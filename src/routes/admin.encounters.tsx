import { createFileRoute } from "@tanstack/react-router";
import AdminEncounters from "@/pages/admin/AdminEncounters";
import { AdminPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/admin/encounters")({
  head: () => ({
    meta: [
      { title: "Encounters — SugboDoc Admin" },
      { name: "description", content: "Clinical encounters, SOAP notes and visit documentation." },
      { property: "og:title", content: "Encounters — SugboDoc Admin" },
      { property: "og:description", content: "Clinical encounters, SOAP notes and visit documentation." },
    ],
  }),
  component: () => (
    <AdminPage>
      <AdminEncounters />
    </AdminPage>
  ),
});
