import { createFileRoute } from "@tanstack/react-router";
import AdminEncounters from "@/pages/admin/AdminEncounters";
import { DoctorPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/doctor/encounters")({
  head: () => ({
    meta: [
      { title: "Encounters — SugboDoc Doctor" },
      { name: "description", content: "Clinical encounters, SOAP notes and diagnoses you authored." },
      { property: "og:title", content: "Encounters — SugboDoc Doctor" },
      {
        property: "og:description",
        content: "Clinical encounters, SOAP notes and diagnoses you authored.",
      },
    ],
  }),
  component: () => (
    <DoctorPage>
      <AdminEncounters />
    </DoctorPage>
  ),
});
