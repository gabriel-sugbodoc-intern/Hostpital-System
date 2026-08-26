import { createServerFn } from "@tanstack/react-start";
import Stripe from "stripe";
import { sqlDb } from "@/lib/db/sql-db";

// Server-only secrets: loaded strictly from environment (.env), never hardcoded.
// Vite only exposes VITE_* vars to client bundles; STRIPE_SECRET_KEY stays server-side.
const SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const PUBLISHABLE_KEY = process.env.VITE_STRIPE_PUBLISHABLE_KEY || "";

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!SECRET_KEY) {
    throw new Error("Stripe is not configured: missing STRIPE_SECRET_KEY environment variable.");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(SECRET_KEY);
  }
  return stripeClient;
}

export const getStripeConfigServerFn = createServerFn({ method: "GET" }).handler(async () => {
  return {
    provider: "stripe",
    configured: Boolean(SECRET_KEY),
    publishableKey: PUBLISHABLE_KEY,
  };
});

/**
 * Creates a Stripe PaymentIntent for paying a bill, for use with embedded
 * Stripe Elements on the Billing page. Returns ONLY the client secret +
 * intent id; the secret key never leaves the server.
 */
export const createBillPaymentIntentServerFn = createServerFn({ method: "POST" })
  .validator(
    (input: { amount: number; description?: string; billId?: string; invoiceNo?: string }) => input,
  )
  .handler(async (ctx) => {
    const { amount, description, billId, invoiceNo } = ctx.data;

    const { data: authData } = await sqlDb.auth.getUser();
    const userId = authData?.user?.id;
    if (!userId) {
      return { success: false as const, error: "You must be signed in to pay." };
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false as const, error: "Invalid payment amount." };
    }
    const centavos = Math.round(amount * 100);
    // Stripe minimum charge is ₱1.00 in PHP; cap guards against fat-finger input.
    if (centavos < 100 || centavos > 50_000_000_00) {
      return { success: false as const, error: "Amount must be between ₱1.00 and ₱500,000." };
    }

    try {
      const stripe = getStripe();
      const intent = await stripe.paymentIntents.create({
        amount: centavos,
        currency: "php",
        automatic_payment_methods: { enabled: true },
        description: (description || "SugboDoc Healthcare Bill").slice(0, 300),
        metadata: {
          kind: "bill",
          patient_id: userId,
          bill_id: billId || "",
          invoice_no: invoiceNo || "",
        },
      });

      if (!intent.client_secret) {
        return { success: false as const, error: "Stripe did not return a client secret." };
      }

      console.log("[Stripe] PaymentIntent created:", intent.id);
      return {
        success: true as const,
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
        amountTotal: (intent.amount ?? centavos) / 100,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to initialize the Stripe payment.";
      console.error("[Stripe] PaymentIntent creation failed:", message);
      return { success: false as const, error: message };
    }
  });

export const createStripeCheckoutSessionServerFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      amount: number;
      description: string;
      patientId?: string;
      billId?: string;
      orderId?: string;
      policyId?: string;
      invoiceNo?: string;
      orderNo?: string;
      items?: Array<{
        productId: string;
        name: string;
        brand?: string;
        unitPrice: number;
        quantity: number;
        lineTotal: number;
      }>;
      fulfillmentType?: string;
      pickupBranch?: string;
      deliveryAddress?: string;
      deliveryFee?: number;
      subtotal?: number;
      successUrl: string;
      cancelUrl: string;
    }) => input,
  )
  .handler(async (ctx) => {
    const {
      amount,
      description,
      patientId,
      billId,
      orderId,
      policyId,
      invoiceNo,
      orderNo,
      items,
      fulfillmentType,
      pickupBranch,
      deliveryAddress,
      deliveryFee,
      subtotal,
      successUrl,
      cancelUrl,
    } = ctx.data;

    const stripe = getStripe();

    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    if (items && items.length > 0) {
      lineItems = items.map((item) => ({
        price_data: {
          currency: "php",
          product_data: {
            name: `${item.name}${item.brand ? ` (${item.brand})` : ""}`,
          },
          unit_amount: Math.max(100, Math.round(item.unitPrice * 100)),
        },
        quantity: item.quantity,
      }));

      if (deliveryFee && deliveryFee > 0) {
        lineItems.push({
          price_data: {
            currency: "php",
            product_data: {
              name: "Delivery Fee",
            },
            unit_amount: Math.round(deliveryFee * 100),
          },
          quantity: 1,
        });
      }
    } else {
      lineItems = [
        {
          price_data: {
            currency: "php",
            product_data: {
              name: description || "SugboDoc Healthcare Bill",
            },
            unit_amount: Math.max(100, Math.round(amount * 100)), // Amount in PHP centavos (min 100 = 1.00 PHP)
          },
          quantity: 1,
        },
      ];
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${successUrl}${successUrl.includes("?") ? "&" : "?"}checkout_session_id={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: `${cancelUrl}${cancelUrl.includes("?") ? "&" : "?"}checkout_session_id={CHECKOUT_SESSION_ID}&status=cancelled`,
      client_reference_id: billId || orderId || policyId || patientId || undefined,
      metadata: {
        patient_id: patientId || "",
        bill_id: billId || "",
        order_id: orderId || "",
        order_no: orderNo || "",
        invoice_no: invoiceNo || "",
        policy_id: policyId || "",
        fulfillment_type: fulfillmentType || "",
        pickup_branch: pickupBranch || "",
        delivery_address: (deliveryAddress || "").slice(0, 400),
        subtotal: String(subtotal ?? amount),
        delivery_fee: String(deliveryFee ?? 0),
        description: (description || "").slice(0, 400),
      },
    });

    return {
      sessionId: session.id,
      url: session.url,
      paymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : session.id,
    };
  });
async function fulfillPayment({
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
}: {
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
}) {
  // 1. Idempotency Check: check if payment record already exists for this transaction_id
  const { data: existingPayment } = await sqlDb
    .from("payments")
    .select("id, bill_id, status")
    .eq("transaction_id", paymentIntentId)
    .maybeSingle();

  if (existingPayment) {
    return {
      success: true,
      alreadyProcessed: true,
      paymentStatus: "paid",
      paymentIntentId,
      amountTotal,
      billId: existingPayment.bill_id,
      orderId,
      orderNo,
      policyId,
    };
  }

  // 2. Find matching order & order_items
  let targetOrder: any = null;
  if (orderId) {
    const { data } = await sqlDb
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .maybeSingle();
    targetOrder = data;
  } else if (orderNo) {
    const { data } = await sqlDb
      .from("orders")
      .select("*, order_items(*)")
      .eq("order_no", orderNo)
      .maybeSingle();
    targetOrder = data;
  }

  // 3. If order exists and wasn't marked paid yet, finalize order & deduct inventory
  if (targetOrder) {
    await sqlDb
      .from("orders")
      .update({
        payment_status: "Paid",
        status: "Preparing",
      })
      .eq("id", targetOrder.id);

    // Deduct inventory only now upon confirmed payment
    const orderItems = targetOrder.order_items || [];
    for (const item of orderItems) {
      if (item.product_id && item.quantity > 0) {
        const { data: prod } = await sqlDb
          .from("products")
          .select("id, stock")
          .eq("id", item.product_id)
          .maybeSingle();
        if (prod) {
          const updatedStock = Math.max(0, (prod.stock ?? 0) - item.quantity);
          await sqlDb.from("products").update({ stock: updatedStock }).eq("id", prod.id);
        }
      }
    }
  }

  // 4. Find or update matching bill
  let targetBill: any = null;
  const invoiceId = billId;
  if (invoiceId) {
    const { data } = await sqlDb.from("bills").select("*").eq("id", invoiceId).maybeSingle();
    targetBill = data;
  }
  if (!targetBill && invoiceNo) {
    const { data } = await sqlDb
      .from("bills")
      .select("*")
      .eq("invoice_no", invoiceNo)
      .maybeSingle();
    targetBill = data;
  }
  if (!targetBill && orderNo) {
    const expectedInv = `INV-${orderNo.replace("ORD-", "")}`;
    const { data } = await sqlDb
      .from("bills")
      .select("*")
      .eq("invoice_no", expectedInv)
      .maybeSingle();
    targetBill = data;
  }

  let finalBillId = invoiceId || targetBill?.id;
  let finalPatientId = patientId || targetOrder?.user_id || targetBill?.patient_id;

  // Resolve the paying user up-front (previously computed below, which caused a
  // temporal-dead-zone ReferenceError when the insurance branch referenced it).
  const insertUserId = finalPatientId || (await sqlDb.auth.getUser()).data.user?.id || undefined;

  if (targetBill) {
    finalBillId = targetBill.id;
    finalPatientId = targetBill.patient_id || finalPatientId;
    // Idempotency: never downgrade an already-paid bill.
    if (String(targetBill.status).toLowerCase() === "paid") {
      return {
        success: true,
        alreadyProcessed: true,
        paymentStatus: "paid",
        paymentIntentId,
        amountTotal,
        billId: targetBill.id,
        orderId: targetOrder?.id || orderId,
        orderNo: targetOrder?.order_no || orderNo,
        policyId,
      };
    }
    await sqlDb
      .from("bills")
      .update({
        status: "Paid",
        paid_at: new Date().toISOString(),
        payment_method: paymentMethod,
      })
      .eq("id", targetBill.id);
  } else if (finalPatientId) {
    const billInvoiceNo =
      invoiceNo ||
      (orderNo
        ? `INV-${orderNo.replace("ORD-", "")}`
        : `INV-${Date.now().toString(36).toUpperCase()}`);
    const { data: createdBill } = await sqlDb
      .from("bills")
      .insert({
        patient_id: finalPatientId,
        invoice_no: billInvoiceNo,
        category: policyId ? "Insurance" : orderId || orderNo ? "Medical Store" : "Healthcare",
        description:
          description || (orderNo ? `Medical Store Order #${orderNo}` : "Healthcare Payment"),
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

  // 5. Update Insurance Policy (if applicable)
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
      .select("*, insurance_plans(name, provider)")
      .eq("id", policyId)
      .maybeSingle();

    if (updatedPolicy && (finalPatientId || insertUserId)) {
      const targetUser = finalPatientId || insertUserId;
      await sqlDb.from("notifications").insert({
        user_id: targetUser,
        title: `Insurance Plan Activated (${updatedPolicy.policy_number})`,
        message: `Your payment of ₱${Number(amountTotal || updatedPolicy.premium_amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })} for ${updatedPolicy.plan_name || updatedPolicy.insurance_plans?.name || "Health Coverage"} was verified. Your policy is now Active!`,
        kind: "system",
      });
    }
  } else if (
    targetBill &&
    (targetBill.category === "Insurance" ||
      targetBill.description?.toLowerCase().includes("insurance"))
  ) {
    const targetUserId = finalPatientId || targetBill.patient_id;
    if (targetUserId) {
      await sqlDb
        .from("insurance_policies")
        .update({
          status: "Active",
          payment_status: "Paid",
        })
        .eq("user_id", targetUserId)
        .or(
          "status.eq.Pending Payment,status.eq.pending_payment,status.eq.Pending,status.eq.pending",
        );
    }
  }

  // 6. Insert Payment record
  if (insertUserId) {
    await sqlDb.from("payments").insert({
      user_id: insertUserId,
      bill_id: finalBillId || null,
      amount: amountTotal || targetOrder?.total || targetBill?.amount || 0,
      description:
        description ||
        (orderNo
          ? `Medical Store Order #${orderNo}`
          : targetBill?.description || `${paymentMethod} Payment`),
      method: paymentMethod,
      status: "Paid",
      transaction_id: paymentIntentId,
    });

    // Insert notification for patient
    const confirmedOrderNo = orderNo || targetOrder?.order_no;
    if (confirmedOrderNo) {
      await sqlDb.from("notifications").insert({
        user_id: insertUserId,
        title: `Order #${confirmedOrderNo} Paid & Confirmed`,
        message: `Your payment of ₱${Number(amountTotal || targetOrder?.total || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })} for Medical Store order #${confirmedOrderNo} was confirmed. Your order is now being prepared.`,
        kind: "order",
      });
    }
  }

  return {
    success: true,
    alreadyProcessed: false,
    paymentStatus: "paid",
    paymentIntentId,
    amountTotal,
    billId: finalBillId,
    orderId: targetOrder?.id || orderId,
    orderNo: targetOrder?.order_no || orderNo,
    policyId,
  };
}

export const processDirectStripePaymentServerFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      amount: number;
      orderId?: string;
      orderNo?: string;
      billId?: string;
      invoiceNo?: string;
      patientId?: string;
      description?: string;
    }) => input,
  )
  .handler(async (ctx) => {
    const { amount, orderId, orderNo, billId, invoiceNo, patientId, description } = ctx.data;

    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false as const, error: "Invalid payment amount." };
    }

    try {
      const stripe = getStripe();
      const pi = await stripe.paymentIntents.create({
        amount: Math.max(100, Math.round(amount * 100)),
        currency: "php",
        payment_method: "pm_card_visa", // Stripe test payment method (test mode only)
        confirm: true,
        return_url: "https://sugbodoc.ph/billing",
        payment_method_types: ["card"],
        description:
          description ||
          (orderNo ? `Medical Store Order #${orderNo}` : "SugboDoc Medical Store Payment"),
        metadata: {
          order_id: orderId || "",
          order_no: orderNo || "",
          bill_id: billId || "",
          invoice_no: invoiceNo || "",
          patient_id: patientId || "",
        },
      });

      // Only a succeeded PaymentIntent may be fulfilled. Anything else
      // (requires_action, processing, canceled, requires_payment_method) must
      // NOT mark the order/bill paid.
      if (pi.status !== "succeeded") {
        return {
          success: false as const,
          error:
            pi.status === "requires_action"
              ? "Card requires additional authentication. Please use Stripe Checkout instead."
              : `Payment was not completed (status: ${pi.status}).`,
          paymentStatus: pi.status,
          paymentIntentId: pi.id,
        };
      }

      return {
        success: true as const,
        paymentIntentId: pi.id,
        paymentStatus: pi.status,
        amountTotal: (pi.amount_received ?? pi.amount) / 100,
        metadata: {
          patient_id: patientId || "",
          bill_id: billId || "",
          invoice_no: invoiceNo || "",
          order_id: orderId || "",
          order_no: orderNo || "",
          description: description || "",
        },
      };
    } catch (err) {
      // Surface the real Stripe rejection instead of silently faking success.
      const message =
        err instanceof Error
          ? err.message
          : "Stripe rejected the payment. Please try another card or use Stripe Checkout.";
      console.warn("[Stripe] Direct payment failed:", message);
      return { success: false as const, error: message };
    }
  });

/**
 * Read-only verification of a Stripe Checkout session.
 *
 * IMPORTANT: this handler intentionally performs NO database writes. The app's
 * database lives in the browser (localStorage-backed sqlDb); writes performed
 * inside a server function would mutate the server's throwaway in-memory copy
 * and never reach the client. The caller (Billing/Store/Insurance pages)
 * applies fulfillment locally via applyPaymentFulfillment() after verifying
 * here. The webhook route remains the server-side path for a future real DB.
 */
export const verifyStripeSessionServerFn = createServerFn({ method: "POST" })
  .validator((input: { sessionId: string }) => input)
  .handler(async (ctx) => {
    const { sessionId } = ctx.data;
    if (!sessionId) {
      return { success: false as const, error: "Session ID is required." };
    }

    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      return {
        success: true as const,
        sessionId: session.id,
        paymentStatus: session.payment_status, // 'paid' | 'unpaid' | 'no_payment_required'
        sessionStatus: session.status, // 'open' | 'complete' | 'expired'
        paymentIntentId:
          typeof session.payment_intent === "string" ? session.payment_intent : undefined,
        amountTotal: (session.amount_total ?? 0) / 100,
        currency: session.currency ?? "php",
        created: session.created,
        metadata: {
          patient_id: session.metadata?.patient_id || "",
          bill_id: session.metadata?.bill_id || session.metadata?.invoice_id || "",
          invoice_no: session.metadata?.invoice_no || "",
          order_id: session.metadata?.order_id || "",
          order_no: session.metadata?.order_no || "",
          policy_id: session.metadata?.policy_id || "",
          description: session.metadata?.description || "",
        },
      };
    } catch (e) {
      return {
        success: false as const,
        error: e instanceof Error ? e.message : "Error verifying Stripe session",
      };
    }
  });

export async function handleStripeWebhookRequest(request: Request): Promise<Response> {
  try {
    const rawBody = await request.text();
    const sig = request.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripe = getStripe();

    let event: Stripe.Event;

    if (webhookSecret && sig) {
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      } catch (err: any) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return new Response(JSON.stringify({ error: `Webhook Error: ${err.message}` }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    } else {
      try {
        event = JSON.parse(rawBody) as Stripe.Event;
      } catch (err: any) {
        return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`);

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === "paid") {
          const paymentIntentId =
            typeof session.payment_intent === "string" ? session.payment_intent : session.id;
          const amountTotal = (session.amount_total ?? 0) / 100;
          const metadata = session.metadata || {};

          await fulfillPayment({
            paymentIntentId,
            amountTotal,
            patientId: metadata.patient_id,
            billId: metadata.bill_id || metadata.invoice_id,
            invoiceNo: metadata.invoice_no,
            orderId: metadata.order_id,
            orderNo: metadata.order_no,
            policyId: metadata.policy_id,
            description: metadata.description,
            paymentMethod: "Stripe",
          });
        }
        break;
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const metadata = pi.metadata || {};
        const amountTotal = (pi.amount_received ?? pi.amount ?? 0) / 100;

        await fulfillPayment({
          paymentIntentId: pi.id,
          amountTotal,
          patientId: metadata.patient_id,
          billId: metadata.bill_id || metadata.invoice_id,
          invoiceNo: metadata.invoice_no,
          orderId: metadata.order_id,
          orderNo: metadata.order_no,
          policyId: metadata.policy_id,
          description: metadata.description || pi.description || undefined,
          paymentMethod: "Stripe",
        });
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const metadata = pi.metadata || {};
        if (metadata.order_id) {
          await sqlDb
            .from("orders")
            .update({ payment_status: "Failed" })
            .eq("id", metadata.order_id);
        } else if (metadata.order_no) {
          await sqlDb
            .from("orders")
            .update({ payment_status: "Failed" })
            .eq("order_no", metadata.order_no);
        }
        if (metadata.bill_id) {
          await sqlDb.from("bills").update({ status: "Failed" }).eq("id", metadata.bill_id);
        }
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};
        if (metadata.order_id) {
          await sqlDb
            .from("orders")
            .update({ payment_status: "Cancelled", status: "Cancelled" })
            .eq("id", metadata.order_id);
        } else if (metadata.order_no) {
          await sqlDb
            .from("orders")
            .update({ payment_status: "Cancelled", status: "Cancelled" })
            .eq("order_no", metadata.order_no);
        }
        if (metadata.bill_id) {
          await sqlDb.from("bills").update({ status: "Cancelled" }).eq("id", metadata.bill_id);
        }
        break;
      }
      default:
        break;
    }

    return new Response(JSON.stringify({ received: true, event: event.type }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[Stripe Webhook Error]:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Webhook handler failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
