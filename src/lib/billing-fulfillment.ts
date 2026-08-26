import { sqlDb } from "@/lib/db/sql-db";
import { sendEmailSafe } from "@/lib/brevo-api";
import { paymentReceiptTemplate } from "@/lib/email-templates";

// ─────────────────────────────────────────────────────────────────────────────
// Client-side payment fulfillment.
//
// The application database lives in the browser (localStorage-backed sqlDb).
// Stripe verification happens server-side (needs STRIPE_SECRET_KEY), but the
// resulting billing/order/insurance updates MUST be applied here on the client,
// otherwise they are written into the server's throwaway memory copy and the
// UI never sees them.
//
// This module is IDEMPOTENT: repeated calls for the same paymentIntentId
// (webhook retries, page refreshes with ?checkout_session_id=…, double clicks)
// never create duplicate bills or payments and never deduct stock twice.
// ─────────────────────────────────────────────────────────────────────────────

export type PaymentFulfillmentInput = {
  paymentIntentId: string;
  amountTotal: number;
  patientId?: string;
  billId?: string;
  invoiceNo?: string;
  orderId?: string;
  orderNo?: string;
  policyId?: string;
  description?: string;
  paymentMethod?: string;
};

export type PaymentFulfillmentResult = {
  applied: boolean;
  alreadyProcessed: boolean;
  paymentIntentId: string;
  amountTotal: number;
  billId?: string | null;
  orderId?: string | null;
  orderNo?: string | null;
  policyId?: string | null;
};

export async function isPaymentAlreadyProcessed(paymentIntentId: string): Promise<boolean> {
  if (!paymentIntentId) return false;
  const { data } = await sqlDb
    .from("payments")
    .select("id")
    .eq("transaction_id", paymentIntentId)
    .maybeSingle();
  return Boolean(data);
}

export async function applyPaymentFulfillment(
  input: PaymentFulfillmentInput
): Promise<PaymentFulfillmentResult> {
  const {
    paymentIntentId,
    amountTotal,
    patientId,
    billId,
    invoiceNo,
    orderId,
    orderNo,
    policyId,
    description,
    paymentMethod = "Stripe",
  } = input;

  // 1. Idempotency guard — a payments row keyed by the Stripe transaction id.
  if (await isPaymentAlreadyProcessed(paymentIntentId)) {
    const { data: existing } = await sqlDb
      .from("payments")
      .select("bill_id")
      .eq("transaction_id", paymentIntentId)
      .maybeSingle();
    return {
      applied: false,
      alreadyProcessed: true,
      paymentIntentId,
      amountTotal,
      billId: existing?.bill_id ?? null,
      orderId: orderId ?? null,
      orderNo: orderNo ?? null,
      policyId: policyId ?? null,
    };
  }

  // 2. Finalize the order (if this payment was for a Medical Store order) and
  //    deduct inventory exactly once (guarded by step 1).
  let targetOrder: any = null;
  if (orderId || orderNo) {
    const query = sqlDb.from("orders").select("*, order_items(*)");
    const { data } = orderId
      ? await query.eq("id", orderId).maybeSingle()
      : await query.eq("order_no", orderNo).maybeSingle();
    targetOrder = data;
  }

  if (targetOrder && String(targetOrder.payment_status).toLowerCase() !== "paid") {
    await sqlDb
      .from("orders")
      .update({ payment_status: "Paid", status: "Preparing" })
      .eq("id", targetOrder.id);

    for (const item of targetOrder.order_items ?? []) {
      if (!item.product_id || !(item.quantity > 0)) continue;
      const { data: prod } = await sqlDb
        .from("products")
        .select("id, stock")
        .eq("id", item.product_id)
        .maybeSingle();
      if (prod) {
        await sqlDb
          .from("products")
          .update({ stock: Math.max(0, (prod.stock ?? 0) - item.quantity) })
          .eq("id", prod.id);
      }
    }
  }

  // 3. Locate the matching bill — by explicit id, invoice number, or the
  //    INV-<orderNo> convention used by store checkout.
  let targetBill: any = null;
  if (billId) {
    targetBill = (await sqlDb.from("bills").select("*").eq("id", billId).maybeSingle()).data;
  }
  if (!targetBill && invoiceNo) {
    targetBill = (await sqlDb.from("bills").select("*").eq("invoice_no", invoiceNo).maybeSingle()).data;
  }
  if (!targetBill && (orderNo || targetOrder?.order_no)) {
    const effectiveOrderNo = orderNo || targetOrder.order_no;
    const expectedInv = `INV-${String(effectiveOrderNo).replace("ORD-", "")}`;
    targetBill = (await sqlDb.from("bills").select("*").eq("invoice_no", expectedInv).maybeSingle()).data;
  }
  if (!targetBill && targetOrder?.bill_id) {
    targetBill = (await sqlDb.from("bills").select("*").eq("id", targetOrder.bill_id).maybeSingle()).data;
  }

  let finalBillId: string | null | undefined = billId || targetBill?.id;
  let finalPatientId: string | undefined =
    patientId || targetOrder?.user_id || targetBill?.patient_id;

  // 4. Mark the existing bill Paid (or create one when the payment had no
  //    pre-existing bill — e.g. legacy direct payments). Never duplicate: the
  //    create branch only runs when no bill matched any lookup above.
  if (targetBill) {
    finalBillId = targetBill.id;
    finalPatientId = targetBill.patient_id || finalPatientId;
    if (String(targetBill.status).toLowerCase() !== "paid") {
      await sqlDb
        .from("bills")
        .update({
          status: "Paid",
          paid_at: new Date().toISOString(),
          payment_method: paymentMethod,
        })
        .eq("id", targetBill.id);
    }
  } else if (finalPatientId) {
    const createdInvoiceNo =
      invoiceNo ||
      (orderNo || targetOrder?.order_no
        ? `INV-${String(orderNo || targetOrder.order_no).replace("ORD-", "")}`
        : `INV-${Date.now().toString(36).toUpperCase()}`);
    const { data: createdBill } = await sqlDb
      .from("bills")
      .insert({
        patient_id: finalPatientId,
        invoice_no: createdInvoiceNo,
        category: policyId ? "Insurance" : orderNo || targetOrder ? "Medical Store" : "Healthcare",
        description:
          description ||
          (orderNo || targetOrder?.order_no
            ? `Medical Store Order #${orderNo || targetOrder.order_no}`
            : "Healthcare Payment"),
        amount: amountTotal || targetOrder?.total || 0,
        status: "Paid",
        paid_at: new Date().toISOString(),
        payment_method: paymentMethod,
      })
      .select()
      .maybeSingle();
    if (createdBill) {
      targetBill = createdBill;
      finalBillId = createdBill.id;
    }
  }

  // 5. Activate the insurance policy when applicable.
  if (policyId) {
    const startDate = new Date().toISOString().split("T")[0];
    const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    await sqlDb
      .from("insurance_policies")
      .update({
        status: "Active",
        payment_status: "Paid",
        start_date: startDate,
        end_date: endDate,
      })
      .eq("id", policyId);

    const { data: updatedPolicy } = await sqlDb
      .from("insurance_policies")
      .select("*")
      .eq("id", policyId)
      .maybeSingle();
    const notifyUserId = finalPatientId || updatedPolicy?.user_id;
    if (notifyUserId) {
      await sqlDb.from("notifications").insert({
        user_id: notifyUserId,
        title: `Insurance Plan Activated (${updatedPolicy?.policy_number ?? policyId})`,
        message: `Your payment of ₱${Number(amountTotal || updatedPolicy?.premium_amount || 0).toLocaleString(
          "en-PH",
          { minimumFractionDigits: 2 }
        )} was verified. Your policy is now Active!`,
        kind: "system",
      });
    }
  } else if (
    targetBill &&
    (targetBill.category === "Insurance" || String(targetBill.description ?? "").toLowerCase().includes("insurance"))
  ) {
    const targetUserId = finalPatientId || targetBill.patient_id;
    if (targetUserId) {
      await sqlDb
        .from("insurance_policies")
        .update({ status: "Active", payment_status: "Paid" })
        .eq("user_id", targetUserId)
        .or("status.eq.Pending Payment,status.eq.pending_payment,status.eq.Pending,status.eq.pending");
    }
  }

  // 6. Persist the canonical payment record (Stripe transaction reference).
  const payingUserId = finalPatientId || (await sqlDb.auth.getUser()).data.user?.id;
  if (payingUserId) {
    await sqlDb.from("payments").insert({
      user_id: payingUserId,
      bill_id: finalBillId || null,
      amount: amountTotal || targetOrder?.total || targetBill?.amount || 0,
      description:
        description ||
        (orderNo || targetOrder?.order_no
          ? `Medical Store Order #${orderNo || targetOrder.order_no}`
          : targetBill?.description || `${paymentMethod} Payment`),
      method: paymentMethod,
      status: "Paid",
      transaction_id: paymentIntentId,
    });

    const confirmedOrderNo = orderNo || targetOrder?.order_no;
    if (confirmedOrderNo) {
      await sqlDb.from("notifications").insert({
        user_id: payingUserId,
        title: `Order #${confirmedOrderNo} Paid & Confirmed`,
        message: `Your payment of ₱${Number(amountTotal || targetOrder?.total || 0).toLocaleString("en-PH", {
          minimumFractionDigits: 2,
        })} for Medical Store order #${confirmedOrderNo} was confirmed. Your order is now being prepared.`,
        kind: "order",
      });
    }
  }

  // 7. Fire-and-forget payment receipt email — never blocks or fails fulfillment.
  const receiptUserId = payingUserId;
  if (receiptUserId) {
    try {
      const { data: profile } = await sqlDb
        .from("profiles")
        .select("email, name")
        .eq("id", receiptUserId)
        .maybeSingle();
      if (profile?.email) {
        const receiptAmount =
          amountTotal || targetOrder?.total || targetBill?.amount || 0;
        const content = paymentReceiptTemplate({
          patientName: profile.name,
          kind: policyId ? "insurance" : orderNo || targetOrder?.order_no ? "order" : "bill",
          title:
            description ||
            (orderNo || targetOrder?.order_no
              ? `Medical Store Order #${orderNo || targetOrder.order_no}`
              : targetBill?.description || `${paymentMethod} Payment`),
          amount: receiptAmount,
          reference: paymentIntentId || undefined,
        });
        await sendEmailSafe({
          to: profile.email,
          toName: profile.name || undefined,
          subject: content.subject,
          html: content.html,
          text: content.text,
        });
      }
    } catch (err: any) {
      console.error("[Email] payment receipt notification failed:", err?.message);
    }
  }

  return {
    applied: true,
    alreadyProcessed: false,
    paymentIntentId,
    amountTotal,
    billId: finalBillId ?? null,
    orderId: targetOrder?.id || orderId || null,
    orderNo: targetOrder?.order_no || orderNo || null,
    policyId: policyId ?? null,
  };
}
