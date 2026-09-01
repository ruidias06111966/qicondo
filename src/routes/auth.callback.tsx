import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { destinoAposLogin } from "@/auth/proximo-destino";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Entrando…" }] }),
  component: CallbackPage,
});

function CallbackPage() {
  const { loading, user, hasAnyRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/auth/login" }); return; }
    // O OAuth do Google não preserva query strings — o destino vem do sessionStorage.
    navigate({ to: destinoAposLogin(undefined, hasAnyRole) });
  }, [loading, user, hasAnyRole, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="animate-spin" />
      <p className="text-sm">Conectando…</p>
    </div>
  );
}
