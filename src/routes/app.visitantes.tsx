import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { dateTimeBR } from "@/lib/format";
import { moradoresDaUnidade, registrarNotificacaoWA } from "@/lib/whatsapp";
import {
  Users, Plus, Loader2, X, Check, Search, MessageCircle,
  Car, IdCard, LogIn, LogOut, Clock, MapPin, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/visitantes")({
  component: VisitantesPage,
});

type Visitante = {
  id: string;
  unidade_id: string;
  nome: string;
  documento: string | null;
  foto_url: string | null;
  tipo: "visita" | "prestador" | "delivery" | "mudanca" | "outro";
  empresa: string | null;
  placa_veiculo: string | null;
  observacoes: string | null;
  status: "aguardando" | "autorizado" | "recusado" | "dentro" | "saiu" | "expirado";
  motivo_recusa: string | null;
  valido_ate: string | null;
  entrada_em: string | null;
  saida_em: string | null;
  created_at: string;
};

type Unidade = { id: string; numero: string; bloco: string | null };

const ERROS: Record<string, string> = {
  forbidden: "Sem permissão",
  unidade_invalida: "Unidade inválida",
  visitante_nao_encontrado: "Visitante não encontrado",
  status_invalido: "Status inválido",
};

const TIPO_LABEL: Record<Visitante["tipo"], string> = {
  visita: "Visita",
  prestador: "Prestador",
  delivery: "Delivery",
  mudanca: "Mudança",
  outro: "Outro",
};

const STATUS_BADGE: Record<Visitante["status"], string> = {
  aguardando: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  autorizado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  recusado: "bg-destructive/15 text-destructive",
  dentro: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  saiu: "bg-muted text-muted-foreground",
  expirado: "bg-muted text-muted-foreground",
};

function VisitantesPage() {
  const { condominioId, isSindico, isPorteiro, isMorador } = useCondominioAtivo();
  const podeGerenciar = isSindico || isPorteiro;
  const [visitantes, setVisitantes] = useState<Visitante[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNovo, setShowNovo] = useState(false);
  const [tab, setTab] = useState<"hoje" | "aguardando" | "dentro" | "todos">("hoje");
  const [busca, setBusca] = useState("");

  const carregar = async () => {
    if (!condominioId) return;
    setLoading(true);
    const [v, u] = await Promise.all([
      supabase.from("visitantes").select("*").eq("condominio_id", condominioId).order("created_at", { ascending: false }).limit(500),
      supabase.from("unidades").select("id, numero, bloco").eq("condominio_id", condominioId).order("numero"),
    ]);
    if (v.data) setVisitantes(v.data as Visitante[]);
    if (u.data) setUnidades(u.data as Unidade[]);
    setLoading(false);
  };

  useEffect(() => { void carregar(); /* eslint-disable-next-line */ }, [condominioId]);

  const unidadeLabel = (id: string) => {
    const u = unidades.find((x) => x.id === id);
    return u ? `${u.bloco ? `${u.bloco} · ` : ""}Un. ${u.numero}` : "—";
  };

  const lista = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    return visitantes.filter((v) => {
      if (tab === "hoje" && new Date(v.created_at) < hoje) return false;
      if (tab === "aguardando" && v.status !== "aguardando") return false;
      if (tab === "dentro" && v.status !== "dentro") return false;
      if (busca) {
        const q = busca.toLowerCase();
        const u = unidades.find((x) => x.id === v.unidade_id);
        const txt = `${v.nome} ${v.documento ?? ""} ${v.empresa ?? ""} ${v.placa_veiculo ?? ""} ${u?.numero ?? ""} ${u?.bloco ?? ""}`.toLowerCase();
        if (!txt.includes(q)) return false;
      }
      return true;
    });
  }, [visitantes, tab, busca, unidades]);

  const stats = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    return {
      hoje: visitantes.filter((v) => new Date(v.created_at) >= hoje).length,
      aguardando: visitantes.filter((v) => v.status === "aguardando").length,
      dentro: visitantes.filter((v) => v.status === "dentro").length,
    };
  }, [visitantes]);

  const notificarChegada = async (v: Visitante) => {
    if (!condominioId) return;
    const moradores = await moradoresDaUnidade(v.unidade_id);
    const comTel = moradores.filter((m) => m.telefone);
    if (comTel.length === 0) {
      toast.error("Nenhum morador desta unidade tem telefone cadastrado");
      return;
    }
    const u = unidades.find((x) => x.id === v.unidade_id);
    const msg = `🔔 *Visitante na portaria*\n\n👤 ${v.nome}${v.documento ? ` (Doc: ${v.documento})` : ""}\n${TIPO_LABEL[v.tipo]}${v.empresa ? ` - ${v.empresa}` : ""}${v.placa_veiculo ? `\n🚗 Placa: ${v.placa_veiculo}` : ""}\n📍 Procura: ${u?.bloco ? u.bloco + " · " : ""}Un. ${u?.numero}\n\nResponda *AUTORIZAR* ou *NEGAR*.`;
    let primeiro: string | null = null;
    for (const m of comTel) {
      const r = await registrarNotificacaoWA({
        condominioId, unidadeId: v.unidade_id,
        destinatarioUserId: m.user_id,
        destinatarioTelefone: m.telefone!, destinatarioNome: m.nome,
        mensagem: msg, contexto: "visitante", contextoId: v.id,
      });
      if (r?.link && !primeiro) primeiro = r.link;
    }
    await supabase.from("visitantes").update({ notificado_em: new Date().toISOString() }).eq("id", v.id);
    toast.success("Morador notificado");
    if (primeiro) window.open(primeiro, "_blank");
    void carregar();
  };

  const acao = async (rpcName: string, params: Record<string, any>, sucesso: string) => {
    const { error } = await supabase.rpc(rpcName as any, params);
    if (error) toast.error(ERROS[error.message] ?? error.message);
    else { toast.success(sucesso); void carregar(); }
  };

  if (!condominioId) return <div className="p-8 text-muted-foreground">Selecione um condomínio.</div>;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
            <Users className="text-primary" /> Visitantes
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Registro de portaria com autorização do morador via WhatsApp.
          </p>
        </div>
        <button onClick={() => setShowNovo(true)} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium flex items-center gap-2">
          <Plus size={16} /> {podeGerenciar ? "Registrar visitante" : "Pré-cadastrar visita"}
        </button>
      </header>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Visitantes hoje" value={stats.hoje} />
        <Stat label="Aguardando autorização" value={stats.aguardando} highlight={stats.aguardando > 0} />
        <Stat label="Atualmente dentro" value={stats.dentro} />
      </div>

      <div className="border-b border-border mb-4 overflow-x-auto">
        <nav className="flex gap-6 min-w-max">
          {([
            ["hoje", "Hoje"],
            ["aguardando", `Aguardando${stats.aguardando ? ` (${stats.aguardando})` : ""}`],
            ["dentro", `Dentro${stats.dentro ? ` (${stats.dentro})` : ""}`],
            ["todos", "Todos"],
          ] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${tab === k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, documento, placa, unidade..." className="input pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : lista.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Nenhum visitante.</p>
      ) : (
        <div className="space-y-3">
          {lista.map((v) => (
            <div key={v.id} className="border border-border rounded-lg p-4 bg-background">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-3 flex-1 min-w-0">
                  {v.foto_url ? (
                    <img src={v.foto_url} alt="" className="w-14 h-14 rounded-full object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground">
                      {v.nome.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold">{v.nome}</h4>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted">{TIPO_LABEL[v.tipo]}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[v.status]}`}>{v.status}</span>
                    </div>
                    <div className="mt-1 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground">
                      <p className="flex items-center gap-1.5"><MapPin size={14} /> {unidadeLabel(v.unidade_id)}</p>
                      {v.documento && <p className="flex items-center gap-1.5"><IdCard size={14} /> {v.documento}</p>}
                      {v.empresa && <p>🏢 {v.empresa}</p>}
                      {v.placa_veiculo && <p className="flex items-center gap-1.5"><Car size={14} /> {v.placa_veiculo.toUpperCase()}</p>}
                      <p className="flex items-center gap-1.5"><Clock size={14} /> {dateTimeBR(v.created_at)}</p>
                      {v.entrada_em && <p>🟢 Entrou {dateTimeBR(v.entrada_em)}</p>}
                      {v.saida_em && <p>🔴 Saiu {dateTimeBR(v.saida_em)}</p>}
                      {v.valido_ate && <p>⏰ Válido até {dateTimeBR(v.valido_ate)}</p>}
                    </div>
                    {v.observacoes && <p className="text-sm mt-1 text-foreground/80">{v.observacoes}</p>}
                    {v.motivo_recusa && (
                      <p className="text-sm mt-1 text-destructive flex items-center gap-1.5"><AlertTriangle size={14} /> {v.motivo_recusa}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {podeGerenciar && v.status === "aguardando" && (
                    <button onClick={() => notificarChegada(v)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-medium flex items-center gap-1">
                      <MessageCircle size={14} /> Notificar morador
                    </button>
                  )}
                  {(isMorador || podeGerenciar) && v.status === "aguardando" && (
                    <>
                      <button onClick={() => acao("autorizar_visitante", { _visitante_id: v.id }, "Autorizado")} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-medium flex items-center gap-1">
                        <Check size={14} /> Autorizar
                      </button>
                      <button onClick={() => {
                        const m = window.prompt("Motivo da recusa:");
                        if (!m) return;
                        void acao("recusar_visitante", { _visitante_id: v.id, _motivo: m }, "Recusado");
                      }} className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 text-xs font-medium flex items-center gap-1">
                        <X size={14} /> Recusar
                      </button>
                    </>
                  )}
                  {podeGerenciar && (v.status === "autorizado" || v.status === "aguardando") && (
                    <button onClick={() => acao("registrar_entrada_visitante", { _visitante_id: v.id }, "Entrada registrada")} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-medium flex items-center gap-1">
                      <LogIn size={14} /> Entrada
                    </button>
                  )}
                  {podeGerenciar && v.status === "dentro" && (
                    <button onClick={() => acao("registrar_saida_visitante", { _visitante_id: v.id }, "Saída registrada")} className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-medium flex items-center gap-1">
                      <LogOut size={14} /> Saída
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNovo && (
        <NovoVisitanteModal
          unidades={unidades}
          condominioId={condominioId}
          podeGerenciar={podeGerenciar}
          onClose={() => setShowNovo(false)}
          onCriado={(id, dados) => {
            setShowNovo(false);
            void carregar();
            // Se foi registrado pela portaria e morador deve ser notificado
            if (podeGerenciar && dados?.notificar) {
              setTimeout(() => {
                const v = { ...dados, id, status: "aguardando" } as Visitante;
                void notificarChegada(v);
              }, 400);
            }
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border border-border p-4 ${highlight ? "bg-primary/5 border-primary/30" : "bg-background"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function NovoVisitanteModal({
  unidades, condominioId, podeGerenciar, onClose, onCriado,
}: {
  unidades: Unidade[]; condominioId: string; podeGerenciar: boolean;
  onClose: () => void;
  onCriado: (id: string, dados?: any) => void;
}) {
  const { isMorador } = useCondominioAtivo();
  const [form, setForm] = useState({
    unidade_id: unidades[0]?.id ?? "",
    nome: "",
    documento: "",
    tipo: "visita" as Visitante["tipo"],
    empresa: "",
    placa_veiculo: "",
    observacoes: "",
    valido_ate: "",
    pre_autorizar: isMorador,
    notificar: true,
  });
  const [foto, setFoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.unidade_id || !form.nome) { toast.error("Unidade e nome são obrigatórios"); return; }
    setSaving(true);

    let fotoUrl = "";
    if (foto) {
      const reader = new FileReader();
      fotoUrl = await new Promise<string>((res) => {
        reader.onload = () => res(reader.result as string);
        reader.readAsDataURL(foto);
      });
    }

    const { data, error } = await supabase.rpc("registrar_visitante", {
      _unidade_id: form.unidade_id,
      _nome: form.nome,
      _documento: form.documento || "",
      _tipo: form.tipo,
      _empresa: form.empresa || "",
      _placa_veiculo: form.placa_veiculo || "",
      _observacoes: form.observacoes || "",
      _valido_ate: form.valido_ate ? new Date(form.valido_ate).toISOString() : null as any,
      _foto_url: fotoUrl,
      _pre_autorizar: form.pre_autorizar,
    });
    setSaving(false);
    if (error) { toast.error(ERROS[error.message] ?? error.message); return; }
    toast.success("Visitante registrado");
    onCriado(data as string, { ...form, notificar: podeGerenciar && form.notificar });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-background">
          <h3 className="font-bold text-lg">{podeGerenciar ? "Registrar visitante" : "Pré-cadastrar visita"}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <Field label="Unidade *">
            <select value={form.unidade_id} onChange={(ev) => setForm({ ...form, unidade_id: ev.target.value })} className="input" required>
              <option value="">Selecione...</option>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.bloco ? `${u.bloco} · ` : ""}Un. {u.numero}</option>)}
            </select>
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Nome *"><input value={form.nome} onChange={(ev) => setForm({ ...form, nome: ev.target.value })} className="input" required /></Field>
            <Field label="Documento"><input value={form.documento} onChange={(ev) => setForm({ ...form, documento: ev.target.value })} className="input" placeholder="RG/CPF" /></Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Tipo">
              <select value={form.tipo} onChange={(ev) => setForm({ ...form, tipo: ev.target.value as Visitante["tipo"] })} className="input">
                {Object.entries(TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Empresa"><input value={form.empresa} onChange={(ev) => setForm({ ...form, empresa: ev.target.value })} className="input" placeholder="Ex: iFood, NET..." /></Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Placa do veículo"><input value={form.placa_veiculo} onChange={(ev) => setForm({ ...form, placa_veiculo: ev.target.value.toUpperCase() })} className="input" /></Field>
            <Field label="Válido até"><input type="datetime-local" value={form.valido_ate} onChange={(ev) => setForm({ ...form, valido_ate: ev.target.value })} className="input" /></Field>
          </div>
          <Field label="Foto (opcional)">
            <input type="file" accept="image/*" capture="environment" onChange={(ev) => setFoto(ev.target.files?.[0] ?? null)} className="input" />
          </Field>
          <Field label="Observações"><textarea value={form.observacoes} onChange={(ev) => setForm({ ...form, observacoes: ev.target.value })} rows={2} className="input" /></Field>

          {isMorador && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.pre_autorizar} onChange={(ev) => setForm({ ...form, pre_autorizar: ev.target.checked })} />
              Pré-autorizar (visitante já está liberado)
            </label>
          )}
          {podeGerenciar && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.notificar} onChange={(ev) => setForm({ ...form, notificar: ev.target.checked })} />
              Notificar morador via WhatsApp
            </label>
          )}

          <button type="submit" disabled={saving} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium flex items-center justify-center gap-2 disabled:opacity-60">
            {saving && <Loader2 size={16} className="animate-spin" />} Registrar
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium mb-1 block">{label}</span>
      {children}
    </label>
  );
}
