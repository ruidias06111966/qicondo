import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { safeCall } from "@/lib/safe-call";
import { linkWhatsApp } from "@/lib/whatsapp";
import { Inbox, MessageCircle, Loader2, RefreshCw, Calendar, Shield } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/leads")({
  head: () => ({ meta: [{ title: "Leads do site — QiCond" }] }),
  component: LeadsPage,
});

type Lead = {
  id: string;
  nome: string;
  condominio: string;
  telefone: string;
  origem: string;
  mensagem: string | null;
  consent_lgpd: boolean;
  quer_demo: boolean;
  status: "novo" | "contatado" | "agendado" | "convertido" | "descartado";
  observacoes_internas: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<Lead["status"], string> = {
  novo: "Novo",
  contatado: "Contatado",
  agendado: "Demo agendada",
  convertido: "Convertido",
  descartado: "Descartado",
};

const STATUS_COLORS: Record<Lead["status"], string> = {
  novo: "bg-primary/15 text-primary",
  contatado: "bg-warning/15 text-[var(--color-warning-foreground)]",
  agendado: "bg-accent/30 text-foreground",
  convertido: "bg-success/15 text-success",
  descartado: "bg-muted text-muted-foreground",
};

function LeadsPage() {
  const { isAdmin } = useCondominioAtivo();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | Lead["status"]>("todos");

  async function carregar() {
    setLoading(true);
    const res = await safeCall(
      supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
    );
    setLeads(((res as any)?.data as Lead[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function atualizarStatus(id: string, status: Lead["status"]) {
    const res = await safeCall(
      supabase.from("leads").update({ status }).eq("id", id),
    );
    if (res) {
      toast.success("Status atualizado");
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    }
  }

  const visiveis = filtro === "todos" ? leads : leads.filter((l) => l.status === filtro);

  // O item já não aparece no menu para outros perfis; isto cobre o URL directo.
  if (!isAdmin) {
    return (
      <div className="p-6 max-w-xl">
        <div className="rounded-2xl border border-border bg-background p-6 text-center">
          <Shield className="mx-auto mb-3 text-muted-foreground" />
          <h2 className="font-display text-xl font-bold mb-1">Acesso restrito</h2>
          <p className="text-sm text-muted-foreground">
            Apenas administradores da empresa podem ver os leads do site.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display font-extrabold text-3xl flex items-center gap-2">
            <Inbox size={26} className="text-primary" /> Leads do site
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Contatos capturados pelo formulário e botão de WhatsApp do site público.
          </p>
        </div>
        <button
          onClick={carregar}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium hover:border-primary"
        >
          <RefreshCw size={14} /> Atualizar
        </button>
      </header>

      <div className="flex flex-wrap gap-2 mb-5">
        {(["todos", "novo", "contatado", "agendado", "convertido", "descartado"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFiltro(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filtro === s
                ? "bg-primary text-primary-foreground"
                : "bg-surface border border-border text-foreground hover:border-primary"
            }`}
          >
            {s === "todos" ? "Todos" : STATUS_LABELS[s]}
            <span className="ml-1.5 opacity-70">
              ({s === "todos" ? leads.length : leads.filter((l) => l.status === s).length})
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="animate-spin" />
        </div>
      ) : visiveis.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center text-muted-foreground">
          Nenhum lead {filtro === "todos" ? "" : `com status "${STATUS_LABELS[filtro as Lead["status"]]}"`} ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {visiveis.map((lead) => {
            const wa = linkWhatsApp(
              lead.telefone,
              `Olá ${lead.nome.split(" ")[0]}! Aqui é o QiCond. Vi seu interesse pelo nosso sistema para o ${lead.condominio}. Posso te ajudar?`,
            );
            return (
              <div key={lead.id} className="rounded-xl border border-border bg-surface p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display font-extrabold text-lg">{lead.nome}</h3>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLORS[lead.status]}`}>
                        {STATUS_LABELS[lead.status]}
                      </span>
                      {lead.quer_demo && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-primary-soft text-primary px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Calendar size={10} /> Quer demo
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {lead.condominio} · {lead.telefone}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(lead.created_at).toLocaleString("pt-BR")} · via {lead.origem}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-success text-white px-3 py-2 text-xs font-bold hover:opacity-90"
                      >
                        <MessageCircle size={14} /> Abrir WhatsApp
                      </a>
                    )}
                    <select
                      value={lead.status}
                      onChange={(e) => atualizarStatus(lead.id, e.target.value as Lead["status"])}
                      className="h-9 rounded-lg border border-input bg-background px-2 text-xs font-medium"
                    >
                      {(Object.keys(STATUS_LABELS) as Lead["status"][]).map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {lead.mensagem && (
                  <p className="text-sm text-foreground bg-surface-2 rounded-lg p-3 border border-border">
                    {lead.mensagem}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
