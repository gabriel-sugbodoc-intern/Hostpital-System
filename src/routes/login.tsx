import { createFileRoute } from "@tanstack/react-router";
import Login from "@/pages/Login";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — SugboDoc Patient Portal" },
      { name: "description", content: "Sign in to your SugboDoc patient portal account." },
      { property: "og:title", content: "Login — SugboDoc Patient Portal" },
      { property: "og:description", content: "Sign in to your SugboDoc patient portal account." },
    ],
  }),
  component: () => <Login initialMode="login" />,
});
