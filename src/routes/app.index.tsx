import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { supabase } from "@/integrations/supabase/client";
import { resumoFinanceiro } from "@/lib/financeiro.functions";
import { brl } from "@/lib/format";
import { Building2, Users, Wallet, AlertCircle, TrendingUp, MessageCircle } from "lucide-react";
import { safeCall } from "@/lib/safe-call";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Painel — QiCond" }] }),
  component: DashboardPage,
});

type Cond = { id: string; nome: string; codigo_publico: string };

function DashboardPage() {
  const { profile, roles, user } = useAuth();
  const { condominioId, setCondominioId } = useCondominioAtivo();
  const [conds, setConds] = useState<Cond[]>([]);
  const [loading, setLoading] = useState(true);
  /** Unidades por condomínio, contadas de verdade — ver o comentário abaixo. */
  const [unidadesPorCond, setUnidadesPorCond] = useState<Record<string, number>>({});
  const [resumo, setResumo] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const ids = Array.from(new Set(roles.map((r) => r.condominio_id)));
      if (ids.length === 0) {
        setLoading(false);
        return;
      }
      // `condominios.total_unidades` é uma coluna que ninguém mantém: ficava a
      // zero em condomínios com unidades, e a lista dizia "0 unidades" a quem
      // tinha doze. Conta-se a sério, por condomínio — uma consulta por cada,
      // que são poucos e cada uma é só um COUNT indexado.
      const r = await safeCall(
        Promise.all([
          supabase.from("condominios").select("id, nome, codigo_publico").in("id", ids),
          Promise.all(
            ids.map(async (id) => {
              const { count } = await supabase
                .from("unidades")
                .select("*", { count: "exact", head: true })
                .eq("condominio_id", id);
              return [id, count ?? 0] as const;
            }),
          ),
        ]),
      );
      if (r) {
        const [{ data: cs }, pares] = r;
        setConds((cs as Cond[]) ?? []);
        setUnidadesPorCond(Object.fromEntries(pares));
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
    return () => {
      cancelled = true;
    };
  }, [condominioId, user]);

  // `null` = ainda a verificar; evita piscar o aviso antes de sabermos o estado.
  const [waAtivo, setWaAtivo] = useState<boolean | null>(null);
  useEffect(() => {
    if (!condominioId) return;
    let cancelled = false;
    (async () => {
      const r = await safeCall(
        supabase.from("wa_config").select("ativo").eq("condominio_id", condominioId).maybeSingle(),
      );
      if (!cancelled) setWaAtivo(!!r?.data?.ativo);
    })();
    return () => {
      cancelled = true;
    };
  }, [condominioId]);

  const isSindico = roles.some((r) => r.role === "sindico");

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">
          Olá, {(profile?.nome_completo || "").split(" ")[0] || "bem-vindo"} 👋
        </p>
        <h1 className="font-display text-3xl font-extrabold mt-1">Visão geral</h1>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat icon={Building2} label="Condomínios" value={conds.length} />
        <Stat
          icon={Users}
          label="Unidades"
          value={condominioId ? (unidadesPorCond[condominioId] ?? 0) : 0}
        />
        <Stat
          icon={Wallet}
          label="Inadimplência"
          value={resumo ? brl(resumo.totalInadimplencia) : "—"}
          hint={resumo ? `${resumo.qtdInadimplentes} cobrança(s)` : undefined}
        />
        <Stat
          icon={TrendingUp}
          label="Recebido no mês"
          value={resumo ? brl(resumo.totalRecebidoMes) : "—"}
        />
      </div>

      <section className="bg-background border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold">Seus condomínios</h2>
          {isSindico && (
            <a href="/onboarding" className="text-sm text-primary font-semibold hover:underline">
              + Novo
            </a>
          )}
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : conds.length === 0 ? (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
            <AlertCircle className="text-muted-foreground mt-0.5" size={18} />
            <div className="text-sm">
              <p className="font-semibold">Você ainda não tem condomínio cadastrado.</p>
              <p className="text-muted-foreground mt-1">
                Vá para o onboarding para criar o primeiro.
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {conds.map((c) => {
              const role = roles.find((r) => r.condominio_id === c.id)?.role ?? "morador";
              const activo = c.id === condominioId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (activo) return;
                      setCondominioId(c.id);
                      // O condomínio activo é estado local de cada componente;
                      // remonta-se tudo para não ficar meio ecrã num e meio
                      // noutro. Ver `SeletorCondominio`.
                      window.location.reload();
                    }}
                    className={`w-full py-4 px-3 -mx-3 rounded-lg flex items-center justify-between gap-3 text-left transition-colors ${
                      activo ? "bg-primary/5" : "hover:bg-muted"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{c.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        Código: <code className="font-mono">{c.codigo_publico}</code> ·{" "}
                        {unidadesPorCond[c.id] ?? 0} unidades
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {activo ? (
                        <span className="px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold uppercase">
                          activo
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">entrar →</span>
                      )}
                      <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase">
                        {role}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Só aparece enquanto a integração não estiver ligada — antes era um aviso
          fixo a anunciar uma "Fase 5" que já foi entregue. */}
      {waAtivo === false && (
        <section className="mt-6 bg-primary/5 border border-primary/20 rounded-2xl p-6 flex items-start gap-4">
          <MessageCircle className="text-primary shrink-0" />
          <div>
            <p className="font-semibold">WhatsApp ainda não conectado</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ligue a integração oficial Meta Cloud API para enviar cobranças, avisos de encomenda e
              confirmações de reserva automaticamente.
            </p>
            <Link
              to="/app/whatsapp"
              className="text-sm text-primary font-semibold hover:underline mt-2 inline-block"
            >
              Configurar WhatsApp →
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Building2;
  label: string;
  value: number | string;
  hint?: string;
}) {
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
