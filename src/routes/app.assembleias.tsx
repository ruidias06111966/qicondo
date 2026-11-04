import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { EmptyState, Field, Modal, safeCall } from "@/components/financeiro/ui";
import {
  abrirVotacao,
  adicionarPauta,
  apurarPauta,
  cancelarAssembleia,
  convocarAssembleia,
  criarAssembleia,
  encerrarAssembleia,
  fecharVotacao,
  listarAssembleias,
  listarElegibilidade,
  listarVotos,
  minhasUnidades,
  obterAssembleia,
  registrarVoto,
  removerPauta,
  MAIORIAS,
  type Assembleia,
  type Elegibilidade,
  type MaioriaTipo,
  type Pauta,
  type Resultado,
  type VotoOpcao,
} from "@/lib/assembleia.functions";
import { paraInputLocal } from "@/lib/periodo";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Gavel,
  Loader2,
  Lock,
  Megaphone,
  Minus,
  Play,
  Plus,
  Trash2,
  Users,
  Video,
  X,
} from "lucide-react";

export const Route = createFileRoute("/app/assembleias")({
  head: () => ({ meta: [{ title: "Assembleias" }] }),
  component: AssembleiasPage,
});

const dataHoraBR = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const num = (v: number) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 6 });

const ROTULO_STATUS: Record<Assembleia["status"], { texto: string; classe: string }> = {
  rascunho: { texto: "Rascunho", classe: "text-amber-700 dark:text-amber-500" },
  convocada: { texto: "Convocada", classe: "text-sky-700 dark:text-sky-400" },
  em_curso: { texto: "Em curso", classe: "text-emerald-700 dark:text-emerald-500" },
  encerrada: { texto: "Encerrada", classe: "text-muted-foreground" },
  cancelada: { texto: "Cancelada", classe: "text-rose-600" },
};

function AssembleiasPage() {
  const { condominioId, isAdmin } = useCondominioAtivo();
  const [lista, setLista] = useState<Assembleia[]>([]);
  const [loading, setLoading] = useState(true);
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [nova, setNova] = useState(false);

  const carregar = useCallback(async () => {
    if (!condominioId) return;
    setLoading(true);
    const r = await safeCall(listarAssembleias({ data: { condominio_id: condominioId } }));
    setLista((r ?? []) as Assembleia[]);
    setLoading(false);
  }, [condominioId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!condominioId) {
    return (
      <div className="p-10 text-muted-foreground">
        Selecione uma empresa para ver as assembleias.
      </div>
    );
  }

  if (abertaId) {
    return (
      <Detalhe
        id={abertaId}
        condominioId={condominioId}
        isAdmin={isAdmin}
        onVoltar={() => {
          setAbertaId(null);
          carregar();
        }}
      />
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-2">
            <Gavel size={26} /> Assembleias
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin
              ? "Convoque, ponha a ordem do dia a votos e encerre com ata."
              : "As assembleias do condomínio. Vota o proprietário, uma vez por unidade."}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setNova(true)}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2"
          >
            <Plus size={16} /> Nova assembleia
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : !lista.length ? (
        <EmptyState
          icon={Gavel}
          title="Nenhuma assembleia"
          desc={
            isAdmin
              ? "Crie a primeira, acrescente a ordem do dia e convoque."
              : "O síndico ainda não convocou nenhuma assembleia."
          }
        />
      ) : (
        <div className="border border-border rounded-2xl divide-y divide-border">
          {lista.map((a) => {
            const r = ROTULO_STATUS[a.status];
            return (
              <button
                key={a.id}
                onClick={() => setAbertaId(a.id)}
                className="w-full text-left px-5 py-4 hover:bg-muted/30 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{a.titulo}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {a.tipo === "ordinaria" ? "Ordinária" : "Extraordinária"} · {a.modo} ·{" "}
                    {dataHoraBR(a.inicio)}
                  </p>
                </div>
                <span className={`text-xs font-semibold shrink-0 ${r.classe}`}>{r.texto}</span>
              </button>
            );
          })}
        </div>
      )}

      {nova && (
        <ModalNova
          condominioId={condominioId}
          onClose={() => setNova(false)}
          onDone={(id) => {
            setNova(false);
            carregar();
            setAbertaId(id);
          }}
        />
      )}
    </div>
  );
}

function ModalNova({
  condominioId,
  onClose,
  onDone,
}: {
  condominioId: string;
  onClose: () => void;
  onDone: (id: string) => void;
}) {
  const amanha = new Date(Date.now() + 86400000);
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<"ordinaria" | "extraordinaria">("extraordinaria");
  const [modo, setModo] = useState<"virtual" | "presencial" | "hibrida">("virtual");
  const [inicio, setInicio] = useState(paraInputLocal(amanha));
  const [fim, setFim] = useState(paraInputLocal(new Date(amanha.getTime() + 7200000)));
  const [edital, setEdital] = useState("");
  const [local, setLocal] = useState("");
  const [link, setLink] = useState("");
  const [pesoPorFracao, setPesoPorFracao] = useState(true);
  const [exigeQuitacao, setExigeQuitacao] = useState(true);
  const [segundaConvocacao, setSegundaConvocacao] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const r = await safeCall(
      criarAssembleia({
        data: {
          condominio_id: condominioId,
          titulo: titulo.trim(),
          tipo,
          modo,
          inicio,
          fim,
          edital: edital.trim() || null,
          local: local.trim() || null,
          link: link.trim() || null,
          peso_por_fracao: pesoPorFracao,
          exige_quitacao: exigeQuitacao,
          quorum_instalacao: segundaConvocacao ? 0 : 0.5,
        },
      }),
    );
    setSaving(false);
    if (r) {
      toast.success("Assembleia criada. Acrescente a ordem do dia e convoque.");
      onDone(r.id);
    }
  };

  return (
    <Modal title="Nova assembleia" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Título">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="AGE — obra da fachada"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as typeof tipo)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value="extraordinaria">Extraordinária</option>
              <option value="ordinaria">Ordinária</option>
            </select>
          </Field>
          <Field label="Modo">
            <select
              value={modo}
              onChange={(e) => setModo(e.target.value as typeof modo)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value="virtual">Virtual</option>
              <option value="hibrida">Híbrida</option>
              <option value="presencial">Presencial</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Início">
            <input
              type="datetime-local"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </Field>
          <Field label="Fim">
            <input
              type="datetime-local"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </Field>
        </div>

        {modo !== "presencial" && (
          <Field label="Link da videoconferência">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://meet.google.com/…"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </Field>
        )}
        {modo !== "virtual" && (
          <Field label="Local">
            <input
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Salão de festas"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </Field>
        )}

        <Field label="Edital (texto da convocação)">
          <textarea
            value={edital}
            onChange={(e) => setEdital(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </Field>

        <div className="border-t border-border pt-4 space-y-3">
          <p className="font-semibold text-sm">Regras de apuramento</p>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={pesoPorFracao}
              onChange={(e) => setPesoPorFracao(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Voto proporcional à fração ideal
              <span className="block text-xs text-muted-foreground">
                É a regra do art. 1.352, § único, salvo disposição diversa da convenção. Desligado,
                cada unidade vale um voto.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={exigeQuitacao}
              onChange={(e) => setExigeQuitacao(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Unidade em atraso não vota
              <span className="block text-xs text-muted-foreground">
                Art. 1.335, III: o direito de voto é do condómino que esteja quite.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={segundaConvocacao}
              onChange={(e) => setSegundaConvocacao(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Segunda convocação
              <span className="block text-xs text-muted-foreground">
                Dispensa o quórum de metade das frações que o art. 1.352 exige na primeira; o art.
                1.353 deixa deliberar com qualquer número.
              </span>
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving || titulo.trim().length < 3}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "A criar…" : "Criar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Detalhe({
  id,
  condominioId,
  isAdmin,
  onVoltar,
}: {
  id: string;
  condominioId: string;
  isAdmin: boolean;
  onVoltar: () => void;
}) {
  const [ass, setAss] = useState<Assembleia | null>(null);
  const [pautas, setPautas] = useState<Pauta[]>([]);
  const [eleg, setEleg] = useState<Elegibilidade[]>([]);
  const [unidades, setUnidades] = useState<
    { unidade_id: string; bloco: string | null; numero: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [novaPauta, setNovaPauta] = useState(false);
  const [verElegibilidade, setVerElegibilidade] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const [r, e, u] = await Promise.all([
      safeCall(obterAssembleia({ data: { id } })),
      safeCall(listarElegibilidade({ data: { assembleia_id: id } })),
      safeCall(minhasUnidades({ data: { condominio_id: condominioId } })),
    ]);
    if (r) {
      setAss(r.assembleia as Assembleia);
      setPautas(r.pautas as Pauta[]);
    }
    setEleg((e ?? []) as Elegibilidade[]);
    setUnidades((u ?? []) as typeof unidades);
    setLoading(false);
  }, [id, condominioId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const acao = async (chave: string, fn: () => Promise<unknown>, msg: string) => {
    setOcupado(chave);
    const r = await safeCall(fn());
    setOcupado(null);
    if (r) {
      toast.success(msg);
      carregar();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!ass) return <div className="p-10 text-muted-foreground">Assembleia não encontrada.</div>;

  const r = ROTULO_STATUS[ass.status];
  const elegiveis = eleg.filter((e) => e.elegivel);
  const totalPeso = elegiveis.reduce((s, e) => s + Number(e.peso), 0);

  return (
    <div className="p-6 lg:p-10 max-w-5xl space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onVoltar}
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} /> Todas as assembleias
        </button>
        <div className="flex-1" />
        {isAdmin && ass.status === "rascunho" && (
          <button
            onClick={() =>
              acao("convocar", () => convocarAssembleia({ data: { id } }), "Assembleia convocada")
            }
            disabled={ocupado === "convocar"}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
          >
            <Megaphone size={16} /> Convocar
          </button>
        )}
        {isAdmin && (ass.status === "convocada" || ass.status === "em_curso") && (
          <>
            <button
              onClick={() => {
                if (
                  !confirm(
                    "Encerrar a assembleia? As votações abertas são apuradas e a ata fica gravada.",
                  )
                )
                  return;
                acao(
                  "encerrar",
                  () => encerrarAssembleia({ data: { id } }),
                  "Assembleia encerrada",
                );
              }}
              disabled={ocupado === "encerrar"}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
            >
              <Lock size={16} /> Encerrar com ata
            </button>
            <button
              onClick={() => {
                const motivo = prompt("Cancelar a assembleia. Motivo:");
                if (motivo === null) return;
                acao(
                  "cancelar",
                  () => cancelarAssembleia({ data: { id, motivo: motivo || null } }),
                  "Assembleia cancelada",
                );
              }}
              className="px-4 py-2 rounded-lg border border-border text-sm font-semibold"
            >
              Cancelar
            </button>
          </>
        )}
      </div>

      <header className="border border-border rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-bold">{ass.titulo}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {ass.tipo === "ordinaria" ? "Ordinária" : "Extraordinária"} · {dataHoraBR(ass.inicio)}{" "}
              até {dataHoraBR(ass.fim)}
            </p>
          </div>
          <span className={`text-sm font-bold ${r.classe}`}>{r.texto}</span>
        </div>

        {ass.edital && <p className="text-sm mt-4 whitespace-pre-wrap">{ass.edital}</p>}
        {ass.local && <p className="text-sm mt-2">Local: {ass.local}</p>}
        {ass.link_videoconferencia && (
          <a
            href={ass.link_videoconferencia}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            <Video size={15} /> Entrar na videoconferência
          </a>
        )}

        <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground space-y-1">
          <p>
            Voto {ass.peso_por_fracao ? "proporcional à fração ideal" : "de uma unidade, um voto"}
            {ass.exige_quitacao ? ", e a unidade em atraso não vota (art. 1.335, III)" : ""}.
          </p>
          <p>
            Quórum de instalação:{" "}
            {Number(ass.quorum_instalacao) === 0
              ? "dispensado (segunda convocação, art. 1.353)"
              : `${(Number(ass.quorum_instalacao) * 100).toFixed(0)}% do total elegível`}
            . Elegíveis: {elegiveis.length} de {eleg.length} unidade(s), peso total {num(totalPeso)}
            .
          </p>
        </div>

        <button
          onClick={() => setVerElegibilidade((v) => !v)}
          className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
        >
          <Users size={14} /> {verElegibilidade ? "Esconder" : "Ver"} quem pode votar
        </button>

        {verElegibilidade && (
          <div className="mt-3 border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">Unidade</th>
                  <th className="text-right px-4 py-2 font-semibold">Peso</th>
                  <th className="text-left px-4 py-2 font-semibold">Pode votar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {eleg.map((e) => (
                  <tr key={e.unidade_id}>
                    <td className="px-4 py-2">
                      {e.bloco ? `${e.bloco}-` : ""}
                      {e.numero}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{num(Number(e.peso))}</td>
                    <td className="px-4 py-2">
                      {e.elegivel ? (
                        <span className="text-emerald-700 dark:text-emerald-500">sim</span>
                      ) : (
                        <span className="text-rose-600">não — {e.motivo}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </header>

      <div className="flex items-center gap-3">
        <h2 className="font-semibold">Ordem do dia</h2>
        <div className="flex-1" />
        {isAdmin && ass.status === "rascunho" && (
          <button
            onClick={() => setNovaPauta(true)}
            className="px-3 py-1.5 rounded-lg border border-border text-sm font-semibold inline-flex items-center gap-2"
          >
            <Plus size={15} /> Acrescentar item
          </button>
        )}
      </div>

      {!pautas.length ? (
        <EmptyState
          icon={Gavel}
          title="Sem ordem do dia"
          desc="O edital tem de dizer sobre o que se vai deliberar. Acrescente ao menos um item antes de convocar."
        />
      ) : (
        <div className="space-y-4">
          {pautas.map((p) => (
            <ItemPauta
              key={p.id}
              pauta={p}
              assembleia={ass}
              isAdmin={isAdmin}
              unidades={unidades}
              eleg={eleg}
              ocupado={ocupado}
              setOcupado={setOcupado}
              onMudou={carregar}
            />
          ))}
        </div>
      )}

      {novaPauta && (
        <ModalPauta
          assembleiaId={id}
          onClose={() => setNovaPauta(false)}
          onDone={() => {
            setNovaPauta(false);
            carregar();
          }}
        />
      )}
    </div>
  );
}

function ItemPauta({
  pauta,
  assembleia,
  isAdmin,
  unidades,
  eleg,
  ocupado,
  setOcupado,
  onMudou,
}: {
  pauta: Pauta;
  assembleia: Assembleia;
  isAdmin: boolean;
  unidades: { unidade_id: string; bloco: string | null; numero: string }[];
  eleg: Elegibilidade[];
  ocupado: string | null;
  setOcupado: (v: string | null) => void;
  onMudou: () => void;
}) {
  const [parcial, setParcial] = useState<Resultado | null>(null);
  const [votos, setVotos] = useState<
    { unidade_id: string; bloco: string | null; numero: string; opcao: VotoOpcao; peso: number }[]
  >([]);

  const meta = MAIORIAS.find((m) => m.valor === pauta.maioria);
  const aberta = !!pauta.aberta_em && !pauta.fechada_em;
  const fechada = !!pauta.fechada_em;
  const resultado = (pauta.resultado ?? parcial) as Resultado | null;

  const carregarVotos = useCallback(async () => {
    const v = await safeCall(listarVotos({ data: { pauta_id: pauta.id } }));
    setVotos((v ?? []) as typeof votos);
  }, [pauta.id]);

  useEffect(() => {
    carregarVotos();
  }, [carregarVotos]);

  const votar = async (unidadeId: string, opcao: VotoOpcao) => {
    setOcupado(pauta.id);
    const r = await safeCall(
      registrarVoto({ data: { pauta_id: pauta.id, unidade_id: unidadeId, opcao } }),
    );
    setOcupado(null);
    if (r) {
      toast.success("Voto registado");
      carregarVotos();
    }
  };

  const meuVoto = (unidadeId: string) => votos.find((v) => v.unidade_id === unidadeId)?.opcao;

  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="font-semibold">
              {pauta.ordem}. {pauta.titulo}
            </p>
            {pauta.descricao && (
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                {pauta.descricao}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              <strong>{meta?.rotulo}</strong> — {meta?.nota}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {isAdmin && assembleia.status === "rascunho" && (
              <button
                onClick={async () => {
                  if (!confirm("Remover este item da ordem do dia?")) return;
                  const r = await safeCall(removerPauta({ data: { pauta_id: pauta.id } }));
                  if (r) onMudou();
                }}
                className="p-2 rounded-lg hover:bg-muted text-destructive"
                aria-label="Remover item"
              >
                <Trash2 size={15} />
              </button>
            )}
            {isAdmin && !fechada && assembleia.status !== "rascunho" && !aberta && (
              <button
                onClick={async () => {
                  setOcupado(pauta.id);
                  const r = await safeCall(abrirVotacao({ data: { pauta_id: pauta.id } }));
                  setOcupado(null);
                  if (r) {
                    toast.success("Votação aberta");
                    onMudou();
                  }
                }}
                disabled={ocupado === pauta.id}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
              >
                <Play size={14} /> Abrir votação
              </button>
            )}
            {isAdmin && aberta && (
              <>
                <button
                  onClick={async () => {
                    const res = await safeCall(apurarPauta({ data: { pauta_id: pauta.id } }));
                    if (res) setParcial(res as Resultado);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-border text-sm font-semibold"
                >
                  Ver parcial
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("Encerrar a votação deste item? O resultado fica fixado.")) return;
                    setOcupado(pauta.id);
                    const res = await safeCall(fecharVotacao({ data: { pauta_id: pauta.id } }));
                    setOcupado(null);
                    if (res) {
                      toast.success("Votação apurada");
                      onMudou();
                    }
                  }}
                  disabled={ocupado === pauta.id}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
                >
                  Apurar e fechar
                </button>
              </>
            )}
          </div>
        </div>

        {aberta && unidades.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            {unidades.map((u) => {
              const e = eleg.find((x) => x.unidade_id === u.unidade_id);
              const voto = meuVoto(u.unidade_id);
              return (
                <div key={u.unidade_id} className="flex items-center gap-3 flex-wrap text-sm">
                  <span className="font-medium w-20">
                    {u.bloco ? `${u.bloco}-` : ""}
                    {u.numero}
                  </span>
                  {e && !e.elegivel ? (
                    <span className="text-rose-600 text-xs">Não pode votar — {e.motivo}</span>
                  ) : (
                    <div className="flex gap-1.5">
                      {(
                        [
                          ["sim", "Sim", Check],
                          ["nao", "Não", X],
                          ["abstencao", "Abstenção", Minus],
                        ] as const
                      ).map(([op, rot, Icone]) => (
                        <button
                          key={op}
                          onClick={() => votar(u.unidade_id, op)}
                          disabled={ocupado === pauta.id}
                          className={`px-3 py-1.5 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 border disabled:opacity-60 ${
                            voto === op
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border"
                          }`}
                        >
                          <Icone size={14} /> {rot}
                        </button>
                      ))}
                    </div>
                  )}
                  {voto && (
                    <span className="text-xs text-muted-foreground">
                      voto registado — pode mudar enquanto a votação estiver aberta
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {resultado && (
        <div className="border-t border-border bg-muted/30 px-5 py-4 text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`font-bold ${
                resultado.situacao === "aprovado"
                  ? "text-emerald-700 dark:text-emerald-500"
                  : resultado.situacao === "sem_quorum"
                    ? "text-amber-700 dark:text-amber-500"
                    : "text-rose-600"
              }`}
            >
              {resultado.situacao === "aprovado"
                ? "Aprovado"
                : resultado.situacao === "sem_quorum"
                  ? "Sem quórum"
                  : "Rejeitado"}
            </span>
            {!fechada && <span className="text-xs text-muted-foreground">(parcial)</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Base: {resultado.base}</p>
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 mt-3 text-xs font-mono">
            <span>Sim: {num(resultado.sim)}</span>
            <span>Não: {num(resultado.nao)}</span>
            <span>Abstenção: {num(resultado.abstencao)}</span>
            <span>Necessário: {num(resultado.necessario)}</span>
            <span>Presentes: {num(resultado.presentes)}</span>
            <span>Total elegível: {num(resultado.total_elegivel)}</span>
          </div>
          {!resultado.tem_quorum && (
            <p className="text-xs text-amber-700 dark:text-amber-500 mt-2">
              Presentes {num(resultado.presentes)} para um quórum exigido de{" "}
              {num(resultado.quorum_exigido)}. Sem quórum não há deliberação (art. 1.352).
            </p>
          )}
        </div>
      )}

      {fechada && votos.length > 0 && (
        <div className="border-t border-border px-5 py-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
            Votos registados
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {votos.map((v) => (
              <span key={v.unidade_id} className="px-2 py-1 rounded border border-border font-mono">
                {v.bloco ? `${v.bloco}-` : ""}
                {v.numero}: {v.opcao}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ModalPauta({
  assembleiaId,
  onClose,
  onDone,
}: {
  assembleiaId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [maioria, setMaioria] = useState<MaioriaTipo>("maioria_presentes");
  const [saving, setSaving] = useState(false);

  const meta = MAIORIAS.find((m) => m.valor === maioria);

  const submit = async () => {
    setSaving(true);
    const r = await safeCall(
      adicionarPauta({
        data: {
          assembleia_id: assembleiaId,
          titulo: titulo.trim(),
          maioria,
          descricao: descricao.trim() || null,
        },
      }),
    );
    setSaving(false);
    if (r) {
      toast.success("Item acrescentado");
      onDone();
    }
  };

  return (
    <Modal title="Item da ordem do dia" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Matéria">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Aprovação das contas de 2026"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </Field>

        <Field label="Detalhe (opcional)">
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </Field>

        <Field label="Maioria exigida">
          <select
            value={maioria}
            onChange={(e) => setMaioria(e.target.value as MaioriaTipo)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          >
            {MAIORIAS.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.rotulo}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-muted-foreground -mt-2">{meta?.nota}</p>
        <p className="text-xs text-muted-foreground">
          Escolher a maioria errada é o que invalida uma deliberação. «Dos presentes» conta sobre
          quem votou; «dos condóminos» conta sobre o condomínio inteiro, e quem não vota conta
          contra.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving || titulo.trim().length < 3}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "A acrescentar…" : "Acrescentar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
