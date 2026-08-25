import { createFileRoute } from "@tanstack/react-router";
import DoctorDashboard from "@/pages/doctor/DoctorDashboard";
import { DoctorPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/doctor/")({
  head: () => ({
    meta: [
      { title: "Doctor Dashboard — SugboDoc" },
      { name: "description", content: "Clinical overview of assigned patients, appointments and encounters." },
      { property: "og:title", content: "Doctor Dashboard — SugboDoc" },
      {
        property: "og:description",
        content: "Clinical overview of assigned patients, appointments and encounters.",
      },
    ],
  }),
  component: () => (
    <DoctorPage>
      <DoctorDashboard />
    </DoctorPage>
  ),
});
