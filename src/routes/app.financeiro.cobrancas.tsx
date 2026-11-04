import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useCondominioAtivo } from "@/auth/useCondominio";
import {
  listarCobrancas,
  listarCategorias,
  gerarCobrancasLote,
  cancelarCobranca,
  registrarPagamentoManual,
  enviarLembreteCobranca,
} from "@/lib/financeiro.functions";
import { previsualizarRateio } from "@/lib/unidades.functions";

import { brl, dateBR, competenciaBR } from "@/lib/format";
import { Modal, Field, EmptyState, StatusBadge, safeCall } from "@/components/financeiro/ui";
import { emitChanged } from "@/lib/safe-call";
import { toast } from "sonner";
import { FileText, Plus, Loader2, X, CheckCircle2, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/app/financeiro/cobrancas")({
  head: () => ({ meta: [{ title: "Cobranças — Financeiro" }] }),
  component: CobrancasPage,
});

function CobrancasPage() {
  const { condominioId, podeGerirFinanceiro: podeGerir } = useCondominioAtivo();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("todos");
  const [showLote, setShowLote] = useState(false);
  const [showPagar, setShowPagar] = useState<any>(null);

  const reload = () => {
    if (!condominioId) return;
    setLoading(true);
    safeCall(listarCobrancas({ data: { condominio_id: condominioId } }))
      .then((rs) => setRows(Array.isArray(rs) ? rs : []))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [condominioId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = () => reload();
    window.addEventListener("cobrancas:changed", h);
    window.addEventListener("pagamentos:changed", h);
    return () => {
      window.removeEventListener("cobrancas:changed", h);
      window.removeEventListener("pagamentos:changed", h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominioId]);

  const filtered = useMemo(() => {
    const arr = Array.isArray(rows) ? rows : [];
    return filter === "todos" ? arr : arr.filter((r) => r.status === filter);
  }, [rows, filter]);

  if (!condominioId) return null;

  const lembrar = async (cobrancaId: string) => {
    const r = await safeCall(enviarLembreteCobranca({ data: { cobranca_id: cobrancaId } }));
    if (r) {
      toast.success(`Lembrete enfileirado para ${r.enfileirados} morador(es)`);
      emitChanged("wa:changed");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
        >
          <option value="todos">Todos status</option>
          <option value="pendente">Pendentes</option>
          <option value="paga">Pagas</option>
          <option value="parcial">Parciais</option>
          <option value="vencida">Vencidas</option>
          <option value="cancelada">Canceladas</option>
        </select>
        <div className="flex-1" />
        {podeGerir && (
          <button
            onClick={() => setShowLote(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90"
          >
            <Plus size={16} /> Gerar cobranças do mês
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhuma cobrança encontrada"
          desc={
            podeGerir
              ? "Comece gerando as cobranças do mês."
              : "Você não tem cobranças neste condomínio."
          }
        />
      ) : (
        <div className="bg-background border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Unidade</th>
                  <th className="text-left px-4 py-3 font-semibold">Categoria</th>
                  <th className="text-left px-4 py-3 font-semibold">Competência</th>
                  <th className="text-left px-4 py-3 font-semibold">Vencimento</th>
                  <th className="text-right px-4 py-3 font-semibold">Valor</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {r.unidades?.bloco ? `${r.unidades.bloco}-` : ""}
                      {r.unidades?.numero ?? "—"}
                    </td>
                    <td className="px-4 py-3">{r.categorias_financeiras?.nome ?? "—"}</td>
                    <td className="px-4 py-3">{competenciaBR(r.competencia)}</td>
                    <td className="px-4 py-3">{dateBR(r.vencimento)}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {brl(Number(r.valor) + Number(r.multa) - Number(r.desconto))}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} venc={r.vencimento} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {podeGerir && r.status !== "paga" && r.status !== "cancelada" && (
                          <>
                            <button
                              onClick={() => lembrar(r.id)}
                              className="p-2 rounded hover:bg-muted text-emerald-700"
                              title="Enviar lembrete WhatsApp"
                            >
                              <MessageCircle size={16} />
                            </button>
                            <button
                              onClick={() => setShowPagar(r)}
                              className="p-2 rounded hover:bg-muted text-emerald-600"
                              title="Marcar como pago"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm("Cancelar esta cobrança?"))
                                  safeCall(cancelarCobranca({ data: { id: r.id } })).then((ok) => {
                                    if (ok) {
                                      toast.success("Cancelada");
                                      emitChanged("cobrancas:changed");
                                      reload();
                                    }
                                  });
                              }}
                              className="p-2 rounded hover:bg-muted text-rose-600"
                              title="Cancelar"
                            >
                              <X size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showLote && (
        <ModalGerarLote
          condominioId={condominioId}
          onClose={() => setShowLote(false)}
          onDone={() => {
            setShowLote(false);
            reload();
          }}
        />
      )}
      {showPagar && (
        <ModalRegistrarPagamento
          cobranca={showPagar}
          onClose={() => setShowPagar(null)}
          onDone={() => {
            setShowPagar(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function ModalGerarLote({
  condominioId,
  onClose,
  onDone,
}: {
  condominioId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const hoje = new Date();
  const mes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const [competencia, setCompetencia] = useState(`${mes}-01`);
  const [vencimento, setVencimento] = useState(`${mes}-10`);
  const [modo, setModo] = useState<"taxa_unidade" | "valor_unico" | "fracao_ideal">("taxa_unidade");
  const [valor, setValor] = useState("0");
  const [descricao, setDescricao] = useState("Taxa condominial");
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [categorias, setCategorias] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [previa, setPrevia] = useState<{ linhas: any[]; soma: number } | null>(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);

  useEffect(() => {
    safeCall(listarCategorias({ data: { condominio_id: condominioId } })).then((cs) => {
      const recs = (cs ?? []).filter((c: any) => c.tipo === "receita");
      setCategorias(recs);
      if (recs[0]) setCategoriaId(recs[0].id);
    });
  }, [condominioId]);

  // Gerar o lote é irreversível na prática: depois é apagar cobrança a
  // cobrança. Num rateio vale a pena ver os números antes de os gravar.
  const verPrevia = async () => {
    const total = Number(valor.replace(",", "."));
    if (!Number.isFinite(total) || total <= 0) {
      toast.error("Informe o valor total a ratear");
      return;
    }
    setCarregandoPrevia(true);
    const r = await safeCall(previsualizarRateio({ data: { condominio_id: condominioId, total } }));
    setCarregandoPrevia(false);
    if (r) setPrevia(r);
  };

  const submit = async () => {
    setSaving(true);
    const r = await safeCall(
      gerarCobrancasLote({
        data: {
          condominio_id: condominioId,
          categoria_id: categoriaId || null,
          competencia,
          vencimento,
          descricao,
          modo,
          valor: Number(valor.replace(",", ".")) || 0,
        },
      }),
    );
    setSaving(false);
    if (r) {
      toast.success(`${r.criadas} cobrança(s) gerada(s)`);
      emitChanged("cobrancas:changed");
      onDone();
    }
  };

  return (
    <Modal title="Gerar cobranças em lote" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Categoria">
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Competência (mês)">
            <input
              type="date"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </Field>
          <Field label="Vencimento">
            <input
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </Field>
        </div>
        <Field label="Descrição">
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </Field>
        <Field label="Como calcular o valor">
          <div className="space-y-2">
            {[
              {
                v: "taxa_unidade" as const,
                t: "Taxa mensal de cada unidade",
                d: "Usa o valor cadastrado em cada unidade. É o normal na taxa do mês.",
              },
              {
                v: "fracao_ideal" as const,
                t: "Ratear um total por fração ideal",
                d: "Para taxas extras e obras: cada unidade paga a proporção que lhe cabe.",
              },
              {
                v: "valor_unico" as const,
                t: "Valor igual para todas",
                d: "Só quando a despesa é mesmo igual para cada unidade.",
              },
            ].map((o) => (
              <label
                key={o.v}
                className={`flex gap-3 p-3 rounded-lg border cursor-pointer text-sm ${
                  modo === o.v ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="modo-lote"
                  className="mt-0.5"
                  checked={modo === o.v}
                  onChange={() => {
                    setModo(o.v);
                    setPrevia(null);
                  }}
                />
                <span>
                  <span className="font-semibold block">{o.t}</span>
                  <span className="text-muted-foreground text-xs">{o.d}</span>
                </span>
              </label>
            ))}
          </div>
        </Field>

        {modo !== "taxa_unidade" && (
          <Field label={modo === "fracao_ideal" ? "Total a ratear (R$)" : "Valor por unidade (R$)"}>
            <input
              value={valor}
              onChange={(e) => {
                setValor(e.target.value);
                setPrevia(null);
              }}
              inputMode="decimal"
              placeholder="50000,00"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm tabular-nums"
            />
          </Field>
        )}

        {modo === "fracao_ideal" && (
          <div className="space-y-3">
            <button
              onClick={verPrevia}
              disabled={carregandoPrevia}
              className="w-full px-4 py-2 rounded-lg border border-border text-sm font-semibold disabled:opacity-60"
            >
              {carregandoPrevia ? "A calcular…" : "Ver como fica o rateio"}
            </button>

            {previa && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="max-h-56 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr className="text-muted-foreground">
                        <th className="text-left font-semibold px-3 py-2">Unidade</th>
                        <th className="text-right font-semibold px-3 py-2">Fração</th>
                        <th className="text-right font-semibold px-3 py-2">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previa.linhas.map((l: any) => (
                        <tr key={l.unidade_id} className="border-t border-border">
                          <td className="px-3 py-1.5">
                            {l.bloco ? `${l.bloco} · ` : ""}
                            {l.numero}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                            {Number(l.fracao_ideal).toFixed(6)}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                            {Number(l.valor).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between px-3 py-2 border-t border-border bg-muted/30 text-xs font-semibold">
                  <span>{previa.linhas.length} unidade(s)</span>
                  <span className="tabular-nums">
                    Soma:{" "}
                    {previa.soma.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          As unidades que já possuem cobrança nessa competência e categoria serão ignoradas.
          {modo === "fracao_ideal" &&
            " No rateio, a quota de cada unidade é sempre calculada sobre o condomínio inteiro — quem já tem cobrança não faz os outros pagarem a mais."}
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
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Gerando…" : "Gerar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ModalRegistrarPagamento({
  cobranca,
  onClose,
  onDone,
}: {
  cobranca: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const restante =
    Number(cobranca.valor) +
    Number(cobranca.multa) +
    Number(cobranca.juros) -
    Number(cobranca.desconto) -
    Number(cobranca.valor_pago);
  const [valor, setValor] = useState(restante.toFixed(2));
  const [forma, setForma] = useState<any>("pix");
  const [pagoEm, setPagoEm] = useState(new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const r = await safeCall(
      registrarPagamentoManual({
        data: {
          cobranca_id: cobranca.id,
          valor: Number(valor),
          forma,
          pago_em: new Date(pagoEm).toISOString(),
          observacoes: obs,
        },
      }),
    );
    setSaving(false);
    if (r) {
      toast.success("Pagamento registrado");
      emitChanged("pagamentos:changed");
      emitChanged("cobrancas:changed");
      onDone();
    }
  };

  return (
    <Modal title="Registrar pagamento" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Saldo devedor: <strong className="text-foreground">{brl(restante)}</strong>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor recebido (R$)">
            <input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </Field>
          <Field label="Forma">
            <select
              value={forma}
              onChange={(e) => setForma(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value="pix">PIX</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="boleto">Boleto</option>
              <option value="transferencia">Transferência</option>
              <option value="cartao">Cartão</option>
              <option value="outro">Outro</option>
            </select>
          </Field>
        </div>
        <Field label="Data do pagamento">
          <input
            type="date"
            value={pagoEm}
            onChange={(e) => setPagoEm(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </Field>
        <Field label="Observações">
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
