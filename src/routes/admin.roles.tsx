import { createFileRoute } from "@tanstack/react-router";
import AdminRoles from "@/pages/admin/AdminRoles";
import { AdminPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/admin/roles")({
  head: () => ({
    meta: [
      { title: "Role Management — SugboDoc Admin" },
      { name: "description", content: "Assign patient, doctor and admin roles to SugboDoc users." },
      { property: "og:title", content: "Role Management — SugboDoc Admin" },
      {
        property: "og:description",
        content: "Assign patient, doctor and admin roles to SugboDoc users.",
      },
    ],
  }),
  component: () => (
    <AdminPage>
      <AdminRoles />
    </AdminPage>
  ),
});
