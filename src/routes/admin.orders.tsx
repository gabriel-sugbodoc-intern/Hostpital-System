import { createFileRoute } from "@tanstack/react-router";
import AdminOrders from "@/pages/admin/AdminOrders";
import { AdminPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({
    meta: [
      { title: "Orders — SugboDoc Admin" },
      { name: "description", content: "Fulfil medical store orders and update delivery status." },
      { property: "og:title", content: "Orders — SugboDoc Admin" },
      { property: "og:description", content: "Fulfil medical store orders and update delivery status." },
    ],
  }),
  component: () => (
    <AdminPage>
      <AdminOrders />
    </AdminPage>
  ),
});
