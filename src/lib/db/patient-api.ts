import { sqlDb } from "@/lib/db/sql-db";
import {
  ensureEncounterForAppointment,
  syncPatientEncountersAndAppointments,
} from "./encounter-sync";
import { sendEmailSafe } from "@/lib/brevo-api";
import { sendInfobipSmsSafe } from "@/lib/infobip-api";
import { appointmentBookedTemplate, appointmentBookedSmsText } from "@/lib/email-templates";

type Ok<T> = { data: T; error?: undefined };
type Fail = { data?: undefined; error: string };
type Result<T> = Ok<T> | Fail;

function ok<T>(data: T): Result<T> {
  return { data };
}
function fail(error: string): Result<never> {
  return { error };
}

function fmtDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function fmtShortDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data } = await sqlDb.auth.getUser();
    if (data.user?.id) return data.user.id;
  } catch {}
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("sugbodoc_user") : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.id) return parsed.id;
    }
  } catch {}
  return null;
}

function mapProfile(row: any) {
  return {
    id: row.id,
    email: row.email ?? "",
    name: row.name ?? "",
    dob: row.dob ?? "",
    bloodType: row.blood_type ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    sex: row.sex ?? "",
    allergies: row.allergies ?? [],
    emergencyContactName: row.emergency_contact_name ?? "",
    emergencyContactRelation: row.emergency_contact_relation ?? "",
    emergencyContactPhone: row.emergency_contact_phone ?? "",
  };
}

function mapAppointment(row: any) {
  return {
    id: row.id,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name ?? "",
    specialty: row.department ?? "",
    clinic: row.clinic ?? "",
    appointmentDate: fmtDate(row.appointment_date),
    appointmentTime: row.appointment_time ?? "",
    status: row.status ?? "Pending",
  };
}

function mapBill(
  row: any,
  extra?: {
    matchingOrder?: any;
    matchingPayment?: any;
    branchName?: string;
  },
) {
  const matchingOrder = extra?.matchingOrder;
  const matchingPayment = extra?.matchingPayment;
  const branchName = extra?.branchName;

  const items: Array<{ desc: string; qty: number; unitPrice: number; total: number }> = [];
  if (
    matchingOrder?.order_items &&
    Array.isArray(matchingOrder.order_items) &&
    matchingOrder.order_items.length > 0
  ) {
    for (const item of matchingOrder.order_items) {
      items.push({
        desc: `${item.product_name}${item.brand ? ` (${item.brand})` : ""}`,
        qty: Number(item.quantity ?? 1),
        unitPrice: Number(item.unit_price ?? 0),
        total: Number(item.line_total ?? Number(item.quantity ?? 1) * Number(item.unit_price ?? 0)),
      });
    }
  } else {
    items.push({
      desc: row.description || "Healthcare Services",
      qty: 1,
      unitPrice: Number(row.amount ?? 0),
      total: Number(row.amount ?? 0),
    });
  }

  const deliveryFee = Number(matchingOrder?.delivery_fee ?? 0);
  const subtotal = Number(matchingOrder?.subtotal ?? Number(row.amount ?? 0) - deliveryFee);

  return {
    id: row.id,
    invoiceNo: row.invoice_no,
    description: row.description ?? "",
    amount: Number(row.amount ?? 0),
    status: row.status,
    category: row.category ?? (matchingOrder ? "Medical Store" : "Healthcare"),
    dueDate: row.due_date,
    paidAt: row.paid_at || matchingPayment?.created_at,
    createdAt: row.created_at,
    paymentMethod:
      row.payment_method ||
      matchingPayment?.method ||
      (row.status === "Paid" ? "Stripe" : undefined),
    orderNo: matchingOrder?.order_no,
    orderId: matchingOrder?.id,
    stripePaymentIntentId: matchingPayment?.transaction_id,
    transactionId: matchingPayment?.transaction_id,
    pickupBranch: branchName || matchingOrder?.pickup_branch,
    deliveryAddress: matchingOrder?.delivery_address,
    fulfillmentType: matchingOrder?.fulfillment_type,
    details: {
      orderNo: matchingOrder?.order_no,
      pickupBranch: branchName || matchingOrder?.pickup_branch,
      deliveryAddress: matchingOrder?.delivery_address,
      deliveryFee,
      subtotal,
      items,
    },
  };
}

function mapMessage(row: any) {
  return {
    id: row.id,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name ?? "",
    specialty: row.specialty ?? "",
    sender: row.sender,
    text: row.text ?? undefined,
    fileName: row.file_name ?? undefined,
    createdAt: row.created_at,
    read: row.read,
  };
}

async function buildEncounterRecords(patientId: string, encounterId?: string) {
  await syncPatientEncountersAndAppointments(patientId);

  let encQuery = sqlDb
    .from("encounters")
    .select("*")
    .eq("patient_id", patientId)
    .order("encounter_date", { ascending: false });
  if (encounterId) encQuery = encQuery.eq("id", encounterId);
  const { data: encounters, error: encError } = await encQuery;
  if (encError) throw new Error(encError.message);

  const encounterIds = (encounters ?? []).map((e: any) => e.id);
  const [soap, vitals, diagnoses, prescriptions, labs, imaging, procedures] = await Promise.all([
    encounterIds.length
      ? sqlDb.from("soap_notes").select("*").in("encounter_id", encounterIds)
      : Promise.resolve({ data: [], error: null } as any),
    encounterIds.length
      ? sqlDb.from("vital_signs").select("*").in("encounter_id", encounterIds)
      : Promise.resolve({ data: [], error: null } as any),
    encounterIds.length
      ? sqlDb.from("encounter_diagnoses").select("*").in("encounter_id", encounterIds)
      : Promise.resolve({ data: [], error: null } as any),
    encounterId
      ? sqlDb.from("prescriptions").select("*").eq("encounter_id", encounterId)
      : sqlDb.from("prescriptions").select("*").eq("patient_id", patientId),
    encounterId
      ? sqlDb.from("lab_results").select("*").eq("encounter_id", encounterId)
      : sqlDb.from("lab_results").select("*").eq("patient_id", patientId),
    encounterId
      ? sqlDb.from("imaging_records").select("*").eq("encounter_id", encounterId)
      : sqlDb.from("imaging_records").select("*").eq("patient_id", patientId),
    encounterIds.length
      ? sqlDb.from("procedures").select("*").in("encounter_id", encounterIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  const records: Array<Record<string, any>> = [];

  for (const enc of encounters ?? []) {
    records.push({
      id: enc.id,
      kind: "encounter",
      data: {
        date: fmtDate(enc.encounter_date),
        doctor: enc.doctor_name ?? "",
        specialty: enc.department ?? "",
        clinic: enc.department ?? "",
        complaint: enc.chief_complaint ?? enc.summary ?? "",
        summary: enc.summary ?? enc.treatment_provided ?? "",
        status: enc.status,
      },
    });
  }
  for (const s of soap.data ?? []) {
    const enc = (encounters ?? []).find((e: any) => e.id === s.encounter_id);
    records.push({
      id: s.id,
      kind: "soap",
      encounterRef: s.encounter_id,
      data: {
        id: s.id,
        date: fmtDate(s.created_at),
        doctor: enc?.doctor_name ?? "",
        text: `S: ${s.subjective ?? ""} / O: ${s.objective ?? ""} / A: ${s.assessment ?? ""} / P: ${s.plan ?? ""}`,
      },
    });
  }
  for (const v of vitals.data ?? []) {
    const bp = String(v.blood_pressure ?? "").split("/");
    records.push({
      id: v.id,
      kind: "vital",
      encounterRef: v.encounter_id,
      data: {
        date: fmtShortDate(v.recorded_at),
        systolic: Number(bp[0]) || null,
        diastolic: Number(bp[1]) || null,
        hr: v.heart_rate,
        temp: v.temperature,
        weight: v.weight_kg,
      },
    });
  }
  for (const d of diagnoses.data ?? []) {
    records.push({
      id: d.id,
      kind: "diagnosis",
      encounterRef: d.encounter_id,
      data: {
        code: d.code ?? "",
        desc: d.description,
        date: fmtDate(d.created_at),
        status: d.status,
      },
    });
  }
  for (const p of prescriptions.data ?? []) {
    records.push({
      id: p.id,
      kind: "prescription",
      encounterRef: p.encounter_id,
      data: {
        med: p.drug,
        instruction:
          p.instructions ?? [p.dosage, p.frequency, p.duration].filter(Boolean).join(" · "),
        status: p.status,
      },
    });
  }
  for (const l of labs.data ?? []) {
    records.push({
      id: l.id,
      kind: "lab",
      encounterRef: l.encounter_id,
      data: {
        test: l.test_name,
        value: l.result ?? "",
        range: l.reference_range ?? "",
        status: l.status,
        date: fmtDate(l.resulted_at),
      },
    });
  }
  for (const im of imaging.data ?? []) {
    records.push({
      id: im.id,
      kind: "imaging",
      encounterRef: im.encounter_id,
      data: {
        type: im.modality,
        date: fmtDate(im.taken_at),
        orderedBy: "",
        facility: im.body_part ?? "",
        status: "Completed",
        findings: im.findings ?? "",
        impression: im.impression ?? "",
        recommendation: null,
        reportGeneratedDate: fmtDate(im.taken_at),
        images: im.image_url ? [{ label: "Image", src: im.image_url }] : [],
      },
    });
  }
  for (const pr of procedures.data ?? []) {
    records.push({
      id: pr.id,
      kind: "procedure",
      encounterRef: pr.encounter_id,
      data: {
        name: pr.name,
        code: pr.code ?? "",
        notes: pr.notes ?? "",
        date: fmtDate(pr.performed_at),
      },
    });
  }

  return { encounters: encounters ?? [], records };
}

export const patientApi = {
  getPatientProfile: async () => {
    const uid = await getCurrentUserId();
    if (!uid) return fail("You must be signed in.");
    try {
      const { data, error } = await sqlDb.from("profiles").select("*").eq("id", uid).maybeSingle();
      if (error) return fail(error.message);
      if (data) {
        const mapped = mapProfile(data);
        return ok({
          ...mapped,
          user: mapped,
        });
      }

      // Fallback to auth metadata if profile row isn't yet created
      const { data: authData } = await sqlDb.auth.getUser();
      if (authData.user) {
        const fallback = {
          id: authData.user.id,
          email: authData.user.email ?? "",
          name:
            (authData.user.user_metadata?.name as string) ??
            authData.user.email?.split("@")[0] ??
            "Patient",
          dob: "",
          bloodType: "",
          phone: (authData.user.user_metadata?.phone as string) ?? "",
          address: "",
          sex: "",
          allergies: [] as string[],
          emergencyContactName: "",
          emergencyContactRelation: "",
          emergencyContactPhone: "",
        };
        return ok({
          ...fallback,
          user: fallback,
        });
      }

      // Fallback to stored user in localStorage
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem("sugbodoc_user") : null;
        if (raw) {
          const parsed = JSON.parse(raw);
          const fallback = {
            id: parsed.id ?? uid,
            email: parsed.email ?? "",
            name: parsed.name ?? "Patient",
            dob: parsed.dob ?? "",
            bloodType: parsed.bloodType ?? "",
            phone: parsed.phone ?? "",
            address: parsed.address ?? "",
            sex: parsed.sex ?? "",
            allergies: (parsed.allergies as string[]) ?? [],
            emergencyContactName: parsed.emergencyContactName ?? "",
            emergencyContactRelation: parsed.emergencyContactRelation ?? "",
            emergencyContactPhone: parsed.emergencyContactPhone ?? "",
          };
          return ok({
            ...fallback,
            user: fallback,
          });
        }
      } catch {}

      return fail("Profile not found.");
    } catch (err) {
      return fail(err instanceof Error ? err.message : "Failed to load patient profile.");
    }
  },

  getProfile: async () => {
    const res = await patientApi.getPatientProfile();
    if (res.error) return fail(res.error);
    return ok({ user: res.data?.user || res.data });
  },

  updateProfile: async (profile: Record<string, unknown>) => {
    const uid = await getCurrentUserId();
    if (!uid) return fail("You must be signed in.");
    const update: Record<string, any> = {};
    const { safeParseDate } = await import("@/lib/date-utils");
    const { normalizeToE164 } = await import("@/lib/phone");

    // dob — accept only empty (→ null) or a parseable date (→ YYYY-MM-DD);
    // anything else is rejected with a traceable log instead of poisoning the
    // profiles.dob column (which previously caused "Invalid time value" on render).
    if ("dob" in profile) {
      const rawDob = typeof profile.dob === "string" ? profile.dob.trim() : profile.dob;
      if (!rawDob) {
        update.dob = null;
      } else {
        const parsed = safeParseDate(rawDob);
        if (parsed) {
          update.dob = parsed.toISOString().slice(0, 10);
        } else {
          console.warn("[Profile] invalid dob rejected:", profile.dob);
          return fail(
            `"${String(profile.dob)}" is not a valid date of birth. Use the date picker (YYYY-MM-DD).`,
          );
        }
      }
    }

    // phone — store canonical E.164 (+639…) so every SMS consumer (Infobip)
    // receives a consistent, directly usable value.
    if ("phone" in profile) {
      const rawPhone = typeof profile.phone === "string" ? profile.phone.trim() : "";
      if (!rawPhone) {
        update.phone = null;
      } else {
        const e164 = normalizeToE164(rawPhone);
        if (e164) {
          update.phone = e164;
        } else {
          console.warn("[Profile] invalid phone rejected:", profile.phone);
          update.phone = rawPhone;
        }
      }
    }

    if ("name" in profile) update.name = profile.name;
    if ("bloodType" in profile) update.blood_type = profile.bloodType;
    if ("address" in profile) update.address = profile.address;
    if ("sex" in profile) update.sex = profile.sex;
    if ("allergies" in profile) update.allergies = profile.allergies;
    if ("emergencyContactName" in profile)
      update.emergency_contact_name = profile.emergencyContactName;
    if ("emergencyContactRelation" in profile)
      update.emergency_contact_relation = profile.emergencyContactRelation;
    if ("emergencyContactPhone" in profile)
      update.emergency_contact_phone = profile.emergencyContactPhone;

    const { data, error } = await sqlDb
      .from("profiles")
      .update(update as never)
      .eq("id", uid)
      .select("*")
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Profile not found.");
    return ok({ user: mapProfile(data) });
  },

  getAppointments: async () => {
    const uid = await getCurrentUserId();
    if (!uid) return fail("You must be signed in.");
    const { data, error } = await sqlDb
      .from("appointments")
      .select("*")
      .eq("patient_id", uid)
      .order("appointment_date", { ascending: false });
    if (error) return fail(error.message);
    return ok({ appointments: (data ?? []).map(mapAppointment) });
  },

  createAppointment: async (appointment: {
    doctorId: string;
    doctorName: string;
    specialty: string;
    clinic: string;
    appointmentDate: string;
    appointmentTime: string;
  }) => {
    const uid = await getCurrentUserId();
    if (!uid) return fail("You must be signed in.");
    const { data, error } = await sqlDb
      .from("appointments")
      .insert({
        patient_id: uid,
        doctor_id: appointment.doctorId || null,
        doctor_name: appointment.doctorName,
        department: appointment.specialty,
        clinic: appointment.clinic,
        appointment_date: appointment.appointmentDate,
        appointment_time: appointment.appointmentTime,
        status: "Pending",
      })
      .select("*")
      .single();
    if (error) return fail(error.message);
    await ensureEncounterForAppointment(data);

    // Fire-and-forget confirmation email — never blocks or fails the booking.
    let email: { sent: boolean; reason?: string } = { sent: false, reason: "Skipped" };
    let sms: { sent: boolean; reason?: string } = { sent: false, reason: "Skipped" };
    try {
      const { data: profile } = await sqlDb
        .from("profiles")
        .select("email, name, phone")
        .eq("id", uid)
        .maybeSingle();
      if (profile?.email) {
        const content = appointmentBookedTemplate({
          patientName: profile.name,
          doctorName: appointment.doctorName,
          department: appointment.specialty,
          clinic: appointment.clinic,
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.appointmentTime,
        });
        email = await sendEmailSafe({
          to: profile.email,
          toName: profile.name || undefined,
          subject: content.subject,
          html: content.html,
          text: content.text,
        });
      } else {
        email = { sent: false, reason: "Patient profile has no email address." };
      }

      // Fire-and-forget confirmation SMS via Infobip — same non-blocking rules.
      const { normalizeToE164 } = await import("@/lib/phone");
      const toPhone = normalizeToE164(profile?.phone);
      if (toPhone) {
        const smsResult = await sendInfobipSmsSafe({
          to: toPhone,
          body: appointmentBookedSmsText({
            patientName: profile?.name,
            doctorName: appointment.doctorName,
            department: appointment.specialty,
            clinic: appointment.clinic,
            appointmentDate: appointment.appointmentDate,
            appointmentTime: appointment.appointmentTime,
          }),
        });
        sms = {
          sent: smsResult.success,
          ...(smsResult.success ? {} : { reason: smsResult.error }),
        };
      } else {
        sms = { sent: false, reason: "Patient profile has no phone number." };
      }
    } catch (err: any) {
      console.error("[Booking notification] failed:", err?.message);
      if (email.sent === false && email.reason === "Skipped")
        email = { sent: false, reason: err?.message };
      sms = { sent: false, reason: err?.message };
    }

    return ok({ appointment: mapAppointment(data), email, sms });
  },

  cancelAppointment: async (id: string) => {
    const uid = await getCurrentUserId();
    if (!uid) return fail("You must be signed in.");
    const { data, error } = await sqlDb
      .from("appointments")
      .update({ status: "Cancelled" })
      .eq("id", id)
      .eq("patient_id", uid)
      .select("*")
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Appointment not found");
    return ok({ appointment: mapAppointment(data) });
  },

  confirmAppointment: async (id: string) => {
    const { adminApi } = await import("./admin-api");
    return adminApi.updateAdminAppointmentStatus(id, "Confirmed");
  },

  getAccountData: async () => {
    const uid = await getCurrentUserId();
    if (!uid) return fail("You must be signed in.");
    try {
      const [
        profileRes,
        apptRes,
        billsRes,
        messagesRes,
        recordsRes,
        queueRes,
        ordersRes,
        paymentsRes,
        branchesRes,
      ] = await Promise.all([
        sqlDb.from("profiles").select("*").eq("id", uid).maybeSingle(),
        sqlDb
          .from("appointments")
          .select("*")
          .eq("patient_id", uid)
          .order("appointment_date", { ascending: false }),
        sqlDb
          .from("bills")
          .select("*")
          .eq("patient_id", uid)
          .order("created_at", { ascending: false }),
        sqlDb
          .from("messages")
          .select("*")
          .eq("patient_id", uid)
          .order("created_at", { ascending: true }),
        buildEncounterRecords(uid),
        patientApi.getQueue(),
        sqlDb
          .from("orders")
          .select("*, order_items(*)")
          .eq("user_id", uid)
          .order("created_at", { ascending: false }),
        sqlDb
          .from("payments")
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: false }),
        sqlDb.from("store_branches").select("id, name, location"),
      ]);
      if (profileRes.error) return fail(profileRes.error.message);
      if (apptRes.error) return fail(apptRes.error.message);
      if (billsRes.error) return fail(billsRes.error.message);
      if (messagesRes.error) return fail(messagesRes.error.message);

      const branchesMap = new Map<string, string>();
      for (const branch of branchesRes.data ?? []) {
        branchesMap.set(branch.id, branch.name);
      }

      const orders = ordersRes.data ?? [];
      const payments = paymentsRes.data ?? [];
      const bills = billsRes.data ?? [];

      // Reconcile unbilled orders (if any store order exists without a bill, create it)
      const existingBillInvoices = new Set(bills.map((b) => b.invoice_no));
      const existingBillDescriptions = new Set(bills.map((b) => b.description || ""));

      for (const order of orders) {
        const expectedInvoiceNo = `INV-${order.order_no.replace("ORD-", "")}`;
        const hasBill =
          existingBillInvoices.has(expectedInvoiceNo) ||
          Array.from(existingBillDescriptions).some((d) => d.includes(order.order_no));

        if (!hasBill) {
          const isPaid = order.payment_status === "Paid";
          const { data: newBill } = await sqlDb
            .from("bills")
            .insert({
              patient_id: uid,
              invoice_no: expectedInvoiceNo,
              category: "Medical Store",
              description: `Medical Store Order #${order.order_no}`,
              amount: Number(order.total ?? 0),
              status: isPaid ? "Paid" : order.payment_status || "Pending",
              due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              paid_at: isPaid
                ? order.received_at || order.created_at || new Date().toISOString()
                : null,
              payment_method: isPaid ? "Stripe" : null,
            })
            .select()
            .maybeSingle();

          if (newBill) {
            bills.push(newBill);
            existingBillInvoices.add(newBill.invoice_no);
            if (newBill.description) existingBillDescriptions.add(newBill.description);

            if (isPaid) {
              // Ensure payment record exists
              const hasPayment = payments.some(
                (p) => (p.description || "").includes(order.order_no) || p.bill_id === newBill.id,
              );
              if (!hasPayment) {
                const { data: newPayment } = await sqlDb
                  .from("payments")
                  .insert({
                    user_id: uid,
                    bill_id: newBill.id,
                    amount: Number(order.total ?? 0),
                    description: `Medical Store Order #${order.order_no}`,
                    status: "Paid",
                    method: "Stripe",
                    transaction_id: `pi_sync_${order.order_no}`,
                  })
                  .select()
                  .maybeSingle();
                if (newPayment) payments.push(newPayment);
              }
            }
          }
        }
      }

      // Map bills with their matching orders and payments
      const mappedBills = bills.map((bill) => {
        // Find matching order
        const invDigits = (bill.invoice_no || "").replace(/\D/g, "");
        const matchingOrder = orders.find((o) => {
          if (o.order_no && invDigits && o.order_no.replace(/\D/g, "") === invDigits) return true;
          if (bill.description && o.order_no && bill.description.includes(o.order_no)) return true;
          return false;
        });

        // Find matching payment
        const matchingPayment = payments.find((p) => {
          if (p.bill_id && p.bill_id === bill.id) return true;
          if (
            matchingOrder?.order_no &&
            p.description &&
            p.description.includes(matchingOrder.order_no)
          )
            return true;
          if (bill.invoice_no && p.description && p.description.includes(bill.invoice_no))
            return true;
          return false;
        });

        const branchName = matchingOrder?.pickup_branch
          ? branchesMap.get(matchingOrder.pickup_branch) || matchingOrder.pickup_branch
          : undefined;

        return mapBill(bill, { matchingOrder, matchingPayment, branchName });
      });

      return ok({
        profile: profileRes.data ? mapProfile(profileRes.data) : null,
        appointments: (apptRes.data ?? []).map(mapAppointment),
        records: recordsRes.records,
        messages: (messagesRes.data ?? []).map(mapMessage),
        bills: mappedBills,
        queue: queueRes.data?.queue ?? null,
      });
    } catch (err) {
      return fail(err instanceof Error ? err.message : "Failed to load account data.");
    }
  },

  getAccountEncounters: async () => {
    const uid = await getCurrentUserId();
    if (!uid) return fail("You must be signed in.");
    await syncPatientEncountersAndAppointments(uid);
    const { data, error } = await sqlDb
      .from("encounters")
      .select("*")
      .eq("patient_id", uid)
      .order("encounter_date", { ascending: false });
    if (error) return fail(error.message);
    return ok({
      encounters: (data ?? []).map((enc: any) => ({
        id: enc.id,
        date: fmtDate(enc.encounter_date),
        doctor: enc.doctor_name ?? "",
        specialty: enc.department ?? "",
        clinic: enc.department ?? "",
        complaint: enc.chief_complaint ?? enc.summary ?? "",
        summary: enc.summary ?? enc.treatment_provided ?? "",
        status: enc.status,
      })),
    });
  },

  getAccountEncounterRecords: async (encounterId: string) => {
    const uid = await getCurrentUserId();
    if (!uid) return fail("You must be signed in.");
    try {
      const { encounters, records } = await buildEncounterRecords(uid, encounterId);
      const encounter = encounters[0] ?? null;
      return ok({
        encounter: encounter
          ? {
              id: encounter.id,
              date: fmtDate(encounter.encounter_date),
              doctor: encounter.doctor_name ?? "",
              specialty: encounter.department ?? "",
              clinic: encounter.department ?? "",
              complaint: encounter.chief_complaint ?? encounter.summary ?? "",
              summary: encounter.summary ?? encounter.treatment_provided ?? "",
              status: encounter.status,
            }
          : null,
        records: records
          .filter((r) => r.kind !== "encounter")
          .map((r) => ({ id: r.id, type: r.kind, data: r.data })),
      });
    } catch (err) {
      return fail(err instanceof Error ? err.message : "Failed to load encounter records.");
    }
  },

  getQueue: async () => {
    const uid = await getCurrentUserId();
    if (!uid) return fail("You must be signed in.");
    const { data: entries, error } = await sqlDb
      .from("queue_entries")
      .select("*")
      .eq("patient_id", uid)
      .order("checked_in_at", { ascending: false })
      .limit(1);
    if (error) return fail(error.message);
    const entry = entries?.[0];
    if (!entry) return ok({ queue: null });

    let ahead: number | null = null;
    const { count } = await sqlDb
      .from("queue_entries")
      .select("id", { count: "exact", head: true })
      .eq("status", "Waiting")
      .eq("department", entry.department ?? "")
      .lt("checked_in_at", entry.checked_in_at);
    ahead = count ?? null;

    let appointment: { date: string; time: string; doctorName?: string; clinic?: string } | null =
      null;
    if (entry.appointment_id) {
      const { data: appt } = await sqlDb
        .from("appointments")
        .select("*")
        .eq("id", entry.appointment_id)
        .maybeSingle();
      if (appt) {
        appointment = {
          date: fmtDate(appt.appointment_date),
          time: appt.appointment_time,
          doctorName: appt.doctor_name ?? undefined,
          clinic: appt.clinic ?? undefined,
        };
      }
    }

    return ok({
      queue: {
        queueNumber: entry.queue_number,
        estimatedWaitMinutes: entry.estimated_wait_minutes,
        status: entry.status,
        updatedAt: entry.created_at,
        createdAt: entry.created_at,
        ahead,
        currentServingNumber: null,
        appointment,
      },
    });
  },

  sendPatientMessage: async (message: {
    doctorId: string;
    doctorName: string;
    specialty: string;
    text?: string;
    fileName?: string;
  }) => {
    const uid = await getCurrentUserId();
    if (!uid) return fail("You must be signed in.");
    const { data, error } = await sqlDb
      .from("messages")
      .insert({
        patient_id: uid,
        doctor_id: message.doctorId || null,
        doctor_name: message.doctorName,
        specialty: message.specialty,
        sender: "patient",
        text: message.text ?? null,
        file_name: message.fileName ?? null,
        read: true,
      })
      .select("*")
      .single();
    if (error) return fail(error.message);
    return ok({ message: mapMessage(data) });
  },

  getConversationMessages: async (doctorId: string) => {
    const uid = await getCurrentUserId();
    if (!uid) return fail("You must be signed in.");
    const { data, error } = await sqlDb
      .from("messages")
      .select("*")
      .eq("patient_id", uid)
      .eq("doctor_id", doctorId)
      .order("created_at", { ascending: true });
    if (error) return fail(error.message);
    return ok({ messages: (data ?? []).map(mapMessage) });
  },
};
