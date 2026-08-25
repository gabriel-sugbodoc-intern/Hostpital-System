import { createFileRoute } from "@tanstack/react-router";
import AdminPatientProfile from "@/pages/admin/AdminPatientProfile";
import { DoctorPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/doctor/patients/$id")({
  head: () => ({
    meta: [
      { title: "Patient Profile — SugboDoc Doctor" },
      { name: "description", content: "Encounters, SOAP notes, diagnoses, vitals, prescriptions and results." },
      { property: "og:title", content: "Patient Profile — SugboDoc Doctor" },
      {
        property: "og:description",
        content: "Encounters, SOAP notes, diagnoses, vitals, prescriptions and results.",
      },
    ],
  }),
  component: () => (
    <DoctorPage>
      <AdminPatientProfile />
    </DoctorPage>
  ),
});
