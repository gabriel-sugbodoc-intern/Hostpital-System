import { createFileRoute } from "@tanstack/react-router";
import Records from "@/pages/Records";
import { PortalPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/records")({
  head: () => ({
    meta: [
      { title: "Medical Records — SugboDoc" },
      { name: "description", content: "Vitals, prescriptions, lab results and imaging in one place." },
      { property: "og:title", content: "Medical Records — SugboDoc" },
      { property: "og:description", content: "Vitals, prescriptions, lab results and imaging in one place." },
    ],
  }),
  component: () => (
    <PortalPage>
      <Records />
    </PortalPage>
  ),
});
