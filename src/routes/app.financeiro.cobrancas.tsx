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
} from "@/server/financeiro.functions";
import { criarPixCobranca } from "@/server/mercadopago.functions";
import { brl, dateBR, competenciaBR } from "@/lib/format";
import {
  Modal, Field, EmptyState, StatusBadge, safeCall,
} from "@/components/financeiro/ui";
import { toast } from "sonner";
import {
  FileText, Plus, Loader2, X, CheckCircle2, QrCode, Copy, MessageCircle,
} from "lucide-react";

export const Route = createFileRoute("/app/financeiro/cobrancas")({
  head: () => ({ meta: [{ title: "Cobranças — Financeiro" }] }),
  component: CobrancasPage,
});

function CobrancasPage() {
  const { condominioId, podeGerirFinanceiro: podeGerir, isMorador } = useCondominioAtivo();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("todos");
  const [showLote, setShowLote] = useState(false);
  const [showPagar, setShowPagar] = useState<any>(null);
  const [showPix, setShowPix] = useState<any>(null);

  const reload = () => {
    if (!condominioId) return;
    setLoading(true);
    safeCall(listarCobrancas({ data: { condominio_id: condominioId } }))
      .then((rs) => setRows(rs ?? []))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [condominioId]);

  const filtered = useMemo(
    () => (filter === "todos" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  if (!condominioId) return null;

  const lembrar = async (cobrancaId: string) => {
    const r = await safeCall(enviarLembreteCobranca({ data: { cobranca_id: cobrancaId } }));
    if (r) toast.success(`Lembrete enfileirado para ${r.enfileirados} morador(es)`);
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
                        {(isMorador || podeGerir) &&
                          (r.status === "pendente" || r.status === "vencida" || r.status === "parcial") && (
                            <button
                              onClick={() => setShowPix(r)}
                              className="p-2 rounded hover:bg-muted text-primary"
                              title="Gerar PIX"
                            >
                              <QrCode size={16} />
                            </button>
                          )}
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
      {showPix && (
        <ModalPix cobranca={showPix} onClose={() => setShowPix(null)} onPaid={reload} />
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
  const [usarTaxaUnidade, setUsarTaxaUnidade] = useState(true);
  const [valorPadrao, setValorPadrao] = useState("0");
  const [descricao, setDescricao] = useState("Taxa condominial");
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [categorias, setCategorias] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    safeCall(listarCategorias({ data: { condominio_id: condominioId } })).then((cs) => {
      const recs = (cs ?? []).filter((c: any) => c.tipo === "receita");
      setCategorias(recs);
      if (recs[0]) setCategoriaId(recs[0].id);
    });
  }, [condominioId]);

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
          usar_taxa_unidade: usarTaxaUnidade,
          valor_padrao: Number(valorPadrao),
        },
      }),
    );
    setSaving(false);
    if (r) {
      toast.success(`${r.criadas} cobrança(s) gerada(s)`);
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
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={usarTaxaUnidade}
            onChange={(e) => setUsarTaxaUnidade(e.target.checked)}
          />
          Usar taxa mensal cadastrada em cada unidade (recomendado)
        </label>
        {!usarTaxaUnidade && (
          <Field label="Valor único (R$)">
            <input
              type="number"
              step="0.01"
              value={valorPadrao}
              onChange={(e) => setValorPadrao(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </Field>
        )}
        <p className="text-xs text-muted-foreground">
          As unidades que já possuem cobrança nessa competência e categoria serão ignoradas.
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

function ModalPix({
  cobranca,
  onClose,
  onPaid,
}: {
  cobranca: any;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pix, setPix] = useState<any>(null);

  useEffect(() => {
    criarPixCobranca({ data: { cobranca_id: cobranca.id } })
      .then((r) => setPix(r))
      .catch((e) => setError(e?.message || "Erro ao gerar PIX"))
      .finally(() => setLoading(false));
  }, [cobranca.id]);

  const copiar = () => {
    if (!pix?.qr_code) return;
    navigator.clipboard.writeText(pix.qr_code);
    toast.success("Código PIX copiado");
  };

  return (
    <Modal title="Pagamento via PIX" onClose={onClose}>
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="space-y-3">
          <p className="text-sm text-rose-600">{error}</p>
          <p className="text-xs text-muted-foreground">
            Configure o Mercado Pago em <strong>Pagamentos</strong> para habilitar PIX automático.
          </p>
        </div>
      ) : pix ? (
        <div className="space-y-4 text-center">
          {pix.qr_code_base64 && (
            <img
              src={`data:image/png;base64,${pix.qr_code_base64}`}
              alt="QR Code PIX"
              className="mx-auto w-56 h-56 border border-border rounded-lg"
            />
          )}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Copia e cola</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={pix.qr_code}
                className="flex-1 px-2 py-2 text-xs font-mono border border-border rounded-lg bg-muted/30 truncate"
              />
              <button
                onClick={copiar}
                className="p-2 rounded-lg border border-border hover:bg-muted"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            A cobrança será atualizada automaticamente ao receber o pagamento.
          </p>
          {pix.ticket_url && (
            <a
              href={pix.ticket_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline"
            >
              Abrir comprovante MP
            </a>
          )}
          <button
            onClick={() => {
              onPaid();
              onClose();
            }}
            className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
          >
            Fechar
          </button>
        </div>
      ) : null}
    </Modal>
  );
}
