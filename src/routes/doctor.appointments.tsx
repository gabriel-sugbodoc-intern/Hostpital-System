import { createFileRoute } from "@tanstack/react-router";
import AdminAppointments from "@/pages/admin/AdminAppointments";
import { DoctorPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/doctor/appointments")({
  head: () => ({
    meta: [
      { title: "Appointments — SugboDoc Doctor" },
      { name: "description", content: "Appointments scheduled with you." },
      { property: "og:title", content: "Appointments — SugboDoc Doctor" },
      { property: "og:description", content: "Appointments scheduled with you." },
    ],
  }),
  component: () => (
    <DoctorPage>
      <AdminAppointments />
    </DoctorPage>
  ),
});
