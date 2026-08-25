import { createFileRoute } from "@tanstack/react-router";
import AdminPatients from "@/pages/admin/AdminPatients";
import { DoctorPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/doctor/patients/")({
  head: () => ({
    meta: [
      { title: "My Patients — SugboDoc Doctor" },
      { name: "description", content: "Patients assigned to your care." },
      { property: "og:title", content: "My Patients — SugboDoc Doctor" },
      { property: "og:description", content: "Patients assigned to your care." },
    ],
  }),
  component: () => (
    <DoctorPage>
      <AdminPatients />
    </DoctorPage>
  ),
});
