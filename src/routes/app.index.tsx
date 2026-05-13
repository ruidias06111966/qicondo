import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { supabase } from "@/integrations/supabase/client";
import { resumoFinanceiro } from "@/server/financeiro.functions";
import { brl } from "@/lib/format";
import { Building2, Users, Wallet, AlertCircle, TrendingUp, MessageCircle } from "lucide-react";
import { safeCall } from "@/lib/safe-call";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Painel — WHATSCOND" }] }),
  component: DashboardPage,
});

type Cond = { id: string; nome: string; codigo_publico: string; total_unidades: number };

function DashboardPage() {
  const { profile, roles, user } = useAuth();
  const { condominioId } = useCondominioAtivo();
  const [conds, setConds] = useState<Cond[]>([]);
  const [loading, setLoading] = useState(true);
  const [unidadesCount, setUnidadesCount] = useState(0);
  const [resumo, setResumo] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const ids = Array.from(new Set(roles.map((r) => r.condominio_id)));
      if (ids.length === 0) { setLoading(false); return; }
      const r = await safeCall(Promise.all([
        supabase.from("condominios").select("id, nome, codigo_publico, total_unidades").in("id", ids),
        supabase.from("unidades").select("*", { count: "exact", head: true }).in("condominio_id", ids),
      ]));
      if (r) {
        const [{ data: cs }, { count }] = r;
        setConds((cs as Cond[]) ?? []);
        setUnidadesCount(count ?? 0);
      }
      setLoading(false);
    })();
  }, [roles]);

  useEffect(() => {
    if (!condominioId || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const mes = new Date().toISOString().slice(0, 7);
        const r = await resumoFinanceiro({ data: { condominio_id: condominioId, mes } });
        if (!cancelled) setResumo(r);
      } catch (err) {
        // 401/500 silencioso — painel apenas omite o cartão financeiro
        console.warn("[app] resumoFinanceiro falhou:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [condominioId, user]);

  const isSindico = roles.some((r) => r.role === "sindico");

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">Olá, {(profile?.nome_completo || "").split(" ")[0] || "bem-vindo"} 👋</p>
        <h1 className="font-display text-3xl font-extrabold mt-1">Visão geral</h1>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat icon={Building2} label="Condomínios" value={conds.length} />
        <Stat icon={Users} label="Unidades" value={unidadesCount} />
        <Stat icon={Wallet} label="Inadimplência" value={resumo ? brl(resumo.totalInadimplencia) : "—"} hint={resumo ? `${resumo.qtdInadimplentes} cobrança(s)` : undefined} />
        <Stat icon={TrendingUp} label="Recebido no mês" value={resumo ? brl(resumo.totalRecebidoMes) : "—"} />
      </div>

      <section className="bg-background border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold">Seus condomínios</h2>
          {isSindico && (
            <a href="/onboarding" className="text-sm text-primary font-semibold hover:underline">+ Novo</a>
          )}
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : conds.length === 0 ? (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
            <AlertCircle className="text-muted-foreground mt-0.5" size={18} />
            <div className="text-sm">
              <p className="font-semibold">Você ainda não tem condomínio cadastrado.</p>
              <p className="text-muted-foreground mt-1">Vá para o onboarding para criar o primeiro.</p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {conds.map((c) => {
              const role = roles.find((r) => r.condominio_id === c.id)?.role ?? "morador";
              return (
                <li key={c.id} className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">Código: <code className="font-mono">{c.codigo_publico}</code> · {c.total_unidades} unidades</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase">{role}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6 bg-primary/5 border border-primary/20 rounded-2xl p-6 flex items-start gap-4">
        <MessageCircle className="text-primary shrink-0" />
        <div>
          <p className="font-semibold">WhatsApp ainda não conectado</p>
          <p className="text-sm text-muted-foreground mt-1">Na Fase 5 vamos ativar a integração oficial Meta Cloud API. Por enquanto, comunique-se manualmente.</p>
        </div>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Building2; label: string; value: number | string; hint?: string }) {
  return (
    <div className="bg-background border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase">{label}</p>
        <Icon size={18} className="text-muted-foreground" />
      </div>
      <p className="font-display text-3xl font-extrabold mt-2">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
