import { createFileRoute } from "@tanstack/react-router";
import Store from "@/pages/Store";
import { PortalPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/store")({
  head: () => ({
    meta: [
      { title: "Medical Store — SugboDoc" },
      { name: "description", content: "Order medicines and health essentials for pickup or delivery." },
      { property: "og:title", content: "Medical Store — SugboDoc" },
      { property: "og:description", content: "Order medicines and health essentials for pickup or delivery." },
    ],
  }),
  component: () => (
    <PortalPage>
      <Store />
    </PortalPage>
  ),
});
