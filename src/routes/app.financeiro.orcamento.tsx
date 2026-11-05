/**
 * Planilha orçamentária anual.
 *
 * O ecrã não calcula a quota. Mostra o que `resumo_orcamento` devolve, porque
 * é esse número que fica no registo da aprovação em assembleia e é por ele que
 * o condómino vai pagar durante doze meses.
 *
 * A ordem do ecrã é a ordem do trabalho: o realizado do ano anterior, o
 * reajuste rubrica a rubrica, o que isso dá de quota, e — depois de aprovado —
 * o orçado contra o realizado, que é o que impede a planilha de ser um papel
 * de Janeiro.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Calculator, Plus, CheckCircle2, AlertTriangle, TrendingUp, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { EmptyState, Field, Modal, safeCall } from "@/components/financeiro/ui";
import {
  aprovarOrcamento,
  atualizarOrcamento,
  atualizarRubrica,
  criarOrcamento,
  listarOrcamentos,
  orcadoXRealizado,
  quotasDoOrcamento,
  realizadoPorCategoria,
  resumoOrcamento,
  rubricasDoOrcamento,
  sugerirIndice,
  AJUDA_INDICE,
  ROTULO_INDICE,
  type IndiceReajuste,
  type Orcamento,
  type OrcamentoItem,
  type OrcadoRealizado,
  type QuotaUnidade,
  type RealizadoAno,
  type ResumoOrcamento,
} from "@/lib/orcamento.functions";
import {
  atualizarIndices,
  indicesParaOrcamento,
  INDICE_PUBLICADO,
  type AcumuladoIndice,
  type IndicePublicado,
} from "@/lib/indices.functions";
import { listarAssembleias, type Assembleia } from "@/lib/assembleia.functions";
import { dataBR } from "@/lib/periodo";

export const Route = createFileRoute("/app/financeiro/orcamento")({
  head: () => ({ meta: [{ title: "Orçamento — QiCond" }] }),
  component: OrcamentoPage,
});

const brl = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const INDICES = Object.keys(ROTULO_INDICE) as IndiceReajuste[];

function OrcamentoPage() {
  const { condominioId, isAdmin } = useCondominioAtivo();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState(false);

  const carregar = useCallback(async () => {
    if (!condominioId) return;
    setLoading(true);
    const r = ((await safeCall(listarOrcamentos({ data: { condominio_id: condominioId } }))) ??
      []) as Orcamento[];
    setOrcamentos(r);
    setSel((s) => s ?? r[0]?.id ?? null);
    setLoading(false);
  }, [condominioId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!condominioId) return null;

  const actual = orcamentos.find((o) => o.id === sel) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="font-semibold text-lg">Planilha orçamentária</h2>
          <p className="text-sm text-muted-foreground">
            A previsão do ano, aprovada em assembleia (art. 1.350), que determina a quota de cada
            unidade pela fração ideal.
          </p>
        </div>
        <div className="flex-1" />
        {orcamentos.length > 1 && (
          <select
            value={sel ?? ""}
            onChange={(e) => setSel(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm font-semibold"
          >
            {orcamentos.map((o) => (
              <option key={o.id} value={o.id}>
                {o.ano} {o.status === "aprovado" ? "· aprovado" : "· rascunho"}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => setNovo(true)}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2"
        >
          <Plus size={16} /> Novo orçamento
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : !actual ? (
        <EmptyState
          icon={Calculator}
          title="Nenhum orçamento"
          desc="O orçamento parte do realizado do ano anterior e projeta cada rubrica pelo índice que lhe serve."
        />
      ) : (
        <Detalhe
          key={actual.id}
          orcamento={actual}
          condominioId={condominioId}
          isAdmin={isAdmin}
          onMudou={carregar}
        />
      )}

      {novo && (
        <ModalNovo
          condominioId={condominioId}
          anosUsados={orcamentos.map((o) => o.ano)}
          onClose={() => setNovo(false)}
          onCriado={(id) => {
            setNovo(false);
            setSel(id);
            carregar();
          }}
        />
      )}
    </div>
  );
}

function Detalhe({
  orcamento,
  condominioId,
  isAdmin,
  onMudou,
}: {
  orcamento: Orcamento;
  condominioId: string;
  isAdmin: boolean;
  onMudou: () => void;
}) {
  const [itens, setItens] = useState<OrcamentoItem[]>([]);
  const [resumo, setResumo] = useState<ResumoOrcamento | null>(null);
  const [quotas, setQuotas] = useState<QuotaUnidade[] | null>(null);
  const [erroQuotas, setErroQuotas] = useState(false);
  const [comparado, setComparado] = useState<OrcadoRealizado | null>(null);
  const [aAprovar, setAAprovar] = useState(false);
  const [indices, setIndices] = useState<AcumuladoIndice[]>([]);

  const rascunho = orcamento.status === "rascunho";

  const recarregar = useCallback(async () => {
    const [i, r] = await Promise.all([
      safeCall(rubricasDoOrcamento({ data: { orcamento_id: orcamento.id } })),
      safeCall(resumoOrcamento({ data: { orcamento_id: orcamento.id } })),
    ]);
    setItens((i ?? []) as OrcamentoItem[]);
    setResumo((r ?? null) as ResumoOrcamento | null);

    // As quotas dependem de todas as unidades terem fração ideal. Se faltar,
    // a função recusa — e isso não pode derrubar o resto do ecrã.
    const q = await safeCall(quotasDoOrcamento({ data: { orcamento_id: orcamento.id } }));
    setQuotas((q ?? null) as QuotaUnidade[] | null);
    setErroQuotas(q === null);

    if (!rascunho) {
      const c = await safeCall(orcadoXRealizado({ data: { orcamento_id: orcamento.id } }));
      setComparado((c ?? null) as OrcadoRealizado | null);
    }
  }, [orcamento.id, rascunho]);

  const carregarIndices = useCallback(async () => {
    const r = await safeCall(indicesParaOrcamento({ data: {} }));
    setIndices((r ?? []) as AcumuladoIndice[]);
  }, []);

  useEffect(() => {
    recarregar();
    carregarIndices();
  }, [recarregar, carregarIndices]);

  return (
    <div className="space-y-6">
      {resumo && <Resumo r={resumo} />}

      {rascunho && (
        <Premissas orcamento={orcamento} onGravado={() => Promise.all([onMudou(), recarregar()])} />
      )}

      {rascunho && isAdmin && <PainelIndices indices={indices} onActualizado={carregarIndices} />}

      <div className="bg-background border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <p className="font-semibold">Rubricas</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Base: o realizado de {orcamento.ano_base}. O índice é por rubrica porque a folha não
            segue inflação geral e a água não segue índice nenhum.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground uppercase bg-muted/40">
                <th className="text-left px-5 py-2.5">Rubrica</th>
                <th className="text-right px-3 py-2.5">{orcamento.ano_base}</th>
                <th className="text-left px-3 py-2.5">Índice</th>
                <th className="text-right px-3 py-2.5">%</th>
                <th className="text-right px-5 py-2.5">{orcamento.ano}</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => (
                <Rubrica
                  key={i.id}
                  item={i}
                  editavel={rascunho && isAdmin}
                  indices={indices}
                  onGravado={recarregar}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {erroQuotas ? (
        <div className="flex gap-2 text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <p>
            Não foi possível calcular a quota por unidade. A repartição é pela fração ideal (art.
            1.336, I), e alguma unidade não a tem preenchida.
          </p>
        </div>
      ) : (
        quotas && quotas.length > 0 && <Quotas quotas={quotas} />
      )}

      {comparado && <Comparado c={comparado} />}

      {rascunho && isAdmin && (
        <div className="flex justify-end">
          <button
            onClick={() => setAAprovar(true)}
            className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2"
          >
            <CheckCircle2 size={16} /> Aprovar em assembleia
          </button>
        </div>
      )}

      {aAprovar && (
        <ModalAprovar
          orcamentoId={orcamento.id}
          condominioId={condominioId}
          onClose={() => setAAprovar(false)}
          onAprovado={() => {
            setAAprovar(false);
            onMudou();
            recarregar();
          }}
        />
      )}
    </div>
  );
}

function Resumo({ r }: { r: ResumoOrcamento }) {
  const subiu = r.variacao_percentual != null && r.variacao_percentual > 0;
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["Despesa prevista", brl(r.despesa_prevista), `realizado ${brl(r.realizado_base)}`],
          [
            "Fundo de reserva",
            brl(r.fundo_reserva),
            `${pct(r.fundo_reserva_percentual)} da despesa`,
          ],
          [
            "Provisão de inadimplência",
            brl(r.provisao_inadimplencia),
            `${pct(r.inadimplencia_prevista)} previstos`,
          ],
          ["A arrecadar no ano", brl(r.a_arrecadar), `${brl(r.arrecadacao_mensal)} por mês`],
        ].map(([t, v, s]) => (
          <div key={String(t)} className="bg-background border border-border rounded-2xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase">{t}</p>
            <p className="font-display text-xl font-extrabold mt-1">{v}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s}</p>
          </div>
        ))}
      </div>

      {r.variacao_percentual != null && (
        <div
          className={`flex gap-2 text-sm rounded-xl p-4 border ${
            subiu
              ? "bg-amber-50 border-amber-200 text-amber-900"
              : "bg-emerald-50 border-emerald-200 text-emerald-900"
          }`}
        >
          <TrendingUp size={18} className="shrink-0 mt-0.5" />
          <p>
            A arrecadação mensal passa de {brl(r.taxa_mensal_actual)} para{" "}
            {brl(r.arrecadacao_mensal)} — {subiu ? "uma subida" : "uma descida"} de{" "}
            <strong>{pct(Math.abs(r.variacao_percentual))}</strong>. É este o número que a
            assembleia vai discutir; leve-o explicado.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        A provisão de inadimplência entra como divisor e não como soma: para receber{" "}
        {brl(r.necessidade)} com {pct(r.inadimplencia_prevista)} de falta, é preciso lançar{" "}
        {brl(r.a_arrecadar)}. Somar a percentagem deixaria o caixa curto na mesma.
      </p>
    </div>
  );
}

function Rubrica({
  item,
  editavel,
  indices,
  onGravado,
}: {
  item: OrcamentoItem;
  editavel: boolean;
  indices: AcumuladoIndice[];
  onGravado: () => void;
}) {
  const [indice, setIndice] = useState<IndiceReajuste>(item.indice);
  const [percentual, setPercentual] = useState(String(item.percentual));
  const [valor, setValor] = useState(String(item.valor_previsto));
  const [sujo, setSujo] = useState(false);

  const sugerido = useMemo(() => sugerirIndice(item.categoria), [item.categoria]);

  // O acumulado publicado do índice escolhido, quando há um. É o número que
  // mais se erra a digitar: ou se usa a variação do mês, ou se copia o de três
  // meses atrás.
  const publicado = useMemo(
    () =>
      INDICE_PUBLICADO.includes(indice as IndicePublicado)
        ? (indices.find((i) => i.indice === indice) ?? null)
        : null,
    [indices, indice],
  );
  const diferente =
    publicado?.acumulado != null && Number(percentual) !== Number(publicado.acumulado);

  const gravar = async (override?: number | null) => {
    const r = await safeCall(
      atualizarRubrica({
        data: {
          item_id: item.id,
          indice,
          percentual: Number(percentual) || 0,
          valor_previsto: override ?? null,
          observacao: item.observacao,
        },
      }),
    );
    setSujo(false);
    if (r) {
      setValor(String(r.valor_previsto));
      onGravado();
    }
  };

  if (!editavel) {
    return (
      <tr className="border-t border-border">
        <td className="px-5 py-2.5">{item.categoria}</td>
        <td className="px-3 py-2.5 text-right text-muted-foreground">{brl(item.realizado_base)}</td>
        <td className="px-3 py-2.5 text-xs">{ROTULO_INDICE[item.indice]}</td>
        <td className="px-3 py-2.5 text-right">{pct(item.percentual)}</td>
        <td className="px-5 py-2.5 text-right font-semibold">{brl(item.valor_previsto)}</td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border">
      <td className="px-5 py-2">
        {item.categoria}
        {indice !== sugerido && (
          <button
            onClick={() => {
              setIndice(sugerido);
              setSujo(true);
            }}
            className="block text-xs text-primary hover:underline"
            title={AJUDA_INDICE[sugerido]}
          >
            sugestão: {ROTULO_INDICE[sugerido]}
          </button>
        )}
      </td>
      <td className="px-3 py-2 text-right text-muted-foreground">{brl(item.realizado_base)}</td>
      <td className="px-3 py-2">
        <select
          value={indice}
          onChange={(e) => {
            setIndice(e.target.value as IndiceReajuste);
            setSujo(true);
          }}
          onBlur={() => sujo && gravar()}
          title={AJUDA_INDICE[indice]}
          className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
        >
          {INDICES.map((i) => (
            <option key={i} value={i}>
              {ROTULO_INDICE[i]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          step="0.01"
          value={percentual}
          onChange={(e) => {
            setPercentual(e.target.value);
            setSujo(true);
          }}
          onBlur={() => sujo && gravar()}
          className="w-20 px-2 py-1.5 rounded border border-border bg-background text-xs text-right"
        />
        {diferente && publicado && (
          <button
            onClick={() => {
              setPercentual(String(publicado.acumulado));
              setSujo(true);
            }}
            className="block mt-1 w-full text-right text-xs text-primary hover:underline"
            title={`Acumulado de ${publicado.meses} meses até ${dataBR(String(publicado.ultima))}`}
          >
            usar {pct(Number(publicado.acumulado))}
          </button>
        )}
      </td>
      <td className="px-5 py-2">
        <input
          type="number"
          step="0.01"
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            setSujo(true);
          }}
          onBlur={() => sujo && gravar(Number(valor))}
          title="Pode escrever o valor directamente quando a rubrica não se projeta por índice."
          className="w-28 px-2 py-1.5 rounded border border-border bg-background text-xs text-right font-semibold"
        />
      </td>
    </tr>
  );
}

function Premissas({ orcamento, onGravado }: { orcamento: Orcamento; onGravado: () => void }) {
  const [inad, setInad] = useState(String(orcamento.inadimplencia_prevista));
  const [fundo, setFundo] = useState(String(orcamento.fundo_reserva_percentual));
  const [texto, setTexto] = useState(orcamento.premissas ?? "");

  const gravar = async () => {
    const r = await safeCall(
      atualizarOrcamento({
        data: {
          orcamento_id: orcamento.id,
          inadimplencia: Number(inad) || 0,
          fundo_reserva: Number(fundo) || 0,
          premissas: texto || null,
        },
      }),
    );
    if (r) {
      toast.success("Premissas gravadas");
      onGravado();
    }
  };

  return (
    <div className="bg-background border border-border rounded-2xl p-5 space-y-4">
      <p className="font-semibold text-sm">Premissas</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Inadimplência prevista (%)">
          <input
            type="number"
            step="0.01"
            min="0"
            max="99"
            value={inad}
            onChange={(e) => setInad(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </Field>
        <Field label="Fundo de reserva (% da despesa)">
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={fundo}
            onChange={(e) => setFundo(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </Field>
      </div>
      <Field label="Notas para a assembleia">
        <textarea
          rows={3}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="O que explica os números: a convenção coletiva deu 6%, a obra da fachada entra uma só vez, a inadimplência média dos últimos três anos foi de 7%."
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
        />
      </Field>
      <button
        onClick={gravar}
        className="px-4 py-2 rounded-lg border border-border text-sm font-semibold"
      >
        Gravar premissas
      </button>
    </div>
  );
}

function Quotas({ quotas }: { quotas: QuotaUnidade[] }) {
  return (
    <div className="bg-background border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <p className="font-semibold">Quota por unidade</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Repartida pela fração ideal, ao cêntimo — a soma das quotas dá exactamente a arrecadação
          mensal.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground uppercase bg-muted/40">
              <th className="text-left px-5 py-2.5">Unidade</th>
              <th className="text-right px-3 py-2.5">Fração</th>
              <th className="text-right px-3 py-2.5">Hoje</th>
              <th className="text-right px-5 py-2.5">Proposta</th>
            </tr>
          </thead>
          <tbody>
            {quotas.map((q) => (
              <tr key={q.unidade_id} className="border-t border-border">
                <td className="px-5 py-2">{q.bloco ? `${q.bloco} · ${q.numero}` : q.numero}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {q.fracao_ideal == null ? "—" : pct(q.fracao_ideal)}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {q.taxa_actual == null ? "—" : brl(q.taxa_actual)}
                </td>
                <td className="px-5 py-2 text-right font-semibold">{brl(q.quota_mensal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Comparado({ c }: { c: OrcadoRealizado }) {
  const acima = c.desvio > 0;
  return (
    <div className="bg-background border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <p className="font-semibold">Orçado contra realizado</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Até ao mês {c.ate_mes}. O previsto até ao mês é a quota anual repartida pelos meses
          decorridos — não porque a despesa seja uniforme, mas porque é a única repartição que não
          inventa sazonalidade.
        </p>
      </div>
      <div className="px-5 py-3 border-b border-border text-sm">
        Realizado {brl(c.realizado)} contra {brl(c.previsto_ate_mes)} previstos —{" "}
        <strong className={acima ? "text-rose-600" : "text-emerald-600"}>
          {acima ? "acima" : "abaixo"} em {brl(Math.abs(c.desvio))}
        </strong>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground uppercase bg-muted/40">
              <th className="text-left px-5 py-2.5">Rubrica</th>
              <th className="text-right px-3 py-2.5">Previsto</th>
              <th className="text-right px-3 py-2.5">Realizado</th>
              <th className="text-right px-5 py-2.5">Desvio</th>
            </tr>
          </thead>
          <tbody>
            {c.rubricas.map((r) => (
              <tr key={r.categoria_id} className="border-t border-border">
                <td className="px-5 py-2">{r.nome}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {brl(r.previsto_ate_mes)}
                </td>
                <td className="px-3 py-2 text-right">{brl(r.realizado)}</td>
                <td
                  className={`px-5 py-2 text-right font-semibold ${
                    r.desvio > 0 ? "text-rose-600" : "text-emerald-600"
                  }`}
                >
                  {r.desvio > 0 ? "+" : ""}
                  {brl(r.desvio)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModalNovo({
  condominioId,
  anosUsados,
  onClose,
  onCriado,
}: {
  condominioId: string;
  anosUsados: number[];
  onClose: () => void;
  onCriado: (id: string) => void;
}) {
  const proximo = new Date().getFullYear() + 1;
  const [ano, setAno] = useState(anosUsados.includes(proximo) ? proximo + 1 : proximo);
  const [base, setBase] = useState(new Date().getFullYear());
  const [inad, setInad] = useState("5");
  const [fundo, setFundo] = useState("10");
  const [previa, setPrevia] = useState<RealizadoAno | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let activo = true;
    safeCall(realizadoPorCategoria({ data: { condominio_id: condominioId, ano: base } })).then(
      (r) => {
        if (activo) setPrevia((r ?? null) as RealizadoAno | null);
      },
    );
    return () => {
      activo = false;
    };
  }, [condominioId, base]);

  const criar = async () => {
    setOcupado(true);
    const r = await safeCall(
      criarOrcamento({
        data: {
          condominio_id: condominioId,
          ano,
          ano_base: base,
          inadimplencia: Number(inad) || 0,
          fundo_reserva: Number(fundo) || 0,
        },
      }),
    );
    setOcupado(false);
    if (r) {
      toast.success(`Orçamento de ${ano} criado`);
      onCriado(r.id);
    }
  };

  return (
    <Modal title="Novo orçamento" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ano a orçar">
            <input
              type="number"
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </Field>
          <Field label="Ano base">
            <input
              type="number"
              value={base}
              onChange={(e) => setBase(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </Field>
        </div>

        {previa && (
          <div className="text-xs bg-muted rounded-xl p-3 space-y-1">
            <p>
              Realizado de {previa.ano}: <strong>{brl(previa.total)}</strong> em{" "}
              {previa.categorias.filter((c) => c.valor > 0).length} rubricas.
            </p>
            {previa.sem_categoria > 0 && (
              <p className="text-amber-700">
                {brl(previa.sem_categoria)} em despesas sem categoria não entram em rubrica nenhuma.
                Classifique-as antes, ou o orçamento nasce abaixo do que se gastou.
              </p>
            )}
            {previa.total === 0 && (
              <p className="text-amber-700">
                Não há despesas lançadas em {previa.ano}. O orçamento nasce com as rubricas a zero.
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Inadimplência prevista (%)">
            <input
              type="number"
              step="0.01"
              value={inad}
              onChange={(e) => setInad(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </Field>
          <Field label="Fundo de reserva (%)">
            <input
              type="number"
              step="0.01"
              value={fundo}
              onChange={(e) => setFundo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </Field>
        </div>

        <p className="text-xs text-muted-foreground">
          O fundo de reserva vem da convenção. A inadimplência deve sair do histórico do próprio
          condomínio — a média dos últimos anos, não um número redondo.
        </p>

        <button
          onClick={criar}
          disabled={ocupado || base >= ano}
          className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50"
        >
          Criar orçamento de {ano}
        </button>
        {base >= ano && (
          <p className="text-xs text-rose-600">O ano base tem de ser anterior ao ano orçado.</p>
        )}
      </div>
    </Modal>
  );
}

function ModalAprovar({
  orcamentoId,
  condominioId,
  onClose,
  onAprovado,
}: {
  orcamentoId: string;
  condominioId: string;
  onClose: () => void;
  onAprovado: () => void;
}) {
  const [assembleias, setAssembleias] = useState<Assembleia[]>([]);
  const [sel, setSel] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    safeCall(listarAssembleias({ data: { condominio_id: condominioId } })).then((r) =>
      setAssembleias(((r ?? []) as Assembleia[]).filter((a) => a.status === "encerrada")),
    );
  }, [condominioId]);

  const aprovar = async () => {
    setOcupado(true);
    const r = await safeCall(
      aprovarOrcamento({ data: { orcamento_id: orcamentoId, assembleia_id: sel } }),
    );
    setOcupado(false);
    if (r) {
      toast.success("Orçamento aprovado");
      onAprovado();
    }
  };

  return (
    <Modal title="Aprovar o orçamento" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          É a assembleia que aprova o orçamento, não o síndico (art. 1.350). Escolha a assembleia
          encerrada em que foi aprovado — fica ligada ao orçamento, e depois disto nada se
          reescreve.
        </p>

        {assembleias.length === 0 ? (
          <div className="flex gap-2 text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <p>
              Não há assembleias encerradas. Registe e encerre a assembleia que aprovou o orçamento
              antes de o aprovar aqui.
            </p>
          </div>
        ) : (
          <Field label="Assembleia">
            <select
              value={sel}
              onChange={(e) => setSel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value="">Escolha…</option>
              {assembleias.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.titulo} — {dataBR(a.inicio)}
                </option>
              ))}
            </select>
          </Field>
        )}

        <button
          onClick={aprovar}
          disabled={!sel || ocupado}
          className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50"
        >
          Aprovar
        </button>
      </div>
    </Modal>
  );
}

/**
 * Os quatro índices publicados, com o acumulado de doze meses já composto.
 *
 * Fica ao lado das rubricas e não escondido numa configuração: é aqui que o
 * número é preciso, e um índice de três meses atrás usado sem se dar conta
 * passa para o orçamento inteiro.
 */
function PainelIndices({
  indices,
  onActualizado,
}: {
  indices: AcumuladoIndice[];
  onActualizado: () => void;
}) {
  const [ocupado, setOcupado] = useState(false);

  const actualizar = async () => {
    setOcupado(true);
    const r = await safeCall(atualizarIndices());
    setOcupado(false);
    if (!r) return;
    if (r.falhou.length > 0) {
      toast.warning(
        `Actualizado, mas ${r.falhou
          .map((i) => ROTULO_INDICE[i].split(" —")[0])
          .join(", ")} não respondeu. Tente de novo daqui a pouco.`,
      );
    } else {
      toast.success(r.gravadas > 0 ? `${r.gravadas} medições novas` : "Já estava em dia");
    }
    onActualizado();
  };

  const vazio = indices.every((i) => i.acumulado == null);

  return (
    <div className="bg-background border border-border rounded-2xl p-5">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div>
          <p className="font-semibold text-sm">Índices publicados</p>
          <p className="text-xs text-muted-foreground">
            Acumulado de doze meses, composto e não somado, do SGS do Banco Central.
          </p>
        </div>
        <div className="flex-1" />
        <button
          onClick={actualizar}
          disabled={ocupado}
          className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw size={14} className={ocupado ? "animate-spin" : ""} /> Actualizar
        </button>
      </div>

      {vazio ? (
        <p className="text-xs text-muted-foreground">
          Ainda não há medições gravadas. Carregue em Actualizar para as buscar ao Banco Central.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {indices.map((i) => (
            <div key={i.indice} className="rounded-xl border border-border p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                {ROTULO_INDICE[i.indice].split(" —")[0]}
              </p>
              <p className="font-display text-lg font-bold">
                {i.acumulado == null ? "—" : pct(i.acumulado)}
              </p>
              <p className="text-xs text-muted-foreground">
                {i.ultima ? `até ${dataBR(i.ultima)}` : "sem medições"}
                {i.acumulado != null && !i.completo ? ` · só ${i.meses} meses` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
