import { createFileRoute } from "@tanstack/react-router";
import Queue from "@/pages/Queue";
import { PortalPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/queue")({
  head: () => ({
    meta: [
      { title: "Clinic Queue — SugboDoc" },
      { name: "description", content: "Track your live queue number and estimated waiting time." },
      { property: "og:title", content: "Clinic Queue — SugboDoc" },
      { property: "og:description", content: "Track your live queue number and estimated waiting time." },
    ],
  }),
  component: () => (
    <PortalPage>
      <Queue />
    </PortalPage>
  ),
});
