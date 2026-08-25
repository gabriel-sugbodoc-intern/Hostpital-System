import { createFileRoute } from "@tanstack/react-router";
import Profile from "@/pages/Profile";
import { PortalPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — SugboDoc" },
      { name: "description", content: "Manage your personal, medical and emergency contact details." },
      { property: "og:title", content: "My Profile — SugboDoc" },
      { property: "og:description", content: "Manage your personal, medical and emergency contact details." },
    ],
  }),
  component: () => (
    <PortalPage>
      <Profile />
    </PortalPage>
  ),
});
