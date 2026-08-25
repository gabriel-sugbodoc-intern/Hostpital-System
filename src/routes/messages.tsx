import { createFileRoute } from "@tanstack/react-router";
import Messages from "@/pages/Messages";
import { PortalPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — SugboDoc" },
      { name: "description", content: "Secure conversations with your care team." },
      { property: "og:title", content: "Messages — SugboDoc" },
      { property: "og:description", content: "Secure conversations with your care team." },
    ],
  }),
  component: () => (
    <PortalPage>
      <Messages />
    </PortalPage>
  ),
});
