import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/site/Logo";
import {
  LayoutDashboard, Users, Building2, MessageCircle, LogOut, Loader2,
  Calendar, Package, Wrench, Wallet, Settings, Menu, X
} from "lucide-react";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const NAV: NavItem[] = [
  { to: "/app", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { to: "/app/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/app/reservas", label: "Reservas", icon: Calendar },
  { to: "/app/encomendas", label: "Encomendas", icon: Package },
  { to: "/app/ocorrencias", label: "Ocorrências", icon: Wrench },
  { to: "/app/moradores", label: "Moradores", icon: Users },
  { to: "/app/condominio", label: "Condomínio", icon: Building2 },
  { to: "/app/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { to: "/app/configuracoes", label: "Configurações", icon: Settings },
];

function AppLayout() {
  const navigate = useNavigate();
  const { loading, user, hasAnyRole, profile, signOut } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/auth/login" }); return; }
    if (!hasAnyRole) { navigate({ to: "/onboarding" }); return; }
  }, [loading, user, hasAnyRole, navigate]);

  if (loading || !user || !hasAnyRole) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const isActive = (to: string, exact?: boolean) => exact ? path === to : path.startsWith(to);

  return (
    <div className="min-h-screen flex bg-muted/40">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-background">
        <div className="h-16 flex items-center px-6 border-b border-border"><Logo /></div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive(item.to, item.exact) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <item.icon size={18} /> {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              {(profile?.nome_completo || user.email || "?").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{profile?.nome_completo || "Sem nome"}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <button onClick={() => signOut().then(() => navigate({ to: "/" }))} className="p-2 rounded hover:bg-muted text-muted-foreground" title="Sair">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile topbar */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-14 bg-background border-b border-border flex items-center justify-between px-4 z-40">
        <Logo size="sm" />
        <button onClick={() => setOpen(!open)} className="p-2">{open ? <X /> : <Menu />}</button>
      </div>
      {open && (
        <div className="lg:hidden fixed inset-0 top-14 bg-background z-30 p-4 space-y-1">
          {NAV.map((item) => (
            <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${isActive(item.to, item.exact) ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              <item.icon size={18} /> {item.label}
            </Link>
          ))}
          <button onClick={() => signOut().then(() => navigate({ to: "/" }))} className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10">
            <LogOut size={18} /> Sair
          </button>
        </div>
      )}

      <main className="flex-1 lg:ml-0 mt-14 lg:mt-0">
        <Outlet />
      </main>
    </div>
  );
}
