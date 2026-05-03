import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { brl, dateBR, dateTimeBR, timeBR } from "@/lib/format";
import {
  Calendar, Plus, Loader2, ChevronLeft, ChevronRight, Check, X,
  Clock, Users, MapPin, AlertTriangle, Settings2, Ban, Trash2
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/reservas")({
  component: ReservasPage,
});

type Area = {
  id: string;
  nome: string;
  descricao: string | null;
  capacidade: number | null;
  taxa_uso: number;
  requer_aprovacao: boolean;
  antecedencia_min_horas: number;
  antecedencia_max_dias: number;
  duracao_min_minutos: number;
  duracao_max_minutos: number;
  hora_abertura: string;
  hora_fechamento: string;
  dias_permitidos: number[];
  max_reservas_por_unidade_mes: number;
  cor: string;
  regulamento: string | null;
  ativo: boolean;
};

type Reserva = {
  id: string;
  area_id: string;
  unidade_id: string;
  solicitante_id: string;
  inicio: string;
  fim: string;
  num_convidados: number;
  observacoes: string | null;
  status: "pendente" | "confirmada" | "recusada" | "cancelada" | "concluida";
  motivo_recusa: string | null;
  taxa: number;
};

type Bloqueio = {
  id: string;
  area_id: string;
  inicio: string;
  fim: string;
  motivo: string;
};

type Unidade = { id: string; numero: string; bloco: string | null };

type Tab = "calendario" | "minhas" | "pendentes" | "areas";

const ERROS: Record<string, string> = {
  area_indisponivel: "Área indisponível",
  forbidden: "Sem permissão",
  unidade_invalida: "Unidade inválida",
  periodo_invalido: "Período inválido",
  antecedencia_minima_nao_atendida: "Reserva com antecedência insuficiente",
  antecedencia_maxima_excedida: "Reserva fora do limite de antecedência",
  duracao_abaixo_minimo: "Duração abaixo do mínimo permitido",
  duracao_acima_maximo: "Duração acima do máximo permitido",
  dia_nao_permitido: "Dia da semana não permitido para esta área",
  fora_horario_funcionamento: "Fora do horário de funcionamento",
  capacidade_excedida: "Número de convidados excede a capacidade",
  horario_indisponivel: "Já existe reserva neste horário",
  periodo_bloqueado: "Período bloqueado pelo síndico",
  limite_mensal_atingido: "Limite mensal de reservas atingido",
  status_invalido: "Status inválido para esta operação",
};

function ReservasPage() {
  const { user } = useAuth();
  const { condominioId, isSindico, isPorteiro, isMorador } = useCondominioAtivo();
  const podeGerenciar = isSindico || isPorteiro;
  const [tab, setTab] = useState<Tab>("calendario");
  const [areas, setAreas] = useState<Area[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [minhasUnidades, setMinhasUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNova, setShowNova] = useState(false);
  const [showArea, setShowArea] = useState<Area | null>(null);
  const [showBloqueio, setShowBloqueio] = useState(false);

  const carregar = async () => {
    if (!condominioId) return;
    setLoading(true);
    const [a, r, b, u] = await Promise.all([
      supabase.from("areas_comuns").select("*").eq("condominio_id", condominioId).order("ordem").order("nome"),
      supabase.from("reservas").select("*").eq("condominio_id", condominioId).order("inicio", { ascending: false }),
      supabase.from("area_bloqueios").select("*").eq("condominio_id", condominioId),
      supabase.from("unidades").select("id, numero, bloco").eq("condominio_id", condominioId).order("numero"),
    ]);
    if (a.data) setAreas(a.data as Area[]);
    if (r.data) setReservas(r.data as Reserva[]);
    if (b.data) setBloqueios(b.data as Bloqueio[]);
    if (u.data) setUnidades(u.data as Unidade[]);

    if (user && !podeGerenciar) {
      const { data } = await supabase
        .from("unidade_moradores")
        .select("unidade_id, unidades(id, numero, bloco)")
        .eq("user_id", user.id);
      if (data) {
        const mu = data
          .map((d: any) => d.unidades)
          .filter(Boolean) as Unidade[];
        setMinhasUnidades(mu);
      }
    } else {
      setMinhasUnidades(u.data as Unidade[] ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominioId]);

  const minhasReservas = useMemo(
    () => reservas.filter((r) => r.solicitante_id === user?.id),
    [reservas, user?.id]
  );
  const pendentes = useMemo(
    () => reservas.filter((r) => r.status === "pendente"),
    [reservas]
  );

  if (!condominioId) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Selecione um condomínio para gerenciar reservas.</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
            <Calendar className="text-primary" /> Reservas de áreas comuns
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Salão, churrasqueira, quadra e mais. Solicite, aprove e controle a disponibilidade.
          </p>
        </div>
        <div className="flex gap-2">
          {podeGerenciar && (
            <button
              onClick={() => setShowBloqueio(true)}
              className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium flex items-center gap-2"
            >
              <Ban size={16} /> Bloquear data
            </button>
          )}
          <button
            onClick={() => setShowNova(true)}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium flex items-center gap-2"
          >
            <Plus size={16} /> Nova reserva
          </button>
        </div>
      </header>

      <div className="border-b border-border mb-6 overflow-x-auto">
        <nav className="flex gap-6 min-w-max">
          {([
            ["calendario", "Calendário"],
            ["minhas", `Minhas reservas${minhasReservas.length ? ` (${minhasReservas.length})` : ""}`],
            ...(podeGerenciar ? ([["pendentes", `Pendentes${pendentes.length ? ` (${pendentes.length})` : ""}`]] as [Tab, string][]) : []),
            ["areas", "Áreas"],
          ] as [Tab, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === k
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {tab === "calendario" && (
            <CalendarioView
              areas={areas}
              reservas={reservas}
              bloqueios={bloqueios}
              podeGerenciar={podeGerenciar}
              onAprovar={async (id) => {
                const { error } = await supabase.rpc("aprovar_reserva", { _reserva_id: id });
                if (error) toast.error(ERROS[error.message] ?? error.message);
                else { toast.success("Reserva aprovada"); void carregar(); }
              }}
              onRecusar={async (id) => {
                const motivo = window.prompt("Motivo da recusa:");
                if (!motivo) return;
                const { error } = await supabase.rpc("recusar_reserva", { _reserva_id: id, _motivo: motivo });
                if (error) toast.error(ERROS[error.message] ?? error.message);
                else { toast.success("Reserva recusada"); void carregar(); }
              }}
              onCancelar={async (id) => {
                if (!confirm("Cancelar esta reserva?")) return;
                const { error } = await supabase.rpc("cancelar_reserva", { _reserva_id: id });
                if (error) toast.error(ERROS[error.message] ?? error.message);
                else { toast.success("Reserva cancelada"); void carregar(); }
              }}
            />
          )}
          {tab === "minhas" && (
            <ListaReservas
              reservas={minhasReservas}
              areas={areas}
              unidades={unidades}
              vazio="Você ainda não tem reservas."
              onCancelar={async (id) => {
                if (!confirm("Cancelar esta reserva?")) return;
                const { error } = await supabase.rpc("cancelar_reserva", { _reserva_id: id });
                if (error) toast.error(ERROS[error.message] ?? error.message);
                else { toast.success("Reserva cancelada"); void carregar(); }
              }}
            />
          )}
          {tab === "pendentes" && podeGerenciar && (
            <ListaReservas
              reservas={pendentes}
              areas={areas}
              unidades={unidades}
              vazio="Nenhuma reserva pendente."
              modoAprovacao
              onAprovar={async (id) => {
                const { error } = await supabase.rpc("aprovar_reserva", { _reserva_id: id });
                if (error) toast.error(ERROS[error.message] ?? error.message);
                else { toast.success("Reserva aprovada"); void carregar(); }
              }}
              onRecusar={async (id) => {
                const motivo = window.prompt("Motivo da recusa:");
                if (!motivo) return;
                const { error } = await supabase.rpc("recusar_reserva", { _reserva_id: id, _motivo: motivo });
                if (error) toast.error(ERROS[error.message] ?? error.message);
                else { toast.success("Reserva recusada"); void carregar(); }
              }}
            />
          )}
          {tab === "areas" && (
            <AreasView
              areas={areas}
              podeGerenciar={podeGerenciar}
              onEditar={(a) => setShowArea(a)}
              onNova={() => setShowArea({} as Area)}
              onAtualizar={() => void carregar()}
            />
          )}
        </>
      )}

      {showNova && (
        <NovaReservaModal
          areas={areas.filter((a) => a.ativo)}
          unidades={minhasUnidades.length ? minhasUnidades : unidades}
          onClose={() => setShowNova(false)}
          onCriada={() => { setShowNova(false); void carregar(); }}
        />
      )}
      {showArea && podeGerenciar && (
        <AreaModal
          condominioId={condominioId}
          area={showArea.id ? showArea : null}
          onClose={() => setShowArea(null)}
          onSalvo={() => { setShowArea(null); void carregar(); }}
        />
      )}
      {showBloqueio && podeGerenciar && (
        <BloqueioModal
          areas={areas}
          condominioId={condominioId}
          onClose={() => setShowBloqueio(false)}
          onSalvo={() => { setShowBloqueio(false); void carregar(); }}
        />
      )}
    </div>
  );
}

/* ========== Calendário mensal ========== */
function CalendarioView({
  areas, reservas, bloqueios, podeGerenciar, onAprovar, onRecusar, onCancelar,
}: {
  areas: Area[]; reservas: Reserva[]; bloqueios: Bloqueio[]; podeGerenciar: boolean;
  onAprovar: (id: string) => void; onRecusar: (id: string) => void; onCancelar: (id: string) => void;
}) {
  const [ref, setRef] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const [filtroArea, setFiltroArea] = useState<string>("");

  const ano = ref.getFullYear();
  const mes = ref.getMonth();
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const dias: (Date | null)[] = [];
  for (let i = 0; i < primeiroDia; i++) dias.push(null);
  for (let d = 1; d <= diasNoMes; d++) dias.push(new Date(ano, mes, d));

  const reservasFiltradas = reservas.filter(
    (r) => r.status !== "cancelada" && r.status !== "recusada" &&
    (!filtroArea || r.area_id === filtroArea)
  );

  const reservasPorDia = (data: Date) => {
    const ymd = data.toISOString().slice(0, 10);
    return reservasFiltradas.filter((r) => r.inicio.slice(0, 10) === ymd);
  };
  const bloqueiosPorDia = (data: Date) => {
    const ymd = data.toISOString().slice(0, 10);
    return bloqueios.filter((b) => b.inicio.slice(0, 10) <= ymd && b.fim.slice(0, 10) >= ymd && (!filtroArea || b.area_id === filtroArea));
  };

  const areaCor = (id: string) => areas.find((a) => a.id === id)?.cor ?? "#10B981";
  const areaNome = (id: string) => areas.find((a) => a.id === id)?.nome ?? "Área";

  const [diaAberto, setDiaAberto] = useState<Date | null>(null);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setRef(new Date(ano, mes - 1, 1))} className="p-2 rounded hover:bg-muted"><ChevronLeft size={18} /></button>
          <span className="font-semibold capitalize min-w-[180px] text-center">
            {ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </span>
          <button onClick={() => setRef(new Date(ano, mes + 1, 1))} className="p-2 rounded hover:bg-muted"><ChevronRight size={18} /></button>
          <button onClick={() => { const d = new Date(); d.setDate(1); setRef(d); }} className="px-3 py-1 text-xs rounded border border-border hover:bg-muted ml-2">Hoje</button>
        </div>
        <select
          value={filtroArea}
          onChange={(e) => setFiltroArea(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background"
        >
          <option value="">Todas as áreas</option>
          {areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
        {["D","S","T","Q","Q","S","S"].map((d, i) => (
          <div key={i} className="bg-muted text-xs font-semibold text-center py-2">{d}</div>
        ))}
        {dias.map((d, i) => {
          if (!d) return <div key={i} className="bg-background min-h-[90px]" />;
          const evs = reservasPorDia(d);
          const bls = bloqueiosPorDia(d);
          const hoje = d.toDateString() === new Date().toDateString();
          return (
            <button
              key={i}
              onClick={() => setDiaAberto(d)}
              className="bg-background min-h-[90px] p-1.5 text-left hover:bg-muted/40 transition-colors flex flex-col"
            >
              <span className={`text-xs font-medium ${hoje ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center" : ""}`}>
                {d.getDate()}
              </span>
              <div className="flex-1 mt-1 space-y-0.5 overflow-hidden">
                {bls.slice(0, 1).map((b) => (
                  <div key={b.id} className="text-[10px] px-1 py-0.5 rounded bg-destructive/15 text-destructive truncate" title={b.motivo}>
                    🚫 {b.motivo}
                  </div>
                ))}
                {evs.slice(0, 2).map((r) => (
                  <div key={r.id} className="text-[10px] px-1 py-0.5 rounded truncate text-white" style={{ background: areaCor(r.area_id), opacity: r.status === "pendente" ? 0.6 : 1 }}>
                    {timeBR(r.inicio)} {areaNome(r.area_id)}
                  </div>
                ))}
                {evs.length > 2 && <div className="text-[10px] text-muted-foreground">+{evs.length - 2}</div>}
              </div>
            </button>
          );
        })}
      </div>

      {diaAberto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDiaAberto(null)}>
          <div className="bg-background rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-background">
              <h3 className="font-bold text-lg">{dateBR(diaAberto)}</h3>
              <button onClick={() => setDiaAberto(null)} className="p-1 rounded hover:bg-muted"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              {bloqueiosPorDia(diaAberto).map((b) => (
                <div key={b.id} className="border border-destructive/40 bg-destructive/5 rounded-lg p-3">
                  <p className="font-semibold text-sm flex items-center gap-2"><Ban size={14} /> {b.motivo}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {areaNome(b.area_id)} · {dateTimeBR(b.inicio)} → {dateTimeBR(b.fim)}
                  </p>
                </div>
              ))}
              {reservasPorDia(diaAberto).length === 0 && bloqueiosPorDia(diaAberto).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma reserva neste dia.</p>
              )}
              {reservasPorDia(diaAberto).map((r) => (
                <ReservaCard key={r.id} r={r} area={areas.find((a) => a.id === r.area_id)}
                  podeGerenciar={podeGerenciar}
                  onAprovar={onAprovar} onRecusar={onRecusar} onCancelar={onCancelar} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========== Lista de reservas ========== */
function ListaReservas({
  reservas, areas, unidades, vazio, modoAprovacao, onAprovar, onRecusar, onCancelar,
}: {
  reservas: Reserva[]; areas: Area[]; unidades: Unidade[]; vazio: string;
  modoAprovacao?: boolean;
  onAprovar?: (id: string) => void; onRecusar?: (id: string) => void; onCancelar?: (id: string) => void;
}) {
  if (reservas.length === 0) {
    return <p className="text-center text-muted-foreground py-12">{vazio}</p>;
  }
  return (
    <div className="space-y-3">
      {reservas.map((r) => (
        <ReservaCard
          key={r.id}
          r={r}
          area={areas.find((a) => a.id === r.area_id)}
          unidade={unidades.find((u) => u.id === r.unidade_id)}
          podeGerenciar={!!modoAprovacao}
          onAprovar={onAprovar} onRecusar={onRecusar} onCancelar={onCancelar}
        />
      ))}
    </div>
  );
}

function ReservaCard({
  r, area, unidade, podeGerenciar, onAprovar, onRecusar, onCancelar,
}: {
  r: Reserva; area?: Area; unidade?: Unidade; podeGerenciar: boolean;
  onAprovar?: (id: string) => void; onRecusar?: (id: string) => void; onCancelar?: (id: string) => void;
}) {
  const statusBadge = {
    pendente: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
    confirmada: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    recusada: "bg-destructive/15 text-destructive",
    cancelada: "bg-muted text-muted-foreground",
    concluida: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  }[r.status];

  return (
    <div className="border border-border rounded-lg p-4 bg-background">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-3 h-3 rounded-full" style={{ background: area?.cor ?? "#10B981" }} />
            <h4 className="font-semibold">{area?.nome ?? "Área"}</h4>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge}`}>{r.status}</span>
          </div>
          <div className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <p className="flex items-center gap-1.5"><Clock size={14} /> {dateTimeBR(r.inicio)} → {timeBR(r.fim)}</p>
            {unidade && <p className="flex items-center gap-1.5"><MapPin size={14} /> {unidade.bloco ? `${unidade.bloco} · ` : ""}Un. {unidade.numero}</p>}
            {r.num_convidados > 0 && <p className="flex items-center gap-1.5"><Users size={14} /> {r.num_convidados} convidados</p>}
            {r.taxa > 0 && <p className="font-medium text-foreground">Taxa: {brl(r.taxa)}</p>}
          </div>
          {r.observacoes && <p className="text-sm mt-2 text-foreground/80">{r.observacoes}</p>}
          {r.motivo_recusa && (
            <p className="text-sm mt-2 text-destructive flex items-center gap-1.5"><AlertTriangle size={14} /> {r.motivo_recusa}</p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {podeGerenciar && r.status === "pendente" && (
            <>
              <button onClick={() => onAprovar?.(r.id)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-medium flex items-center gap-1">
                <Check size={14} /> Aprovar
              </button>
              <button onClick={() => onRecusar?.(r.id)} className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 text-xs font-medium flex items-center gap-1">
                <X size={14} /> Recusar
              </button>
            </>
          )}
          {(r.status === "pendente" || r.status === "confirmada") && onCancelar && (
            <button onClick={() => onCancelar(r.id)} className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-medium">
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ========== Áreas ========== */
function AreasView({
  areas, podeGerenciar, onEditar, onNova, onAtualizar,
}: {
  areas: Area[]; podeGerenciar: boolean;
  onEditar: (a: Area) => void; onNova: () => void; onAtualizar: () => void;
}) {
  const dias = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

  const excluir = async (id: string) => {
    if (!confirm("Excluir esta área? As reservas existentes serão mantidas.")) return;
    const { error } = await supabase.from("areas_comuns").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Área excluída"); onAtualizar(); }
  };

  return (
    <div>
      {podeGerenciar && (
        <div className="mb-4">
          <button onClick={onNova} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium flex items-center gap-2">
            <Plus size={16} /> Nova área
          </button>
        </div>
      )}
      {areas.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Nenhuma área cadastrada.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {areas.map((a) => (
            <div key={a.id} className="border border-border rounded-xl p-4 bg-background">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: a.cor }} />
                  <h4 className="font-semibold truncate">{a.nome}</h4>
                </div>
                {!a.ativo && <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">inativa</span>}
              </div>
              {a.descricao && <p className="text-sm text-muted-foreground mt-1">{a.descricao}</p>}
              <div className="mt-3 text-xs text-muted-foreground space-y-1">
                <p>{a.hora_abertura.slice(0,5)} – {a.hora_fechamento.slice(0,5)} · {a.dias_permitidos.map((d) => dias[d]).join(" ")}</p>
                {a.capacidade && <p>Capacidade: {a.capacidade}</p>}
                {a.taxa_uso > 0 && <p className="text-foreground font-medium">Taxa: {brl(a.taxa_uso)}</p>}
                <p>{a.requer_aprovacao ? "Requer aprovação" : "Aprovação automática"}</p>
              </div>
              {podeGerenciar && (
                <div className="mt-4 flex gap-2">
                  <button onClick={() => onEditar(a)} className="flex-1 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-medium flex items-center justify-center gap-1">
                    <Settings2 size={14} /> Editar
                  </button>
                  <button onClick={() => excluir(a.id)} className="px-3 py-1.5 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 text-xs">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ========== Modal: Nova reserva ========== */
function NovaReservaModal({
  areas, unidades, onClose, onCriada,
}: { areas: Area[]; unidades: Unidade[]; onClose: () => void; onCriada: () => void }) {
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "");
  const [unidadeId, setUnidadeId] = useState(unidades[0]?.id ?? "");
  const [data, setData] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [horaIni, setHoraIni] = useState("14:00");
  const [horaFim, setHoraFim] = useState("18:00");
  const [convidados, setConvidados] = useState(0);
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  const area = areas.find((a) => a.id === areaId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaId || !unidadeId) { toast.error("Selecione área e unidade"); return; }
    setSaving(true);
    const inicio = new Date(`${data}T${horaIni}:00`).toISOString();
    const fim = new Date(`${data}T${horaFim}:00`).toISOString();
    const { error } = await supabase.rpc("solicitar_reserva", {
      _area_id: areaId,
      _unidade_id: unidadeId,
      _inicio: inicio,
      _fim: fim,
      _num_convidados: convidados,
      _observacoes: obs || "",
    });
    setSaving(false);
    if (error) {
      toast.error(ERROS[error.message] ?? error.message);
      return;
    }
    toast.success(area?.requer_aprovacao ? "Reserva enviada para aprovação" : "Reserva confirmada!");
    onCriada();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="font-bold text-lg">Nova reserva</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <Field label="Área">
            <select value={areaId} onChange={(e) => setAreaId(e.target.value)} className="input" required>
              <option value="">Selecione...</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.nome}{a.taxa_uso > 0 ? ` — ${brl(a.taxa_uso)}` : ""}</option>)}
            </select>
          </Field>
          <Field label="Unidade">
            <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)} className="input" required>
              <option value="">Selecione...</option>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.bloco ? `${u.bloco} · ` : ""}Un. {u.numero}</option>)}
            </select>
          </Field>
          <Field label="Data">
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="input" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Início"><input type="time" value={horaIni} onChange={(e) => setHoraIni(e.target.value)} className="input" required /></Field>
            <Field label="Fim"><input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} className="input" required /></Field>
          </div>
          <Field label={`Convidados${area?.capacidade ? ` (máx. ${area.capacidade})` : ""}`}>
            <input type="number" min={0} value={convidados} onChange={(e) => setConvidados(Number(e.target.value))} className="input" />
          </Field>
          <Field label="Observações">
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className="input" />
          </Field>
          {area && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 space-y-1">
              <p>⏱️ Funcionamento: {area.hora_abertura.slice(0,5)} – {area.hora_fechamento.slice(0,5)}</p>
              <p>📅 Antecedência mínima: {area.antecedencia_min_horas}h</p>
              {area.taxa_uso > 0 && <p>💰 Taxa: {brl(area.taxa_uso)}</p>}
              {area.requer_aprovacao && <p>⚠️ Esta área requer aprovação do síndico.</p>}
              {area.regulamento && <p className="pt-1 border-t border-border whitespace-pre-line">{area.regulamento}</p>}
            </div>
          )}
          <button type="submit" disabled={saving} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium flex items-center justify-center gap-2 disabled:opacity-60">
            {saving && <Loader2 size={16} className="animate-spin" />} Solicitar reserva
          </button>
        </form>
      </div>
    </div>
  );
}

/* ========== Modal: Área ========== */
function AreaModal({
  condominioId, area, onClose, onSalvo,
}: { condominioId: string; area: Area | null; onClose: () => void; onSalvo: () => void }) {
  const [form, setForm] = useState({
    nome: area?.nome ?? "",
    descricao: area?.descricao ?? "",
    capacidade: area?.capacidade ?? "",
    taxa_uso: area?.taxa_uso ?? 0,
    requer_aprovacao: area?.requer_aprovacao ?? true,
    antecedencia_min_horas: area?.antecedencia_min_horas ?? 24,
    antecedencia_max_dias: area?.antecedencia_max_dias ?? 90,
    duracao_min_minutos: area?.duracao_min_minutos ?? 60,
    duracao_max_minutos: area?.duracao_max_minutos ?? 480,
    hora_abertura: area?.hora_abertura?.slice(0,5) ?? "08:00",
    hora_fechamento: area?.hora_fechamento?.slice(0,5) ?? "22:00",
    dias_permitidos: area?.dias_permitidos ?? [0,1,2,3,4,5,6],
    max_reservas_por_unidade_mes: area?.max_reservas_por_unidade_mes ?? 4,
    cor: area?.cor ?? "#10B981",
    regulamento: area?.regulamento ?? "",
    ativo: area?.ativo ?? true,
  });
  const [saving, setSaving] = useState(false);
  const dias = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

  const toggleDia = (i: number) => {
    setForm((f) => ({
      ...f,
      dias_permitidos: f.dias_permitidos.includes(i)
        ? f.dias_permitidos.filter((d) => d !== i)
        : [...f.dias_permitidos, i].sort(),
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      condominio_id: condominioId,
      nome: form.nome,
      descricao: form.descricao || null,
      capacidade: form.capacidade ? Number(form.capacidade) : null,
      taxa_uso: Number(form.taxa_uso),
      requer_aprovacao: form.requer_aprovacao,
      antecedencia_min_horas: Number(form.antecedencia_min_horas),
      antecedencia_max_dias: Number(form.antecedencia_max_dias),
      duracao_min_minutos: Number(form.duracao_min_minutos),
      duracao_max_minutos: Number(form.duracao_max_minutos),
      hora_abertura: form.hora_abertura,
      hora_fechamento: form.hora_fechamento,
      dias_permitidos: form.dias_permitidos,
      max_reservas_por_unidade_mes: Number(form.max_reservas_por_unidade_mes),
      cor: form.cor,
      regulamento: form.regulamento || null,
      ativo: form.ativo,
    };
    const res = area
      ? await supabase.from("areas_comuns").update(payload).eq("id", area.id)
      : await supabase.from("areas_comuns").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(area ? "Área atualizada" : "Área cadastrada");
    onSalvo();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-background">
          <h3 className="font-bold text-lg">{area ? "Editar área" : "Nova área"}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2"><Field label="Nome"><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="input" required /></Field></div>
            <Field label="Cor"><input type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} className="input h-10" /></Field>
          </div>
          <Field label="Descrição"><textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} className="input" /></Field>

          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Capacidade"><input type="number" min={0} value={form.capacidade} onChange={(e) => setForm({ ...form, capacidade: e.target.value })} className="input" placeholder="—" /></Field>
            <Field label="Taxa de uso (R$)"><input type="number" step="0.01" min={0} value={form.taxa_uso} onChange={(e) => setForm({ ...form, taxa_uso: Number(e.target.value) })} className="input" /></Field>
            <Field label="Máx. reservas/unid./mês"><input type="number" min={1} value={form.max_reservas_por_unidade_mes} onChange={(e) => setForm({ ...form, max_reservas_por_unidade_mes: Number(e.target.value) })} className="input" /></Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Abertura"><input type="time" value={form.hora_abertura} onChange={(e) => setForm({ ...form, hora_abertura: e.target.value })} className="input" /></Field>
            <Field label="Fechamento"><input type="time" value={form.hora_fechamento} onChange={(e) => setForm({ ...form, hora_fechamento: e.target.value })} className="input" /></Field>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Dias permitidos</label>
            <div className="flex gap-2 flex-wrap">
              {dias.map((d, i) => (
                <button key={i} type="button" onClick={() => toggleDia(i)}
                  className={`px-3 py-1.5 text-xs rounded-full border ${form.dias_permitidos.includes(i) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Antecedência mín. (horas)"><input type="number" min={0} value={form.antecedencia_min_horas} onChange={(e) => setForm({ ...form, antecedencia_min_horas: Number(e.target.value) })} className="input" /></Field>
            <Field label="Antecedência máx. (dias)"><input type="number" min={1} value={form.antecedencia_max_dias} onChange={(e) => setForm({ ...form, antecedencia_max_dias: Number(e.target.value) })} className="input" /></Field>
            <Field label="Duração mín. (min)"><input type="number" min={15} value={form.duracao_min_minutos} onChange={(e) => setForm({ ...form, duracao_min_minutos: Number(e.target.value) })} className="input" /></Field>
            <Field label="Duração máx. (min)"><input type="number" min={15} value={form.duracao_max_minutos} onChange={(e) => setForm({ ...form, duracao_max_minutos: Number(e.target.value) })} className="input" /></Field>
          </div>

          <Field label="Regulamento (texto livre)">
            <textarea value={form.regulamento} onChange={(e) => setForm({ ...form, regulamento: e.target.value })} rows={3} className="input" />
          </Field>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.requer_aprovacao} onChange={(e) => setForm({ ...form, requer_aprovacao: e.target.checked })} />
              Requer aprovação do síndico
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
              Área ativa
            </label>
          </div>

          <button type="submit" disabled={saving} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium flex items-center justify-center gap-2 disabled:opacity-60">
            {saving && <Loader2 size={16} className="animate-spin" />} Salvar
          </button>
        </form>
      </div>
    </div>
  );
}

/* ========== Modal: Bloqueio ========== */
function BloqueioModal({
  areas, condominioId, onClose, onSalvo,
}: { areas: Area[]; condominioId: string; onClose: () => void; onSalvo: () => void }) {
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "");
  const [inicio, setInicio] = useState(() => new Date().toISOString().slice(0, 16));
  const [fim, setFim] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 16);
  });
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("area_bloqueios").insert({
      condominio_id: condominioId,
      area_id: areaId,
      inicio: new Date(inicio).toISOString(),
      fim: new Date(fim).toISOString(),
      motivo,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Bloqueio criado");
    onSalvo();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="font-bold text-lg flex items-center gap-2"><Ban size={18} /> Bloquear data</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <Field label="Área">
            <select value={areaId} onChange={(e) => setAreaId(e.target.value)} className="input" required>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </Field>
          <Field label="Início"><input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} className="input" required /></Field>
          <Field label="Fim"><input type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} className="input" required /></Field>
          <Field label="Motivo"><input value={motivo} onChange={(e) => setMotivo(e.target.value)} className="input" placeholder="Ex: Manutenção, feriado..." required /></Field>
          <button type="submit" disabled={saving} className="w-full py-2.5 rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 font-medium flex items-center justify-center gap-2 disabled:opacity-60">
            {saving && <Loader2 size={16} className="animate-spin" />} Bloquear
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
