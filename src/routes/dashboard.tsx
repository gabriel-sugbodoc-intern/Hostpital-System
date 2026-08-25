import { createFileRoute } from "@tanstack/react-router";
import Dashboard from "@/pages/Dashboard";
import { PortalPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Patient Dashboard — SugboDoc" },
      { name: "description", content: "Your health overview, upcoming appointments and quick actions." },
      { property: "og:title", content: "Patient Dashboard — SugboDoc" },
      { property: "og:description", content: "Your health overview, upcoming appointments and quick actions." },
    ],
  }),
  component: () => (
    <PortalPage>
      <Dashboard />
    </PortalPage>
  ),
});
