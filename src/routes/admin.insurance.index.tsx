import { createFileRoute } from "@tanstack/react-router";
import AdminInsurance from "@/pages/admin/AdminInsurance";
import { AdminPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/admin/insurance/")({
  head: () => ({
    meta: [
      { title: "Insurance Requests — SugboDoc Admin" },
      { name: "description", content: "Approve or reject patient insurance applications." },
      { property: "og:title", content: "Insurance Requests — SugboDoc Admin" },
      { property: "og:description", content: "Approve or reject patient insurance applications." },
    ],
  }),
  component: () => (
    <AdminPage>
      <AdminInsurance />
    </AdminPage>
  ),
});
