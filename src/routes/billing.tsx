import { createFileRoute } from "@tanstack/react-router";
import Billing from "@/pages/Billing";
import { PortalPage } from "@/components/portal/RouteGuards";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "Billing — SugboDoc" },
      { name: "description", content: "Review invoices, payment history and settle balances." },
      { property: "og:title", content: "Billing — SugboDoc" },
      { property: "og:description", content: "Review invoices, payment history and settle balances." },
    ],
  }),
  component: () => (
    <PortalPage>
      <Billing />
    </PortalPage>
  ),
});
