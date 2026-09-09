import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/plumbing")({
  beforeLoad: () => {
    throw redirect({ to: "/platform" });
  },
  component: () => null,
});
