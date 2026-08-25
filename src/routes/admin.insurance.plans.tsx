import { createFileRoute } from "@tanstack/react-router";
import AdminInsurancePlans from "@/pages/admin/AdminInsurancePlans";
import { AdminPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/admin/insurance/plans")({
  head: () => ({
    meta: [
      { title: "Insurance Plans — SugboDoc Admin" },
      { name: "description", content: "Create and maintain the insurance plan catalogue." },
      { property: "og:title", content: "Insurance Plans — SugboDoc Admin" },
      { property: "og:description", content: "Create and maintain the insurance plan catalogue." },
    ],
  }),
  component: () => (
    <AdminPage>
      <AdminInsurancePlans />
    </AdminPage>
  ),
});
