import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/empresas/")({
  beforeLoad: () => { throw redirect({ to: "/admin" }); },
});
