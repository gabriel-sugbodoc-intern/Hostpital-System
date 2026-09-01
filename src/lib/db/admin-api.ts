import { sqlDb } from "@/lib/db/sql-db";
import {
  ensureEncounterForAppointment,
  parseApptIdFromText,
  syncPatientEncountersAndAppointments,
} from "./encounter-sync";
import { sendEmailSafe } from "@/lib/brevo-api";
import { appointmentStatusTemplate } from "@/lib/email-templates";

type Result<T> = { data: T; error?: never } | { data?: never; error: string };

function ok<T>(data: T): Result<T> {
  return { data };
}
function fail(error: string): Result<never> {
  return { error };
}

function matchesSearch(value: string | null | undefined, search: string | undefined) {
  if (!search) return true;
  if (!value) return false;
  return value.toLowerCase().includes(search.toLowerCase());
}

function calcAge(dob: string | null): number | undefined {
  if (!dob) return undefined;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoping helpers — resolves whether the signed-in user is a doctor (scoped)
// or admin (unrestricted).
// ─────────────────────────────────────────────────────────────────────────────

export const CONFIRMED_APPOINTMENT_STATUSES = [
  "Confirmed",
  "Checked In",
  "Waiting",
  "In Progress",
  "Completed",
];

export async function getCurrentDoctor(): Promise<{
  id: string;
  name: string;
  specialty: string;
  user_id?: string | null;
} | null> {
  const { data: authData } = await sqlDb.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return null;

  const { data: roles } = await sqlDb.from("user_roles").select("role").eq("user_id", userId);
  const roleSet = new Set((roles ?? []).map((r) => r.role));
  if (roleSet.has("admin")) return null;
  if (!roleSet.has("doctor")) return null;

  let doctor = (await sqlDb.from("doctors").select("*").eq("user_id", userId).maybeSingle()).data;
  if (!doctor) {
    const profile = (await sqlDb.from("profiles").select("name").eq("id", userId).maybeSingle())
      .data;
    if (profile?.name) {
      doctor = (await sqlDb.from("doctors").select("*").ilike("name", profile.name).maybeSingle())
        .data;
    }
  }

  if (!doctor) return null;
  return {
    id: doctor.id,
    name: doctor.name,
    specialty: doctor.specialty || "General Medicine",
    user_id: doctor.user_id,
  };
}

export async function getCurrentDoctorName(): Promise<string | null> {
  const doc = await getCurrentDoctor();
  return doc?.name ?? null;
}

export async function checkDoctorPatientAccess(
  doctorId: string | null,
  doctorName: string | null,
  patientId: string,
): Promise<{
  authorized: boolean;
  reason?: string;
  hasConfirmedAppointment: boolean;
  hasPendingAppointment: boolean;
  isAssigned: boolean;
  confirmedAppointments: any[];
  pendingAppointments: any[];
}> {
  if (!doctorId && !doctorName) {
    return {
      authorized: false,
      reason: "Doctor identity could not be established.",
      hasConfirmedAppointment: false,
      hasPendingAppointment: false,
      isAssigned: false,
      confirmedAppointments: [],
      pendingAppointments: [],
    };
  }

  const { data: patient } = await sqlDb
    .from("profiles")
    .select("id, name, assigned_doctor")
    .eq("id", patientId)
    .maybeSingle();
  if (!patient) {
    return {
      authorized: false,
      reason: "Patient profile not found.",
      hasConfirmedAppointment: false,
      hasPendingAppointment: false,
      isAssigned: false,
      confirmedAppointments: [],
      pendingAppointments: [],
    };
  }

  // Fetch all appointments for this patient
  const { data: allAppts } = await sqlDb
    .from("appointments")
    .select("*")
    .eq("patient_id", patientId);

  const doctorAppts = (allAppts ?? []).filter((a) => {
    if (doctorId && a.doctor_id === doctorId) return true;
    if (doctorName && a.doctor_name) {
      const aName = a.doctor_name.toLowerCase();
      const dName = doctorName.toLowerCase();
      if (aName === dName || aName.includes(dName) || dName.includes(aName)) return true;
    }
    return false;
  });

  const confirmedAppointments = doctorAppts.filter((a) =>
    CONFIRMED_APPOINTMENT_STATUSES.includes(a.status),
  );
  const pendingAppointments = doctorAppts.filter((a) => a.status === "Pending");

  const isAssigned = Boolean(
    patient.assigned_doctor &&
    doctorName &&
    (patient.assigned_doctor === doctorName ||
      patient.assigned_doctor.toLowerCase().includes(doctorName.toLowerCase()) ||
      doctorName.toLowerCase().includes(patient.assigned_doctor.toLowerCase())),
  );

  const hasConfirmedAppointment = confirmedAppointments.length > 0;
  const hasPendingAppointment = pendingAppointments.length > 0;

  if (hasConfirmedAppointment || isAssigned) {
    return {
      authorized: true,
      hasConfirmedAppointment,
      hasPendingAppointment,
      isAssigned,
      confirmedAppointments,
      pendingAppointments,
    };
  }

  if (hasPendingAppointment) {
    return {
      authorized: false,
      reason: `403 Forbidden: Appointment with ${patient.name || "patient"} is Pending. Full medical records, encounters, and messaging become authorized once the appointment is confirmed by the doctor.`,
      hasConfirmedAppointment: false,
      hasPendingAppointment: true,
      isAssigned: false,
      confirmedAppointments,
      pendingAppointments,
    };
  }

  return {
    authorized: false,
    reason: `403 Forbidden: Dr. ${doctorName} does not have a confirmed appointment or assigned relationship with this patient.`,
    hasConfirmedAppointment: false,
    hasPendingAppointment: false,
    isAssigned: false,
    confirmedAppointments: [],
    pendingAppointments: [],
  };
}

async function verifyDoctorAccess(
  patientId: string,
  encounterId?: string,
): Promise<{
  authorized: boolean;
  doctorName?: string;
  doctorId?: string;
  isAdmin: boolean;
  error?: string;
}> {
  const { data: authData } = await sqlDb.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId)
    return {
      authorized: false,
      isAdmin: false,
      error: "403 Unauthorized: Session expired or invalid.",
    };

  const { data: roles } = await sqlDb.from("user_roles").select("role").eq("user_id", userId);
  const roleSet = new Set((roles ?? []).map((r) => r.role));

  const isAdmin = roleSet.has("admin");

  // Admins and Patients are strictly read-only and cannot create, edit, or update medical records
  if (isAdmin) {
    return {
      authorized: false,
      isAdmin: true,
      error:
        "403 Forbidden: Administrators have read-only access to medical records and cannot modify them.",
    };
  }

  if (!roleSet.has("doctor")) {
    return {
      authorized: false,
      isAdmin: false,
      error:
        "403 Forbidden: Only doctors are allowed to create, edit, or update patient medical records.",
    };
  }

  let doctor = (await sqlDb.from("doctors").select("*").eq("user_id", userId).maybeSingle()).data;
  if (!doctor) {
    const profile = (await sqlDb.from("profiles").select("name").eq("id", userId).maybeSingle())
      .data;
    if (profile?.name) {
      doctor = (await sqlDb.from("doctors").select("*").ilike("name", profile.name).maybeSingle())
        .data;
    }
  }

  const doctorName = doctor?.name ?? null;
  const doctorId = doctor?.id ?? null;

  if (!doctorName) {
    return {
      authorized: false,
      isAdmin: false,
      error: "403 Forbidden: Active doctor profile not found.",
    };
  }

  const access = await checkDoctorPatientAccess(doctorId, doctorName, patientId);
  if (!access.authorized) {
    return {
      authorized: false,
      isAdmin: false,
      error:
        access.reason ??
        "403 Forbidden: Doctor access requires a confirmed appointment or assigned relationship.",
    };
  }

  if (encounterId) {
    const { data: enc } = await sqlDb
      .from("encounters")
      .select("id, patient_id")
      .eq("id", encounterId)
      .maybeSingle();
    if (enc && enc.patient_id !== patientId) {
      return {
        authorized: false,
        isAdmin: false,
        error: "403 Forbidden: Encounter does not match the specified patient.",
      };
    }
  }

  return { authorized: true, isAdmin: false, doctorName, doctorId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────────────────────

function mapPatient(row: any) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    dob: row.dob,
    age: calcAge(row.dob),
    sex: row.sex,
    createdAt: row.created_at,
    assignedDoctor: row.assigned_doctor,
    status: row.status,
    address: row.address,
    bloodType: row.blood_type,
    allergies: row.allergies ?? [],
    emergencyContactName: row.emergency_contact_name,
    emergencyContactPhone: row.emergency_contact_phone,
    emergencyContactRelation: row.emergency_contact_relation,
  };
}

function mapAppointment(row: any) {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.profiles?.name ?? row.patient_name ?? "Unknown",
    doctorName: row.doctor_name,
    department: row.department,
    date: row.appointment_date,
    time: row.appointment_time,
    status: row.status,
    notes: row.notes,
    clinic: row.clinic,
  };
}

function mapQueue(row: any) {
  return {
    id: row.id,
    queueNumber: row.queue_number,
    patientId: row.patient_id,
    patientName: row.profiles?.name ?? "Unknown",
    department: row.department,
    doctorName: row.doctor_name,
    status: row.status,
    estimatedWaitMinutes: row.estimated_wait_minutes,
    checkedInAt: row.checked_in_at,
    joinedAt: row.checked_in_at,
  };
}

function mapProduct(row: any) {
  const stock = row.stock ?? 0;
  const reorderLevel = row.reorder_level ?? 20;
  return {
    id: row.id,
    sku: (row.id as string).replace(/-/g, "").slice(0, 8).toUpperCase(),
    name: row.name,
    description: row.description ?? "",
    category: row.category,
    price: String(row.price ?? 0),
    stock,
    reorderLevel,
    brand: row.brand ?? "",
    supplier: row.supplier ?? "",
    prescriptionRequired: row.prescription_required ? 1 : 0,
    imageUrl: row.image_url ?? "",
    status: stock === 0 ? "Out of Stock" : stock < reorderLevel ? "Low Stock" : "In Stock",
  };
}

function mapOrder(row: any) {
  return {
    id: row.id,
    orderNo: row.order_no,
    patientName: row.profiles?.name ?? "Unknown",
    fulfillmentType: row.fulfillment_type,
    deliveryAddress: row.delivery_address,
    status: row.status,
    paymentStatus: row.payment_status,
    total: String(row.total ?? 0),
    createdAt: row.created_at,
    receivedAt: row.received_at,
    items: (row.order_items ?? []).map((it: any) => ({
      productName: it.product_name,
      quantity: it.quantity,
    })),
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

  const items: Array<{
    productName: string;
    brand?: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }> = [];

  if (
    matchingOrder?.order_items &&
    Array.isArray(matchingOrder.order_items) &&
    matchingOrder.order_items.length > 0
  ) {
    for (const item of matchingOrder.order_items) {
      items.push({
        productName: item.product_name || "Product Item",
        brand: item.brand ?? undefined,
        quantity: Number(item.quantity ?? 1),
        unitPrice: Number(item.unit_price ?? 0),
        lineTotal: Number(
          item.line_total ?? Number(item.quantity ?? 1) * Number(item.unit_price ?? 0),
        ),
      });
    }
  } else {
    items.push({
      productName: row.description || "Healthcare Services",
      quantity: 1,
      unitPrice: Number(row.amount ?? 0),
      lineTotal: Number(row.amount ?? 0),
    });
  }

  const deliveryFee = Number(matchingOrder?.delivery_fee ?? 0);
  const subtotal = Number(matchingOrder?.subtotal ?? Number(row.amount ?? 0) - deliveryFee);

  return {
    id: row.id,
    invoiceNo: row.invoice_no,
    patientId: row.patient_id || row.profiles?.id || matchingOrder?.user_id,
    patientName: row.profiles?.name ?? matchingOrder?.profiles?.name ?? "Unknown Patient",
    patientEmail: row.profiles?.email ?? matchingOrder?.profiles?.email ?? "",
    description: row.description ?? "",
    category: row.category ?? (matchingOrder ? "Medical Store" : "Healthcare"),
    amount: String(row.amount ?? 0),
    status: row.status,
    paymentMethod:
      row.payment_method ||
      matchingPayment?.method ||
      (row.status === "Paid" ? "Stripe" : undefined),
    createdAt: row.created_at,
    paidAt: row.paid_at || matchingPayment?.created_at,
    orderId: matchingOrder?.id,
    orderNo: matchingOrder?.order_no,
    transactionId: matchingPayment?.transaction_id,
    fulfillmentType: matchingOrder?.fulfillment_type,
    pickupBranch: branchName || matchingOrder?.pickup_branch,
    deliveryAddress: matchingOrder?.delivery_address,
    deliveryFee,
    subtotal,
    items,
  };
}

function mapEncounter(row: any) {
  const apptId =
    row.appointment_id ??
    parseApptIdFromText(row.encounter_notes) ??
    parseApptIdFromText(row.summary) ??
    null;
  return {
    id: row.id,
    _id: row.id,
    patientId: row.patient_id,
    appointmentId: apptId,
    appointment_id: apptId,
    patientName: row.profiles?.name ?? "Unknown",
    date: row.encounter_date,
    encounterDate: row.encounter_date,
    doctor: row.doctor_name ?? "Assigned Doctor",
    doctorName: row.doctor_name ?? "Assigned Doctor",
    doctorId: row.doctor_id ?? null,
    department: row.department ?? "General Medicine",
    specialty: row.department ?? "General Medicine",
    encounterType:
      row.encounter_type ??
      (row.department ? `${row.department} Consultation` : "Outpatient Visit"),
    chiefComplaint: row.chief_complaint ?? "",
    complaint: row.chief_complaint ?? "",
    diagnosis: row.diagnosis ?? "",
    summary: row.summary ?? "",
    historyOfPresentIllness: row.history_of_present_illness ?? "",
    treatmentProvided: row.treatment_provided ?? "",
    followUpRecommendations: row.follow_up_recommendations ?? "",
    encounterNotes: row.encounter_notes ?? "",
    status: row.status ?? "In Progress",
    createdAt: row.created_at,
    _createdAt: row.created_at,
  };
}

function mapInsurancePlan(row: any) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    provider: row.provider,
    description: row.description ?? "",
    monthlyPremium: String(row.monthly_premium ?? 0),
    annualPremium: String(row.annual_premium ?? 0),
    coverageLimit: String(row.coverage_limit ?? 0),
    coveragePercentage: row.coverage_percentage,
    validityMonths: row.validity_months,
    benefits: row.benefits ?? [],
    active: row.active ? 1 : 0,
    createdAt: row.created_at,
  };
}

function mapInsuranceRequest(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    patientName: row.profiles?.name ?? "Unknown",
    patientEmail: row.profiles?.email ?? "",
    planName: row.insurance_plans?.name ?? "",
    provider: row.insurance_plans?.provider ?? "",
    policyNumber: row.policy_number,
    status: row.status,
    premiumAmount: String(row.premium_amount ?? 0),
    coverageLimit: String(row.coverage_limit ?? 0),
    createdAt: row.created_at,
  };
}

function mapMessage(row: any) {
  return {
    id: row.id,
    sender: row.sender,
    text: row.text,
    createdAt: row.created_at,
  };
}

const STORE_CATEGORIES = [
  "Over-the-Counter Medicines",
  "Prescription Medicines (Demo Only)",
  "Vitamins & Supplements",
  "Medical Supplies",
  "First Aid",
  "Personal Care",
  "Medical Devices",
];

const PRODUCT_INSERTABLE_FIELDS: Record<string, string> = {
  name: "name",
  description: "description",
  category: "category",
  price: "price",
  stock: "stock",
  reorderLevel: "reorder_level",
  brand: "brand",
  supplier: "supplier",
  prescriptionRequired: "prescription_required",
  imageUrl: "image_url",
};

function toProductRow(data: Record<string, any>) {
  const row: Record<string, any> = {};
  for (const [camel, snake] of Object.entries(PRODUCT_INSERTABLE_FIELDS)) {
    if (data[camel] === undefined) continue;
    row[snake] = camel === "prescriptionRequired" ? Boolean(data[camel]) : data[camel];
  }
  return row;
}

const PLAN_FIELDS: Record<string, string> = {
  code: "code",
  name: "name",
  provider: "provider",
  description: "description",
  monthlyPremium: "monthly_premium",
  annualPremium: "annual_premium",
  coverageLimit: "coverage_limit",
  coveragePercentage: "coverage_percentage",
  validityMonths: "validity_months",
  benefits: "benefits",
  active: "active",
};

function toPlanRow(data: Record<string, any>) {
  const row: Record<string, any> = {};
  for (const [camel, snake] of Object.entries(PLAN_FIELDS)) {
    if (data[camel] === undefined) continue;
    row[snake] = camel === "active" ? Boolean(data[camel]) : data[camel];
  }
  return row;
}

const ENCOUNTER_FIELDS: Record<string, string> = {
  appointmentId: "appointment_id",
  appointment_id: "appointment_id",
  chiefComplaint: "chief_complaint",
  complaint: "chief_complaint",
  diagnosis: "diagnosis",
  summary: "summary",
  historyOfPresentIllness: "history_of_present_illness",
  treatmentProvided: "treatment_provided",
  followUpRecommendations: "follow_up_recommendations",
  encounterNotes: "encounter_notes",
  encounterType: "encounter_type",
  encounter_type: "encounter_type",
  status: "status",
  department: "department",
  doctor: "doctor_name",
  doctor_name: "doctor_name",
  doctor_id: "doctor_id",
  doctorId: "doctor_id",
  date: "encounter_date",
  encounter_date: "encounter_date",
};

function toEncounterRow(data: Record<string, any>) {
  const row: Record<string, any> = {};
  for (const [camel, snake] of Object.entries(ENCOUNTER_FIELDS)) {
    if (data[camel] === undefined) continue;
    row[snake] = data[camel];
  }
  return row;
}

export const adminApi = {
  getAdminDashboard: async (): Promise<Result<any>> => {
    const today = new Date().toISOString().slice(0, 10);
    const [
      { count: totalRegisteredPatients },
      { data: apptsToday },
      { data: queueRows },
      { data: products },
      { data: recentRegistrations },
      { data: recentAppointmentsRaw },
      { data: recentOrdersRaw },
    ] = await Promise.all([
      sqlDb.from("profiles").select("id", { count: "exact", head: true }),
      sqlDb.from("appointments").select("status").eq("appointment_date", today),
      sqlDb.from("queue_entries").select("status"),
      sqlDb.from("products").select("stock, reorder_level"),
      sqlDb.from("profiles").select("*").order("created_at", { ascending: false }).limit(5),
      sqlDb
        .from("appointments")
        .select("*, profiles(name)")
        .order("created_at", { ascending: false })
        .limit(6),
      sqlDb
        .from("orders")
        .select("*, profiles(name)")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    const activeAppointmentsToday = (apptsToday ?? []).filter(
      (a) => a.status === "Confirmed" || a.status === "Pending",
    ).length;
    const activeQueueCount = (queueRows ?? []).filter((q) =>
      /wait|serv/i.test(q.status ?? ""),
    ).length;
    const inventoryItems = (products ?? []).length;
    const lowStockAlerts = (products ?? []).filter(
      (p) => (p.stock ?? 0) === 0 || (p.stock ?? 0) < (p.reorder_level ?? 20),
    ).length;

    return ok({
      summary: {
        totalRegisteredPatients: totalRegisteredPatients ?? 0,
        activeAppointmentsToday,
        activeQueueCount,
        inventoryItems,
        lowStockAlerts,
      },
      recentPatientRegistrations: (recentRegistrations ?? []).map(mapPatient),
      recentAppointments: (recentAppointmentsRaw ?? []).map(mapAppointment),
      recentOrders: (recentOrdersRaw ?? []).map(mapOrder),
    });
  },

  getAdminPatients: async (params?: {
    search?: string;
    status?: string;
    sortBy?: string;
    sortDir?: string;
  }): Promise<Result<any>> => {
    const doctor = await getCurrentDoctor();
    const { data, error } = await sqlDb.from("profiles").select("*");
    if (error) return fail(error.message);

    const doctorConfirmedPatientIds = new Set<string>();
    const doctorPendingPatientIds = new Set<string>();
    if (doctor) {
      const { data: appts } = await sqlDb
        .from("appointments")
        .select("patient_id, status")
        .or(`doctor_id.eq.${doctor.id},doctor_name.ilike.%${doctor.name}%`);
      for (const a of appts ?? []) {
        if (CONFIRMED_APPOINTMENT_STATUSES.includes(a.status)) {
          doctorConfirmedPatientIds.add(a.patient_id);
        } else if (a.status === "Pending") {
          doctorPendingPatientIds.add(a.patient_id);
        }
      }
    }

    let results = (data ?? []).map(mapPatient).filter((p) => {
      if (doctor) {
        const isAssigned =
          p.assignedDoctor &&
          (p.assignedDoctor === doctor.name ||
            p.assignedDoctor.toLowerCase().includes(doctor.name.toLowerCase()));
        const isConfirmed = doctorConfirmedPatientIds.has(p.id);
        const isPending = doctorPendingPatientIds.has(p.id);
        if (!isAssigned && !isConfirmed && !isPending) return false;
      }
      if (params?.status && params.status !== "all" && p.status !== params.status) return false;
      if (
        params?.search &&
        !(matchesSearch(p.name, params.search) || matchesSearch(p.email, params.search))
      )
        return false;
      return true;
    });
    if (params?.sortBy) {
      const dir = params.sortDir === "desc" ? -1 : 1;
      results = [...results].sort(
        (a: any, b: any) => (a[params.sortBy!] > b[params.sortBy!] ? 1 : -1) * dir,
      );
    }
    return ok({ patients: results, total: results.length });
  },

  getAdminPatient: async (id: string): Promise<Result<any>> => {
    const { data: profile, error } = await sqlDb
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return fail(error.message);
    if (!profile) return fail("Patient not found");

    const doctor = await getCurrentDoctor();
    if (doctor) {
      const access = await checkDoctorPatientAccess(doctor.id, doctor.name, id);
      if (!access.authorized) {
        return fail(
          access.reason ??
            "403 Forbidden: Doctor access to patient records requires a confirmed appointment or assigned relationship.",
        );
      }
    }

    await syncPatientEncountersAndAppointments(id);

    const [
      { data: appts },
      { data: encounters },
      { data: labs },
      { data: imaging },
      { data: policies },
    ] = await Promise.all([
      sqlDb
        .from("appointments")
        .select("*, profiles(name)")
        .eq("patient_id", id)
        .order("appointment_date", { ascending: false }),
      sqlDb
        .from("encounters")
        .select("*, profiles(name)")
        .eq("patient_id", id)
        .order("encounter_date", { ascending: false }),
      sqlDb.from("lab_results").select("*").eq("patient_id", id),
      sqlDb.from("imaging_records").select("*").eq("patient_id", id),
      sqlDb.from("insurance_policies").select("*, insurance_plans(*)").eq("user_id", id),
    ]);

    const doctorSpecialty = profile.assigned_doctor
      ? (
          await sqlDb
            .from("doctors")
            .select("specialty")
            .eq("name", profile.assigned_doctor)
            .maybeSingle()
        ).data?.specialty
      : null;

    const documents = [
      ...(labs ?? []).map((l) => ({
        id: l.id,
        encounterRef: l.encounter_id,
        name: `${l.test_name} - Lab Result`,
        type: "Lab Result",
        uploadedAt: l.resulted_at,
        fileType: "pdf",
        sourceKind: "lab",
        meta: { fileSize: null, date: l.resulted_at },
      })),
      ...(imaging ?? []).map((i) => ({
        id: i.id,
        encounterRef: i.encounter_id,
        name: `${i.modality} - Imaging`,
        type: "Imaging",
        uploadedAt: i.taken_at,
        fileType: "pdf",
        sourceKind: "imaging",
        meta: { fileSize: null, date: i.taken_at },
      })),
    ];

    const mappedEncounters = (encounters ?? []).map(mapEncounter);
    const encounterRecords = mappedEncounters.map((e) => ({
      id: e.id,
      kind: "encounter",
      encounterRef: e.id,
      data: e,
      createdAt: e.createdAt ?? e.date,
    }));

    return ok({
      patient: {
        ...mapPatient(profile),
        insurance: (policies ?? []).map((p: any) => ({
          id: p.id,
          provider: p.insurance_plans?.provider ?? "",
          planName: p.insurance_plans?.name ?? "",
          policyNumber: p.policy_number,
          coverageLimit: String(p.coverage_limit ?? 0),
          remainingCoverage: String(p.coverage_limit ?? 0),
          status: p.status,
          expirationDate: p.end_date,
        })),
        assignedDoctorInfo: profile.assigned_doctor
          ? { name: profile.assigned_doctor, specialty: doctorSpecialty ?? "General Medicine" }
          : undefined,
      },
      documents,
      appointments: (appts ?? []).map(mapAppointment),
      encounters: mappedEncounters,
      records: encounterRecords,
    });
  },

  getAdminPatientEncounterRecords: async (
    patientId: string,
    encounterId: string,
  ): Promise<Result<any>> => {
    const doctor = await getCurrentDoctor();
    if (doctor) {
      const access = await checkDoctorPatientAccess(doctor.id, doctor.name, patientId);
      if (!access.authorized) {
        return fail(
          access.reason ??
            "403 Forbidden: Only doctors with confirmed appointments can view detailed medical encounter records.",
        );
      }
    }

    await syncPatientEncountersAndAppointments(patientId);

    const { data: encounter, error } = await sqlDb
      .from("encounters")
      .select("*, profiles(name)")
      .eq("id", encounterId)
      .maybeSingle();
    if (error) return fail(error.message);
    if (!encounter) return fail("Encounter not found");

    const [
      { data: vitals },
      { data: prescriptions },
      { data: labs },
      { data: imaging },
      { data: soap },
      { data: diagnoses },
      { data: procedures },
    ] = await Promise.all([
      sqlDb.from("vital_signs").select("*").eq("encounter_id", encounterId),
      sqlDb.from("prescriptions").select("*").eq("encounter_id", encounterId),
      sqlDb.from("lab_results").select("*").eq("encounter_id", encounterId),
      sqlDb.from("imaging_records").select("*").eq("encounter_id", encounterId),
      sqlDb.from("soap_notes").select("*").eq("encounter_id", encounterId),
      sqlDb.from("encounter_diagnoses").select("*").eq("encounter_id", encounterId),
      sqlDb.from("procedures").select("*").eq("encounter_id", encounterId),
    ]);

    const records = [
      ...(vitals ?? []).map((v) => ({
        id: v.id,
        kind: "vital",
        encounterRef: encounterId,
        data: v,
        createdAt: v.recorded_at,
      })),
      ...(prescriptions ?? []).map((p) => ({
        id: p.id,
        kind: "prescription",
        encounterRef: encounterId,
        data: p,
        createdAt: p.created_at,
      })),
      ...(labs ?? []).map((l) => ({
        id: l.id,
        kind: "lab",
        encounterRef: encounterId,
        data: l,
        createdAt: l.resulted_at,
      })),
      ...(imaging ?? []).map((i) => ({
        id: i.id,
        kind: "imaging",
        encounterRef: encounterId,
        data: i,
        createdAt: i.taken_at,
      })),
      ...(soap ?? []).map((s) => ({
        id: s.id,
        kind: "soap",
        encounterRef: encounterId,
        data: s,
        createdAt: s.created_at,
      })),
      ...(diagnoses ?? []).map((d) => ({
        id: d.id,
        kind: "diagnosis",
        encounterRef: encounterId,
        data: d,
        createdAt: d.created_at,
      })),
      ...(procedures ?? []).map((p) => ({
        id: p.id,
        kind: "procedure",
        encounterRef: encounterId,
        data: p,
        createdAt: p.performed_at,
      })),
    ];

    return ok({ encounter: mapEncounter(encounter), records });
  },

  getAdminPatientDocument: async (patientId: string, recordId: string): Promise<Result<any>> => {
    const doctor = await getCurrentDoctor();
    if (doctor) {
      const access = await checkDoctorPatientAccess(doctor.id, doctor.name, patientId);
      if (!access.authorized) {
        return fail(
          access.reason ?? "403 Forbidden: You are not authorized to view this patient document.",
        );
      }
    }

    const { data: lab } = await sqlDb
      .from("lab_results")
      .select("*")
      .eq("id", recordId)
      .eq("patient_id", patientId)
      .maybeSingle();
    if (lab) {
      return ok({
        document: {
          id: lab.id,
          name: `${lab.test_name} - Lab Result`,
          type: "Lab Result",
          uploadedAt: lab.resulted_at,
        },
        record: { id: lab.id, patientId, data: lab },
      });
    }
    const { data: imaging } = await sqlDb
      .from("imaging_records")
      .select("*")
      .eq("id", recordId)
      .eq("patient_id", patientId)
      .maybeSingle();
    if (imaging) {
      return ok({
        document: {
          id: imaging.id,
          name: `${imaging.modality} - Imaging`,
          type: "Imaging",
          uploadedAt: imaging.taken_at,
        },
        record: { id: imaging.id, patientId, data: imaging },
      });
    }
    return fail("Document not found");
  },

  getAdminAppointments: async (params?: {
    search?: string;
    status?: string;
    department?: string;
    doctor?: string;
    date?: string;
  }): Promise<Result<any>> => {
    const doctor = await getCurrentDoctor();
    const { data, error } = await sqlDb.from("appointments").select("*, profiles(name)");
    if (error) return fail(error.message);
    const results = (data ?? []).map(mapAppointment).filter((a) => {
      if (doctor) {
        const matchesDoc =
          (a.doctorId && a.doctorId === doctor.id) ||
          (a.doctorName &&
            (a.doctorName === doctor.name ||
              a.doctorName.toLowerCase().includes(doctor.name.toLowerCase()) ||
              doctor.name.toLowerCase().includes(a.doctorName.toLowerCase())));
        if (!matchesDoc) return false;
      }
      if (
        params?.status &&
        params.status !== "all" &&
        a.status.toLowerCase() !== params.status.toLowerCase()
      )
        return false;
      if (params?.department && params.department !== "all" && a.department !== params.department)
        return false;
      if (params?.doctor && params.doctor !== "all" && a.doctorName !== params.doctor) return false;
      if (params?.date && a.date !== params.date) return false;
      if (
        params?.search &&
        !(matchesSearch(a.patientName, params.search) || matchesSearch(a.doctorName, params.search))
      )
        return false;
      return true;
    });
    return ok({ appointments: results, total: results.length });
  },

  getAdminQueue: async (params?: {
    search?: string;
    department?: string;
    status?: string;
  }): Promise<Result<any>> => {
    const scope = await getCurrentDoctorName();
    const { data, error } = await sqlDb.from("queue_entries").select("*, profiles(name)");
    if (error) return fail(error.message);
    const results = (data ?? []).map(mapQueue).filter((q) => {
      if (scope && q.doctorName !== scope) return false;
      if (params?.status && params.status !== "all" && q.status !== params.status) return false;
      if (params?.department && params.department !== "all" && q.department !== params.department)
        return false;
      if (params?.search && !matchesSearch(q.patientName, params.search)) return false;
      return true;
    });
    return ok({ queue: results, total: results.length });
  },

  getAdminInventory: async (params?: {
    search?: string;
    category?: string;
    status?: string;
  }): Promise<Result<any>> => {
    let { data, error } = await sqlDb.from("products").select("*");
    if (!data || data.length === 0) {
      // If products table is not populated yet, attempt to fetch from store-api products
      try {
        const { apiClient } = await import("@/lib/api-client");
        await apiClient.getStoreProducts();
        const refetch = await sqlDb.from("products").select("*");
        if (refetch.data && refetch.data.length > 0) {
          data = refetch.data;
        }
      } catch {}
    }
    const results = (data ?? []).map(mapProduct).filter((p) => {
      if (params?.status && params.status !== "all" && p.status !== params.status) return false;
      if (params?.category && params.category !== "all" && p.category !== params.category)
        return false;
      if (params?.search && !matchesSearch(p.name, params.search)) return false;
      return true;
    });
    return ok({ products: results, categories: STORE_CATEGORIES, total: results.length });
  },

  updateAdminAppointmentStatus: async (id: string, status: string): Promise<Result<any>> => {
    const { data: existingAppt, error: findErr } = await sqlDb
      .from("appointments")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (findErr) return fail(findErr.message);
    if (!existingAppt) return fail("Appointment not found");

    const patch: Record<string, any> = { status };
    const doctor = await getCurrentDoctor();

    if (status === "Confirmed") {
      if (doctor) {
        if (!existingAppt.doctor_id) patch.doctor_id = doctor.id;
        if (!existingAppt.doctor_name) patch.doctor_name = doctor.name;
      }
    }

    const { data, error } = await sqlDb
      .from("appointments")
      .update(patch as any)
      .eq("id", id)
      .select("*, profiles(name, email)")
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Appointment not found");

    // Fire-and-forget status email — never blocks or fails the status update.
    let email: { sent: boolean; reason?: string } | null = null;
    try {
      const patientEmail = (data as any).profiles?.email;
      if (patientEmail) {
        const content = appointmentStatusTemplate(status, {
          patientName: (data as any).profiles?.name,
          doctorName: data.doctor_name,
          department: data.department,
          clinic: data.clinic,
          appointmentDate: data.appointment_date,
          appointmentTime: data.appointment_time,
        });
        const result = await sendEmailSafe({
          to: patientEmail,
          toName: (data as any).profiles?.name || undefined,
          subject: content.subject,
          html: content.html,
          text: content.text,
        });
        email = { sent: result.sent, reason: result.reason };
      }
    } catch (err: any) {
      console.error("[Email] appointment status notification failed:", err?.message);
    }

    // When appointment is confirmed, create / link encounter and set patient assigned_doctor if not assigned
    if (status === "Confirmed") {
      await ensureEncounterForAppointment(data);
      const { data: patientProfile } = await sqlDb
        .from("profiles")
        .select("assigned_doctor")
        .eq("id", data.patient_id)
        .maybeSingle();
      if (patientProfile && !patientProfile.assigned_doctor && data.doctor_name) {
        await sqlDb
          .from("profiles")
          .update({ assigned_doctor: data.doctor_name } as any)
          .eq("id", data.patient_id);
      }
    } else if (status === "Cancelled" || status === "Rejected") {
      // Sync encounter status
      await sqlDb
        .from("encounters")
        .update({ status: "Cancelled" } as any)
        .eq("appointment_id", id);
    }

    return ok({ appointment: mapAppointment(data), accessGranted: status === "Confirmed", email });
  },

  confirmAppointment: async (id: string): Promise<Result<any>> => {
    return adminApi.updateAdminAppointmentStatus(id, "Confirmed");
  },

  updateAdminQueueStatus: async (id: string, status: string): Promise<Result<any>> => {
    const { data, error } = await sqlDb
      .from("queue_entries")
      .update({ status })
      .eq("id", id)
      .select("*, profiles(name)")
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Queue entry not found");
    return ok({ queue: mapQueue(data) });
  },

  updateAdminInventoryStock: async (id: string, stock: number): Promise<Result<any>> => {
    const { data, error } = await sqlDb
      .from("products")
      .update({ stock })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Product not found");
    return ok({ product: mapProduct(data) });
  },

  getAdminOrders: async (params?: { search?: string; status?: string }): Promise<Result<any>> => {
    const { data, error } = await sqlDb.from("orders").select("*, profiles(name), order_items(*)");
    if (error) return fail(error.message);
    const results = (data ?? []).map(mapOrder).filter((o) => {
      if (params?.status && params.status !== "all" && o.status !== params.status) return false;
      if (
        params?.search &&
        !(matchesSearch(o.patientName, params.search) || matchesSearch(o.orderNo, params.search))
      )
        return false;
      return true;
    });
    return ok({ orders: results });
  },

  updateAdminOrderStatus: async (
    id: string,
    update: { status?: string; paymentStatus?: string },
  ): Promise<Result<any>> => {
    const patch: Record<string, any> = {};
    if (update.status) patch.status = update.status;
    if (update.paymentStatus) patch.payment_status = update.paymentStatus;
    const { data, error } = await sqlDb
      .from("orders")
      .update(patch as any)
      .eq("id", id)
      .select("*, profiles(name), order_items(*)")
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Order not found");
    return ok({ order: mapOrder(data) });
  },

  getAdminBilling: async (params?: {
    search?: string;
    status?: string;
    category?: string;
  }): Promise<Result<any>> => {
    try {
      const [billsRes, ordersRes, paymentsRes, branchesRes] = await Promise.all([
        sqlDb
          .from("bills")
          .select("*, profiles(id, name, email)")
          .order("created_at", { ascending: false }),
        sqlDb
          .from("orders")
          .select("*, order_items(*), profiles(id, name, email)")
          .order("created_at", { ascending: false }),
        sqlDb.from("payments").select("*").order("created_at", { ascending: false }),
        sqlDb.from("store_branches").select("id, name, location"),
      ]);

      if (billsRes.error) return fail(billsRes.error.message);

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
              patient_id: order.user_id,
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
            .select("*, profiles(id, name, email)")
            .maybeSingle();

          if (newBill) {
            bills.push(newBill);
            existingBillInvoices.add(newBill.invoice_no);
            if (newBill.description) existingBillDescriptions.add(newBill.description);

            if (isPaid) {
              const hasPayment = payments.some(
                (p) => (p.description || "").includes(order.order_no) || p.bill_id === newBill.id,
              );
              if (!hasPayment) {
                const { data: newPayment } = await sqlDb
                  .from("payments")
                  .insert({
                    user_id: order.user_id,
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

      const results = bills
        .map((bill) => {
          // Find matching order
          const invDigits = (bill.invoice_no || "").replace(/\D/g, "");
          const matchingOrder = orders.find((o) => {
            if (o.order_no && invDigits && o.order_no.replace(/\D/g, "") === invDigits) return true;
            if (bill.description && o.order_no && bill.description.includes(o.order_no))
              return true;
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
        })
        .filter((b) => {
          if (params?.status && params.status !== "all" && b.status !== params.status) return false;
          if (params?.category && params.category !== "all" && b.category !== params.category)
            return false;
          if (params?.search) {
            const q = params.search.toLowerCase();
            const matches =
              (b.patientName && b.patientName.toLowerCase().includes(q)) ||
              (b.patientEmail && b.patientEmail.toLowerCase().includes(q)) ||
              (b.patientId && b.patientId.toLowerCase().includes(q)) ||
              (b.invoiceNo && b.invoiceNo.toLowerCase().includes(q)) ||
              (b.orderNo && b.orderNo.toLowerCase().includes(q)) ||
              (b.transactionId && b.transactionId.toLowerCase().includes(q)) ||
              (b.description && b.description.toLowerCase().includes(q)) ||
              b.items.some((item) => item.productName.toLowerCase().includes(q));
            if (!matches) return false;
          }
          return true;
        });

      return ok({ bills: results });
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Failed to load admin billing records.");
    }
  },

  getAdminEncounters: async (params?: {
    search?: string;
    patientId?: string;
    doctor?: string;
    department?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortDir?: string;
    page?: number;
    limit?: number;
  }): Promise<Result<any>> => {
    const scope = await getCurrentDoctorName();
    const { data, error } = await sqlDb.from("encounters").select("*, profiles(name)");
    if (error) return fail(error.message);
    let results = (data ?? []).map(mapEncounter).filter((e) => {
      if (scope && e.doctor !== scope) return false;
      if (params?.patientId && e.patientId !== params.patientId) return false;
      if (params?.doctor && params.doctor !== "all" && e.doctor !== params.doctor) return false;
      if (params?.department && params.department !== "all" && e.department !== params.department)
        return false;
      if (params?.dateFrom && e.date < params.dateFrom) return false;
      if (params?.dateTo && e.date > params.dateTo) return false;
      if (
        params?.search &&
        !(matchesSearch(e.patientName, params.search) || matchesSearch(e.diagnosis, params.search))
      )
        return false;
      return true;
    });
    if (params?.sortBy) {
      const fieldMap: Record<string, string> = {
        date: "date",
        patient: "patientName",
        doctor: "doctor",
      };
      const field = fieldMap[params.sortBy] ?? params.sortBy;
      const dir = params.sortDir === "desc" ? -1 : 1;
      results = [...results].sort(
        (a: any, b: any) => (a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0) * dir,
      );
    }
    const total = results.length;
    const page = params?.page ?? 1;
    const limit = params?.limit ?? (total > 0 ? total : 1);
    const start = (page - 1) * limit;
    const paged = results.slice(start, start + limit);
    return ok({ encounters: paged, total, page, limit });
  },

  getAdminEncounter: async (id: string): Promise<Result<any>> => {
    const { data, error } = await sqlDb
      .from("encounters")
      .select("*, profiles(name)")
      .eq("id", id)
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Encounter not found");
    return ok({ encounter: mapEncounter(data) });
  },

  updateAdminEncounter: async (id: string, update: Record<string, any>): Promise<Result<any>> => {
    const { data: existing, error: findError } = await sqlDb
      .from("encounters")
      .select("patient_id")
      .eq("id", id)
      .maybeSingle();
    if (findError) return fail(findError.message);
    if (!existing) return fail("Encounter not found");

    const access = await verifyDoctorAccess(existing.patient_id, id);
    if (!access.authorized) {
      return fail(
        access.error ?? "403 Forbidden: Only authorized doctors can edit medical records.",
      );
    }

    const patch = toEncounterRow(update);
    const { data, error } = await sqlDb
      .from("encounters")
      .update(patch as any)
      .eq("id", id)
      .select("*, profiles(name)")
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Encounter not found");
    return ok({ encounter: mapEncounter(data) });
  },

  getAdminInsuranceRequests: async (params?: {
    status?: string;
    search?: string;
  }): Promise<Result<any>> => {
    const { data, error } = await sqlDb
      .from("insurance_policies")
      .select("*, profiles(name, email), insurance_plans(name, provider)");
    if (error) return fail(error.message);
    const results = (data ?? []).map(mapInsuranceRequest).filter((r) => {
      if (
        params?.status &&
        params.status !== "all" &&
        r.status.toLowerCase() !== params.status.toLowerCase()
      )
        return false;
      if (
        params?.search &&
        !(
          matchesSearch(r.patientName, params.search) ||
          matchesSearch(r.policyNumber, params.search)
        )
      )
        return false;
      return true;
    });
    return ok({ requests: results });
  },

  updateAdminInsuranceRequest: async (
    id: string,
    action: "approve" | "reject",
  ): Promise<Result<any>> => {
    try {
      if (action === "approve") {
        const { data: policy } = await sqlDb
          .from("insurance_policies")
          .select("plan_id")
          .eq("id", id)
          .maybeSingle();
        let validityMonths = 12;
        if (policy?.plan_id) {
          const { data: plan } = await sqlDb
            .from("insurance_plans")
            .select("validity_months")
            .eq("id", policy.plan_id)
            .maybeSingle();
          if (plan?.validity_months) validityMonths = Number(plan.validity_months);
        }
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + validityMonths);

        const { data, error } = await sqlDb
          .from("insurance_policies")
          .update({
            status: "active",
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
          })
          .eq("id", id)
          .select("*, profiles(name, email), insurance_plans(name, provider)")
          .maybeSingle();

        if (error) return fail(error.message);
        if (!data) return fail("Request not found");
        return ok({ policy: mapInsuranceRequest(data) });
      } else {
        const { data, error } = await sqlDb
          .from("insurance_policies")
          .update({ status: "rejected" })
          .eq("id", id)
          .select("*, profiles(name, email), insurance_plans(name, provider)")
          .maybeSingle();

        if (error) return fail(error.message);
        if (!data) return fail("Request not found");
        return ok({ policy: mapInsuranceRequest(data) });
      }
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Failed to update insurance policy status.");
    }
  },

  createAdminProduct: async (data: Record<string, any>): Promise<Result<any>> => {
    const row = toProductRow(data);
    const { data: created, error } = await sqlDb
      .from("products")
      .insert(row as any)
      .select("*")
      .maybeSingle();
    if (error) return fail(error.message);
    return ok({ product: mapProduct(created) });
  },

  updateAdminProduct: async (id: string, data: Record<string, any>): Promise<Result<any>> => {
    const row = toProductRow(data);
    const { data: updated, error } = await sqlDb
      .from("products")
      .update(row as any)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) return fail(error.message);
    if (!updated) return fail("Product not found");
    return ok({ product: mapProduct(updated) });
  },

  deleteAdminProduct: async (id: string): Promise<Result<any>> => {
    const { error } = await sqlDb.from("products").delete().eq("id", id);
    if (error) return fail(error.message);
    return ok({ ok: true });
  },

  getAdminInsurancePlans: async (): Promise<Result<any>> => {
    const { data, error } = await sqlDb
      .from("insurance_plans")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return fail(error.message);
    return ok({ plans: (data ?? []).map(mapInsurancePlan) });
  },

  createAdminInsurancePlan: async (data: Record<string, any>): Promise<Result<any>> => {
    const row = toPlanRow(data);
    const { data: created, error } = await sqlDb
      .from("insurance_plans")
      .insert(row as any)
      .select("*")
      .maybeSingle();
    if (error) return fail(error.message);
    return ok({ plan: mapInsurancePlan(created) });
  },

  updateAdminInsurancePlan: async (id: string, data: Record<string, any>): Promise<Result<any>> => {
    const row = toPlanRow(data);
    const { data: updated, error } = await sqlDb
      .from("insurance_plans")
      .update(row as any)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) return fail(error.message);
    if (!updated) return fail("Plan not found");
    return ok({ plan: mapInsurancePlan(updated) });
  },

  deleteAdminInsurancePlan: async (id: string): Promise<Result<any>> => {
    const { error } = await sqlDb.from("insurance_plans").delete().eq("id", id);
    if (error) return fail(error.message);
    return ok({ ok: true });
  },

  getAdminMessagingPatients: async (search?: string): Promise<Result<any>> => {
    const doctor = await getCurrentDoctor();
    const { data, error } = await sqlDb.from("profiles").select("*");
    if (error) return fail(error.message);

    const confirmedPatientIds = new Set<string>();
    if (doctor) {
      const { data: appts } = await sqlDb
        .from("appointments")
        .select("patient_id, status")
        .or(`doctor_id.eq.${doctor.id},doctor_name.ilike.%${doctor.name}%`);
      for (const a of appts ?? []) {
        if (CONFIRMED_APPOINTMENT_STATUSES.includes(a.status)) {
          confirmedPatientIds.add(a.patient_id);
        }
      }
    }

    const results = (data ?? []).map(mapPatient).filter((p) => {
      if (doctor) {
        const isAssigned =
          p.assignedDoctor &&
          (p.assignedDoctor === doctor.name ||
            p.assignedDoctor.toLowerCase().includes(doctor.name.toLowerCase()));
        const hasConfirmed = confirmedPatientIds.has(p.id);
        if (!isAssigned && !hasConfirmed) return false;
      }
      return matchesSearch(p.name, search) || matchesSearch(p.email, search);
    });
    return ok({
      patients: results.map((p) => ({ id: p.id, name: p.name, email: p.email, phone: p.phone })),
    });
  },

  getAdminConversation: async (patientId: string): Promise<Result<any>> => {
    const doctor = await getCurrentDoctor();
    if (doctor) {
      const access = await checkDoctorPatientAccess(doctor.id, doctor.name, patientId);
      if (!access.authorized) {
        return fail(
          access.reason ??
            "403 Forbidden: Direct messaging is only authorized after appointment confirmation.",
        );
      }
    }

    const { data: patient } = await sqlDb
      .from("profiles")
      .select("*")
      .eq("id", patientId)
      .maybeSingle();

    const { data: messages, error } = await sqlDb
      .from("messages")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: true });
    if (error) return fail(error.message);

    return ok({
      messages: (messages ?? []).map(mapMessage),
      patient: patient
        ? { id: patient.id, name: patient.name, email: patient.email, phone: patient.phone }
        : { id: patientId, name: "Patient", email: "", phone: "" },
    });
  },

  sendAdminMessage: async (
    patientId: string,
    text: string,
  ): Promise<Result<any>> => {
    // Role gate: patients are receive-only for SMS and may not use staff
    // messaging at all.
    const { data: authData } = await sqlDb.auth.getUser();
    const senderUserId = authData?.user?.id;
    let senderRole: string | null = null;
    if (senderUserId) {
      const { data: roles } = await sqlDb
        .from("user_roles")
        .select("role")
        .eq("user_id", senderUserId);
      const roleList = (roles ?? []).map((r: any) => String(r.role || "").toLowerCase());
      senderRole = roleList.includes("administrator")
        ? "admin"
        : roleList.includes("physician") || roleList.includes("doctor")
          ? "doctor"
          : (roleList[0] ?? null);
    }
    if (!senderRole || !["admin", "doctor"].includes(senderRole)) {
      return fail("403 Forbidden: Only doctors and admins can send messages to patients.");
    }

    const doctor = await getCurrentDoctor();
    if (doctor) {
      const access = await checkDoctorPatientAccess(doctor.id, doctor.name, patientId);
      if (!access.authorized) {
        return fail(
          access.reason ??
            "403 Forbidden: Doctor authorization requires a confirmed appointment before messaging patients.",
        );
      }
    }

    const { data: patient } = await sqlDb
      .from("profiles")
      .select("phone")
      .eq("id", patientId)
      .maybeSingle();
    const insertRow = {
      patient_id: patientId,
      sender: "doctor",
      text,
    };
    const { data, error } = await sqlDb
      .from("messages")
      .insert(insertRow)
      .select("*")
      .maybeSingle();
    if (error) return fail(error.message);
    return ok({
      message: mapMessage(data),
    });
  },

  createEncounterForDoctor: async (
    patientId: string,
    data: Record<string, any>,
  ): Promise<Result<any>> => {
    const access = await verifyDoctorAccess(patientId);
    if (!access.authorized) return fail(access.error ?? "Not authorized");

    let appointmentId = data.appointment_id ?? data.appointmentId;
    const doctorName = access.doctorName ?? data.doctor_name ?? data.doctorName ?? "Dr. Physician";
    const doctorId = access.doctorId ?? data.doctor_id ?? data.doctorId ?? null;
    const now = new Date().toISOString();
    const encDate = data.encounter_date ?? data.date ?? now.slice(0, 10);
    const encTime = data.encounter_time ?? data.time ?? "09:00";
    const dept = data.department ?? data.specialty ?? "General Medicine";

    if (appointmentId) {
      // If an existing appointment is specified, update or link it
      const { data: existingAppt } = await sqlDb
        .from("appointments")
        .select("*")
        .eq("id", appointmentId)
        .maybeSingle();
      if (existingAppt && (!existingAppt.doctor_id || !existingAppt.doctor_name)) {
        await sqlDb
          .from("appointments")
          .update({
            doctor_id: doctorId || existingAppt.doctor_id,
            doctor_name: doctorName || existingAppt.doctor_name,
          } as any)
          .eq("id", appointmentId);
      }
    } else {
      // Create a linked appointment
      const { data: newAppt, error: apptErr } = await sqlDb
        .from("appointments")
        .insert({
          patient_id: patientId,
          doctor_id: doctorId,
          doctor_name: doctorName,
          department: dept,
          clinic: dept,
          appointment_date: encDate.slice(0, 10),
          appointment_time: encTime,
          status: "Completed",
          notes: data.chief_complaint ?? data.summary ?? "Clinical Encounter",
        })
        .select("*")
        .single();

      if (apptErr || !newAppt) {
        return fail(apptErr?.message ?? "Failed to create required appointment for encounter");
      }

      appointmentId = newAppt.id;
    }

    const fullDate =
      encDate.includes(" ") || encDate.includes("T") ? encDate : `${encDate} ${encTime}`;
    const encType =
      data.encounter_type ?? data.type ?? (dept ? `${dept} Consultation` : "Outpatient Visit");
    const summaryText =
      data.summary || data.diagnosis || data.chief_complaint || "Clinical Encounter";
    const noteText =
      (data.encounter_notes ? `${data.encounter_notes}\n` : "") +
      (data.chief_complaint ? `Chief Complaint: ${data.chief_complaint}\n` : "") +
      (data.diagnosis ? `Diagnosis: ${data.diagnosis}\n` : "") +
      `[APPT:${appointmentId}]`;

    const insertRow: Record<string, any> = {
      patient_id: patientId,
      appointment_id: appointmentId,
      doctor_id: doctorId,
      doctor_name: doctorName,
      department: dept,
      encounter_date: fullDate,
      type: encType,
      status: data.status ?? "In Progress",
      summary: summaryText,
      encounter_notes: noteText,
    };

    const { data: created, error } = await sqlDb
      .from("encounters")
      .insert(insertRow as any)
      .select("*, profiles(name)")
      .maybeSingle();
    if (error) return fail(error.message);
    if (!created) return fail("Failed to create encounter");

    // Auto-record initial diagnosis if provided
    if (data.diagnosis && String(data.diagnosis).trim()) {
      try {
        await sqlDb.from("encounter_diagnoses").insert({
          encounter_id: created.id,
          description: String(data.diagnosis).trim(),
          type: "Primary",
          code: data.code || "Z00.00",
        } as any);
      } catch (diagErr) {
        console.warn("Could not auto-record initial diagnosis:", diagErr);
      }
    }

    // Auto-record initial SOAP note if chief complaint is provided
    if (data.chief_complaint && String(data.chief_complaint).trim()) {
      try {
        await sqlDb.from("soap_notes").insert({
          encounter_id: created.id,
          subjective: `Chief Complaint: ${String(data.chief_complaint).trim()}${data.history_of_present_illness ? `\n\nHPI: ${data.history_of_present_illness}` : ""}`,
          objective: "Patient evaluated in clinic.",
          assessment: data.diagnosis ? `Assessment: ${data.diagnosis}` : "Under active evaluation.",
          plan: data.treatment_provided
            ? `Plan: ${data.treatment_provided}`
            : "Proceed with clinical treatment plan.",
        } as any);
      } catch (soapErr) {
        console.warn("Could not auto-record initial SOAP note:", soapErr);
      }
    }

    return ok({ encounter: mapEncounter(created) });
  },

  saveSoapNote: async (
    patientId: string,
    encounterId: string,
    data: Record<string, any>,
    recordId?: string,
  ): Promise<Result<any>> => {
    const access = await verifyDoctorAccess(patientId, encounterId);
    if (!access.authorized)
      return fail(
        access.error ?? "403 Forbidden: Only authorized doctors can edit medical records.",
      );

    const now = new Date().toISOString();
    await sqlDb
      .from("encounters")
      .update({
        doctor_id: access.doctorId ?? null,
        doctor_name: access.doctorName ?? null,
        updated_at: now,
      } as any)
      .eq("id", encounterId)
      .eq("patient_id", patientId);

    const patch = {
      encounter_id: encounterId,
      subjective: data.subjective ?? "",
      objective: data.objective ?? "",
      assessment: data.assessment ?? "",
      plan: data.plan ?? "",
      created_at: now,
    };

    let targetId = recordId;
    if (!targetId) {
      const { data: existing } = await sqlDb
        .from("soap_notes")
        .select("id")
        .eq("encounter_id", encounterId)
        .maybeSingle();
      if (existing?.id) targetId = existing.id;
    }

    if (targetId) {
      const { data: updated, error } = await sqlDb
        .from("soap_notes")
        .update(patch as any)
        .eq("id", targetId)
        .eq("encounter_id", encounterId)
        .select("*")
        .maybeSingle();
      if (error) return fail(error.message);
      return ok({ soap: updated });
    } else {
      const { data: created, error } = await sqlDb
        .from("soap_notes")
        .insert(patch as any)
        .select("*")
        .maybeSingle();
      if (error) return fail(error.message);
      return ok({ soap: created });
    }
  },

  saveDiagnosis: async (
    patientId: string,
    encounterId: string,
    data: Record<string, any>,
    recordId?: string,
  ): Promise<Result<any>> => {
    const access = await verifyDoctorAccess(patientId, encounterId);
    if (!access.authorized)
      return fail(
        access.error ?? "403 Forbidden: Only authorized doctors can edit medical records.",
      );

    const now = new Date().toISOString();
    await sqlDb
      .from("encounters")
      .update({
        doctor_id: access.doctorId ?? null,
        doctor_name: access.doctorName ?? null,
        updated_at: now,
      } as any)
      .eq("id", encounterId)
      .eq("patient_id", patientId);

    const patch = {
      encounter_id: encounterId,
      code: data.code ?? data.icdCode ?? "Z00.00",
      description: data.description ?? data.diagnosis ?? "",
      category: data.category ?? "Primary",
      status: data.status ?? "Active",
      created_at: now,
    };

    let targetId = recordId;
    if (!targetId) {
      const { data: existing } = await sqlDb
        .from("encounter_diagnoses")
        .select("id")
        .eq("encounter_id", encounterId)
        .maybeSingle();
      if (existing?.id) targetId = existing.id;
    }

    if (targetId) {
      const { data: updated, error } = await sqlDb
        .from("encounter_diagnoses")
        .update(patch as any)
        .eq("id", targetId)
        .eq("encounter_id", encounterId)
        .select("*")
        .maybeSingle();
      if (error) return fail(error.message);
      return ok({ diagnosis: updated });
    } else {
      const { data: created, error } = await sqlDb
        .from("encounter_diagnoses")
        .insert(patch as any)
        .select("*")
        .maybeSingle();
      if (error) return fail(error.message);
      return ok({ diagnosis: created });
    }
  },

  saveVitalSigns: async (
    patientId: string,
    encounterId: string,
    data: Record<string, any>,
    recordId?: string,
  ): Promise<Result<any>> => {
    const access = await verifyDoctorAccess(patientId, encounterId);
    if (!access.authorized)
      return fail(
        access.error ?? "403 Forbidden: Only authorized doctors can edit medical records.",
      );

    const now = new Date().toISOString();
    await sqlDb
      .from("encounters")
      .update({
        doctor_id: access.doctorId ?? null,
        doctor_name: access.doctorName ?? null,
        updated_at: now,
      } as any)
      .eq("id", encounterId)
      .eq("patient_id", patientId);

    const patch = {
      encounter_id: encounterId,
      blood_pressure:
        data.blood_pressure ??
        data.bloodPressure ??
        (data.systolic && data.diastolic ? `${data.systolic}/${data.diastolic}` : null),
      heart_rate: data.heart_rate
        ? Number(data.heart_rate)
        : data.heartRate
          ? Number(data.heartRate)
          : null,
      respiratory_rate: data.respiratory_rate
        ? Number(data.respiratory_rate)
        : data.respiratoryRate
          ? Number(data.respiratoryRate)
          : null,
      temperature: data.temperature
        ? Number(data.temperature)
        : data.temp
          ? Number(data.temp)
          : null,
      oxygen_saturation: data.oxygen_saturation
        ? Number(data.oxygen_saturation)
        : data.oxygenSaturation
          ? Number(data.oxygenSaturation)
          : null,
      height_cm: data.height_cm ? Number(data.height_cm) : data.height ? Number(data.height) : null,
      weight_kg: data.weight_kg ? Number(data.weight_kg) : data.weight ? Number(data.weight) : null,
      recorded_at: data.recorded_at ?? now,
    };

    let targetId = recordId;
    if (!targetId) {
      const { data: existing } = await sqlDb
        .from("vital_signs")
        .select("id")
        .eq("encounter_id", encounterId)
        .maybeSingle();
      if (existing?.id) targetId = existing.id;
    }

    if (targetId) {
      const { data: updated, error } = await sqlDb
        .from("vital_signs")
        .update(patch as any)
        .eq("id", targetId)
        .eq("encounter_id", encounterId)
        .select("*")
        .maybeSingle();
      if (error) return fail(error.message);
      return ok({ vitals: updated });
    } else {
      const { data: created, error } = await sqlDb
        .from("vital_signs")
        .insert(patch as any)
        .select("*")
        .maybeSingle();
      if (error) return fail(error.message);
      return ok({ vitals: created });
    }
  },

  saveProcedure: async (
    patientId: string,
    encounterId: string,
    data: Record<string, any>,
    recordId?: string,
  ): Promise<Result<any>> => {
    const access = await verifyDoctorAccess(patientId, encounterId);
    if (!access.authorized)
      return fail(
        access.error ?? "403 Forbidden: Only authorized doctors can edit medical records.",
      );

    const now = new Date().toISOString();
    await sqlDb
      .from("encounters")
      .update({
        doctor_id: access.doctorId ?? null,
        doctor_name: access.doctorName ?? null,
        updated_at: now,
      } as any)
      .eq("id", encounterId)
      .eq("patient_id", patientId);

    const patch = {
      encounter_id: encounterId,
      name: data.name ?? data.procedureName ?? "",
      code: data.code ?? "",
      notes: data.notes ?? "",
      performed_at: data.performed_at ?? now,
    };

    let targetId = recordId;
    if (!targetId) {
      const { data: existing } = await sqlDb
        .from("procedures")
        .select("id")
        .eq("encounter_id", encounterId)
        .maybeSingle();
      if (existing?.id) targetId = existing.id;
    }

    if (targetId) {
      const { data: updated, error } = await sqlDb
        .from("procedures")
        .update(patch as any)
        .eq("id", targetId)
        .eq("encounter_id", encounterId)
        .select("*")
        .maybeSingle();
      if (error) return fail(error.message);
      return ok({ procedure: updated });
    } else {
      const { data: created, error } = await sqlDb
        .from("procedures")
        .insert(patch as any)
        .select("*")
        .maybeSingle();
      if (error) return fail(error.message);
      return ok({ procedure: created });
    }
  },

  savePrescription: async (
    patientId: string,
    encounterId: string,
    data: Record<string, any>,
    recordId?: string,
  ): Promise<Result<any>> => {
    const access = await verifyDoctorAccess(patientId, encounterId);
    if (!access.authorized)
      return fail(
        access.error ?? "403 Forbidden: Only authorized doctors can edit medical records.",
      );

    const doctorName = access.doctorName ?? "Dr. Physician";
    const now = new Date().toISOString();

    await sqlDb
      .from("encounters")
      .update({
        doctor_id: access.doctorId ?? null,
        doctor_name: access.doctorName ?? null,
        updated_at: now,
      } as any)
      .eq("id", encounterId)
      .eq("patient_id", patientId);

    const patch = {
      patient_id: patientId,
      encounter_id: encounterId,
      drug: data.drug ?? data.medicationName ?? data.med ?? "",
      dosage: data.dosage ?? "",
      frequency: data.frequency ?? "",
      duration: data.duration ?? "",
      instructions: data.instructions ?? data.instruction ?? "",
      prescribed_by: doctorName,
      status: data.status ?? "Active",
      created_at: now,
    };

    let targetId = recordId;
    if (!targetId) {
      const { data: existing } = await sqlDb
        .from("prescriptions")
        .select("id")
        .eq("encounter_id", encounterId)
        .eq("drug", patch.drug)
        .maybeSingle();
      if (existing?.id) targetId = existing.id;
    }

    if (targetId) {
      const { data: updated, error } = await sqlDb
        .from("prescriptions")
        .update(patch as any)
        .eq("id", targetId)
        .eq("encounter_id", encounterId)
        .select("*")
        .maybeSingle();
      if (error) return fail(error.message);
      return ok({ prescription: updated });
    } else {
      const { data: created, error } = await sqlDb
        .from("prescriptions")
        .insert(patch as any)
        .select("*")
        .maybeSingle();
      if (error) return fail(error.message);
      return ok({ prescription: created });
    }
  },

  saveLabResult: async (
    patientId: string,
    encounterId: string,
    data: Record<string, any>,
    recordId?: string,
  ): Promise<Result<any>> => {
    const access = await verifyDoctorAccess(patientId, encounterId);
    if (!access.authorized)
      return fail(
        access.error ?? "403 Forbidden: Only authorized doctors can edit medical records.",
      );

    const now = new Date().toISOString();
    await sqlDb
      .from("encounters")
      .update({
        doctor_id: access.doctorId ?? null,
        doctor_name: access.doctorName ?? null,
        updated_at: now,
      } as any)
      .eq("id", encounterId)
      .eq("patient_id", patientId);

    const patch = {
      patient_id: patientId,
      encounter_id: encounterId,
      test_name: data.test_name ?? data.testName ?? data.test ?? "",
      result: data.result ?? data.value ?? "",
      unit: data.unit ?? "",
      reference_range: data.reference_range ?? data.referenceRange ?? data.range ?? "",
      status: data.status ?? "Completed",
      resulted_at: data.resulted_at ?? now,
    };

    let targetId = recordId;
    if (!targetId) {
      const { data: existing } = await sqlDb
        .from("lab_results")
        .select("id")
        .eq("encounter_id", encounterId)
        .eq("test_name", patch.test_name)
        .maybeSingle();
      if (existing?.id) targetId = existing.id;
    }

    if (targetId) {
      const { data: updated, error } = await sqlDb
        .from("lab_results")
        .update(patch as any)
        .eq("id", targetId)
        .eq("encounter_id", encounterId)
        .select("*")
        .maybeSingle();
      if (error) return fail(error.message);
      return ok({ lab: updated });
    } else {
      const { data: created, error } = await sqlDb
        .from("lab_results")
        .insert(patch as any)
        .select("*")
        .maybeSingle();
      if (error) return fail(error.message);
      return ok({ lab: created });
    }
  },

  saveImagingRecord: async (
    patientId: string,
    encounterId: string,
    data: Record<string, any>,
    recordId?: string,
  ): Promise<Result<any>> => {
    const access = await verifyDoctorAccess(patientId, encounterId);
    if (!access.authorized)
      return fail(
        access.error ?? "403 Forbidden: Only authorized doctors can edit medical records.",
      );

    const now = new Date().toISOString();
    await sqlDb
      .from("encounters")
      .update({
        doctor_id: access.doctorId ?? null,
        doctor_name: access.doctorName ?? null,
        updated_at: now,
      } as any)
      .eq("id", encounterId)
      .eq("patient_id", patientId);

    const patch = {
      patient_id: patientId,
      encounter_id: encounterId,
      modality: data.modality ?? data.examinationName ?? data.type ?? "",
      body_part: data.body_part ?? data.facility ?? "",
      findings: data.findings ?? "",
      impression: data.impression ?? "",
      status: data.status ?? "Completed",
      image_url: data.image_url ?? data.imageUrl ?? null,
      taken_at: data.taken_at ?? now,
    };

    let targetId = recordId;
    if (!targetId) {
      const { data: existing } = await sqlDb
        .from("imaging_records")
        .select("id")
        .eq("encounter_id", encounterId)
        .eq("modality", patch.modality)
        .maybeSingle();
      if (existing?.id) targetId = existing.id;
    }

    if (targetId) {
      const { data: updated, error } = await sqlDb
        .from("imaging_records")
        .update(patch as any)
        .eq("id", targetId)
        .eq("encounter_id", encounterId)
        .select("*")
        .maybeSingle();
      if (error) return fail(error.message);
      return ok({ imaging: updated });
    } else {
      const { data: created, error } = await sqlDb
        .from("imaging_records")
        .insert(patch as any)
        .select("*")
        .maybeSingle();
      if (error) return fail(error.message);
      return ok({ imaging: created });
    }
  },

  saveClinicalNotes: async (
    patientId: string,
    encounterId: string,
    data: Record<string, any>,
  ): Promise<Result<any>> => {
    const access = await verifyDoctorAccess(patientId, encounterId);
    if (!access.authorized)
      return fail(
        access.error ?? "403 Forbidden: Only authorized doctors can edit medical records.",
      );

    const now = new Date().toISOString();
    const patch: Record<string, any> = {
      updated_at: now,
      doctor_id: access.doctorId ?? null,
      doctor_name: access.doctorName ?? null,
    };
    if (data.chief_complaint !== undefined) patch.chief_complaint = data.chief_complaint;
    if (data.history_of_present_illness !== undefined)
      patch.history_of_present_illness = data.history_of_present_illness;
    if (data.diagnosis !== undefined) patch.diagnosis = data.diagnosis;
    if (data.treatment_provided !== undefined) patch.treatment_provided = data.treatment_provided;
    if (data.follow_up_recommendations !== undefined)
      patch.follow_up_recommendations = data.follow_up_recommendations;
    if (data.encounter_notes !== undefined) patch.encounter_notes = data.encounter_notes;
    if (data.summary !== undefined) patch.summary = data.summary;
    if (data.status !== undefined) patch.status = data.status;

    const { data: updated, error } = await sqlDb
      .from("encounters")
      .update(patch as any)
      .eq("id", encounterId)
      .eq("patient_id", patientId)
      .select("*, profiles(name)")
      .maybeSingle();
    if (error) return fail(error.message);
    if (!updated) return fail("Encounter not found");

    return ok({ encounter: mapEncounter(updated) });
  },

  deleteMedicalRecord: async (
    patientId: string,
    encounterId: string,
    kind: string,
    recordId: string,
  ): Promise<Result<any>> => {
    const access = await verifyDoctorAccess(patientId, encounterId);
    if (!access.authorized)
      return fail(
        access.error ?? "403 Forbidden: Only authorized doctors can delete medical records.",
      );

    const tableMap: Record<string, string> = {
      soap: "soap_notes",
      diagnosis: "encounter_diagnoses",
      vital: "vital_signs",
      procedure: "procedures",
      prescription: "prescriptions",
      lab: "lab_results",
      imaging: "imaging_records",
    };

    const tableName = tableMap[kind];
    if (!tableName) return fail("Invalid record type");

    const { error } = await sqlDb
      .from(tableName as any)
      .delete()
      .eq("id", recordId)
      .eq("encounter_id", encounterId);
    if (error) return fail(error.message);

    await sqlDb
      .from("encounters")
      .update({
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", encounterId)
      .eq("patient_id", patientId);

    return ok({ success: true });
  },

  getDoctorDashboard: async (): Promise<Result<any>> => {
    const doctor = await getCurrentDoctor();
    const docName = doctor?.name ?? "Doctor";
    const docSpec = doctor?.specialty ?? "General Medicine";
    const docId = doctor?.id;

    // Fetch appointments
    const { data: allAppts } = await sqlDb
      .from("appointments")
      .select("*, profiles(name)")
      .order("appointment_date", { ascending: false });
    const doctorAppts = (allAppts ?? []).filter((a) => {
      if (docId && a.doctor_id === docId) return true;
      if (
        docName &&
        a.doctor_name &&
        (a.doctor_name === docName || a.doctor_name.toLowerCase().includes(docName.toLowerCase()))
      )
        return true;
      return false;
    });

    const confirmedAppts = doctorAppts.filter((a) =>
      CONFIRMED_APPOINTMENT_STATUSES.includes(a.status),
    );
    const pendingAppts = doctorAppts.filter((a) => a.status === "Pending");

    // Fetch encounters
    const { data: allEncounters } = await sqlDb
      .from("encounters")
      .select("*, profiles(name)")
      .order("encounter_date", { ascending: false });
    const doctorEncounters = (allEncounters ?? []).filter((e) => {
      if (docId && e.doctor_id === docId) return true;
      if (
        docName &&
        e.doctor_name &&
        (e.doctor_name === docName || e.doctor_name.toLowerCase().includes(docName.toLowerCase()))
      )
        return true;
      return false;
    });

    // Fetch patients
    const { data: profiles } = await sqlDb.from("profiles").select("*");
    const assignedPatients = (profiles ?? []).filter((p) => {
      return (
        p.assigned_doctor &&
        (p.assigned_doctor === docName ||
          p.assigned_doctor.toLowerCase().includes(docName.toLowerCase()))
      );
    });

    // Queue
    const { data: queue } = await sqlDb.from("queue_entries").select("*").eq("status", "Waiting");
    const doctorQueue = (queue ?? []).filter(
      (q) => q.doctor_name === docName || q.department === docSpec,
    );

    return ok({
      doctor: { name: docName, specialty: docSpec, id: docId },
      summary: {
        assignedPatients: assignedPatients.length,
        upcomingAppointments: doctorAppts.filter(
          (a) => a.status !== "Completed" && a.status !== "Cancelled",
        ).length,
        encounters: doctorEncounters.length,
        waitingInQueue: doctorQueue.length,
        pendingAppointments: pendingAppts.length,
        confirmedAppointments: confirmedAppts.length,
      },
      recentAppointments: doctorAppts.slice(0, 5).map(mapAppointment),
      recentEncounters: doctorEncounters.slice(0, 5).map(mapEncounter),
      assignedPatients: assignedPatients.slice(0, 5).map(mapPatient),
    });
  },
};
