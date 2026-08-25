import { createFileRoute } from "@tanstack/react-router";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import { AdminPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — SugboDoc" },
      { name: "description", content: "Operational overview of patients, appointments, queue and inventory." },
      { property: "og:title", content: "Admin Dashboard — SugboDoc" },
      { property: "og:description", content: "Operational overview of patients, appointments, queue and inventory." },
    ],
  }),
  component: () => (
    <AdminPage>
      <AdminDashboard />
    </AdminPage>
  ),
});
