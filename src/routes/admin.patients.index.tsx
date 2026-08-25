import { createFileRoute } from "@tanstack/react-router";
import AdminPatients from "@/pages/admin/AdminPatients";
import { AdminPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/admin/patients/")({
  head: () => ({
    meta: [
      { title: "Patients — SugboDoc Admin" },
      { name: "description", content: "Search and manage registered patient accounts." },
      { property: "og:title", content: "Patients — SugboDoc Admin" },
      { property: "og:description", content: "Search and manage registered patient accounts." },
    ],
  }),
  component: () => (
    <AdminPage>
      <AdminPatients />
    </AdminPage>
  ),
});
