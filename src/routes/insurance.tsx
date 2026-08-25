import { createFileRoute } from "@tanstack/react-router";
import Insurance from "@/pages/Insurance";
import { PortalPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/insurance")({
  head: () => ({
    meta: [
      { title: "Insurance Plans — SugboDoc" },
      { name: "description", content: "Compare, purchase and renew health insurance coverage." },
      { property: "og:title", content: "Insurance Plans — SugboDoc" },
      { property: "og:description", content: "Compare, purchase and renew health insurance coverage." },
    ],
  }),
  component: () => (
    <PortalPage>
      <Insurance />
    </PortalPage>
  ),
});
