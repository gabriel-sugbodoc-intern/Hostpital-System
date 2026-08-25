import { createFileRoute } from "@tanstack/react-router";
import AdminMessaging from "@/pages/admin/AdminMessaging";
import { AdminPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/admin/messaging")({
  head: () => ({
    meta: [
      { title: "Messaging — SugboDoc Admin" },
      { name: "description", content: "Message patients directly from the clinical console." },
      { property: "og:title", content: "Messaging — SugboDoc Admin" },
      {
        property: "og:description",
        content: "Message patients directly from the clinical console.",
      },
    ],
  }),
  component: () => (
    <AdminPage allowedRoles={["admin"]}>
      <AdminMessaging />
    </AdminPage>
  ),
});
