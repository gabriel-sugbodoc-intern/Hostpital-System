import { createFileRoute } from "@tanstack/react-router";
import AdminPatientProfile from "@/pages/admin/AdminPatientProfile";
import { AdminPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/admin/patients/$id")({
  head: () => ({
    meta: [
      { title: "Patient Profile — SugboDoc Admin" },
      { name: "description", content: "Full clinical and account profile for a patient." },
      { property: "og:title", content: "Patient Profile — SugboDoc Admin" },
      { property: "og:description", content: "Full clinical and account profile for a patient." },
    ],
  }),
  component: () => (
    <AdminPage>
      <AdminPatientProfile />
    </AdminPage>
  ),
});
