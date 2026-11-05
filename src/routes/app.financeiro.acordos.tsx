/**
 * Acordos de parcelamento.
 *
 * O ecrã não calcula nada. Mostra o que `simular_acordo` devolve e manda os
 * mesmos parâmetros a `criar_acordo`, que repete a conta no banco. É de
 * propósito: o que o condómino vê na simulação é o que fica gravado, e isso
 * só se garante havendo uma só implementação da conta.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Handshake, Plus, Ban, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { EmptyState, Field, Modal, StatusBadge, safeCall } from "@/components/financeiro/ui";
import {
  cobrancasParaAcordo,
  criarAcordo,
  listarAcordos,
  parcelasDoAcordo,
  rescindirAcordo,
  simularAcordo,
  ROTULO_STATUS_ACORDO,
  type Acordo,
  type ParcelaAcordo,
  type SimulacaoAcordo,
} from "@/lib/acordo.functions";
import { listarUnidades } from "@/lib/unidades.functions";
import { dataBR } from "@/lib/periodo";

export const Route = createFileRoute("/app/financeiro/acordos")({
  head: () => ({ meta: [{ title: "Acordos — QiCond" }] }),
  component: AcordosPage,
});

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function AcordosPage() {
  const { condominioId } = useCondominioAtivo();
  const [acordos, setAcordos] = useState<Acordo[]>([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!condominioId) return;
    setLoading(true);
    const r = await safeCall(listarAcordos({ data: { condominio_id: condominioId } }));
    setAcordos((r ?? []) as Acordo[]);
    setLoading(false);
  }, [condominioId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!condominioId) return null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div>
          <h2 className="font-semibold text-lg">Acordos de parcelamento</h2>
          <p className="text-sm text-muted-foreground">
            A dívida consolidada sai da inadimplência e passa a correr nas parcelas.
          </p>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setNovo(true)}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2"
        >
          <Plus size={16} /> Novo acordo
        </button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">A carregar…</p>
      ) : acordos.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="Nenhum acordo"
          desc="Quando uma unidade acumula atrasos, um acordo consolida a dívida e divide-a em parcelas."
        />
      ) : (
        <div className="space-y-3">
          {acordos.map((a) => (
            <CartaoAcordo
              key={a.id}
              acordo={a}
              expandido={aberto === a.id}
              onToggle={() => setAberto(aberto === a.id ? null : a.id)}
              onMudou={carregar}
            />
          ))}
        </div>
      )}

      {novo && (
        <ModalNovoAcordo
          condominioId={condominioId}
          onClose={() => setNovo(false)}
          onDone={() => {
            setNovo(false);
            carregar();
          }}
        />
      )}
    </div>
  );
}

function CartaoAcordo({
  acordo: a,
  expandido,
  onToggle,
  onMudou,
}: {
  acordo: Acordo;
  expandido: boolean;
  onToggle: () => void;
  onMudou: () => void;
}) {
  const [parcelas, setParcelas] = useState<ParcelaAcordo[] | null>(null);
  const [aRescindir, setARescindir] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!expandido || parcelas) return;
    safeCall(parcelasDoAcordo({ data: { acordo_id: a.id } })).then((r) =>
      setParcelas((r ?? []) as ParcelaAcordo[]),
    );
  }, [expandido, parcelas, a.id]);

  const unidade = a.unidade
    ? `${a.unidade.bloco ? `${a.unidade.bloco}-` : ""}${a.unidade.numero}`
    : "—";

  const rescindir = async () => {
    setOcupado(true);
    const r = await safeCall(rescindirAcordo({ data: { acordo_id: a.id, motivo } }));
    setOcupado(false);
    if (r) {
      toast.success("Acordo rescindido. O saldo virou uma cobrança vencida hoje.");
      setARescindir(false);
      setParcelas(null);
      onMudou();
    }
  };

  const cor: Record<string, string> = {
    ativo: "bg-emerald-100 text-emerald-700",
    quitado: "bg-blue-100 text-blue-700",
    rescindido: "bg-rose-100 text-rose-700",
    cancelado: "bg-muted text-muted-foreground",
  };

  return (
    <div className="bg-background border border-border rounded-2xl overflow-hidden">
      <button onClick={onToggle} className="w-full px-5 py-4 flex items-center gap-4 text-left">
        {expandido ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        <div className="min-w-0">
          <p className="font-semibold">
            Acordo {a.numero} — unidade {unidade}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {dataBR(a.data_acordo)} · {a.num_parcelas}{" "}
            {a.num_parcelas === 1 ? "parcela" : "parcelas"}
            {a.valor_entrada > 0 && ` · entrada ${brl(a.valor_entrada)}`}
          </p>
        </div>
        <div className="flex-1" />
        <span className="font-mono font-semibold">{brl(a.valor_total)}</span>
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold ${cor[a.status] ?? "bg-muted"}`}
        >
          {ROTULO_STATUS_ACORDO[a.status]}
        </span>
      </button>

      {expandido && (
        <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
            <Valor rotulo="Principal" valor={a.valor_principal} />
            <Valor rotulo="Multa" valor={a.valor_multa} />
            <Valor rotulo="Juros" valor={a.valor_juros} />
            <Valor rotulo="Abatimento" valor={-a.valor_desconto} />
            <Valor rotulo="Total" valor={a.valor_total} destaque />
          </div>

          {a.autorizacao && (
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold">Abatimento autorizado por:</span> {a.autorizacao}
            </p>
          )}
          {a.observacoes && <p className="text-xs text-muted-foreground">{a.observacoes}</p>}
          {a.rescisao_motivo && (
            <p className="text-xs text-rose-600">
              <span className="font-semibold">Rescindido:</span> {a.rescisao_motivo}
            </p>
          )}

          {parcelas === null ? (
            <p className="text-xs text-muted-foreground">A carregar parcelas…</p>
          ) : (
            <div className="border border-border rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Parcela</th>
                    <th className="text-left px-4 py-2 font-semibold">Vencimento</th>
                    <th className="text-right px-4 py-2 font-semibold">Valor</th>
                    <th className="text-right px-4 py-2 font-semibold">Pago</th>
                    <th className="text-left px-4 py-2 font-semibold">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parcelas.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2">
                        {p.parcela_num === 0 ? "Entrada" : `${p.parcela_num}/${a.num_parcelas}`}
                      </td>
                      <td className="px-4 py-2">{dataBR(p.vencimento)}</td>
                      <td className="px-4 py-2 text-right font-mono">
                        {brl(p.valor + p.multa + p.juros)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{brl(p.valor_pago)}</td>
                      <td className="px-4 py-2">
                        <StatusBadge status={p.status} venc={p.vencimento} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {a.status === "ativo" && (
            <div>
              {aRescindir ? (
                <div className="border border-rose-200 dark:border-rose-900 rounded-xl p-4 space-y-3">
                  <p className="text-sm">
                    As parcelas em aberto são canceladas e o saldo passa a uma cobrança única,
                    vencida hoje. As cobranças originais ficam como registo do acordo.
                  </p>
                  <Field label="Motivo">
                    <input
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Ex.: três parcelas em atraso"
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    />
                  </Field>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setARescindir(false)}
                      className="px-4 py-2 rounded-lg border border-border text-sm"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={rescindir}
                      disabled={ocupado}
                      className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold disabled:opacity-60"
                    >
                      Rescindir
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setARescindir(true)}
                  className="text-sm text-rose-600 font-semibold inline-flex items-center gap-2 hover:underline"
                >
                  <Ban size={14} /> Rescindir acordo
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Valor({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className={`font-mono ${destaque ? "font-bold" : ""}`}>{brl(valor)}</p>
    </div>
  );
}

function ModalNovoAcordo({
  condominioId,
  onClose,
  onDone,
}: {
  condominioId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [unidades, setUnidades] = useState<{ id: string; bloco: string | null; numero: string }[]>(
    [],
  );
  const [unidadeId, setUnidadeId] = useState("");
  const [cobrancas, setCobrancas] = useState<
    {
      id: string;
      descricao: string | null;
      vencimento: string;
      valor: number;
      valor_pago: number;
    }[]
  >([]);
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [desconto, setDesconto] = useState("0");
  const [entrada, setEntrada] = useState("0");
  const [numParcelas, setNumParcelas] = useState("6");
  const [primeiroVenc, setPrimeiroVenc] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().slice(0, 10);
  });
  const [autorizacao, setAutorizacao] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [sim, setSim] = useState<SimulacaoAcordo | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    safeCall(listarUnidades({ data: { condominio_id: condominioId } })).then((r) =>
      setUnidades((r ?? []) as typeof unidades),
    );
  }, [condominioId]);

  useEffect(() => {
    setEscolhidas([]);
    setSim(null);
    if (!unidadeId) {
      setCobrancas([]);
      return;
    }
    safeCall(
      cobrancasParaAcordo({ data: { condominio_id: condominioId, unidade_id: unidadeId } }),
    ).then((r) => setCobrancas((r ?? []) as typeof cobrancas));
  }, [condominioId, unidadeId]);

  const parametros = useMemo(
    () => ({
      condominio_id: condominioId,
      unidade_id: unidadeId,
      cobranca_ids: escolhidas,
      desconto: Number(desconto.replace(",", ".")) || 0,
      entrada: Number(entrada.replace(",", ".")) || 0,
      num_parcelas: Number(numParcelas) || 1,
      primeiro_vencimento: primeiroVenc,
    }),
    [condominioId, unidadeId, escolhidas, desconto, entrada, numParcelas, primeiroVenc],
  );

  const simular = async () => {
    if (escolhidas.length === 0) {
      toast.error("Escolha as cobranças a consolidar");
      return;
    }
    setOcupado(true);
    const r = await safeCall(simularAcordo({ data: parametros }));
    setOcupado(false);
    if (r) setSim(r as SimulacaoAcordo);
  };

  const gravar = async () => {
    setOcupado(true);
    const r = await safeCall(
      criarAcordo({
        data: {
          ...parametros,
          categoria_id: null,
          autorizacao: autorizacao || null,
          observacoes: observacoes || null,
        },
      }),
    );
    setOcupado(false);
    if (r) {
      toast.success("Acordo criado. As parcelas já estão lançadas.");
      onDone();
    }
  };

  return (
    <Modal title="Novo acordo de parcelamento" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Unidade">
          <select
            value={unidadeId}
            onChange={(e) => setUnidadeId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          >
            <option value="">Selecione…</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.bloco ? `${u.bloco}-` : ""}
                {u.numero}
              </option>
            ))}
          </select>
        </Field>

        {unidadeId && (
          <Field label="Cobranças a consolidar">
            {cobrancas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Esta unidade não tem cobranças em aberto.
              </p>
            ) : (
              <div className="border border-border rounded-xl divide-y divide-border max-h-56 overflow-y-auto">
                {cobrancas.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      checked={escolhidas.includes(c.id)}
                      onChange={(e) => {
                        setSim(null);
                        setEscolhidas((prev) =>
                          e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id),
                        );
                      }}
                    />
                    <span className="flex-1 min-w-0 truncate">
                      {c.descricao ?? "Cobrança"} · venc. {dataBR(c.vencimento)}
                    </span>
                    <span className="font-mono">{brl(c.valor - c.valor_pago)}</span>
                  </label>
                ))}
              </div>
            )}
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Abatimento (multa e juros)">
            <input
              value={desconto}
              onChange={(e) => {
                setDesconto(e.target.value);
                setSim(null);
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
            />
          </Field>
          <Field label="Entrada">
            <input
              value={entrada}
              onChange={(e) => {
                setEntrada(e.target.value);
                setSim(null);
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
            />
          </Field>
          <Field label="Parcelas">
            <input
              type="number"
              min={1}
              max={60}
              value={numParcelas}
              onChange={(e) => {
                setNumParcelas(e.target.value);
                setSim(null);
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </Field>
          <Field label="1.º vencimento">
            <input
              type="date"
              value={primeiroVenc}
              onChange={(e) => {
                setPrimeiroVenc(e.target.value);
                setSim(null);
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </Field>
        </div>

        <Field label="Abatimento autorizado por (assembleia, convenção)">
          <input
            value={autorizacao}
            onChange={(e) => setAutorizacao(e.target.value)}
            placeholder="Ex.: assembleia de 20/10/2026, item 3"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </Field>

        <Field label="Observações">
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </Field>

        {sim && (
          <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/30">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Valor rotulo="Principal" valor={sim.principal} />
              <Valor rotulo="Multa" valor={sim.multa} />
              <Valor rotulo="Juros" valor={sim.juros} />
              <Valor rotulo="Abatimento" valor={-sim.desconto} />
              <Valor rotulo="Total" valor={sim.total} destaque />
              <Valor rotulo="Entrada" valor={sim.entrada} />
              <Valor rotulo="A parcelar" valor={sim.a_parcelar} />
            </div>
            <div className="text-sm">
              <p className="font-semibold mb-1">Parcelas</p>
              <div className="max-h-40 overflow-y-auto divide-y divide-border">
                {sim.parcelas.map((p) => (
                  <div key={p.numero} className="flex justify-between py-1">
                    <span>
                      {p.numero}/{sim.num_parcelas} · {dataBR(p.vencimento)}
                    </span>
                    <span className="font-mono">{brl(p.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm">
            Cancelar
          </button>
          {sim ? (
            <button
              onClick={gravar}
              disabled={ocupado}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
            >
              Confirmar acordo
            </button>
          ) : (
            <button
              onClick={simular}
              disabled={ocupado || escolhidas.length === 0}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
            >
              Simular
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
