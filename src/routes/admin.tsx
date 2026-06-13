import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2, Shield, LayoutDashboard, Building2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { usePlatformAdmin } from "@/auth/usePlatformAdmin";
import { useServerFn } from "@tanstack/react-start";
import { reclamarPlatformAdmin } from "@/lib/platform.functions";
import { toast } from "sonner";
import { safeCall } from "@/lib/safe-call";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Master — WHATSCOND" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const { loading, user } = useAuth();
  const { isPlatformAdmin, totalAdmins, loading: chk, refetch } = usePlatformAdmin();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const reclamar = useServerFn(reclamarPlatformAdmin);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth/login" });
  }, [loading, user, navigate]);

  if (loading || !user || chk) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }

  // Bootstrap: ainda ninguém é admin master
  if (!isPlatformAdmin && totalAdmins === 0) {
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-muted/40">
        <div className="max-w-md w-full bg-background border border-border rounded-xl p-8 shadow-sm space-y-4">
          <div className="flex items-center gap-3"><Shield className="text-primary" /><h1 className="text-xl font-semibold">Configurar Admin Master</h1></div>
          <p className="text-sm text-muted-foreground">
            Ainda não existe nenhum administrador master da plataforma. Como é o primeiro,
            pode reclamar este acesso para si. Depois disso ninguém mais o poderá obter sem a sua autorização.
          </p>
          <button
            onClick={async () => {
              const r = await safeCall(reclamar());
              if (r) { toast.success("É agora Admin Master."); refetch(); }
            }}
            className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 font-medium hover:opacity-90"
          >Tornar-me Admin Master</button>
        </div>
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <Shield className="mx-auto text-destructive" size={48} />
          <h1 className="text-xl font-semibold">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">Esta área é exclusiva para administradores master da plataforma.</p>
          <Link to="/app" className="inline-block text-sm text-primary hover:underline">Voltar à aplicação</Link>
        </div>
      </div>
    );
  }

  const isActive = (to: string, exact?: boolean) => exact ? path === to : path.startsWith(to);

  return (
    <div className="min-h-screen flex bg-muted/40">
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-background">
        <div className="h-16 flex items-center px-6 border-b border-border gap-2">
          <Shield className="text-primary" size={20} />
          <span className="font-semibold">Admin Master</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <Link to="/admin" className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${isActive("/admin", true) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
            <LayoutDashboard size={18} /> Visão geral
          </Link>
          <Link to="/admin/empresas" className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${isActive("/admin/empresas") ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
            <Building2 size={18} /> Empresas
          </Link>
        </nav>
        <div className="p-3 border-t border-border">
          <Link to="/app" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground px-2 py-2">
            <ArrowLeft size={16} /> Voltar à app
          </Link>
        </div>
      </aside>
      <main className="flex-1"><Outlet /></main>
    </div>
  );
}
