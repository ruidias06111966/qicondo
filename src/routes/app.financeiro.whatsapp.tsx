import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { listarNotificacoesWA, reenviarNotificacaoWA } from "@/lib/financeiro.functions";
import { EmptyState, Field, safeCall } from "@/components/financeiro/ui";
import { dateTimeBR } from "@/lib/format";
import { toast } from "sonner";
import { Loader2, MessageCircle, RotateCcw, ExternalLink, Filter } from "lucide-react";

export const Route = createFileRoute("/app/financeiro/whatsapp")({
  head: () => ({ meta: [{ title: "Mensagens WhatsApp — Financeiro" }] }),
  component: HistoricoWA,
});

type Status = "" | "pendente" | "enviado" | "falhou";
type Contexto = "" | "encomenda" | "visitante" | "reserva" | "cobranca";

function HistoricoWA() {
  const { condominioId } = useCondominioAtivo();
  const hoje = new Date().toISOString().slice(0, 10);
  const trintaDias = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reenviando, setReenviando] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("");
  const [contexto, setContexto] = useState<Contexto>("");
  const [ini, setIni] = useState(trintaDias);
  const [fim, setFim] = useState(hoje);

  const reload = async () => {
    if (!condominioId) return;
    setLoading(true);
    const r = await safeCall(
      listarNotificacoesWA({
        data: {
          condominio_id: condominioId,
          data_inicio: ini || undefined,
          data_fim: fim || undefined,
          status: (status || undefined) as any,
          contexto: (contexto || undefined) as any,
        },
      }),
    );
    setRows(r ?? []);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominioId, status, contexto, ini, fim]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = () => reload();
    window.addEventListener("wa:changed", h);
    return () => window.removeEventListener("wa:changed", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominioId, status, contexto, ini, fim]);

  const stats = useMemo(() => {
    const c = { total: rows.length, pendente: 0, enviado: 0, falhou: 0 };
    for (const r of rows) (c as any)[r.status] = ((c as any)[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const reenviar = async (id: string) => {
    setReenviando(id);
    const r = await safeCall(reenviarNotificacaoWA({ data: { id } }));
    setReenviando(null);
    if (r) {
      toast.success("Mensagem reenfileirada");
      // notifica outras telas (ex.: dashboard, /app/whatsapp)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("wa:changed"));
      }
      reload();
    }
  };

  if (!condominioId) return null;

  return (
    <div>
      <div className="bg-background border border-border rounded-2xl p-4 mb-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="De">
          <input type="date" value={ini} onChange={(e) => setIni(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        </Field>
        <Field label="Até">
          <input type="date" value={fim} onChange={(e) => setFim(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as Status)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
            <option value="">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="enviado">Enviado</option>
            <option value="falhou">Falhou</option>
          </select>
        </Field>
        <Field label="Contexto">
          <select value={contexto} onChange={(e) => setContexto(e.target.value as Contexto)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
            <option value="">Todos</option>
            <option value="cobranca">Cobrança</option>
            <option value="encomenda">Encomenda</option>
            <option value="visitante">Visitante</option>
            <option value="reserva">Reserva</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Total" value={stats.total} />
        <Stat label="Pendentes" value={stats.pendente} tone="amber" />
        <Stat label="Enviadas" value={stats.enviado} tone="emerald" />
        <Stat label="Com erro" value={stats.falhou} tone="rose" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={MessageCircle} title="Nenhuma mensagem encontrada"
          desc="Ajuste os filtros ou aguarde o disparo da automação." />
      ) : (
        <div className="bg-background border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Data</th>
                <th className="text-left px-4 py-3 font-semibold">Destinatário</th>
                <th className="text-left px-4 py-3 font-semibold">Contexto</th>
                <th className="text-left px-4 py-3 font-semibold">Mensagem</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 align-top">
                  <td className="px-4 py-3 whitespace-nowrap">{dateTimeBR(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.destinatario_nome ?? "—"}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.destinatario_telefone}</div>
                  </td>
                  <td className="px-4 py-3 capitalize">{r.contexto ?? "—"}</td>
                  <td className="px-4 py-3 max-w-md">
                    <p className="line-clamp-2 text-xs text-muted-foreground whitespace-pre-wrap">{r.mensagem}</p>
                    {r.erro && <p className="text-xs text-rose-600 mt-1">⚠ {r.erro}</p>}
                  </td>
                  <td className="px-4 py-3"><StatusPill s={r.status} /></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex gap-1">
                      {r.link_wa && (
                        <a href={r.link_wa} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-xs hover:bg-muted">
                          <ExternalLink size={12} /> Abrir
                        </a>
                      )}
                      {r.status === "falhou" && (
                        <button onClick={() => reenviar(r.id)} disabled={reenviando === r.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary text-primary-foreground text-xs disabled:opacity-60">
                          {reenviando === r.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                          Reenviar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "amber" | "emerald" | "rose" }) {
  const cls =
    tone === "amber" ? "text-amber-600" :
    tone === "emerald" ? "text-emerald-600" :
    tone === "rose" ? "text-rose-600" : "text-foreground";
  return (
    <div className="bg-background border border-border rounded-2xl p-4">
      <p className="text-xs uppercase font-semibold text-muted-foreground">{label}</p>
      <p className={`font-display text-2xl font-extrabold mt-1 ${cls}`}>{value}</p>
    </div>
  );
}

function StatusPill({ s }: { s: string }) {
  const map: Record<string, string> = {
    pendente: "bg-amber-100 text-amber-700",
    enviado: "bg-emerald-100 text-emerald-700",
    falhou: "bg-rose-100 text-rose-700",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${map[s] ?? "bg-muted"}`}>
      {s}
    </span>
  );
}
