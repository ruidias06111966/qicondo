/**
 * Advertências e multas.
 *
 * O tecto da multa aparece no ecrã enquanto se preenche, e não só quando o
 * banco recusa: o síndico que escreve 2.400 numa unidade de 400 vê logo que o
 * limite do art. 1.337, caput, é 2.000. A verificação que vale continua a ser
 * a do banco — aqui é só para não escrever à toa.
 *
 * O histórico da unidade aparece ao lado por uma razão de direito: o art.
 * 1.337 exige reiteração, e quem propõe a multa tem de a poder mostrar.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Gavel, Plus, Ban, AlertTriangle, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { EmptyState, Field, Modal, safeCall } from "@/components/financeiro/ui";
import {
  aplicarMulta,
  cancelarInfracao,
  listarInfracoes,
  registrarAdvertencia,
  reincidenciaDaUnidade,
  QUORUM_BASE,
  ROTULO_BASE,
  TECTO_BASE,
  type Infracao,
  type InfracaoBase,
  type Reincidencia,
} from "@/lib/infracao.functions";
import { listarUnidades } from "@/lib/unidades.functions";
import { listarCategorias } from "@/lib/financeiro.functions";
import { listarAssembleias } from "@/lib/assembleia.functions";
import { dataBR } from "@/lib/periodo";

export const Route = createFileRoute("/app/infracoes")({
  head: () => ({ meta: [{ title: "Advertências e multas — QiCond" }] }),
  component: InfracoesPage,
});

const brl = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Unidade = { id: string; bloco: string | null; numero: string; taxa_mensal: number | null };

const rotuloUnidade = (u: { bloco: string | null; numero: string }) =>
  u.bloco ? `${u.bloco} · ${u.numero}` : u.numero;

const hoje = () => new Date().toISOString().slice(0, 10);

function InfracoesPage() {
  const { condominioId, isAdmin } = useCondominioAtivo();
  const [infracoes, setInfracoes] = useState<Infracao[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"advertencia" | "multa" | null>(null);

  const carregar = useCallback(async () => {
    if (!condominioId) return;
    setLoading(true);
    const [is, us] = await Promise.all([
      safeCall(listarInfracoes({ data: { condominio_id: condominioId } })),
      safeCall(listarUnidades({ data: { condominio_id: condominioId } })),
    ]);
    setInfracoes((is ?? []) as Infracao[]);
    setUnidades((us ?? []) as Unidade[]);
    setLoading(false);
  }, [condominioId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const cancelar = async (i: Infracao) => {
    const motivo = window.prompt(
      `Cancelar a ${i.tipo === "multa" ? "multa" : "advertência"} ${i.numero}. Por que motivo?`,
    );
    if (!motivo) return;
    const r = await safeCall(cancelarInfracao({ data: { infracao_id: i.id, motivo } }));
    if (r) {
      toast.success("Infração cancelada");
      carregar();
    }
  };

  if (!condominioId) return null;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Advertências e multas</h1>
          <p className="text-sm text-muted-foreground">
            Infração a dever que não o de pagar. A multa de mora do atraso é outra, e sai sozinha na
            cobrança.
          </p>
        </div>
        <div className="flex-1" />
        {isAdmin && (
          <>
            <button
              onClick={() => setModal("advertencia")}
              className="px-4 py-2 rounded-lg border border-border text-sm font-semibold inline-flex items-center gap-2"
            >
              <ScrollText size={16} /> Advertência
            </button>
            <button
              onClick={() => setModal("multa")}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2"
            >
              <Plus size={16} /> Multa
            </button>
          </>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">A carregar…</p>
      ) : infracoes.length === 0 ? (
        <EmptyState
          icon={Gavel}
          title="Nenhuma infração registada"
          desc="A advertência é o passo que a maioria das convenções exige antes da multa — e é ela que constrói a reiteração do art. 1.337."
        />
      ) : (
        <div className="space-y-3">
          {infracoes.map((i) => (
            <Cartao key={i.id} i={i} isAdmin={isAdmin} onCancelar={() => cancelar(i)} />
          ))}
        </div>
      )}

      {modal === "advertencia" && (
        <ModalAdvertencia
          condominioId={condominioId}
          unidades={unidades}
          onClose={() => setModal(null)}
          onGravado={() => {
            setModal(null);
            carregar();
          }}
        />
      )}

      {modal === "multa" && (
        <ModalMulta
          condominioId={condominioId}
          unidades={unidades}
          onClose={() => setModal(null)}
          onGravado={() => {
            setModal(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}

function Cartao({
  i,
  isAdmin,
  onCancelar,
}: {
  i: Infracao;
  isAdmin: boolean;
  onCancelar: () => void;
}) {
  const cancelada = i.status === "cancelada";
  return (
    <div
      className={`bg-background border border-border rounded-2xl p-5 ${cancelada ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${
            i.tipo === "multa" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {i.tipo === "multa" ? "multa" : "advertência"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold">
            {i.numero} · {i.unidade ? rotuloUnidade(i.unidade) : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            Ocorrência em {dataBR(i.data_ocorrencia)}
            {i.local ? ` · ${i.local}` : ""}
          </p>
        </div>
        {i.valor != null && (
          <p className="font-display text-lg font-bold">{brl(Number(i.valor))}</p>
        )}
        {cancelada ? (
          <span className="px-2 py-1 rounded-full text-xs font-semibold uppercase bg-muted text-muted-foreground">
            cancelada
          </span>
        ) : (
          isAdmin && (
            <button
              onClick={onCancelar}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              title="Cancelar"
            >
              <Ban size={16} />
            </button>
          )
        )}
      </div>

      <p className="text-sm mt-3 whitespace-pre-wrap">{i.descricao}</p>

      {i.base_legal && (
        <p className="text-xs text-muted-foreground mt-3">
          {ROTULO_BASE[i.base_legal]}
          {i.referencia_mensal != null &&
            TECTO_BASE[i.base_legal] != null &&
            ` · tecto de ${brl(Number(i.referencia_mensal) * (TECTO_BASE[i.base_legal] as number))} (${TECTO_BASE[i.base_legal]}x a contribuição de ${brl(Number(i.referencia_mensal))} à data)`}
        </p>
      )}

      {i.deliberacao && (
        <p className="text-xs text-muted-foreground mt-1">Deliberação: {i.deliberacao}</p>
      )}

      {cancelada && i.cancelamento_motivo && (
        <p className="text-xs text-muted-foreground mt-3 border-t border-border pt-3">
          Cancelada em {i.cancelada_em ? dataBR(i.cancelada_em) : "—"}: {i.cancelamento_motivo}
        </p>
      )}
    </div>
  );
}

/** O histórico vigente da unidade, que é o que sustenta a reiteração. */
function Historico({ unidadeId }: { unidadeId: string }) {
  const [r, setR] = useState<Reincidencia | null>(null);

  useEffect(() => {
    if (!unidadeId) {
      setR(null);
      return;
    }
    let activo = true;
    safeCall(reincidenciaDaUnidade({ data: { unidade_id: unidadeId } })).then((x) => {
      if (activo) setR((x ?? null) as Reincidencia | null);
    });
    return () => {
      activo = false;
    };
  }, [unidadeId]);

  if (!r || Number(r.total) === 0) return null;

  return (
    <div className="text-xs bg-muted rounded-xl p-3">
      Histórico vigente desta unidade: {r.advertencias} advertência(s) e {r.multas} multa(s)
      {Number(r.valor_multas) > 0 ? `, ${brl(Number(r.valor_multas))} em multas` : ""}
      {r.primeira ? `, de ${dataBR(r.primeira)} a ${dataBR(String(r.ultima))}` : ""}.
    </div>
  );
}

function SelectUnidade({
  unidades,
  value,
  onChange,
}: {
  unidades: Unidade[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label="Unidade">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
      >
        <option value="">Escolha a unidade…</option>
        {unidades.map((u) => (
          <option key={u.id} value={u.id}>
            {rotuloUnidade(u)}
          </option>
        ))}
      </select>
    </Field>
  );
}

function ModalAdvertencia({
  condominioId,
  unidades,
  onClose,
  onGravado,
}: {
  condominioId: string;
  unidades: Unidade[];
  onClose: () => void;
  onGravado: () => void;
}) {
  const [unidadeId, setUnidadeId] = useState("");
  const [data, setData] = useState(hoje());
  const [local, setLocal] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const gravar = async () => {
    setOcupado(true);
    const r = await safeCall(
      registrarAdvertencia({
        data: {
          condominio_id: condominioId,
          unidade_id: unidadeId,
          data_ocorrencia: data,
          descricao,
          local: local || null,
        },
      }),
    );
    setOcupado(false);
    if (r) {
      toast.success("Advertência registada");
      onGravado();
    }
  };

  const pronto = unidadeId && data && descricao.trim().length >= 10;

  return (
    <Modal title="Registar advertência" onClose={onClose}>
      <div className="space-y-4">
        <SelectUnidade unidades={unidades} value={unidadeId} onChange={setUnidadeId} />
        {unidadeId && <Historico unidadeId={unidadeId} />}

        <Field label="Data da ocorrência">
          <input
            type="date"
            max={hoje()}
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </Field>

        <Field label="Local (opcional)">
          <input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Garagem, piscina, hall…"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </Field>

        <Field label="O que aconteceu">
          <textarea
            rows={4}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descreva a ocorrência. É este texto que o condómino vai ler e poder contestar."
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </Field>

        <button
          onClick={gravar}
          disabled={!pronto || ocupado}
          className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50"
        >
          Registar advertência
        </button>
      </div>
    </Modal>
  );
}

function ModalMulta({
  condominioId,
  unidades,
  onClose,
  onGravado,
}: {
  condominioId: string;
  unidades: Unidade[];
  onClose: () => void;
  onGravado: () => void;
}) {
  const [unidadeId, setUnidadeId] = useState("");
  const [data, setData] = useState(hoje());
  const [local, setLocal] = useState("");
  const [descricao, setDescricao] = useState("");
  const [base, setBase] = useState<InfracaoBase>("convencao");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [assembleiaId, setAssembleiaId] = useState("");
  const [deliberacao, setDeliberacao] = useState("");
  const [categorias, setCategorias] = useState<{ id: string; nome: string; tipo: string }[]>([]);
  const [assembleias, setAssembleias] = useState<{ id: string; titulo: string; inicio: string }[]>(
    [],
  );
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    safeCall(listarCategorias({ data: { condominio_id: condominioId } })).then((r) =>
      setCategorias(
        ((r ?? []) as { id: string; nome: string; tipo: string }[]).filter(
          (c) => c.tipo === "receita",
        ),
      ),
    );
    safeCall(listarAssembleias({ data: { condominio_id: condominioId } })).then((r) =>
      setAssembleias((r ?? []) as { id: string; titulo: string; inicio: string }[]),
    );
  }, [condominioId]);

  const unidade = useMemo(() => unidades.find((u) => u.id === unidadeId), [unidades, unidadeId]);
  const multiplo = TECTO_BASE[base];
  const taxa = unidade?.taxa_mensal == null ? null : Number(unidade.taxa_mensal);
  const tecto = multiplo != null && taxa != null && taxa > 0 ? taxa * multiplo : null;
  const acimaDoTecto = tecto != null && Number(valor) > tecto;
  const semTaxa = multiplo != null && !!unidade && (taxa == null || taxa <= 0);
  const exigeDeliberacao = base !== "convencao";

  const pronto =
    unidadeId &&
    data &&
    descricao.trim().length >= 10 &&
    Number(valor) > 0 &&
    vencimento &&
    !acimaDoTecto &&
    !semTaxa &&
    (!exigeDeliberacao || !!assembleiaId || deliberacao.trim().length > 0);

  const gravar = async () => {
    setOcupado(true);
    const r = await safeCall(
      aplicarMulta({
        data: {
          condominio_id: condominioId,
          unidade_id: unidadeId,
          data_ocorrencia: data,
          descricao,
          base_legal: base,
          valor: Number(valor),
          vencimento,
          local: local || null,
          categoria_id: categoriaId || null,
          deliberacao: deliberacao || null,
          assembleia_id: assembleiaId || null,
        },
      }),
    );
    setOcupado(false);
    if (r) {
      toast.success("Multa aplicada e cobrança gerada");
      onGravado();
    }
  };

  return (
    <Modal title="Aplicar multa por infração" onClose={onClose}>
      <div className="space-y-4">
        <SelectUnidade unidades={unidades} value={unidadeId} onChange={setUnidadeId} />
        {unidadeId && <Historico unidadeId={unidadeId} />}

        <Field label="Data da ocorrência">
          <input
            type="date"
            max={hoje()}
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </Field>

        <Field label="Local (opcional)">
          <input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </Field>

        <Field label="O que aconteceu">
          <textarea
            rows={4}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </Field>

        <Field label="Fundamento">
          <select
            value={base}
            onChange={(e) => setBase(e.target.value as InfracaoBase)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          >
            {(Object.keys(ROTULO_BASE) as InfracaoBase[]).map((b) => (
              <option key={b} value={b}>
                {ROTULO_BASE[b]}
              </option>
            ))}
          </select>
        </Field>

        <p className="text-xs text-muted-foreground">
          {multiplo == null
            ? "O valor é o que a convenção fixar; o síndico aplica sem assembleia."
            : `Até ${multiplo}x a contribuição mensal, por deliberação de ${QUORUM_BASE[base]}.`}
          {tecto != null &&
            ` Nesta unidade, o tecto é ${brl(tecto)} (contribuição de ${brl(taxa as number)}).`}
        </p>

        {semTaxa && (
          <div className="flex gap-2 text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <p>
              A unidade não tem contribuição mensal preenchida. O tecto legal é um múltiplo dela —
              sem a taxa não há como verificar se a multa é legal. Preencha a taxa da unidade
              primeiro.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor da multa">
            <input
              type="number"
              step="0.01"
              min="0"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </Field>
          <Field label="Vencimento da cobrança">
            <input
              type="date"
              min={hoje()}
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </Field>
        </div>

        {acimaDoTecto && (
          <div className="flex gap-2 text-sm bg-rose-50 border border-rose-200 text-rose-900 rounded-xl p-3">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <p>
              {brl(Number(valor))} passa do tecto de {brl(tecto as number)}. Uma multa acima do
              limite legal é anulável, e quem a aplicou responde.
            </p>
          </div>
        )}

        {exigeDeliberacao && (
          <>
            <Field label="Assembleia que deliberou">
              <select
                value={assembleiaId}
                onChange={(e) => setAssembleiaId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              >
                <option value="">Nenhuma registada no sistema</option>
                {assembleias.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.titulo} — {dataBR(a.inicio)}
                  </option>
                ))}
              </select>
            </Field>
            {!assembleiaId && (
              <Field label="Deliberação (quando a assembleia é anterior ao sistema)">
                <textarea
                  rows={2}
                  value={deliberacao}
                  onChange={(e) => setDeliberacao(e.target.value)}
                  placeholder="AGE de 12/03/2025, item 4 da ordem do dia, aprovada por 3/4 dos restantes."
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                />
              </Field>
            )}
          </>
        )}

        <Field label="Categoria da receita (opcional)">
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          >
            <option value="">Sem categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Field>

        <button
          onClick={gravar}
          disabled={!pronto || ocupado}
          className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50"
        >
          Aplicar multa e gerar cobrança
        </button>
      </div>
    </Modal>
  );
}
