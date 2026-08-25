import { createFileRoute } from "@tanstack/react-router";
import AdminQueue from "@/pages/admin/AdminQueue";
import { AdminPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/admin/queue")({
  head: () => ({
    meta: [
      { title: "Queue — SugboDoc Admin" },
      { name: "description", content: "Manage the live patient queue across departments." },
      { property: "og:title", content: "Queue — SugboDoc Admin" },
      { property: "og:description", content: "Manage the live patient queue across departments." },
    ],
  }),
  component: () => (
    <AdminPage>
      <AdminQueue />
    </AdminPage>
  ),
});
