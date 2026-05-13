import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { useAuth } from "@/auth/AuthProvider";
import { dateTimeBR } from "@/lib/format";
import { moradoresDaUnidade, registrarNotificacaoWA } from "@/lib/whatsapp";
import {
  Package, Plus, Loader2, X, Check, Search, MessageCircle, ExternalLink,
  Truck, Hash, Camera, MapPin
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/encomendas")({
  component: EncomendasPage,
});

type Encomenda = {
  id: string;
  unidade_id: string;
  descricao: string;
  transportadora: string | null;
  codigo_rastreio: string | null;
  remetente: string | null;
  foto_url: string | null;
  local_armazenamento: string | null;
  observacoes: string | null;
  status: "aguardando" | "retirada" | "devolvida";
  recebido_em: string;
  retirado_em: string | null;
  retirado_por_nome: string | null;
  notificado_em: string | null;
};

type Unidade = { id: string; numero: string; bloco: string | null };

const ERROS: Record<string, string> = {
  forbidden: "Sem permissão",
  unidade_invalida: "Unidade inválida",
  encomenda_nao_encontrada: "Encomenda não encontrada",
  status_invalido: "Status inválido",
};

function EncomendasPage() {
  const { user } = useAuth();
  const { condominioId, isSindico, isPorteiro } = useCondominioAtivo();
  const podeGerenciar = isSindico || isPorteiro;
  const [encomendas, setEncomendas] = useState<Encomenda[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNova, setShowNova] = useState(false);
  const [filtro, setFiltro] = useState<"aguardando" | "retirada" | "todas">("aguardando");
  const [busca, setBusca] = useState("");

  const carregar = async () => {
    if (!condominioId) return;
    setLoading(true);
    const r = await safeCall(Promise.all([
      supabase.from("encomendas").select("*").eq("condominio_id", condominioId).order("recebido_em", { ascending: false }),
      supabase.from("unidades").select("id, numero, bloco").eq("condominio_id", condominioId).order("numero"),
    ]));
    if (r) {
      const [e, u] = r;
      if (e.data) setEncomendas(e.data as Encomenda[]);
      if (u.data) setUnidades(u.data as Unidade[]);
    }
    setLoading(false);
  };

  useEffect(() => { void carregar(); /* eslint-disable-next-line */ }, [condominioId]);

  const unidadeLabel = (id: string) => {
    const u = unidades.find((x) => x.id === id);
    return u ? `${u.bloco ? `${u.bloco} · ` : ""}Un. ${u.numero}` : "—";
  };

  const lista = useMemo(() => {
    return encomendas.filter((e) => {
      if (filtro !== "todas" && e.status !== filtro) return false;
      if (busca) {
        const q = busca.toLowerCase();
        const u = unidades.find((x) => x.id === e.unidade_id);
        const txt = `${e.descricao} ${e.transportadora ?? ""} ${e.codigo_rastreio ?? ""} ${e.remetente ?? ""} ${u?.numero ?? ""} ${u?.bloco ?? ""}`.toLowerCase();
        if (!txt.includes(q)) return false;
      }
      return true;
    });
  }, [encomendas, filtro, busca, unidades]);

  const stats = useMemo(() => ({
    aguardando: encomendas.filter((e) => e.status === "aguardando").length,
    mes: encomendas.filter((e) => new Date(e.recebido_em) >= new Date(new Date().setDate(1))).length,
    retiradas: encomendas.filter((e) => e.status === "retirada").length,
  }), [encomendas]);

  const notificarMorador = async (e: Encomenda) => {
    if (!condominioId) return;
    const moradores = await moradoresDaUnidade(e.unidade_id);
    const comTelefone = moradores.filter((m) => m.telefone);
    if (comTelefone.length === 0) {
      toast.error("Nenhum morador desta unidade tem telefone cadastrado");
      return;
    }
    const u = unidades.find((x) => x.id === e.unidade_id);
    const msg = `📦 *Encomenda recebida!*\n\nUnidade: ${u?.bloco ? u.bloco + " · " : ""}${u?.numero}\n${e.descricao}${e.transportadora ? `\nTransportadora: ${e.transportadora}` : ""}${e.local_armazenamento ? `\n📍 Retirar em: ${e.local_armazenamento}` : ""}\n\nFavor retirar na portaria.`;

    let primeiroLink: string | null = null;
    for (const m of comTelefone) {
      const r = await registrarNotificacaoWA({
        condominioId,
        unidadeId: e.unidade_id,
        destinatarioUserId: m.user_id,
        destinatarioTelefone: m.telefone!,
        destinatarioNome: m.nome,
        mensagem: msg,
        contexto: "encomenda",
        contextoId: e.id,
      });
      if (r?.link && !primeiroLink) primeiroLink = r.link;
    }
    await supabase.from("encomendas").update({ notificado_em: new Date().toISOString() }).eq("id", e.id);
    toast.success("Notificação registrada");
    if (primeiroLink) window.open(primeiroLink, "_blank");
    void carregar();
  };

  const marcarRetirada = async (e: Encomenda) => {
    const nome = window.prompt("Nome de quem está retirando (opcional):") ?? "";
    const { error } = await supabase.rpc("marcar_encomenda_retirada", {
      _encomenda_id: e.id,
      _retirado_por_nome: nome || "",
    });
    if (error) toast.error(ERROS[error.message] ?? error.message);
    else { toast.success("Encomenda marcada como retirada"); void carregar(); }
  };

  if (!condominioId) return <div className="p-8 text-muted-foreground">Selecione um condomínio.</div>;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
            <Package className="text-primary" /> Encomendas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Controle de entregas recebidas na portaria com notificação ao morador.
          </p>
        </div>
        {podeGerenciar && (
          <button onClick={() => setShowNova(true)} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium flex items-center gap-2">
            <Plus size={16} /> Nova encomenda
          </button>
        )}
      </header>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Aguardando retirada" value={stats.aguardando} highlight />
        <Stat label="Recebidas no mês" value={stats.mes} />
        <Stat label="Retiradas" value={stats.retiradas} />
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(["aguardando", "retirada", "todas"] as const).map((f) => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors capitalize ${filtro === f ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..." className="input pl-9" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : lista.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Nenhuma encomenda.</p>
      ) : (
        <div className="space-y-3">
          {lista.map((e) => (
            <div key={e.id} className="border border-border rounded-lg p-4 bg-background flex flex-wrap gap-4">
              {e.foto_url && (
                <img src={e.foto_url} alt="" className="w-20 h-20 rounded-lg object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold">{e.descricao}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    e.status === "aguardando" ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" :
                    e.status === "retirada" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" :
                    "bg-muted text-muted-foreground"
                  }`}>{e.status}</span>
                  {e.notificado_em && <span className="text-xs text-emerald-600 flex items-center gap-1"><Check size={12} /> notificado</span>}
                </div>
                <div className="mt-1 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground">
                  <p className="flex items-center gap-1.5"><MapPin size={14} /> {unidadeLabel(e.unidade_id)}</p>
                  {e.transportadora && <p className="flex items-center gap-1.5"><Truck size={14} /> {e.transportadora}</p>}
                  {e.codigo_rastreio && <p className="flex items-center gap-1.5"><Hash size={14} /> {e.codigo_rastreio}</p>}
                  {e.local_armazenamento && <p>📦 {e.local_armazenamento}</p>}
                  <p>Recebida {dateTimeBR(e.recebido_em)}</p>
                  {e.retirado_em && <p>Retirada {dateTimeBR(e.retirado_em)} {e.retirado_por_nome ? `por ${e.retirado_por_nome}` : ""}</p>}
                </div>
                {e.observacoes && <p className="text-sm mt-1 text-foreground/80">{e.observacoes}</p>}
              </div>
              {podeGerenciar && e.status === "aguardando" && (
                <div className="flex gap-2 flex-wrap items-start">
                  <button onClick={() => notificarMorador(e)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-medium flex items-center gap-1">
                    <MessageCircle size={14} /> Notificar
                  </button>
                  <button onClick={() => marcarRetirada(e)} className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-medium flex items-center gap-1">
                    <Check size={14} /> Retirada
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showNova && podeGerenciar && (
        <NovaEncomendaModal
          unidades={unidades}
          condominioId={condominioId}
          userId={user!.id}
          onClose={() => setShowNova(false)}
          onCriada={() => { setShowNova(false); void carregar(); }}
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

function NovaEncomendaModal({
  unidades, condominioId, userId, onClose, onCriada,
}: { unidades: Unidade[]; condominioId: string; userId: string; onClose: () => void; onCriada: () => void }) {
  const [form, setForm] = useState({
    unidade_id: "",
    descricao: "",
    transportadora: "",
    codigo_rastreio: "",
    remetente: "",
    local_armazenamento: "Portaria",
    observacoes: "",
  });
  const [foto, setFoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [notificarApos, setNotificarApos] = useState(true);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.unidade_id || !form.descricao) { toast.error("Unidade e descrição são obrigatórias"); return; }
    setSaving(true);

    let fotoUrl: string | null = null;
    if (foto) {
      // Storage simples por base64 inline (até integrarmos bucket dedicado)
      const reader = new FileReader();
      fotoUrl = await new Promise<string>((res) => {
        reader.onload = () => res(reader.result as string);
        reader.readAsDataURL(foto);
      });
    }

    const { data, error } = await supabase.rpc("registrar_encomenda", {
      _unidade_id: form.unidade_id,
      _descricao: form.descricao,
      _transportadora: form.transportadora || "",
      _codigo_rastreio: form.codigo_rastreio || "",
      _remetente: form.remetente || "",
      _local_armazenamento: form.local_armazenamento || "",
      _observacoes: form.observacoes || "",
      _foto_url: fotoUrl ?? "",
    });
    if (error) { setSaving(false); toast.error(ERROS[error.message] ?? error.message); return; }
    toast.success("Encomenda registrada");

    if (notificarApos && data) {
      const moradores = await moradoresDaUnidade(form.unidade_id);
      const comTelefone = moradores.filter((m) => m.telefone);
      const u = unidades.find((x) => x.id === form.unidade_id);
      const msg = `📦 *Encomenda recebida!*\n\nUnidade: ${u?.bloco ? u.bloco + " · " : ""}${u?.numero}\n${form.descricao}${form.transportadora ? `\nTransportadora: ${form.transportadora}` : ""}${form.local_armazenamento ? `\n📍 Retirar em: ${form.local_armazenamento}` : ""}\n\nFavor retirar na portaria.`;
      let primeiro: string | null = null;
      for (const m of comTelefone) {
        const r = await registrarNotificacaoWA({
          condominioId, unidadeId: form.unidade_id,
          destinatarioUserId: m.user_id,
          destinatarioTelefone: m.telefone!,
          destinatarioNome: m.nome,
          mensagem: msg, contexto: "encomenda", contextoId: data as string,
        });
        if (r?.link && !primeiro) primeiro = r.link;
      }
      await supabase.from("encomendas").update({ notificado_em: new Date().toISOString() }).eq("id", data as string);
      if (primeiro) window.open(primeiro, "_blank");
      else if (comTelefone.length === 0) toast.error("Nenhum morador com telefone cadastrado");
    }

    setSaving(false);
    onCriada();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-background">
          <h3 className="font-bold text-lg">Nova encomenda</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <Field label="Unidade *">
            <select value={form.unidade_id} onChange={(ev) => setForm({ ...form, unidade_id: ev.target.value })} className="input" required>
              <option value="">Selecione...</option>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.bloco ? `${u.bloco} · ` : ""}Un. {u.numero}</option>)}
            </select>
          </Field>
          <Field label="Descrição *">
            <input value={form.descricao} onChange={(ev) => setForm({ ...form, descricao: ev.target.value })} className="input" placeholder="Ex: Caixa pequena Mercado Livre" required />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Transportadora"><input value={form.transportadora} onChange={(ev) => setForm({ ...form, transportadora: ev.target.value })} className="input" placeholder="Correios, Mercado Envios..." /></Field>
            <Field label="Código de rastreio"><input value={form.codigo_rastreio} onChange={(ev) => setForm({ ...form, codigo_rastreio: ev.target.value })} className="input" /></Field>
          </div>
          <Field label="Remetente"><input value={form.remetente} onChange={(ev) => setForm({ ...form, remetente: ev.target.value })} className="input" /></Field>
          <Field label="Local de armazenamento"><input value={form.local_armazenamento} onChange={(ev) => setForm({ ...form, local_armazenamento: ev.target.value })} className="input" placeholder="Portaria, Sala de encomendas..." /></Field>
          <Field label="Foto (opcional)">
            <input type="file" accept="image/*" capture="environment" onChange={(ev) => setFoto(ev.target.files?.[0] ?? null)} className="input" />
          </Field>
          <Field label="Observações"><textarea value={form.observacoes} onChange={(ev) => setForm({ ...form, observacoes: ev.target.value })} rows={2} className="input" /></Field>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notificarApos} onChange={(ev) => setNotificarApos(ev.target.checked)} />
            Notificar morador via WhatsApp ao salvar
          </label>

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
