import { X } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  TrendingUp, FileText, Wallet, AlertTriangle, Tag, CreditCard,
} from "lucide-react";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background">
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-muted-foreground uppercase mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  desc,
}: {
  icon: any;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-background border border-dashed border-border rounded-2xl p-12 text-center">
      <Icon className="mx-auto text-muted-foreground mb-3" size={32} />
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{desc}</p>
    </div>
  );
}

export function StatusBadge({ status, venc }: { status: string; venc: string }) {
  const isVenc = status === "pendente" && new Date(venc) < new Date();
  const real = isVenc ? "vencida" : status;
  const map: Record<string, string> = {
    paga: "bg-emerald-100 text-emerald-700",
    pendente: "bg-amber-100 text-amber-700",
    vencida: "bg-rose-100 text-rose-700",
    parcial: "bg-blue-100 text-blue-700",
    cancelada: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${map[real] || "bg-muted"}`}
    >
      {real}
    </span>
  );
}

export function Stat({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: any;
  label: string;
  value: string;
  tone?: "neutral" | "success" | "danger";
}) {
  const toneCls =
    tone === "success"
      ? "text-emerald-600"
      : tone === "danger"
        ? "text-rose-600"
        : "text-foreground";
  return (
    <div className="bg-background border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase">{label}</p>
        <Icon size={18} className="text-muted-foreground" />
      </div>
      <p className={`font-display text-2xl font-extrabold mt-2 ${toneCls}`}>{value}</p>
    </div>
  );
}

type SubItem = { to: string; label: string; icon: any; restrito?: boolean };
const SUB: SubItem[] = [
  { to: "/app/financeiro", label: "Visão geral", icon: TrendingUp },
  { to: "/app/financeiro/cobrancas", label: "Cobranças", icon: FileText },
  { to: "/app/financeiro/despesas", label: "Despesas", icon: Wallet, restrito: true },
  { to: "/app/financeiro/inadimplencia", label: "Inadimplência", icon: AlertTriangle, restrito: true },
  { to: "/app/financeiro/categorias", label: "Categorias", icon: Tag, restrito: true },
  { to: "/app/financeiro/pagamentos", label: "Pagamentos", icon: CreditCard, restrito: true },
];

export function FinanceiroSubNav({ podeGerir }: { podeGerir: boolean }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const items = SUB.filter((i) => !i.restrito || podeGerir);
  return (
    <div className="border-b border-border mb-6 -mx-2 overflow-x-auto">
      <div className="flex gap-1 px-2 min-w-max">
        {items.map((it) => {
          const active = it.to === "/app/financeiro" ? path === it.to : path.startsWith(it.to);
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <it.icon size={16} /> {it.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** Wrapper que captura erros de Server Function (que vêm como Response). */
export async function safeCall<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (e: any) {
    let msg = e?.message;
    if (e instanceof Response) {
      try { msg = await e.text(); } catch { msg = `HTTP ${e.status}`; }
    } else if (typeof e === "object" && e && "status" in e) {
      msg = `Erro ${(e as any).status}`;
    }
    console.error("[financeiro] erro:", msg, e);
    const { toast } = await import("sonner");
    toast.error(msg || "Erro ao carregar");
    return null;
  }
}
