import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { useAuth } from "@/auth/AuthProvider";
import { dateTimeBR } from "@/lib/format";
import {
  Wrench, Plus, Loader2, X, Search, MessageSquare, Star,
  AlertCircle, CheckCircle2, Clock, User, Tag, Send, Lock
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/ocorrencias")({
  component: OcorrenciasPage,
});

type Categoria = "manutencao" | "barulho" | "seguranca" | "limpeza" | "area_comum" | "infraestrutura" | "outros";
type Prioridade = "baixa" | "media" | "alta" | "urgente";
type Status = "aberta" | "em_andamento" | "aguardando_morador" | "resolvida" | "fechada" | "cancelada";

type Ocorrencia = {
  id: string;
  condominio_id: string;
  unidade_id: string | null;
  aberta_por: string;
  titulo: string;
  descricao: string;
  categoria: Categoria;
  prioridade: Prioridade;
  status: Status;
  local: string | null;
  foto_url: string | null;
  atribuido_a: string | null;
  atribuido_em: string | null;
  resolvido_em: string | null;
  resolucao: string | null;
  fechado_em: string | null;
  nota_satisfacao: number | null;
  created_at: string;
};

type Comentario = {
  id: string;
  autor_id: string;
  mensagem: string;
  interno: boolean;
  created_at: string;
};

type Unidade = { id: string; numero: string; bloco: string | null };

const CATS: Record<Categoria, { label: string; cor: string }> = {
  manutencao:    { label: "Manutenção",     cor: "bg-blue-500" },
  barulho:       { label: "Barulho",        cor: "bg-amber-500" },
  seguranca:     { label: "Segurança",      cor: "bg-red-500" },
  limpeza:       { label: "Limpeza",        cor: "bg-emerald-500" },
  area_comum:    { label: "Área comum",     cor: "bg-purple-500" },
  infraestrutura:{ label: "Infraestrutura", cor: "bg-slate-500" },
  outros:        { label: "Outros",         cor: "bg-gray-500" },
};

const PRIOS: Record<Prioridade, { label: string; classe: string }> = {
  baixa:   { label: "Baixa",   classe: "bg-muted text-muted-foreground" },
  media:   { label: "Média",   classe: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  alta:    { label: "Alta",    classe: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  urgente: { label: "Urgente", classe: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

const STATUS_INFO: Record<Status, { label: string; classe: string; icon: typeof Clock }> = {
  aberta:             { label: "Aberta",             classe: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", icon: AlertCircle },
  em_andamento:       { label: "Em andamento",       classe: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", icon: Clock },
  aguardando_morador: { label: "Aguardando morador", classe: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300", icon: Clock },
  resolvida:          { label: "Resolvida",          classe: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", icon: CheckCircle2 },
  fechada:            { label: "Fechada",            classe: "bg-muted text-muted-foreground", icon: CheckCircle2 },
  cancelada:          { label: "Cancelada",          classe: "bg-muted text-muted-foreground line-through", icon: X },
};

const ERROS: Record<string, string> = {
  forbidden: "Sem permissão",
  unidade_invalida: "Unidade inválida",
  ocorrencia_nao_encontrada: "Ocorrência não encontrada",
  status_invalido: "Status inválido",
  nota_invalida: "Nota deve ser de 1 a 5",
};

function OcorrenciasPage() {
  const { user } = useAuth();
  const { condominioId, isSindico, isPorteiro, isMorador } = useCondominioAtivo();
  const podeGerenciar = isSindico || isPorteiro;

  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [minhasUnidades, setMinhasUnidades] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNova, setShowNova] = useState(false);
  const [filtro, setFiltro] = useState<"abertas" | "minhas" | "todas">("abertas");
  const [busca, setBusca] = useState("");
  const [selecionada, setSelecionada] = useState<Ocorrencia | null>(null);

  const carregar = async () => {
    if (!condominioId) return;
    setLoading(true);
    const [o, u, m] = await Promise.all([
      supabase.from("ocorrencias").select("*").eq("condominio_id", condominioId).order("created_at", { ascending: false }),
      supabase.from("unidades").select("id, numero, bloco").eq("condominio_id", condominioId).order("numero"),
      user ? supabase.from("unidade_moradores").select("unidade_id").eq("user_id", user.id) : Promise.resolve({ data: [] as any[] }),
    ]);
    if (o.data) setOcorrencias(o.data as Ocorrencia[]);
    if (u.data) setUnidades(u.data as Unidade[]);
    if (m.data) setMinhasUnidades((m.data as any[]).map((x) => x.unidade_id));
    setLoading(false);
  };

  useEffect(() => { void carregar(); /* eslint-disable-next-line */ }, [condominioId, user?.id]);

  const unidadeLabel = (id: string | null) => {
    if (!id) return "Geral";
    const u = unidades.find((x) => x.id === id);
    return u ? `${u.bloco ? `${u.bloco} · ` : ""}Un. ${u.numero}` : "—";
  };

  const lista = useMemo(() => {
    return ocorrencias.filter((o) => {
      if (filtro === "abertas" && (o.status === "fechada" || o.status === "cancelada")) return false;
      if (filtro === "minhas" && o.aberta_por !== user?.id) return false;
      if (busca) {
        const q = busca.toLowerCase();
        const txt = `${o.titulo} ${o.descricao} ${o.atribuido_a ?? ""} ${unidadeLabel(o.unidade_id)}`.toLowerCase();
        if (!txt.includes(q)) return false;
      }
      return true;
    });
  }, [ocorrencias, filtro, busca, user?.id, unidades]);

  const stats = useMemo(() => ({
    abertas: ocorrencias.filter((o) => o.status === "aberta").length,
    andamento: ocorrencias.filter((o) => o.status === "em_andamento").length,
    resolvidas: ocorrencias.filter((o) => o.status === "resolvida").length,
    urgentes: ocorrencias.filter((o) => (o.status === "aberta" || o.status === "em_andamento") && o.prioridade === "urgente").length,
  }), [ocorrencias]);

  const abrir = (o: Ocorrencia) => setSelecionada(o);
  const fechar = () => { setSelecionada(null); void carregar(); };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2">
            <Wrench className="text-primary" /> Ocorrências
          </h1>
          <p className="text-sm text-muted-foreground">Chamados, manutenções e reclamações do condomínio.</p>
        </div>
        <button onClick={() => setShowNova(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-[var(--color-primary-deep)]">
          <Plus size={16} /> Nova ocorrência
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Abertas" value={stats.abertas} color="bg-blue-500" />
        <StatCard label="Em andamento" value={stats.andamento} color="bg-amber-500" />
        <StatCard label="Resolvidas" value={stats.resolvidas} color="bg-emerald-500" />
        <StatCard label="Urgentes" value={stats.urgentes} color="bg-red-500" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="flex gap-1 rounded-lg border border-border bg-background p-1">
          {(["abertas", "minhas", "todas"] as const).map((f) => (
            <button key={f} onClick={() => setFiltro(f)} className={`px-3 py-1.5 text-xs font-semibold rounded-md ${filtro === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {f === "abertas" ? "Abertas" : f === "minhas" ? "Minhas" : "Todas"}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por título, descrição..." className="input pl-9" />
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground"><Loader2 className="animate-spin" /></div>
      ) : lista.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl text-muted-foreground">
          <Wrench size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhuma ocorrência encontrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map((o) => {
            const SI = STATUS_INFO[o.status];
            return (
              <button key={o.id} onClick={() => abrir(o)} className="w-full text-left bg-background border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all">
                <div className="flex items-start gap-3">
                  <span className={`mt-1 h-2.5 w-2.5 rounded-full ${CATS[o.categoria].cor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm truncate">{o.titulo}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${PRIOS[o.prioridade].classe}`}>
                        {PRIOS[o.prioridade].label}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 ${SI.classe}`}>
                        <SI.icon size={10} /> {SI.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{o.descricao}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Tag size={11} />{CATS[o.categoria].label}</span>
                      <span>{unidadeLabel(o.unidade_id)}</span>
                      {o.atribuido_a && <span className="inline-flex items-center gap-1"><User size={11} />{o.atribuido_a}</span>}
                      <span>{dateTimeBR(o.created_at)}</span>
                      {o.nota_satisfacao && (
                        <span className="inline-flex items-center gap-0.5 text-amber-500">
                          {Array.from({ length: o.nota_satisfacao }).map((_, i) => <Star key={i} size={10} fill="currentColor" />)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showNova && (
        <NovaOcorrencia
          condominioId={condominioId!}
          unidades={unidades}
          minhasUnidades={minhasUnidades}
          podeGerenciar={podeGerenciar}
          onClose={() => setShowNova(false)}
          onCriada={() => { setShowNova(false); void carregar(); }}
        />
      )}

      {selecionada && (
        <DetalheOcorrencia
          ocorrencia={selecionada}
          unidadeLabel={unidadeLabel(selecionada.unidade_id)}
          podeGerenciar={podeGerenciar}
          souAutor={selecionada.aberta_por === user?.id}
          isSindico={isSindico}
          onClose={fechar}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-background border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-display font-bold">{value}</div>
    </div>
  );
}

function NovaOcorrencia({
  condominioId, unidades, minhasUnidades, podeGerenciar, onClose, onCriada,
}: {
  condominioId: string;
  unidades: Unidade[];
  minhasUnidades: string[];
  podeGerenciar: boolean;
  onClose: () => void;
  onCriada: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<Categoria>("manutencao");
  const [prioridade, setPrioridade] = useState<Prioridade>("media");
  const [unidadeId, setUnidadeId] = useState<string>(minhasUnidades[0] ?? "");
  const [local, setLocal] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [enviando, setEnviando] = useState(false);

  const opcoesUnidades = podeGerenciar ? unidades : unidades.filter((u) => minhasUnidades.includes(u.id));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !descricao.trim()) {
      toast.error("Preencha título e descrição");
      return;
    }
    setEnviando(true);
    const { error } = await supabase.rpc("abrir_ocorrencia", {
      _condominio_id: condominioId,
      _unidade_id: unidadeId || null,
      _titulo: titulo.trim(),
      _descricao: descricao.trim(),
      _categoria: categoria,
      _prioridade: prioridade,
      _local: local.trim() || null,
      _foto_url: fotoUrl.trim() || null,
    } as any);
    setEnviando(false);
    if (error) {
      toast.error(ERROS[error.message] ?? error.message);
      return;
    }
    toast.success("Ocorrência aberta!");
    onCriada();
  };

  return (
    <Modal onClose={onClose} title="Nova ocorrência">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Título *">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Vazamento na garagem" className="input" maxLength={120} required />
        </Field>
        <Field label="Descrição *">
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreva o que está acontecendo..." className="input min-h-[100px]" required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoria">
            <select value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria)} className="input">
              {(Object.keys(CATS) as Categoria[]).map((c) => <option key={c} value={c}>{CATS[c].label}</option>)}
            </select>
          </Field>
          <Field label="Prioridade">
            <select value={prioridade} onChange={(e) => setPrioridade(e.target.value as Prioridade)} className="input">
              {(Object.keys(PRIOS) as Prioridade[]).map((p) => <option key={p} value={p}>{PRIOS[p].label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Unidade (opcional)">
          <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)} className="input">
            <option value="">— Sem unidade (ocorrência geral)</option>
            {opcoesUnidades.map((u) => (
              <option key={u.id} value={u.id}>{u.bloco ? `${u.bloco} · ` : ""}Un. {u.numero}</option>
            ))}
          </select>
        </Field>
        <Field label="Local (opcional)">
          <input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: Garagem subsolo, hall do 3º andar" className="input" />
        </Field>
        <Field label="URL da foto (opcional)">
          <input value={fotoUrl} onChange={(e) => setFotoUrl(e.target.value)} placeholder="https://..." className="input" type="url" />
        </Field>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-muted">Cancelar</button>
          <button type="submit" disabled={enviando} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
            {enviando && <Loader2 size={14} className="animate-spin" />} Abrir ocorrência
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DetalheOcorrencia({
  ocorrencia, unidadeLabel, podeGerenciar, souAutor, isSindico, onClose,
}: {
  ocorrencia: Ocorrencia;
  unidadeLabel: string;
  podeGerenciar: boolean;
  souAutor: boolean;
  isSindico: boolean;
  onClose: () => void;
}) {
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [novoComentario, setNovoComentario] = useState("");
  const [interno, setInterno] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [showAtribuir, setShowAtribuir] = useState(false);
  const [showResolver, setShowResolver] = useState(false);
  const [showAvaliar, setShowAvaliar] = useState(false);
  const SI = STATUS_INFO[ocorrencia.status];

  const carregarComentarios = async () => {
    setCarregando(true);
    const { data } = await supabase
      .from("ocorrencia_comentarios")
      .select("id, autor_id, mensagem, interno, created_at")
      .eq("ocorrencia_id", ocorrencia.id)
      .order("created_at");
    if (data) setComentarios(data as Comentario[]);
    setCarregando(false);
  };

  useEffect(() => { void carregarComentarios(); /* eslint-disable-next-line */ }, [ocorrencia.id]);

  const enviarComentario = async () => {
    if (!novoComentario.trim()) return;
    setEnviando(true);
    const { error } = await supabase.rpc("comentar_ocorrencia", {
      _ocorrencia_id: ocorrencia.id,
      _mensagem: novoComentario.trim(),
      _interno: podeGerenciar ? interno : false,
    });
    setEnviando(false);
    if (error) {
      toast.error(ERROS[error.message] ?? error.message);
      return;
    }
    setNovoComentario("");
    setInterno(false);
    void carregarComentarios();
  };

  const mudarStatus = async (novo: Status, resolucao?: string) => {
    const { error } = await supabase.rpc("atualizar_status_ocorrencia", {
      _ocorrencia_id: ocorrencia.id,
      _novo_status: novo,
      _resolucao: resolucao ?? null,
    } as any);
    if (error) { toast.error(ERROS[error.message] ?? error.message); return; }
    toast.success("Status atualizado");
    onClose();
  };

  return (
    <Modal onClose={onClose} title={ocorrencia.titulo} wide>
      <div className="space-y-4">
        {/* Cabeçalho com badges */}
        <div className="flex flex-wrap gap-2">
          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${PRIOS[ocorrencia.prioridade].classe}`}>
            {PRIOS[ocorrencia.prioridade].label}
          </span>
          <span className={`text-xs px-2 py-1 rounded-full font-semibold inline-flex items-center gap-1 ${SI.classe}`}>
            <SI.icon size={11} /> {SI.label}
          </span>
          <span className="text-xs px-2 py-1 rounded-full font-semibold bg-muted text-muted-foreground inline-flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${CATS[ocorrencia.categoria].cor}`} />
            {CATS[ocorrencia.categoria].label}
          </span>
        </div>

        {/* Detalhes */}
        <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
          <p className="whitespace-pre-wrap">{ocorrencia.descricao}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-2 border-t border-border">
            <span><strong>Unidade:</strong> {unidadeLabel}</span>
            {ocorrencia.local && <span><strong>Local:</strong> {ocorrencia.local}</span>}
            <span><strong>Aberta:</strong> {dateTimeBR(ocorrencia.created_at)}</span>
            {ocorrencia.atribuido_a && <span><strong>Atribuída a:</strong> {ocorrencia.atribuido_a}</span>}
          </div>
          {ocorrencia.foto_url && (
            <a href={ocorrencia.foto_url} target="_blank" rel="noreferrer" className="block mt-2">
              <img src={ocorrencia.foto_url} alt="Foto da ocorrência" className="max-h-48 rounded-lg border border-border" />
            </a>
          )}
          {ocorrencia.resolucao && (
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Resolução:</p>
              <p className="text-sm">{ocorrencia.resolucao}</p>
            </div>
          )}
          {ocorrencia.nota_satisfacao && (
            <div className="mt-2 pt-2 border-t border-border flex items-center gap-1 text-amber-500">
              <strong className="text-xs text-foreground mr-1">Avaliação:</strong>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={14} fill={i < ocorrencia.nota_satisfacao! ? "currentColor" : "none"} />
              ))}
            </div>
          )}
        </div>

        {/* Ações de gestão */}
        {podeGerenciar && ocorrencia.status !== "fechada" && ocorrencia.status !== "cancelada" && (
          <div className="flex flex-wrap gap-2">
            {isSindico && (
              <button onClick={() => setShowAtribuir(true)} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted">
                {ocorrencia.atribuido_a ? "Reatribuir" : "Atribuir"}
              </button>
            )}
            {ocorrencia.status === "aberta" && (
              <button onClick={() => mudarStatus("em_andamento")} className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600">
                Iniciar atendimento
              </button>
            )}
            {(ocorrencia.status === "em_andamento" || ocorrencia.status === "aberta") && (
              <button onClick={() => mudarStatus("aguardando_morador")} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted">
                Aguardar morador
              </button>
            )}
            {ocorrencia.status !== "resolvida" && (
              <button onClick={() => setShowResolver(true)} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600">
                Marcar como resolvida
              </button>
            )}
            <button onClick={() => mudarStatus("cancelada")} className="text-xs px-3 py-1.5 rounded-lg text-destructive border border-destructive/40 hover:bg-destructive/10">
              Cancelar
            </button>
          </div>
        )}

        {/* Avaliação pelo morador */}
        {souAutor && ocorrencia.status === "resolvida" && !ocorrencia.nota_satisfacao && (
          <div className="border border-amber-500/40 bg-amber-50 dark:bg-amber-900/10 rounded-lg p-3">
            <p className="text-sm font-semibold mb-2">Como foi o atendimento?</p>
            <button onClick={() => setShowAvaliar(true)} className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 inline-flex items-center gap-1">
              <Star size={12} /> Avaliar agora
            </button>
          </div>
        )}

        {/* Comentários */}
        <div>
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
            <MessageSquare size={14} /> Conversa ({comentarios.length})
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {carregando ? (
              <div className="flex justify-center py-4 text-muted-foreground"><Loader2 size={16} className="animate-spin" /></div>
            ) : comentarios.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum comentário ainda</p>
            ) : comentarios.map((c) => (
              <div key={c.id} className={`p-2.5 rounded-lg text-sm ${c.interno ? "bg-amber-100 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40" : "bg-muted/40"}`}>
                {c.interno && (
                  <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 mb-1 inline-flex items-center gap-1">
                    <Lock size={9} /> NOTA INTERNA
                  </div>
                )}
                <p className="whitespace-pre-wrap">{c.mensagem}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{dateTimeBR(c.created_at)}</p>
              </div>
            ))}
          </div>

          {/* Novo comentário */}
          {ocorrencia.status !== "fechada" && ocorrencia.status !== "cancelada" && (
            <div className="mt-3 space-y-2">
              <textarea value={novoComentario} onChange={(e) => setNovoComentario(e.target.value)} placeholder="Escreva uma mensagem..." className="input min-h-[60px] text-sm" />
              <div className="flex justify-between items-center">
                {podeGerenciar ? (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input type="checkbox" checked={interno} onChange={(e) => setInterno(e.target.checked)} />
                    Nota interna (não visível ao morador)
                  </label>
                ) : <span />}
                <button onClick={enviarComentario} disabled={enviando || !novoComentario.trim()} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
                  {enviando ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Enviar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showAtribuir && (
        <AtribuirModal
          ocorrenciaId={ocorrencia.id}
          atual={ocorrencia.atribuido_a}
          onClose={() => setShowAtribuir(false)}
          onOk={() => { setShowAtribuir(false); onClose(); }}
        />
      )}
      {showResolver && (
        <ResolverModal
          onClose={() => setShowResolver(false)}
          onOk={(resolucao) => { setShowResolver(false); void mudarStatus("resolvida", resolucao); }}
        />
      )}
      {showAvaliar && (
        <AvaliarModal
          ocorrenciaId={ocorrencia.id}
          onClose={() => setShowAvaliar(false)}
          onOk={() => { setShowAvaliar(false); onClose(); }}
        />
      )}
    </Modal>
  );
}

function AtribuirModal({ ocorrenciaId, atual, onClose, onOk }: { ocorrenciaId: string; atual: string | null; onClose: () => void; onOk: () => void }) {
  const [valor, setValor] = useState(atual ?? "");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!valor.trim()) return;
    setLoading(true);
    const { error } = await supabase.rpc("atribuir_ocorrencia", { _ocorrencia_id: ocorrenciaId, _atribuido_a: valor.trim() });
    setLoading(false);
    if (error) { toast.error(ERROS[error.message] ?? error.message); return; }
    toast.success("Atribuída");
    onOk();
  };
  return (
    <Modal onClose={onClose} title="Atribuir ocorrência">
      <div className="space-y-3">
        <Field label="Responsável (zelador, prestador, empresa...)">
          <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex.: João (zelador), Hidrotec Ltda" className="input" autoFocus />
        </Field>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted">Cancelar</button>
          <button onClick={submit} disabled={loading || !valor.trim()} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground disabled:opacity-50">Confirmar</button>
        </div>
      </div>
    </Modal>
  );
}

function ResolverModal({ onClose, onOk }: { onClose: () => void; onOk: (resolucao: string) => void }) {
  const [resolucao, setResolucao] = useState("");
  return (
    <Modal onClose={onClose} title="Marcar como resolvida">
      <div className="space-y-3">
        <Field label="O que foi feito? (opcional)">
          <textarea value={resolucao} onChange={(e) => setResolucao(e.target.value)} placeholder="Descreva a solução aplicada..." className="input min-h-[100px]" autoFocus />
        </Field>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted">Cancelar</button>
          <button onClick={() => onOk(resolucao.trim())} className="px-4 py-2 text-sm rounded-lg bg-emerald-500 text-white hover:bg-emerald-600">Resolver</button>
        </div>
      </div>
    </Modal>
  );
}

function AvaliarModal({ ocorrenciaId, onClose, onOk }: { ocorrenciaId: string; onClose: () => void; onOk: () => void }) {
  const [nota, setNota] = useState(5);
  const [comentario, setComentario] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    const { error } = await supabase.rpc("avaliar_ocorrencia", {
      _ocorrencia_id: ocorrenciaId, _nota: nota, _comentario: comentario.trim() || null,
    } as any);
    setLoading(false);
    if (error) { toast.error(ERROS[error.message] ?? error.message); return; }
    toast.success("Obrigado pela avaliação!");
    onOk();
  };
  return (
    <Modal onClose={onClose} title="Avaliar atendimento">
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-2">Sua nota</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setNota(n)} className="p-1 text-amber-500 hover:scale-110 transition-transform">
                <Star size={32} fill={n <= nota ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
        </div>
        <Field label="Comentário (opcional)">
          <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Conte como foi sua experiência..." className="input min-h-[80px]" />
        </Field>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted">Cancelar</button>
          <button onClick={submit} disabled={loading} className="px-4 py-2 text-sm rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50">Enviar avaliação</button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className={`bg-background rounded-2xl shadow-xl w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background z-10">
          <h3 className="font-display font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
