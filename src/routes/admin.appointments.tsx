import { createFileRoute } from "@tanstack/react-router";
import AdminAppointments from "@/pages/admin/AdminAppointments";
import { AdminPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/admin/appointments")({
  head: () => ({
    meta: [
      { title: "Appointments — SugboDoc Admin" },
      { name: "description", content: "Review and update clinic appointment schedules." },
      { property: "og:title", content: "Appointments — SugboDoc Admin" },
      { property: "og:description", content: "Review and update clinic appointment schedules." },
    ],
  }),
  component: () => (
    <AdminPage>
      <AdminAppointments />
    </AdminPage>
  ),
});
