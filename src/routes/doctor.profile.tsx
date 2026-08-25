import { createFileRoute } from "@tanstack/react-router";
import DoctorProfile from "@/pages/doctor/DoctorProfile";
import { DoctorPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/doctor/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — SugboDoc Doctor" },
      { name: "description", content: "Your SugboDoc doctor account details." },
      { property: "og:title", content: "My Profile — SugboDoc Doctor" },
      { property: "og:description", content: "Your SugboDoc doctor account details." },
    ],
  }),
  component: () => (
    <DoctorPage>
      <DoctorProfile />
    </DoctorPage>
  ),
});
