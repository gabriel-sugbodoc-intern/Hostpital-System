import { createFileRoute } from "@tanstack/react-router";
import AdminBilling from "@/pages/admin/AdminBilling";
import { AdminPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/admin/billing")({
  head: () => ({
    meta: [
      { title: "Billing — SugboDoc Admin" },
      { name: "description", content: "Monitor patient invoices and payment statuses." },
      { property: "og:title", content: "Billing — SugboDoc Admin" },
      { property: "og:description", content: "Monitor patient invoices and payment statuses." },
    ],
  }),
  component: () => (
    <AdminPage>
      <AdminBilling />
    </AdminPage>
  ),
});
