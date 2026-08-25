import { createFileRoute } from "@tanstack/react-router";
import Login from "@/pages/Login";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create Account — SugboDoc Patient Portal" },
      {
        name: "description",
        content: "Register for SugboDoc to book appointments and manage your healthcare online.",
      },
      { property: "og:title", content: "Create Account — SugboDoc Patient Portal" },
      {
        property: "og:description",
        content: "Register for SugboDoc to book appointments and manage your healthcare online.",
      },
    ],
  }),
  component: () => <Login initialMode="register" />,
});
