import React, { useEffect, useState, useMemo } from "react";
import { useParams, useLocation } from "@/lib/router-compat";
import { usePortalBase } from "@/lib/portal-base";
import { toast } from "sonner";
import { safeFormatDate } from "@/lib/date-utils";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  FileText,
  Download,
  Eye,
  Activity,
  Clock,
  Stethoscope,
  Pill,
  FlaskConical,
  DollarSign,
  ShoppingBag,
  AlertCircle,
  TrendingUp,
  Droplet,
  Heart,
  Wind,
  Thermometer,
  Plus,
  Edit3,
  Trash2,
  Save,
  X,
  ShieldAlert,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import StatusBadge from "@/components/portal/admin/StatusBadge";

type PatientProfile = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  dob?: string;
  age?: number;
  sex?: string;
  bloodType?: string;
  allergies?: string[];
  address?: string;
  emergencyContact?: {
    name: string;
    relation: string;
    phone: string;
  };
  insurance?: Array<{
    provider: string;
    planName?: string;
    policyNumber: string;
    coverageLimit?: string;
    remainingCoverage?: string;
    status?: string;
    expirationDate?: string;
    id?: string;
  }>;
  assignedPhysician?: {
    name: string;
    specialty: string;
  };
  status: string;
  createdAt: string;
  documents?: Array<{
    id: string;
    encounterRef?: string | null;
    name: string;
    type: string | null;
    uploadedAt: string;
    fileType?: string;
    sourceKind?: string;
    metadata?: {
      fileSize?: string | number | null;
      date?: string | null;
    };
  }>;
  appointments?: Array<{
    id: string;
    date?: string;
    time?: string;
    doctor?: string;
    department?: string;
    status: string;
    clinic?: string;
    appointmentDate?: string;
    appointmentTime?: string;
    doctorName?: string;
    specialty?: string;
  }>;
  records?: Array<{
    id: string;
    kind: string;
    encounterRef?: string | null;
    data: Record<string, any>;
    createdAt: string;
  }>;
  encounters?: Array<Record<string, any>>;
  queue?: {
    id: string;
    status: string;
    department: string;
    position?: number;
    estimatedWaitTime?: number;
  } | null;
  billing?: {
    totalOutstanding: number;
    paidBills?: number;
    insuranceCoverage?: number;
    recentBills: Array<{
      id: string;
      invoiceNo: string;
      amount: number;
      status: string;
      dueDate?: string;
    }>;
    recentPayments?: Array<{
      invoiceNo: string;
      amount: number;
      status: string;
      paidAt?: string | Date | null;
    }>;
  };
  medicalStore?: {
    recentOrders: Array<{
      id: string;
      orderNo: string;
      totalAmount: number;
      status: string;
      orderDate: string;
      paymentStatus?: string;
      fulfillmentType?: string;
      pickupBranch?: string | null;
      deliveryStatus?: string;
    }>;
  };
};

export default function AdminPatientProfile() {
  const portalBase = usePortalBase();
  const params = useParams();
  const [, setLocation] = useLocation();
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [documentPreview, setDocumentPreview] = useState<any | null>(null);
  const [updatingAppointment, setUpdatingAppointment] = useState<string | null>(null);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);
  const [encounterScopedRecords, setEncounterScopedRecords] = useState<
    PatientProfile["records"] | null
  >(null);
  const [loadingEncounterRecords, setLoadingEncounterRecords] = useState(false);

  // Doctor Edit Modal States
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [isSavingRecord, setIsSavingRecord] = useState(false);

  const patientId = params.id;

  const refreshPatient = async (
    forceSelectEncounterId?: string,
  ): Promise<PatientProfile | null> => {
    if (!patientId) return null;
    try {
      const { data, error } = await apiClient.getAdminPatient?.(patientId);
      if (error) {
        setAuthError(error);
        return null;
      }
      if (data) {
        setAuthError(null);
        const payload = data as any;
        const profile = payload.patient ?? payload;
        const insurance = Array.isArray(payload.insurance)
          ? payload.insurance
          : payload.insurance
            ? [payload.insurance]
            : [];
        const emergencyContact = profile.emergencyContactName
          ? {
              name: profile.emergencyContactName,
              relation: profile.emergencyContactRelation ?? "Emergency contact",
              phone: profile.emergencyContactPhone ?? "—",
            }
          : undefined;
        const encountersList = Array.isArray(payload.encounters) ? payload.encounters : [];
        const rawRecords = Array.isArray(payload.records) ? payload.records : [];
        const encounterRecords = encountersList.map((e: any) => ({
          id: String(e.id),
          kind: "encounter",
          encounterRef: String(e.id),
          data: e,
          createdAt: String(e.createdAt ?? e.date ?? ""),
        }));
        const combinedRecords = [
          ...encounterRecords,
          ...rawRecords.filter((r: any) => r.kind !== "encounter"),
        ];

        const updatedProfile = {
          ...profile,
          emergencyContact,
          insurance: insurance.map((policy: any) => ({
            id: policy.id,
            provider: policy.provider,
            planName: policy.planName,
            policyNumber: policy.policyNumber,
            coverageLimit: policy.coverageLimit,
            remainingCoverage: policy.remainingCoverage,
            status: policy.status,
            expirationDate: policy.expirationDate,
          })),
          assignedPhysician: profile.assignedPhysician
            ? {
                name: profile.assignedPhysician.name,
                specialty:
                  profile.assignedPhysician.department ??
                  profile.assignedPhysician.specialty ??
                  "Clinical care",
              }
            : undefined,
          documents: payload.documents ?? [],
          records: combinedRecords,
          encounters: encountersList,
          appointments: payload.appointments ?? [],
          queue: payload.queue ?? null,
          billing: payload.billing ?? { totalOutstanding: 0, recentBills: [] },
          medicalStore: payload.medicalStore ?? { recentOrders: [] },
        } as PatientProfile;

        setPatient(updatedProfile);

        if (forceSelectEncounterId) {
          setSelectedEncounterId(forceSelectEncounterId);
        }

        return updatedProfile;
      }
    } catch (err) {
      console.error("Error refreshing patient:", err);
    }
    return null;
  };

  const refreshEncounterRecords = () => {
    if (!patientId || !selectedEncounterId) return;
    setLoadingEncounterRecords(true);
    apiClient
      .getAdminPatientEncounterRecords(patientId, selectedEncounterId)
      .then(({ data, error }) => {
        if (error || !data) {
          setLoadingEncounterRecords(false);
          return;
        }
        const encounter = data.encounter;
        setEncounterScopedRecords([
          {
            id: String(encounter.id),
            kind: "encounter",
            data: encounter,
            createdAt: String(encounter.createdAt ?? ""),
          },
          ...(data.records as NonNullable<PatientProfile["records"]>),
        ]);
        setLoadingEncounterRecords(false);
      });
  };

  useEffect(() => {
    if (!patientId) return;

    setIsLoading(true);
    setAuthError(null);
    apiClient
      .getAdminPatient?.(patientId)
      .then(({ data, error }) => {
        if (error) {
          setAuthError(error);
          toast.error(error);
        } else if (data) {
          const payload = data as any;
          const profile = payload.patient ?? payload;
          const insurance = Array.isArray(payload.insurance)
            ? payload.insurance
            : payload.insurance
              ? [payload.insurance]
              : [];
          const emergencyContact = profile.emergencyContactName
            ? {
                name: profile.emergencyContactName,
                relation: profile.emergencyContactRelation ?? "Emergency contact",
                phone: profile.emergencyContactPhone ?? "—",
              }
            : undefined;
          const encountersList = Array.isArray(payload.encounters) ? payload.encounters : [];
          const rawRecords = Array.isArray(payload.records) ? payload.records : [];
          const encounterRecords = encountersList.map((e: any) => ({
            id: String(e.id),
            kind: "encounter",
            encounterRef: String(e.id),
            data: e,
            createdAt: String(e.createdAt ?? e.date ?? ""),
          }));
          const combinedRecords = [
            ...encounterRecords,
            ...rawRecords.filter((r: any) => r.kind !== "encounter"),
          ];

          setPatient({
            ...profile,
            emergencyContact,
            insurance: insurance.map((policy: any) => ({
              id: policy.id,
              provider: policy.provider,
              planName: policy.planName,
              policyNumber: policy.policyNumber,
              coverageLimit: policy.coverageLimit,
              remainingCoverage: policy.remainingCoverage,
              status: policy.status,
              expirationDate: policy.expirationDate,
            })),
            assignedPhysician: profile.assignedPhysician
              ? {
                  name: profile.assignedPhysician.name,
                  specialty:
                    profile.assignedPhysician.department ??
                    profile.assignedPhysician.specialty ??
                    "Clinical care",
                }
              : undefined,
            documents: payload.documents ?? [],
            records: combinedRecords,
            encounters: encountersList,
            appointments: payload.appointments ?? [],
            queue: payload.queue ?? null,
            billing: payload.billing ?? { totalOutstanding: 0, recentBills: [] },
            medicalStore: payload.medicalStore ?? { recentOrders: [] },
          } as PatientProfile);

          if (encountersList.length > 0) {
            setSelectedEncounterId(String(encountersList[0].id));
          } else {
            const latestEncounter = combinedRecords
              .filter((record: any) => record.kind === "encounter")
              .sort(
                (left: any, right: any) =>
                  new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
              )[0];
            setSelectedEncounterId(latestEncounter?.id ?? null);
          }
          setEncounterScopedRecords(null);
        }
      })
      .finally(() => setIsLoading(false));
  }, [patientId]);

  useEffect(() => {
    if (!patientId || !selectedEncounterId) {
      setEncounterScopedRecords(null);
      setLoadingEncounterRecords(false);
      return;
    }
    let active = true;
    setLoadingEncounterRecords(true);
    setEncounterScopedRecords(null);
    apiClient
      .getAdminPatientEncounterRecords(patientId, selectedEncounterId)
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) {
          toast.error(error ?? "Could not load encounter records.");
          setEncounterScopedRecords(null);
          setLoadingEncounterRecords(false);
          return;
        }
        const encounter = data.encounter;
        setEncounterScopedRecords([
          {
            id: String(encounter.id),
            kind: "encounter",
            data: encounter,
            createdAt: String(encounter.createdAt ?? ""),
          },
          ...(data.records as NonNullable<PatientProfile["records"]>),
        ]);
        setLoadingEncounterRecords(false);
      });
    return () => {
      active = false;
    };
  }, [patientId, selectedEncounterId]);

  // All encounters regardless of selection — memoized, deduplicated and sorted newest first
  const allEncounters: Array<Record<string, any>> = useMemo(() => {
    if (!patient) return [];
    const fromEncounters = (patient.encounters ?? []).map((e: any) => ({
      ...e,
      _id: String(e.id || e._id),
      _createdAt: e.createdAt ?? e.date ?? new Date().toISOString(),
    }));
    const fromRecords = (patient.records ?? [])
      .filter((r) => r.kind === "encounter")
      .map((r) => ({ ...r.data, _id: String(r.id), _createdAt: r.createdAt }));

    const map = new Map<string, Record<string, any>>();
    for (const item of [...fromEncounters, ...fromRecords]) {
      if (item._id) map.set(item._id, item);
    }

    return Array.from(map.values()).sort((a, b) => {
      const dateA = new Date(a.date || a.encounterDate || a._createdAt || 0).getTime();
      const dateB = new Date(b.date || b.encounterDate || b._createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [patient]);

  // Ensure an encounter is selected whenever allEncounters changes
  useEffect(() => {
    if (allEncounters.length > 0) {
      if (!selectedEncounterId || !allEncounters.some((e) => e._id === selectedEncounterId)) {
        setSelectedEncounterId(allEncounters[0]._id);
      }
    } else {
      setSelectedEncounterId(null);
    }
  }, [allEncounters, selectedEncounterId]);

  const handleDeleteRecord = async (kind: string, recordId: string) => {
    if (!patientId || !selectedEncounterId) return;
    if (!confirm("Are you sure you want to delete this medical record?")) return;
    setIsSavingRecord(true);
    const res = await apiClient.deleteMedicalRecord(patientId, selectedEncounterId, kind, recordId);
    setIsSavingRecord(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Record deleted successfully");
    refreshEncounterRecords();
  };

  const handleSaveModal = async (formData: any) => {
    if (!patientId) return;
    setIsSavingRecord(true);

    try {
      if (activeModal === "new-encounter") {
        const res = await apiClient.createEncounterForDoctor(patientId, formData);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success("New encounter created successfully");
        const newEnc = res.data?.encounter;
        if (newEnc?.id) {
          const newEncId = String(newEnc.id);
          setSelectedEncounterId(newEncId);
          await refreshPatient(newEncId);
        } else {
          await refreshPatient();
        }
      } else if (!selectedEncounterId) {
        toast.error("Please select an encounter first");
        return;
      } else if (activeModal === "soap") {
        const res = await apiClient.saveSoapNote(
          patientId,
          selectedEncounterId,
          formData,
          editingRecord?._id ?? editingRecord?.id,
        );
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(editingRecord ? "SOAP note updated" : "SOAP note added");
        refreshEncounterRecords();
      } else if (activeModal === "diagnosis") {
        const res = await apiClient.saveDiagnosis(
          patientId,
          selectedEncounterId,
          formData,
          editingRecord?._id ?? editingRecord?.id,
        );
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(editingRecord ? "Diagnosis updated" : "Diagnosis added");
        refreshEncounterRecords();
      } else if (activeModal === "vital") {
        const res = await apiClient.saveVitalSigns(
          patientId,
          selectedEncounterId,
          formData,
          editingRecord?._id ?? editingRecord?.id,
        );
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(editingRecord ? "Vital signs updated" : "Vital signs recorded");
        refreshEncounterRecords();
      } else if (activeModal === "procedure") {
        const res = await apiClient.saveProcedure(
          patientId,
          selectedEncounterId,
          formData,
          editingRecord?._id ?? editingRecord?.id,
        );
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(editingRecord ? "Procedure updated" : "Procedure added");
        refreshEncounterRecords();
      } else if (activeModal === "prescription") {
        const res = await apiClient.savePrescription(
          patientId,
          selectedEncounterId,
          formData,
          editingRecord?._id ?? editingRecord?.id,
        );
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(editingRecord ? "Prescription updated" : "Prescription added");
        refreshEncounterRecords();
      } else if (activeModal === "lab") {
        const res = await apiClient.saveLabResult(
          patientId,
          selectedEncounterId,
          formData,
          editingRecord?._id ?? editingRecord?.id,
        );
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(editingRecord ? "Lab result updated" : "Lab result saved");
        refreshEncounterRecords();
      } else if (activeModal === "imaging") {
        const res = await apiClient.saveImagingRecord(
          patientId,
          selectedEncounterId,
          formData,
          editingRecord?._id ?? editingRecord?.id,
        );
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(editingRecord ? "Imaging record updated" : "Imaging record saved");
        refreshEncounterRecords();
      } else if (activeModal === "clinical-notes") {
        const res = await apiClient.saveClinicalNotes(patientId, selectedEncounterId, formData);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success("Clinical notes updated");
        await refreshPatient();
        refreshEncounterRecords();
      }
      setActiveModal(null);
      setEditingRecord(null);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save record");
    } finally {
      setIsSavingRecord(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-12 bg-muted rounded" />
        <div className="h-48 bg-muted rounded-xl" />
        <div className="h-64 bg-muted rounded-xl" />
      </div>
    );
  }

  if (authError) {
    const isPendingIssue =
      authError.toLowerCase().includes("pending") || authError.toLowerCase().includes("confirm");
    return (
      <div className="py-16 max-w-md mx-auto text-center space-y-4" id="restricted-access-notice">
        <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Access Restricted</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{authError}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {isPendingIssue && (
            <button
              onClick={() => setLocation(`${portalBase}/appointments`)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              Go to Appointments to Confirm
            </button>
          )}
          <button
            onClick={() => setLocation(`${portalBase}/patients`)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium text-sm hover:bg-secondary/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Patients
          </button>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Patient not found</p>
        <button
          onClick={() => setLocation(`${portalBase}/patients`)}
          className="mt-4 text-primary hover:underline"
          data-testid="link-back-patients"
        >
          Back to patients
        </button>
      </div>
    );
  }

  const recordRows = patient.records ?? [];

  // Encounter-specific cards only use the server response for the selected encounter.
  // Never fall back to the patient's complete record list while this request is pending.
  const filteredRecordRows =
    selectedEncounterId && encounterScopedRecords ? encounterScopedRecords : [];

  const recordsOf = (kind: string): Array<Record<string, any>> =>
    filteredRecordRows
      .filter((record) => record.kind === kind)
      .map((record) => ({ ...record.data, _id: record.id, _createdAt: record.createdAt }));

  const vitals = recordsOf("vital");
  const prescriptions = recordsOf("prescription");
  const labs = recordsOf("lab");
  const imaging = recordsOf("imaging");
  const soapNotes = recordsOf("soap");
  const diagnoses = recordsOf("diagnosis");
  const procedures = recordsOf("procedure");

  const currentAppointment = patient.appointments?.filter((apt) =>
    ["Pending", "Confirmed", "Checked In", "Waiting", "In Progress"].includes(apt.status),
  )[0];
  const selectedEncounter = allEncounters.find(
    (encounter) => encounter._id === selectedEncounterId,
  );
  const visibleDocuments = (patient.documents ?? []).filter(
    (document) => !document.encounterRef || document.encounterRef === selectedEncounterId,
  );

  const currentUser = (() => {
    try {
      const raw = localStorage.getItem("sugbodoc_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const isDoctor = currentUser?.role === "doctor" && portalBase === "/doctor";

  const updateAppointment = async (id: string, status: string) => {
    setUpdatingAppointment(id);
    const result = await apiClient.updateAdminAppointmentStatus(id, status);
    setUpdatingAppointment(null);
    if (result.error || !result.data) {
      toast.error(result.error ?? "Could not update appointment.");
      return;
    }
    setPatient((current) =>
      current
        ? {
            ...current,
            appointments: current.appointments?.map((appointment) =>
              appointment.id === id ? { ...appointment, status } : appointment,
            ),
          }
        : current,
    );
    toast.success("Appointment status updated and patient notified.");
  };

  const previewDocument = async (document: any) => {
    const result = await apiClient.getAdminPatientDocument?.(patient.id, document.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setDocumentPreview(result.data);
  };

  const downloadDocument = (documentRecord: any) => {
    const content = JSON.stringify(
      documentPreview?.record?.data ?? documentRecord.metadata ?? documentRecord,
      null,
      2,
    );
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${
      String(documentRecord.name)
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase() || "medical-document"
    }.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const isAbnormal = (value: number | string | undefined, range: { min: number; max: number }) => {
    if (value === undefined || value === null || value === "—") return false;
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return false;
    return num < range.min || num > range.max;
  };

  return (
    <div className="space-y-6 animate-in slide-up">
      {/* Header */}
      <div>
        <button
          onClick={() => setLocation(`${portalBase}/patients`)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to patients
        </button>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold shrink-0">
              {patient.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{patient.name}</h1>
              <p className="text-sm text-muted-foreground font-mono mt-1">ID: {patient.id}</p>
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={patient.status} />
                <span className="text-xs text-muted-foreground">
                  Registered {safeFormatDate(patient.createdAt, "patient.createdAt")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Section title="Patient Information">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <InfoCard title="Patient Information" icon={<User className="w-4 h-4" />}>
            <InfoRow label="Patient ID" value={patient.id} />
            <InfoRow label="Full Name" value={patient.name} />
            <InfoRow label="Date of Birth" value={safeFormatDate(patient.dob, "patient.dob")} />
            <InfoRow label="Age" value={patient.age ? `${patient.age} years` : "—"} />
            <InfoRow label="Sex" value={patient.sex || "—"} />
            <InfoRow label="Blood Type" value={patient.bloodType || "—"} />
            <InfoRow label="Civil Status" value="—" />
            <InfoRow label="Nationality" value="Filipino" />
            <InfoRow
              label="Registration Date"
              value={safeFormatDate(patient.createdAt, "patient.createdAt")}
            />
            <InfoRow label="Last Login" value="Not available" />
            <InfoRow label="Account Status" value={patient.status || "Active"} />
          </InfoCard>
          <InfoCard title="Contact Information" icon={<Mail className="w-4 h-4" />}>
            <InfoRow label="Email" value={patient.email} />
            <InfoRow label="Phone" value={patient.phone || "—"} />
            <InfoRow label="Address" value={patient.address || "—"} />
          </InfoCard>
          <div className="space-y-6">
            {patient.emergencyContact && (
              <InfoCard title="Emergency Contact" icon={<Phone className="w-4 h-4" />}>
                <InfoRow label="Name" value={patient.emergencyContact.name} />
                <InfoRow label="Relation" value={patient.emergencyContact.relation} />
                <InfoRow label="Phone" value={patient.emergencyContact.phone} />
              </InfoCard>
            )}
            {patient.assignedPhysician && (
              <InfoCard title="Primary Care Physician" icon={<Stethoscope className="w-4 h-4" />}>
                <InfoRow label="Name" value={patient.assignedPhysician.name} />
                <InfoRow label="Specialty" value={patient.assignedPhysician.specialty} />
                <InfoRow
                  label="Next Appointment"
                  value={
                    currentAppointment
                      ? `${currentAppointment.date ?? currentAppointment.appointmentDate} · ${currentAppointment.time ?? currentAppointment.appointmentTime}`
                      : "None scheduled"
                  }
                />
                <InfoRow label="Queue Status" value={patient.queue?.status || "Not in queue"} />
              </InfoCard>
            )}
            {patient.allergies && patient.allergies.length > 0 && (
              <InfoCard title="Allergies" icon={<AlertCircle className="w-4 h-4" />}>
                <div className="flex flex-wrap gap-2">
                  {patient.allergies.map((allergy, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded text-xs font-medium"
                    >
                      {allergy}
                    </span>
                  ))}
                </div>
              </InfoCard>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Patient Summary</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryTile
                label="Encounters"
                value={allEncounters.length}
                onClick={() => setLocation(`/admin/encounters?patientId=${patient.id}`)}
              />
              <SummaryTile
                label="Appointments"
                value={patient.appointments?.length ?? 0}
                onClick={() => setLocation(`${portalBase}/appointments`)}
              />
              <SummaryTile
                label="Outstanding Bills"
                value={
                  patient.billing?.recentBills.filter((bill) =>
                    ["Pending", "Failed"].includes(bill.status),
                  ).length ?? 0
                }
                onClick={() => setLocation(`${portalBase}/billing`)}
              />
              <SummaryTile
                label="Store Orders"
                value={patient.medicalStore?.recentOrders.length ?? 0}
                onClick={() => setLocation(`${portalBase}/orders`)}
              />
            </div>
          </div>
          <DocumentsCard
            documents={visibleDocuments}
            onPreview={previewDocument}
            onDownload={downloadDocument}
          />
        </div>
      </Section>

      <Section title="Clinical Records (Encounter Details)">
        {!isDoctor && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 mb-5 text-xs font-medium shadow-sm">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>Read-Only Mode:</strong> Medical record creation and modifications are
              restricted exclusively to authorized doctors. Admins and Patients may view all
              records.
            </span>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground">Encounter History</h3>
                <span className="text-xs text-muted-foreground">({allEncounters.length})</span>
              </div>
              {isDoctor && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingRecord(null);
                    setActiveModal("new-encounter");
                  }}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> New Encounter
                </button>
              )}
            </div>
            {allEncounters.length > 0 ? (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {allEncounters.map((encounter) => {
                  const isSelected = selectedEncounterId === encounter._id;
                  const encDate = encounter.date ?? encounter.encounterDate ?? encounter._createdAt;
                  const encStatus = encounter.status ?? "Completed";
                  return (
                    <button
                      key={encounter._id}
                      onClick={() => setSelectedEncounterId(encounter._id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all border ${
                        isSelected
                          ? "bg-primary/10 border-primary/40 text-foreground font-medium shadow-xs"
                          : "border-border/60 hover:bg-muted/60 text-foreground hover:border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-foreground">
                          {encDate
                            ? safeFormatDate(encDate, "encounter.encounter_date", undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "Recent Encounter"}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            encStatus === "Completed"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : encStatus === "In Progress"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                          }`}
                        >
                          {encStatus}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {encounter.doctor ?? encounter.physician ?? "Provider"} ·{" "}
                        {encounter.department ?? encounter.specialty ?? "Clinical Care"}
                      </div>
                      {(encounter.chiefComplaint ?? encounter.complaint ?? encounter.summary) && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {encounter.chiefComplaint ?? encounter.complaint ?? encounter.summary}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState text="No encounters logged yet." />
            )}
            <div className="mt-3 pt-2 border-t border-border text-xs text-muted-foreground flex items-center gap-1">
              <Activity className="w-3 h-3" />
              Showing records linked to the selected encounter
            </div>
          </div>

          <InfoCard title="Encounter Details" icon={<Stethoscope className="w-4 h-4" />}>
            {selectedEncounter ? (
              <div className="space-y-3">
                {isDoctor && (
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRecord(selectedEncounter);
                        setActiveModal("clinical-notes");
                      }}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 font-medium transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit Encounter Notes
                    </button>
                  </div>
                )}
                <InfoRow label="Date" value={formatRecordDate(selectedEncounter)} />
                <InfoRow
                  label="Appointment"
                  value={
                    selectedEncounter.appointmentId
                      ? `#${selectedEncounter.appointmentId.slice(0, 8)}`
                      : "—"
                  }
                />
                <InfoRow
                  label="Encounter Type"
                  value={selectedEncounter.encounterType ?? "Outpatient Visit"}
                />
                <InfoRow
                  label="Provider"
                  value={selectedEncounter.doctor ?? selectedEncounter.physician ?? "—"}
                />
                <InfoRow
                  label="Department"
                  value={selectedEncounter.department ?? selectedEncounter.specialty ?? "—"}
                />
                <InfoRow label="Clinic" value={selectedEncounter.clinic ?? "—"} />
                <InfoRow
                  label="Chief Complaint"
                  value={selectedEncounter.chiefComplaint ?? selectedEncounter.complaint ?? "—"}
                />
                <InfoRow
                  label="Diagnosis"
                  value={selectedEncounter.diagnosis ?? selectedEncounter.summary ?? "—"}
                />
                <InfoRow label="Status" value={selectedEncounter.status ?? "Completed"} />
              </div>
            ) : (
              <EmptyState text="No encounter selected" />
            )}
          </InfoCard>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Encounter Summary</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SummaryTile label="SOAP Notes" value={soapNotes.length} />
              <SummaryTile label="Diagnoses" value={diagnoses.length} />
              <SummaryTile label="Vital Signs" value={vitals.length} />
              <SummaryTile label="Procedures" value={procedures.length} />
            </div>
            {loadingEncounterRecords && (
              <div className="mt-4 text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Loading selected
                encounter records…
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecordListCard
            title="SOAP Notes"
            icon={<FileText className="w-4 h-4" />}
            records={soapNotes}
            emptyText="No SOAP notes for this encounter."
            headerAction={
              isDoctor ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingRecord(null);
                    setActiveModal("soap");
                  }}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add SOAP
                </button>
              ) : undefined
            }
            onEditRecord={
              isDoctor
                ? (rec) => {
                    setEditingRecord(rec);
                    setActiveModal("soap");
                  }
                : undefined
            }
            onDeleteRecord={isDoctor ? (recId) => handleDeleteRecord("soap", recId) : undefined}
          >
            {(record) => (
              <>
                <InfoRow label="Date" value={formatRecordDate(record)} />
                <InfoRow label="Provider" value={record.doctor ?? record.physician ?? "—"} />
                <RecordText label="Subjective" value={record.subjective} />
                <RecordText label="Objective" value={record.objective} />
                <RecordText label="Assessment" value={record.assessment} />
                <RecordText label="Plan" value={record.plan} />
              </>
            )}
          </RecordListCard>

          <RecordListCard
            title="Diagnoses"
            icon={<Activity className="w-4 h-4" />}
            records={diagnoses}
            emptyText="No diagnoses for this encounter."
            headerAction={
              isDoctor ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingRecord(null);
                    setActiveModal("diagnosis");
                  }}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Diagnosis
                </button>
              ) : undefined
            }
            onEditRecord={
              isDoctor
                ? (rec) => {
                    setEditingRecord(rec);
                    setActiveModal("diagnosis");
                  }
                : undefined
            }
            onDeleteRecord={
              isDoctor ? (recId) => handleDeleteRecord("diagnosis", recId) : undefined
            }
          >
            {(record) => (
              <>
                <InfoRow
                  label="Diagnosis"
                  value={record.diagnosis ?? record.description ?? record.desc ?? "—"}
                />
                <InfoRow label="ICD Code" value={record.icdCode ?? record.code ?? "—"} />
                <InfoRow label="Date" value={formatRecordDate(record)} />
                <InfoRow
                  label="Provider"
                  value={record.diagnosingPhysician ?? record.physician ?? "—"}
                />
                <InfoRow label="Status" value={record.status ?? "—"} />
              </>
            )}
          </RecordListCard>

          <RecordListCard
            title="Vital Signs"
            icon={<Heart className="w-4 h-4" />}
            records={vitals}
            emptyText="No vital signs for this encounter."
            headerAction={
              isDoctor ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingRecord(null);
                    setActiveModal("vital");
                  }}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Record Vitals
                </button>
              ) : undefined
            }
            onEditRecord={
              isDoctor
                ? (rec) => {
                    setEditingRecord(rec);
                    setActiveModal("vital");
                  }
                : undefined
            }
            onDeleteRecord={isDoctor ? (recId) => handleDeleteRecord("vital", recId) : undefined}
          >
            {(record) => (
              <div className="space-y-2.5">
                <div className="text-xs text-muted-foreground">
                  Recorded {formatRecordDate(record)}
                </div>
                <VitalRow
                  icon={<Activity className="w-3.5 h-3.5" />}
                  label="Blood Pressure"
                  value={
                    record.blood_pressure ??
                    record.bloodPressure ??
                    `${record.systolic ?? "—"}/${record.diastolic ?? "—"}`
                  }
                  abnormal={
                    isAbnormal(record.systolic, { min: 90, max: 140 }) ||
                    isAbnormal(record.diastolic, { min: 60, max: 90 })
                  }
                />
                <VitalRow
                  icon={<Heart className="w-3.5 h-3.5" />}
                  label="Heart Rate"
                  value={`${record.heart_rate ?? record.heartRate ?? record.hr ?? "—"} bpm`}
                  abnormal={isAbnormal(record.heart_rate ?? record.heartRate ?? record.hr, {
                    min: 60,
                    max: 100,
                  })}
                />
                <VitalRow
                  icon={<Wind className="w-3.5 h-3.5" />}
                  label="Respiratory Rate"
                  value={`${record.respiratory_rate ?? record.respiratoryRate ?? "—"} /min`}
                  abnormal={isAbnormal(record.respiratory_rate ?? record.respiratoryRate, {
                    min: 12,
                    max: 20,
                  })}
                />
                <VitalRow
                  icon={<Thermometer className="w-3.5 h-3.5" />}
                  label="Temperature"
                  value={`${record.temperature ?? record.temp ?? "—"} °C`}
                  abnormal={isAbnormal(record.temperature ?? record.temp, { min: 36.1, max: 37.2 })}
                />
                <VitalRow
                  icon={<Droplet className="w-3.5 h-3.5" />}
                  label="O₂ Saturation"
                  value={`${record.oxygen_saturation ?? record.oxygenSaturation ?? "—"}%`}
                  abnormal={isAbnormal(record.oxygen_saturation ?? record.oxygenSaturation, {
                    min: 95,
                    max: 100,
                  })}
                />
              </div>
            )}
          </RecordListCard>

          <RecordListCard
            title="Procedures"
            icon={<Activity className="w-4 h-4" />}
            records={procedures}
            emptyText="No procedures for this encounter."
            headerAction={
              isDoctor ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingRecord(null);
                    setActiveModal("procedure");
                  }}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Procedure
                </button>
              ) : undefined
            }
            onEditRecord={
              isDoctor
                ? (rec) => {
                    setEditingRecord(rec);
                    setActiveModal("procedure");
                  }
                : undefined
            }
            onDeleteRecord={
              isDoctor ? (recId) => handleDeleteRecord("procedure", recId) : undefined
            }
          >
            {(record) => (
              <>
                <InfoRow
                  label="Procedure"
                  value={
                    record.name ?? record.procedureName ?? record.type ?? record.description ?? "—"
                  }
                />
                <InfoRow label="Date" value={formatRecordDate(record)} />
                <InfoRow label="Provider" value={record.doctor ?? record.physician ?? "—"} />
                <RecordText label="Notes" value={record.notes} />
                <InfoRow label="Status" value={record.status ?? "—"} />
              </>
            )}
          </RecordListCard>
        </div>
      </Section>

      <Section title="Medications">
        <RecordListCard
          title="Prescriptions"
          icon={<Pill className="w-4 h-4" />}
          records={prescriptions}
          emptyText="No prescriptions for this encounter."
          headerAction={
            isDoctor ? (
              <button
                type="button"
                onClick={() => {
                  setEditingRecord(null);
                  setActiveModal("prescription");
                }}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Prescription
              </button>
            ) : undefined
          }
          onEditRecord={
            isDoctor
              ? (rec) => {
                  setEditingRecord(rec);
                  setActiveModal("prescription");
                }
              : undefined
          }
          onDeleteRecord={
            isDoctor ? (recId) => handleDeleteRecord("prescription", recId) : undefined
          }
        >
          {(record) => (
            <>
              <InfoRow
                label="Medication"
                value={record.drug ?? record.medicationName ?? record.med ?? "—"}
              />
              <InfoRow label="Dosage" value={record.dosage ?? "—"} />
              <InfoRow label="Frequency" value={record.frequency ?? "—"} />
              <InfoRow label="Duration" value={record.duration ?? "—"} />
              <RecordText label="Instructions" value={record.instructions} />
              <InfoRow
                label="Prescriber"
                value={record.prescribingDoctor ?? record.doctor ?? "—"}
              />
              <InfoRow label="Status" value={record.status ?? "—"} />
            </>
          )}
        </RecordListCard>
      </Section>

      <Section title="Diagnostic Results">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecordListCard
            title="Laboratory Results"
            icon={<FlaskConical className="w-4 h-4" />}
            records={labs}
            emptyText="No laboratory results for this encounter."
            headerAction={
              isDoctor ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingRecord(null);
                    setActiveModal("lab");
                  }}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Order / Record Lab
                </button>
              ) : undefined
            }
            onEditRecord={
              isDoctor
                ? (rec) => {
                    setEditingRecord(rec);
                    setActiveModal("lab");
                  }
                : undefined
            }
            onDeleteRecord={isDoctor ? (recId) => handleDeleteRecord("lab", recId) : undefined}
          >
            {(record) => (
              <>
                <InfoRow
                  label="Test"
                  value={record.test_name ?? record.testName ?? record.test ?? "—"}
                />
                <InfoRow
                  label="Result"
                  value={record.result ?? record.resultSummary ?? record.value ?? "—"}
                />
                <InfoRow
                  label="Reference Range"
                  value={record.reference_range ?? record.referenceRange ?? record.range ?? "—"}
                />
                <InfoRow label="Released" value={record.dateReleased ?? formatRecordDate(record)} />
                <InfoRow label="Status" value={record.status ?? record.resultStatus ?? "—"} />
              </>
            )}
          </RecordListCard>

          <RecordListCard
            title="Imaging Results"
            icon={<Eye className="w-4 h-4" />}
            records={imaging}
            emptyText="No imaging results for this encounter."
            headerAction={
              isDoctor ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingRecord(null);
                    setActiveModal("imaging");
                  }}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Order / Record Imaging
                </button>
              ) : undefined
            }
            onEditRecord={
              isDoctor
                ? (rec) => {
                    setEditingRecord(rec);
                    setActiveModal("imaging");
                  }
                : undefined
            }
            onDeleteRecord={isDoctor ? (recId) => handleDeleteRecord("imaging", recId) : undefined}
          >
            {(record) => (
              <>
                <InfoRow
                  label="Examination"
                  value={record.modality ?? record.examinationName ?? record.type ?? "—"}
                />
                <InfoRow label="Date" value={record.imagingDate ?? formatRecordDate(record)} />
                <InfoRow label="Radiologist" value={record.radiologist ?? "—"} />
                <RecordText label="Findings" value={record.findings} />
                <RecordText label="Impression" value={record.impression} />
                <InfoRow label="Status" value={record.status ?? "—"} />
              </>
            )}
          </RecordListCard>
        </div>
      </Section>

      <Section title="Appointments">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InfoCard title="Appointments" icon={<Calendar className="w-4 h-4" />}>
            {patient.appointments && patient.appointments.length > 0 ? (
              patient.appointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="border-t border-border pt-3 first:border-t-0 first:pt-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {appointment.date ?? appointment.appointmentDate} at{" "}
                        {appointment.time ?? appointment.appointmentTime}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {appointment.doctor ?? appointment.doctorName} ·{" "}
                        {appointment.department ?? appointment.specialty}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {appointment.clinic ?? "Clinic unavailable"}
                      </div>
                    </div>
                    <StatusBadge status={appointment.status} />
                  </div>
                </div>
              ))
            ) : (
              <EmptyState text="No appointments found." />
            )}
          </InfoCard>
          <div className="space-y-6">
            {currentAppointment && (
              <InfoCard title="Current Appointment" icon={<Calendar className="w-4 h-4" />}>
                <InfoRow
                  label="Date and Time"
                  value={`${currentAppointment.date ?? currentAppointment.appointmentDate} at ${currentAppointment.time ?? currentAppointment.appointmentTime}`}
                />
                <InfoRow
                  label="Provider"
                  value={currentAppointment.doctor ?? currentAppointment.doctorName ?? "—"}
                />
                <InfoRow label="Clinic" value={currentAppointment.clinic ?? "—"} />
                <select
                  disabled={updatingAppointment === currentAppointment.id}
                  value={currentAppointment.status}
                  onChange={(event) => updateAppointment(currentAppointment.id, event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium"
                >
                  {[
                    "Pending",
                    "Confirmed",
                    "Checked In",
                    "Waiting",
                    "In Progress",
                    "Completed",
                    "Done",
                    "Cancelled",
                    "No Show",
                    "Rescheduled",
                  ].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </InfoCard>
            )}
            {patient.queue && (
              <InfoCard title="Queue Status" icon={<Clock className="w-4 h-4" />}>
                <InfoRow label="Department" value={patient.queue.department} />
                <InfoRow label="Status" value={patient.queue.status} />
                {patient.queue.position !== undefined && (
                  <InfoRow label="Position" value={`#${patient.queue.position}`} />
                )}
                {patient.queue.estimatedWaitTime !== undefined && (
                  <InfoRow label="Est. Wait" value={`${patient.queue.estimatedWaitTime} min`} />
                )}
              </InfoCard>
            )}
          </div>
        </div>
      </Section>

      <Section title="Insurance">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(patient.insurance ?? []).length > 0 ? (
            (patient.insurance ?? []).map((policy, index) => (
              <InfoCard
                key={policy.id ?? `${policy.policyNumber}-${index}`}
                title="Insurance"
                icon={<FileText className="w-4 h-4" />}
              >
                <InfoRow label="Provider" value={policy.provider} />
                <InfoRow label="Plan" value={policy.planName || "—"} />
                <InfoRow label="Policy Number" value={policy.policyNumber} />
                <InfoRow
                  label="Coverage Limit"
                  value={
                    policy.coverageLimit
                      ? `₱${Number(policy.coverageLimit).toLocaleString("en-PH")}`
                      : "—"
                  }
                />
                <InfoRow
                  label="Remaining Coverage"
                  value={
                    policy.remainingCoverage
                      ? `₱${Number(policy.remainingCoverage).toLocaleString("en-PH")}`
                      : "—"
                  }
                />
                <InfoRow label="Coverage Status" value={policy.status || "—"} />
                <InfoRow label="Expiration" value={policy.expirationDate || "—"} />
              </InfoCard>
            ))
          ) : (
            <InfoCard title="Insurance" icon={<FileText className="w-4 h-4" />}>
              <EmptyState text="No insurance policies found." />
            </InfoCard>
          )}
        </div>
      </Section>

      <Section title="Billing & Payments">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Billing & Payments</h3>
            </div>
            <div className="mb-4">
              <div className="text-xs text-muted-foreground">Total Outstanding</div>
              <div className="text-2xl font-bold text-foreground">
                ₱
                {(patient.billing?.totalOutstanding ?? 0).toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                <div className="rounded-lg bg-muted/40 p-2">
                  <span className="block text-muted-foreground">Paid bills</span>
                  <strong>{patient.billing?.paidBills ?? 0}</strong>
                </div>
                <div className="rounded-lg bg-muted/40 p-2">
                  <span className="block text-muted-foreground">Insurance coverage</span>
                  <strong>
                    ₱{(patient.billing?.insuranceCoverage ?? 0).toLocaleString("en-PH")}
                  </strong>
                </div>
              </div>
            </div>
            {patient.billing?.recentBills && patient.billing.recentBills.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground mb-2">Recent Bills</div>
                {patient.billing.recentBills.slice(0, 5).map((bill) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between text-sm border-t border-border pt-2"
                  >
                    <div>
                      <div className="font-medium text-foreground">{bill.invoiceNo}</div>
                      <div className="text-xs text-muted-foreground">
                        {bill.dueDate
                          ? `Due ${safeFormatDate(bill.dueDate, "bill.due_date")}`
                          : "No due date"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        ₱{bill.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </div>
                      <StatusBadge status={bill.status} />
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setLocation(`${portalBase}/billing`)}
                  className="w-full mt-2 text-xs text-primary hover:underline"
                >
                  View all billing
                </button>
              </div>
            ) : (
              <EmptyState text="No recent bills." />
            )}
          </div>
          <InfoCard title="Payment History" icon={<DollarSign className="w-4 h-4" />}>
            {patient.billing?.recentPayments && patient.billing.recentPayments.length > 0 ? (
              patient.billing.recentPayments.map((payment) => (
                <div
                  key={`${payment.invoiceNo}-${payment.paidAt}`}
                  className="flex items-center justify-between border-t border-border pt-3 first:border-t-0 first:pt-0"
                >
                  <div>
                    <div className="text-sm font-medium">{payment.invoiceNo}</div>
                    <div className="text-xs text-muted-foreground">
                      {payment.paidAt
                        ? safeFormatDate(payment.paidAt, "payment.paid_at")
                        : "Date unavailable"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      ₱{payment.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </div>
                    <StatusBadge status={payment.status} />
                  </div>
                </div>
              ))
            ) : (
              <EmptyState text="No payment history found." />
            )}
          </InfoCard>
          <InfoCard title="Medical Store Orders" icon={<ShoppingBag className="w-4 h-4" />}>
            {patient.medicalStore?.recentOrders && patient.medicalStore.recentOrders.length > 0 ? (
              <div className="space-y-2">
                {patient.medicalStore.recentOrders.slice(0, 5).map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between text-sm border-t border-border pt-2 first:border-t-0 first:pt-0"
                  >
                    <div>
                      <div className="font-medium text-foreground">{order.orderNo}</div>
                      <div className="text-xs text-muted-foreground">
                        {safeFormatDate(order.orderDate, "order.order_date")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        ₱{order.totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </div>
                      <StatusBadge status={order.status} />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {order.paymentStatus || "Payment pending"} ·{" "}
                        {order.fulfillmentType === "pickup" ? "Pickup" : "Delivery"}
                      </p>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setLocation(`${portalBase}/orders`)}
                  className="w-full mt-2 text-xs text-primary hover:underline"
                >
                  View all orders
                </button>
              </div>
            ) : (
              <EmptyState text="No recent orders." />
            )}
          </InfoCard>
        </div>
      </Section>

      {documentPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Document preview"
        >
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">
                  {documentPreview.document?.name ?? "Document preview"}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {documentPreview.document?.type ?? "Medical document"} · Uploaded{" "}
                  {documentPreview.document?.uploadedAt
                    ? safeFormatDate(documentPreview.document.uploadedAt, "document.uploaded_at")
                    : "date unavailable"}
                </p>
              </div>
              <button
                onClick={() => setDocumentPreview(null)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
            <pre className="mt-5 whitespace-pre-wrap rounded-xl bg-muted p-4 text-xs leading-5">
              {JSON.stringify(
                documentPreview.record?.data ?? documentPreview.document?.metadata ?? {},
                null,
                2,
              )}
            </pre>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => downloadDocument(documentPreview.document)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                <Download className="h-4 w-4" /> Download record
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal && (
        <RecordEditModal
          modalType={activeModal}
          editingRecord={editingRecord}
          isSaving={isSavingRecord}
          appointments={patient.appointments ?? []}
          onClose={() => {
            setActiveModal(null);
            setEditingRecord(null);
          }}
          onSave={handleSaveModal}
        />
      )}
    </div>
  );
}

function InfoCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="text-primary">{icon}</div>
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-foreground whitespace-nowrap">
          {title}
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function formatRecordDate(record: Record<string, any>) {
  const value =
    record.date ??
    record.encounterDate ??
    record.prescriptionDate ??
    record.dateRequested ??
    record.imagingDate ??
    record.dateDiagnosed ??
    record._createdAt;
  if (!value) return "—";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString();
}

function RecordText({ label, value }: { label: string; value?: unknown }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      <p className="text-sm leading-5 text-foreground whitespace-pre-wrap">{String(value)}</p>
    </div>
  );
}

function RecordListCard({
  title,
  icon,
  records,
  emptyText,
  headerAction,
  onEditRecord,
  onDeleteRecord,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  records: Array<Record<string, any>>;
  emptyText: string;
  headerAction?: React.ReactNode;
  onEditRecord?: (record: Record<string, any>) => void;
  onDeleteRecord?: (recordId: string) => void;
  children: (record: Record<string, any>) => React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="text-primary">{icon}</div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          {records.length > 0 && (
            <span className="text-xs text-muted-foreground">({records.length})</span>
          )}
        </div>
        {headerAction}
      </div>
      <div className="space-y-3">
        {records.length > 0 ? (
          records.map((record, index) => {
            const recId = String(record._id ?? record.id ?? `${title}-${index}`);
            return (
              <div
                key={recId}
                className="group relative space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0"
              >
                {(onEditRecord || onDeleteRecord) && (
                  <div className="flex items-center gap-1.5 justify-end mb-1">
                    {onEditRecord && (
                      <button
                        type="button"
                        onClick={() => onEditRecord(record)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-muted hover:bg-primary/10 hover:text-primary transition-colors font-medium text-foreground"
                      >
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                    )}
                    {onDeleteRecord && recId && !recId.startsWith(title) && (
                      <button
                        type="button"
                        onClick={() => onDeleteRecord(recId)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-muted hover:bg-red-100 hover:text-red-700 transition-colors font-medium text-foreground"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    )}
                  </div>
                )}
                {children(record)}
              </div>
            );
          })
        ) : (
          <EmptyState text={emptyText} />
        )}
      </div>
    </div>
  );
}

function DocumentsCard({
  documents,
  onPreview,
  onDownload,
}: {
  documents: NonNullable<PatientProfile["documents"]>;
  onPreview: (document: any) => void;
  onDownload: (document: any) => void;
}) {
  return (
    <InfoCard title="Documents" icon={<FileText className="w-4 h-4" />}>
      {documents.length > 0 ? (
        <div className="space-y-2">
          {documents.slice(0, 5).map((document) => (
            <div
              key={document.id}
              className="flex items-center justify-between text-sm border-t border-border pt-2 first:border-t-0 first:pt-0"
              data-testid={`document-${document.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">{document.name}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(document.uploadedAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <button
                  onClick={() => onPreview(document)}
                  className="text-xs text-primary hover:underline"
                  aria-label={`Preview ${document.name}`}
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onDownload(document)}
                  className="text-xs text-primary hover:underline"
                  aria-label={`Download ${document.name}`}
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {documents.length > 5 && (
            <div className="text-xs text-muted-foreground pt-2">
              + {documents.length - 5} more documents
            </div>
          )}
        </div>
      ) : (
        <EmptyState text="No documents uploaded." />
      )}
    </InfoCard>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:grid sm:grid-cols-3 gap-1">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-sm text-foreground sm:col-span-2 font-medium">{value}</span>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </>
  );
  if (!onClick) {
    return (
      <div className="flex flex-col items-start rounded-lg border border-border bg-card p-3">
        {content}
      </div>
    );
  }
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start rounded-lg border border-border p-3 text-left transition-colors hover:border-primary hover:bg-accent/50"
    >
      {content}
    </button>
  );
}

function VitalRow({
  icon,
  label,
  value,
  abnormal,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  abnormal?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between p-2 rounded-lg ${abnormal ? "bg-red-50 border border-red-200" : "bg-muted/30"}`}
    >
      <div className="flex items-center gap-2">
        <div className={abnormal ? "text-red-600" : "text-muted-foreground"}>{icon}</div>
        <span className="text-xs font-medium text-foreground">{label}</span>
      </div>
      <span className={`text-sm font-semibold ${abnormal ? "text-red-700" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

function RecordEditModal({
  modalType,
  editingRecord,
  isSaving,
  appointments = [],
  onClose,
  onSave,
}: {
  modalType: string;
  editingRecord: any | null;
  isSaving: boolean;
  appointments?: any[];
  onClose: () => void;
  onSave: (formData: any) => void;
}) {
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    if (!editingRecord) {
      if (modalType === "new-encounter") {
        return {
          encounter_date: new Date().toISOString().slice(0, 10),
          department: "General Medicine",
          chief_complaint: "",
          diagnosis: "",
          status: "In Progress",
        };
      }
      if (modalType === "vital") {
        return {
          blood_pressure: "",
          heart_rate: "",
          respiratory_rate: "",
          temperature: "",
          oxygen_saturation: "",
          height_cm: "",
          weight_kg: "",
        };
      }
      if (modalType === "soap") {
        return { subjective: "", objective: "", assessment: "", plan: "" };
      }
      if (modalType === "diagnosis") {
        return { description: "", code: "Z00.00", category: "Primary", status: "Active" };
      }
      if (modalType === "procedure") {
        return {
          name: "",
          code: "",
          notes: "",
          performed_at: new Date().toISOString().slice(0, 10),
        };
      }
      if (modalType === "prescription") {
        return {
          drug: "",
          dosage: "",
          frequency: "",
          duration: "",
          instructions: "",
          status: "Active",
        };
      }
      if (modalType === "lab") {
        return { test_name: "", result: "", unit: "", reference_range: "", status: "Completed" };
      }
      if (modalType === "imaging") {
        return { modality: "", body_part: "", findings: "", impression: "", status: "Completed" };
      }
      if (modalType === "clinical-notes") {
        return {
          chief_complaint: "",
          history_of_present_illness: "",
          diagnosis: "",
          treatment_provided: "",
          follow_up_recommendations: "",
          encounter_notes: "",
          status: "In Progress",
        };
      }
      return {};
    }
    return {
      ...editingRecord,
      encounter_date:
        editingRecord.encounter_date ?? editingRecord.date ?? new Date().toISOString().slice(0, 10),
      description: editingRecord.description ?? editingRecord.diagnosis ?? editingRecord.desc ?? "",
      code: editingRecord.code ?? editingRecord.icdCode ?? "Z00.00",
      drug: editingRecord.drug ?? editingRecord.medicationName ?? editingRecord.med ?? "",
      test_name: editingRecord.test_name ?? editingRecord.testName ?? editingRecord.test ?? "",
      result: editingRecord.result ?? editingRecord.resultSummary ?? editingRecord.value ?? "",
      reference_range:
        editingRecord.reference_range ?? editingRecord.referenceRange ?? editingRecord.range ?? "",
      modality: editingRecord.modality ?? editingRecord.examinationName ?? editingRecord.type ?? "",
      blood_pressure:
        editingRecord.blood_pressure ??
        editingRecord.bloodPressure ??
        (editingRecord.systolic && editingRecord.diastolic
          ? `${editingRecord.systolic}/${editingRecord.diastolic}`
          : ""),
      heart_rate: editingRecord.heart_rate ?? editingRecord.heartRate ?? editingRecord.hr ?? "",
      respiratory_rate: editingRecord.respiratory_rate ?? editingRecord.respiratoryRate ?? "",
      temperature: editingRecord.temperature ?? editingRecord.temp ?? "",
      oxygen_saturation: editingRecord.oxygen_saturation ?? editingRecord.oxygenSaturation ?? "",
      height_cm: editingRecord.height_cm ?? editingRecord.height ?? "",
      weight_kg: editingRecord.weight_kg ?? editingRecord.weight ?? "",
      name:
        editingRecord.name ??
        editingRecord.procedureName ??
        editingRecord.type ??
        editingRecord.description ??
        "",
    };
  });

  const titles: Record<string, string> = {
    "new-encounter": "Create New Patient Encounter",
    soap: editingRecord ? "Edit SOAP Note" : "Add SOAP Note",
    diagnosis: editingRecord ? "Edit Diagnosis" : "Add Diagnosis",
    vital: editingRecord ? "Edit Vital Signs" : "Record Vital Signs",
    procedure: editingRecord ? "Edit Procedure" : "Add Procedure",
    prescription: editingRecord ? "Edit Prescription" : "Add Prescription",
    lab: editingRecord ? "Edit Lab Result" : "Order / Record Lab Result",
    imaging: editingRecord ? "Edit Imaging Record" : "Order / Record Imaging",
    "clinical-notes": "Edit Clinical Notes & Encounter Details",
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {titles[modalType] ?? "Edit Medical Record"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fill out the clinical record details. Changes will update the patient history.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {modalType === "new-encounter" && (
            <>
              {appointments && appointments.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Associated Patient Appointment
                  </label>
                  <select
                    value={formData.appointment_id ?? ""}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selectedAppt = appointments.find(
                        (a: any) => String(a.id) === selectedId,
                      );
                      if (selectedAppt) {
                        setFormData((prev) => ({
                          ...prev,
                          appointment_id: selectedId,
                          encounter_date:
                            selectedAppt.date ??
                            selectedAppt.appointmentDate ??
                            prev.encounter_date,
                          department:
                            selectedAppt.department ?? selectedAppt.specialty ?? prev.department,
                          chief_complaint: selectedAppt.notes ?? prev.chief_complaint,
                        }));
                      } else {
                        setFormData((prev) => ({ ...prev, appointment_id: "" }));
                      }
                    }}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Auto-create / Link New Appointment</option>
                    {appointments.map((appt: any) => (
                      <option key={appt.id} value={appt.id}>
                        Appt #{String(appt.id).slice(0, 8)} ·{" "}
                        {appt.date ?? appt.appointmentDate ?? "Date"} ·{" "}
                        {appt.department ?? appt.specialty ?? "General"} ({appt.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Encounter Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.encounter_date ?? new Date().toISOString().slice(0, 10)}
                    onChange={(e) => handleChange("encounter_date", e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Encounter Time
                  </label>
                  <input
                    type="time"
                    value={formData.encounter_time ?? "09:00"}
                    onChange={(e) => handleChange("encounter_time", e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Department / Specialty *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.department ?? ""}
                    onChange={(e) => handleChange("department", e.target.value)}
                    placeholder="e.g. Internal Medicine"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Encounter Type
                  </label>
                  <select
                    value={formData.encounter_type ?? "Outpatient Visit"}
                    onChange={(e) => handleChange("encounter_type", e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option>Outpatient Visit</option>
                    <option>Clinical Consultation</option>
                    <option>Follow-up Visit</option>
                    <option>Emergency Consultation</option>
                    <option>Inpatient Round</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Encounter Status
                  </label>
                  <select
                    value={formData.status ?? "In Progress"}
                    onChange={(e) => handleChange("status", e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option>In Progress</option>
                    <option>Completed</option>
                    <option>Pending Appointment</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Chief Complaint *
                </label>
                <input
                  type="text"
                  required
                  value={formData.chief_complaint ?? ""}
                  onChange={(e) => handleChange("chief_complaint", e.target.value)}
                  placeholder="e.g. Fever, persistent cough for 3 days"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Initial Working Diagnosis
                </label>
                <input
                  type="text"
                  value={formData.diagnosis ?? ""}
                  onChange={(e) => handleChange("diagnosis", e.target.value)}
                  placeholder="e.g. Acute Upper Respiratory Infection"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </>
          )}

          {modalType === "soap" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Subjective (S)
                </label>
                <textarea
                  rows={3}
                  value={formData.subjective ?? ""}
                  onChange={(e) => handleChange("subjective", e.target.value)}
                  placeholder="Patient's symptoms, history, concerns, chief complaint..."
                  className="w-full rounded-lg border border-input bg-background p-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Objective (O)
                </label>
                <textarea
                  rows={3}
                  value={formData.objective ?? ""}
                  onChange={(e) => handleChange("objective", e.target.value)}
                  placeholder="Physical exam findings, vital signs, lab/imaging values..."
                  className="w-full rounded-lg border border-input bg-background p-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Assessment (A)
                </label>
                <textarea
                  rows={3}
                  value={formData.assessment ?? ""}
                  onChange={(e) => handleChange("assessment", e.target.value)}
                  placeholder="Clinical impression, primary & differential diagnoses..."
                  className="w-full rounded-lg border border-input bg-background p-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Plan (P)</label>
                <textarea
                  rows={3}
                  value={formData.plan ?? ""}
                  onChange={(e) => handleChange("plan", e.target.value)}
                  placeholder="Treatment plan, medications prescribed, diagnostic orders, follow-up..."
                  className="w-full rounded-lg border border-input bg-background p-3 text-sm"
                />
              </div>
            </>
          )}

          {modalType === "diagnosis" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Diagnosis Description *
                </label>
                <input
                  type="text"
                  required
                  value={formData.description ?? ""}
                  onChange={(e) => handleChange("description", e.target.value)}
                  placeholder="e.g. Essential (primary) hypertension"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    ICD-10 Code
                  </label>
                  <input
                    type="text"
                    value={formData.code ?? ""}
                    onChange={(e) => handleChange("code", e.target.value)}
                    placeholder="e.g. I10"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category ?? "Primary"}
                    onChange={(e) => handleChange("category", e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option>Primary</option>
                    <option>Secondary</option>
                    <option>Differential</option>
                    <option>Comorbidity</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Status</label>
                  <select
                    value={formData.status ?? "Active"}
                    onChange={(e) => handleChange("status", e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option>Active</option>
                    <option>Resolved</option>
                    <option>Chronic</option>
                    <option>Suspected</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {modalType === "vital" && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Blood Pressure
                  </label>
                  <input
                    type="text"
                    value={formData.blood_pressure ?? ""}
                    onChange={(e) => handleChange("blood_pressure", e.target.value)}
                    placeholder="120/80"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Heart Rate (bpm)
                  </label>
                  <input
                    type="number"
                    value={formData.heart_rate ?? ""}
                    onChange={(e) => handleChange("heart_rate", e.target.value)}
                    placeholder="72"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Resp. Rate (/min)
                  </label>
                  <input
                    type="number"
                    value={formData.respiratory_rate ?? ""}
                    onChange={(e) => handleChange("respiratory_rate", e.target.value)}
                    placeholder="16"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Temp (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.temperature ?? ""}
                    onChange={(e) => handleChange("temperature", e.target.value)}
                    placeholder="36.8"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    O₂ Saturation (%)
                  </label>
                  <input
                    type="number"
                    value={formData.oxygen_saturation ?? ""}
                    onChange={(e) => handleChange("oxygen_saturation", e.target.value)}
                    placeholder="98"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.weight_kg ?? ""}
                    onChange={(e) => handleChange("weight_kg", e.target.value)}
                    placeholder="65"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </>
          )}

          {modalType === "procedure" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Procedure Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name ?? ""}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="e.g. Nebulization, Wound Debridement"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Procedure Code
                  </label>
                  <input
                    type="text"
                    value={formData.code ?? ""}
                    onChange={(e) => handleChange("code", e.target.value)}
                    placeholder="e.g. CPT-94640"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Performed Date
                  </label>
                  <input
                    type="date"
                    value={formData.performed_at ?? ""}
                    onChange={(e) => handleChange("performed_at", e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Procedure Notes & Details
                </label>
                <textarea
                  rows={3}
                  value={formData.notes ?? ""}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  placeholder="Clinical procedure notes, patient tolerance..."
                  className="w-full rounded-lg border border-input bg-background p-3 text-sm"
                />
              </div>
            </>
          )}

          {modalType === "prescription" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Medication / Drug Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.drug ?? ""}
                  onChange={(e) => handleChange("drug", e.target.value)}
                  placeholder="e.g. Amoxicillin, Paracetamol"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Dosage</label>
                  <input
                    type="text"
                    value={formData.dosage ?? ""}
                    onChange={(e) => handleChange("dosage", e.target.value)}
                    placeholder="e.g. 500 mg"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Frequency
                  </label>
                  <input
                    type="text"
                    value={formData.frequency ?? ""}
                    onChange={(e) => handleChange("frequency", e.target.value)}
                    placeholder="e.g. Every 8 hours"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    value={formData.duration ?? ""}
                    onChange={(e) => handleChange("duration", e.target.value)}
                    placeholder="e.g. 7 days"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Special Instructions
                </label>
                <input
                  type="text"
                  value={formData.instructions ?? ""}
                  onChange={(e) => handleChange("instructions", e.target.value)}
                  placeholder="Take after meals with plenty of water"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </>
          )}

          {modalType === "lab" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Lab Test Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.test_name ?? ""}
                  onChange={(e) => handleChange("test_name", e.target.value)}
                  placeholder="e.g. Complete Blood Count (CBC), Fasting Blood Sugar"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Result Value
                  </label>
                  <input
                    type="text"
                    value={formData.result ?? ""}
                    onChange={(e) => handleChange("result", e.target.value)}
                    placeholder="e.g. 110"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Unit</label>
                  <input
                    type="text"
                    value={formData.unit ?? ""}
                    onChange={(e) => handleChange("unit", e.target.value)}
                    placeholder="e.g. mg/dL"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Reference Range
                  </label>
                  <input
                    type="text"
                    value={formData.reference_range ?? ""}
                    onChange={(e) => handleChange("reference_range", e.target.value)}
                    placeholder="e.g. 70-100"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </>
          )}

          {modalType === "imaging" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Imaging Examination / Modality *
                </label>
                <input
                  type="text"
                  required
                  value={formData.modality ?? ""}
                  onChange={(e) => handleChange("modality", e.target.value)}
                  placeholder="e.g. Chest X-Ray PA/Lateral, Brain CT Scan"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Body Part / Facility
                </label>
                <input
                  type="text"
                  value={formData.body_part ?? ""}
                  onChange={(e) => handleChange("body_part", e.target.value)}
                  placeholder="e.g. Chest, Abdomen"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Findings Summary
                </label>
                <textarea
                  rows={3}
                  value={formData.findings ?? ""}
                  onChange={(e) => handleChange("findings", e.target.value)}
                  placeholder="Radiologist / Physician findings..."
                  className="w-full rounded-lg border border-input bg-background p-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Impression
                </label>
                <textarea
                  rows={2}
                  value={formData.impression ?? ""}
                  onChange={(e) => handleChange("impression", e.target.value)}
                  placeholder="Diagnostic impression..."
                  className="w-full rounded-lg border border-input bg-background p-3 text-sm"
                />
              </div>
            </>
          )}

          {modalType === "clinical-notes" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Chief Complaint
                </label>
                <input
                  type="text"
                  value={formData.chief_complaint ?? ""}
                  onChange={(e) => handleChange("chief_complaint", e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  History of Present Illness (HPI)
                </label>
                <textarea
                  rows={2}
                  value={formData.history_of_present_illness ?? ""}
                  onChange={(e) => handleChange("history_of_present_illness", e.target.value)}
                  className="w-full rounded-lg border border-input bg-background p-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Diagnosis Summary
                </label>
                <input
                  type="text"
                  value={formData.diagnosis ?? ""}
                  onChange={(e) => handleChange("diagnosis", e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Treatment Provided
                </label>
                <textarea
                  rows={2}
                  value={formData.treatment_provided ?? ""}
                  onChange={(e) => handleChange("treatment_provided", e.target.value)}
                  className="w-full rounded-lg border border-input bg-background p-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Follow-up Recommendations
                </label>
                <textarea
                  rows={2}
                  value={formData.follow_up_recommendations ?? ""}
                  onChange={(e) => handleChange("follow_up_recommendations", e.target.value)}
                  className="w-full rounded-lg border border-input bg-background p-3 text-sm"
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-input bg-background hover:bg-muted transition-colors text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
