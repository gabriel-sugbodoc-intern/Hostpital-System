import { createFileRoute } from "@tanstack/react-router";
import AdminMessaging from "@/pages/admin/AdminMessaging";
import { DoctorPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/doctor/messaging")({
  head: () => ({
    meta: [
      { title: "Patient Messaging — SugboDoc Doctor" },
      { name: "description", content: "Message the patients assigned to your care." },
      { property: "og:title", content: "Patient Messaging — SugboDoc Doctor" },
      { property: "og:description", content: "Message the patients assigned to your care." },
    ],
  }),
  component: () => (
    <DoctorPage>
      <AdminMessaging />
    </DoctorPage>
  ),
});
