import { createFileRoute } from "@tanstack/react-router";
import Appointments from "@/pages/Appointments";
import { PortalPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/appointments")({
  head: () => ({
    meta: [
      { title: "Appointments — SugboDoc" },
      { name: "description", content: "Book, review and manage your clinic appointments." },
      { property: "og:title", content: "Appointments — SugboDoc" },
      { property: "og:description", content: "Book, review and manage your clinic appointments." },
    ],
  }),
  component: () => (
    <PortalPage>
      <Appointments />
    </PortalPage>
  ),
});
