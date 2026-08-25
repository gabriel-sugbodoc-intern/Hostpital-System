import { createFileRoute } from "@tanstack/react-router";
import AdminInventory from "@/pages/admin/AdminInventory";
import { AdminPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/admin/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — SugboDoc Admin" },
      { name: "description", content: "Track pharmacy stock levels and low-stock alerts." },
      { property: "og:title", content: "Inventory — SugboDoc Admin" },
      { property: "og:description", content: "Track pharmacy stock levels and low-stock alerts." },
    ],
  }),
  component: () => (
    <AdminPage>
      <AdminInventory />
    </AdminPage>
  ),
});
