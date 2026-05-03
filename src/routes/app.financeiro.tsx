import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { supabase } from "@/integrations/supabase/client";
import { brl, dateBR, competenciaBR } from "@/lib/format";
import {
  resumoFinanceiro,
  listarCobrancas,
  listarCategorias,
  criarCategoria,
  removerCategoria,
  gerarCobrancasLote,
  cancelarCobranca,
  registrarPagamentoManual,
  criarDespesa,
  listarDespesas,
  removerDespesa,
  obterConfigPagamento,
  salvarConfigPagamento,
} from "@/server/financeiro.functions";
import { criarPixCobranca } from "@/server/mercadopago.functions";
import { toast } from "sonner";
import {
  Wallet, TrendingUp, TrendingDown, AlertTriangle, Plus, Loader2, Trash2, X,
  CreditCard, FileText, Settings as SettingsIcon, Copy, QrCode, CheckCircle2, Tag,
} from "lucide-react";

export const Route = createFileRoute("/app/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — CONDOZAP" }] }),
  component: FinanceiroPage,
});

type Tab = "dashboard" | "cobrancas" | "despesas" | "inadimplencia" | "categorias" | "config";

function FinanceiroPage() {
  const { roles } = useAuth();
  const { condominioId, podeGerirFinanceiro, isMorador } = useCondominioAtivo();
  const [tab, setTab] = useState<Tab>("dashboard");

  if (!condominioId) {
    return <div className="p-10 text-muted-foreground">Selecione um condomínio para acessar o financeiro.</div>;
  }

  const tabs: { id: Tab; label: string; icon: any; restrito?: boolean }[] = [
    { id: "dashboard", label: "Visão geral", icon: TrendingUp },
    { id: "cobrancas", label: "Cobranças", icon: FileText },
    { id: "despesas", label: "Despesas", icon: Wallet, restrito: true },
    { id: "inadimplencia", label: "Inadimplência", icon: AlertTriangle, restrito: true },
    { id: "categorias", label: "Categorias", icon: Tag, restrito: true },
    { id: "config", label: "Pagamentos", icon: SettingsIcon, restrito: true },
  ];
  const visibleTabs = tabs.filter((t) => !t.restrito || podeGerirFinanceiro);

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-extrabold">Financeiro</h1>
        <p className="text-muted-foreground mt-1">
          {isMorador ? "Suas cobranças e pagamentos." : "Gestão completa de receitas, despesas e cobranças."}
        </p>
      </header>

      <div className="border-b border-border mb-6 -mx-2 overflow-x-auto">
        <div className="flex gap-1 px-2 min-w-max">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "dashboard" && <DashboardTab condominioId={condominioId} />}
      {tab === "cobrancas" && <CobrancasTab condominioId={condominioId} podeGerir={podeGerirFinanceiro} isMorador={isMorador} />}
      {tab === "despesas" && podeGerirFinanceiro && <DespesasTab condominioId={condominioId} />}
      {tab === "inadimplencia" && podeGerirFinanceiro && <InadimplenciaTab condominioId={condominioId} />}
      {tab === "categorias" && podeGerirFinanceiro && <CategoriasTab condominioId={condominioId} />}
      {tab === "config" && podeGerirFinanceiro && <ConfigTab condominioId={condominioId} />}
    </div>
  );
}

// ====================== DASHBOARD ======================
function DashboardTab({ condominioId }: { condominioId: string }) {
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [resumo, setResumo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    resumoFinanceiro({ data: { condominio_id: condominioId, mes } })
      .then(setResumo)
      .finally(() => setLoading(false));
  }, [condominioId, mes]);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-muted-foreground">Competência</p>
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
        />
      </div>

      {loading || !resumo ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Stat icon={FileText} label="Total cobrado" value={brl(resumo.totalCobrado)} tone="neutral" />
            <Stat icon={TrendingUp} label="Recebido no mês" value={brl(resumo.totalRecebidoMes)} tone="success" />
            <Stat icon={TrendingDown} label="Despesas no mês" value={brl(resumo.totalDespesas)} tone="danger" />
            <Stat icon={Wallet} label="Saldo do mês" value={brl(resumo.saldoMes)} tone={resumo.saldoMes >= 0 ? "success" : "danger"} />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-background border border-border rounded-2xl p-6">
              <div className="flex items-center gap-2 text-amber-600 mb-2">
                <AlertTriangle size={18} />
                <p className="text-sm font-semibold uppercase">Inadimplência atual</p>
              </div>
              <p className="font-display text-3xl font-extrabold">{brl(resumo.totalInadimplencia)}</p>
              <p className="text-sm text-muted-foreground mt-1">{resumo.qtdInadimplentes} cobrança(s) vencida(s)</p>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
              <p className="text-sm font-semibold text-primary uppercase mb-2">Dica</p>
              <p className="text-sm">Configure o Mercado Pago em <strong>Pagamentos</strong> para gerar PIX automático e o morador pagar direto pelo WhatsApp.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone = "neutral" }: { icon: any; label: string; value: string; tone?: "neutral" | "success" | "danger" }) {
  const toneCls = tone === "success" ? "text-emerald-600" : tone === "danger" ? "text-rose-600" : "text-foreground";
  return (
    <div className="bg-background border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase">{label}</p>
        <Icon size={18} className="text-muted-foreground" />
      </div>
      <p className={`font-display text-2xl font-extrabold mt-2 ${toneCls}`}>{value}</p>
    </div>
  );
}

// ====================== COBRANÇAS ======================
function CobrancasTab({ condominioId, podeGerir, isMorador }: { condominioId: string; podeGerir: boolean; isMorador: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("todos");
  const [showLote, setShowLote] = useState(false);
  const [showPagar, setShowPagar] = useState<any>(null);
  const [showPix, setShowPix] = useState<any>(null);

  const reload = () => {
    setLoading(true);
    listarCobrancas({ data: { condominio_id: condominioId } })
      .then((rs) => setRows(rs))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [condominioId]);

  const filtered = useMemo(() => filter === "todos" ? rows : rows.filter((r) => r.status === filter), [rows, filter]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm">
          <option value="todos">Todos status</option>
          <option value="pendente">Pendentes</option>
          <option value="paga">Pagas</option>
          <option value="parcial">Parciais</option>
          <option value="vencida">Vencidas</option>
          <option value="cancelada">Canceladas</option>
        </select>
        <div className="flex-1" />
        {podeGerir && (
          <button onClick={() => setShowLote(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90">
            <Plus size={16} /> Gerar cobranças do mês
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhuma cobrança encontrada" desc={podeGerir ? "Comece gerando as cobranças do mês." : "Você não tem cobranças neste condomínio."} />
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
                    <td className="px-4 py-3 font-medium">{r.unidades?.bloco ? `${r.unidades.bloco}-` : ""}{r.unidades?.numero ?? "—"}</td>
                    <td className="px-4 py-3">{r.categorias_financeiras?.nome ?? "—"}</td>
                    <td className="px-4 py-3">{competenciaBR(r.competencia)}</td>
                    <td className="px-4 py-3">{dateBR(r.vencimento)}</td>
                    <td className="px-4 py-3 text-right font-mono">{brl(Number(r.valor) + Number(r.multa) - Number(r.desconto))}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} venc={r.vencimento} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {(isMorador || podeGerir) && (r.status === "pendente" || r.status === "vencida" || r.status === "parcial") && (
                          <button onClick={() => setShowPix(r)} className="p-2 rounded hover:bg-muted text-primary" title="Gerar PIX"><QrCode size={16} /></button>
                        )}
                        {podeGerir && r.status !== "paga" && r.status !== "cancelada" && (
                          <>
                            <button onClick={() => setShowPagar(r)} className="p-2 rounded hover:bg-muted text-emerald-600" title="Marcar como pago"><CheckCircle2 size={16} /></button>
                            <button
                              onClick={() => { if (confirm("Cancelar esta cobrança?")) cancelarCobranca({ data: { id: r.id } }).then(() => { toast.success("Cancelada"); reload(); }); }}
                              className="p-2 rounded hover:bg-muted text-rose-600" title="Cancelar"><X size={16} /></button>
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

      {showLote && <ModalGerarLote condominioId={condominioId} onClose={() => setShowLote(false)} onDone={() => { setShowLote(false); reload(); }} />}
      {showPagar && <ModalRegistrarPagamento cobranca={showPagar} onClose={() => setShowPagar(null)} onDone={() => { setShowPagar(null); reload(); }} />}
      {showPix && <ModalPix cobranca={showPix} onClose={() => setShowPix(null)} onPaid={reload} />}
    </div>
  );
}

function StatusBadge({ status, venc }: { status: string; venc: string }) {
  const isVenc = status === "pendente" && new Date(venc) < new Date();
  const real = isVenc ? "vencida" : status;
  const map: Record<string, string> = {
    paga: "bg-emerald-100 text-emerald-700",
    pendente: "bg-amber-100 text-amber-700",
    vencida: "bg-rose-100 text-rose-700",
    parcial: "bg-blue-100 text-blue-700",
    cancelada: "bg-muted text-muted-foreground",
  };
  return <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${map[real] || "bg-muted"}`}>{real}</span>;
}

function ModalGerarLote({ condominioId, onClose, onDone }: { condominioId: string; onClose: () => void; onDone: () => void }) {
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
    listarCategorias({ data: { condominio_id: condominioId } }).then((cs) => {
      const recs = cs.filter((c: any) => c.tipo === "receita");
      setCategorias(recs);
      if (recs[0]) setCategoriaId(recs[0].id);
    });
  }, [condominioId]);

  const submit = async () => {
    setSaving(true);
    try {
      const r = await gerarCobrancasLote({
        data: {
          condominio_id: condominioId,
          categoria_id: categoriaId || null,
          competencia,
          vencimento,
          descricao,
          usar_taxa_unidade: usarTaxaUnidade,
          valor_padrao: Number(valorPadrao),
        },
      });
      toast.success(`${r.criadas} cobrança(s) gerada(s)`);
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  return (
    <Modal title="Gerar cobranças em lote" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Categoria">
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
            <option value="">Sem categoria</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Competência (mês)">
            <input type="date" value={competencia} onChange={(e) => setCompetencia(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
          </Field>
          <Field label="Vencimento">
            <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
          </Field>
        </div>
        <Field label="Descrição">
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={usarTaxaUnidade} onChange={(e) => setUsarTaxaUnidade(e.target.checked)} />
          Usar taxa mensal cadastrada em cada unidade (recomendado)
        </label>
        {!usarTaxaUnidade && (
          <Field label="Valor único (R$)">
            <input type="number" step="0.01" value={valorPadrao} onChange={(e) => setValorPadrao(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
          </Field>
        )}
        <p className="text-xs text-muted-foreground">As unidades que já possuem cobrança nessa competência e categoria serão ignoradas.</p>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm font-semibold">Cancelar</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">
            {saving ? "Gerando…" : "Gerar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ModalRegistrarPagamento({ cobranca, onClose, onDone }: { cobranca: any; onClose: () => void; onDone: () => void }) {
  const restante = Number(cobranca.valor) + Number(cobranca.multa) + Number(cobranca.juros) - Number(cobranca.desconto) - Number(cobranca.valor_pago);
  const [valor, setValor] = useState(restante.toFixed(2));
  const [forma, setForma] = useState<any>("pix");
  const [pagoEm, setPagoEm] = useState(new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await registrarPagamentoManual({ data: { cobranca_id: cobranca.id, valor: Number(valor), forma, pago_em: new Date(pagoEm).toISOString(), observacoes: obs } });
      toast.success("Pagamento registrado");
      onDone();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Modal title="Registrar pagamento" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Saldo devedor: <strong className="text-foreground">{brl(restante)}</strong></p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor recebido (R$)">
            <input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
          </Field>
          <Field label="Forma">
            <select value={forma} onChange={(e) => setForma(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
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
          <input type="date" value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        </Field>
        <Field label="Observações">
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm font-semibold">Cancelar</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">
            {saving ? "Salvando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ModalPix({ cobranca, onClose, onPaid }: { cobranca: any; onClose: () => void; onPaid: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pix, setPix] = useState<any>(null);

  useEffect(() => {
    criarPixCobranca({ data: { cobranca_id: cobranca.id } })
      .then((r) => setPix(r))
      .catch((e) => setError(e.message))
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
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <div className="space-y-3">
          <p className="text-sm text-rose-600">{error}</p>
          <p className="text-xs text-muted-foreground">Configure o Mercado Pago em <strong>Pagamentos</strong> para habilitar PIX automático.</p>
        </div>
      ) : pix ? (
        <div className="space-y-4 text-center">
          {pix.qr_code_base64 && (
            <img src={`data:image/png;base64,${pix.qr_code_base64}`} alt="QR Code PIX" className="mx-auto w-56 h-56 border border-border rounded-lg" />
          )}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Copia e cola</p>
            <div className="flex gap-2">
              <input readOnly value={pix.qr_code} className="flex-1 px-2 py-2 text-xs font-mono border border-border rounded-lg bg-muted/30 truncate" />
              <button onClick={copiar} className="p-2 rounded-lg border border-border hover:bg-muted"><Copy size={16} /></button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">A cobrança será atualizada automaticamente ao receber o pagamento.</p>
          {pix.ticket_url && <a href={pix.ticket_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Abrir comprovante MP</a>}
          <button onClick={() => { onPaid(); onClose(); }} className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">Fechar</button>
        </div>
      ) : null}
    </Modal>
  );
}

// ====================== DESPESAS ======================
function DespesasTab({ condominioId }: { condominioId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const reload = () => {
    setLoading(true);
    listarDespesas({ data: { condominio_id: condominioId } }).then(setRows).finally(() => setLoading(false));
  };
  useEffect(reload, [condominioId]);

  return (
    <div>
      <div className="flex justify-end mb-5">
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90">
          <Plus size={16} /> Nova despesa
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Wallet} title="Nenhuma despesa registrada" desc="Comece a registrar os gastos do condomínio." />
      ) : (
        <div className="bg-background border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Data</th>
                <th className="text-left px-4 py-3 font-semibold">Descrição</th>
                <th className="text-left px-4 py-3 font-semibold">Categoria</th>
                <th className="text-left px-4 py-3 font-semibold">Fornecedor</th>
                <th className="text-right px-4 py-3 font-semibold">Valor</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">{dateBR(r.data)}</td>
                  <td className="px-4 py-3 font-medium">{r.descricao}</td>
                  <td className="px-4 py-3">{r.categorias_financeiras?.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.fornecedor ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-rose-600">- {brl(r.valor)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { if (confirm("Excluir despesa?")) removerDespesa({ data: { id: r.id } }).then(() => { toast.success("Excluída"); reload(); }); }} className="p-2 rounded hover:bg-muted text-rose-600">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showNew && <ModalNovaDespesa condominioId={condominioId} onClose={() => setShowNew(false)} onDone={() => { setShowNew(false); reload(); }} />}
    </div>
  );
}

function ModalNovaDespesa({ condominioId, onClose, onDone }: { condominioId: string; onClose: () => void; onDone: () => void }) {
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [fornecedor, setFornecedor] = useState("");
  const [forma, setForma] = useState<any>("pix");
  const [categoriaId, setCategoriaId] = useState("");
  const [cats, setCats] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listarCategorias({ data: { condominio_id: condominioId } }).then((cs) => setCats(cs.filter((c: any) => c.tipo === "despesa")));
  }, [condominioId]);

  const submit = async () => {
    if (!descricao || !valor) return toast.error("Preencha descrição e valor");
    setSaving(true);
    try {
      await criarDespesa({
        data: {
          condominio_id: condominioId,
          categoria_id: categoriaId || null,
          fornecedor: fornecedor || null,
          descricao, valor: Number(valor), data, forma,
        },
      });
      toast.success("Despesa registrada");
      onDone();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Modal title="Nova despesa" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Descrição"><input value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor (R$)"><input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></Field>
          <Field label="Data"><input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></Field>
        </div>
        <Field label="Categoria">
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
            <option value="">Sem categoria</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Field>
        <Field label="Fornecedor"><input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></Field>
        <Field label="Forma de pagamento">
          <select value={forma} onChange={(e) => setForma(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
            <option value="pix">PIX</option><option value="boleto">Boleto</option><option value="dinheiro">Dinheiro</option>
            <option value="transferencia">Transferência</option><option value="cartao">Cartão</option><option value="outro">Outro</option>
          </select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm font-semibold">Cancelar</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">{saving ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>
    </Modal>
  );
}

// ====================== INADIMPLENCIA ======================
function InadimplenciaTab({ condominioId }: { condominioId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("cobrancas")
      .select("*, unidades(numero, bloco)")
      .eq("condominio_id", condominioId)
      .in("status", ["pendente", "vencida", "parcial"])
      .lt("vencimento", new Date().toISOString().slice(0, 10))
      .order("vencimento", { ascending: true })
      .then(({ data }) => { setRows(data ?? []); setLoading(false); });
  }, [condominioId]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  if (rows.length === 0) return <EmptyState icon={CheckCircle2} title="Sem inadimplência 🎉" desc="Todas as cobranças estão em dia." />;

  return (
    <div className="bg-background border border-border rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-3 font-semibold">Unidade</th>
            <th className="text-left px-4 py-3 font-semibold">Vencimento</th>
            <th className="text-left px-4 py-3 font-semibold">Dias atraso</th>
            <th className="text-right px-4 py-3 font-semibold">Saldo devedor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => {
            const restante = Number(r.valor) + Number(r.multa) + Number(r.juros) - Number(r.desconto) - Number(r.valor_pago);
            const dias = Math.floor((Date.now() - new Date(r.vencimento).getTime()) / 86400000);
            return (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{r.unidades?.bloco ? `${r.unidades.bloco}-` : ""}{r.unidades?.numero}</td>
                <td className="px-4 py-3">{dateBR(r.vencimento)}</td>
                <td className="px-4 py-3"><span className="text-rose-600 font-semibold">{dias} dias</span></td>
                <td className="px-4 py-3 text-right font-mono text-rose-600">{brl(restante)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ====================== CATEGORIAS ======================
function CategoriasTab({ condominioId }: { condominioId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"receita" | "despesa">("receita");

  const reload = () => { setLoading(true); listarCategorias({ data: { condominio_id: condominioId } }).then(setRows).finally(() => setLoading(false)); };
  useEffect(reload, [condominioId]);

  const add = async () => {
    if (!nome.trim()) return;
    try {
      await criarCategoria({ data: { condominio_id: condominioId, nome: nome.trim(), tipo } });
      setNome("");
      toast.success("Categoria criada");
      reload();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="bg-background border border-border rounded-2xl p-5">
        <p className="font-semibold mb-3">Nova categoria</p>
        <div className="flex flex-wrap gap-3">
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Taxa condominial" className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-border bg-background text-sm" />
          <select value={tipo} onChange={(e) => setTipo(e.target.value as any)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm">
            <option value="receita">Receita</option><option value="despesa">Despesa</option>
          </select>
          <button onClick={add} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2"><Plus size={16} /> Adicionar</button>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Tag} title="Sem categorias" desc="Crie categorias para organizar receitas e despesas." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {rows.map((c) => (
            <div key={c.id} className="bg-background border border-border rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold">{c.nome}</p>
                <p className="text-xs text-muted-foreground capitalize">{c.tipo}</p>
              </div>
              <button onClick={() => { if (confirm("Remover categoria?")) removerCategoria({ data: { id: c.id } }).then(() => { toast.success("Removida"); reload(); }); }} className="p-2 rounded hover:bg-muted text-rose-600"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ====================== CONFIG MERCADO PAGO ======================
function ConfigTab({ condominioId }: { condominioId: string }) {
  const [cfg, setCfg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [pixChave, setPixChave] = useState("");
  const [multa, setMulta] = useState("2");
  const [juros, setJuros] = useState("0.0333");
  const [ativo, setAtivo] = useState(false);

  useEffect(() => {
    obterConfigPagamento({ data: { condominio_id: condominioId } }).then((c) => {
      setCfg(c);
      if (c) {
        setPublicKey(c.mp_public_key ?? "");
        setPixChave("");
        setMulta(String(c.multa_percentual ?? 2));
        setJuros(String(c.juros_dia_percentual ?? 0.0333));
        setAtivo(c.ativo ?? false);
      }
    }).finally(() => setLoading(false));
  }, [condominioId]);

  const save = async () => {
    setSaving(true);
    try {
      await salvarConfigPagamento({
        data: {
          condominio_id: condominioId,
          mp_access_token: token || null,
          mp_public_key: publicKey || null,
          pix_chave: pixChave || null,
          multa_percentual: Number(multa),
          juros_dia_percentual: Number(juros),
          ativo,
        },
      });
      toast.success("Configuração salva");
      setToken("");
      const c = await obterConfigPagamento({ data: { condominio_id: condominioId } });
      setCfg(c);
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/public/mp-webhook` : "/api/public/mp-webhook";

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <CreditCard className="text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold mb-1">Configure o Mercado Pago do seu condomínio</p>
            <p className="text-muted-foreground">Crie uma conta em <a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noreferrer" className="text-primary underline">mercadopago.com.br/developers</a>, gere um Access Token de produção e cole abaixo. Os pagamentos caem direto na conta do condomínio.</p>
          </div>
        </div>
      </div>

      <div className="bg-background border border-border rounded-2xl p-6 space-y-4">
        <p className="font-display text-lg font-bold">Mercado Pago</p>
        <Field label={`Access Token ${cfg?.mp_token_configured ? `(atual: ${cfg.mp_access_token})` : ""}`}>
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={cfg?.mp_token_configured ? "Deixe vazio para manter" : "APP_USR-..."} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono" />
        </Field>
        <Field label="Public Key (opcional)">
          <input value={publicKey} onChange={(e) => setPublicKey(e.target.value)} placeholder="APP_USR-..." className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono" />
        </Field>
        <Field label="Webhook URL (cole no painel do MP em Notificações)">
          <div className="flex gap-2">
            <input readOnly value={webhookUrl} className="flex-1 px-3 py-2 rounded-lg border border-border bg-muted/30 text-xs font-mono" />
            <button onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("Copiado"); }} className="p-2 rounded-lg border border-border hover:bg-muted"><Copy size={16} /></button>
          </div>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Ativar pagamentos online (PIX) para os moradores
        </label>
      </div>

      <div className="bg-background border border-border rounded-2xl p-6 space-y-4">
        <p className="font-display text-lg font-bold">Política de cobrança</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Multa por atraso (%)"><input type="number" step="0.1" value={multa} onChange={(e) => setMulta(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></Field>
          <Field label="Juros ao dia (%)"><input type="number" step="0.001" value={juros} onChange={(e) => setJuros(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></Field>
        </div>
        <Field label="Chave PIX manual (fallback)">
          <input value={pixChave} onChange={(e) => setPixChave(e.target.value)} placeholder="CNPJ, e-mail ou aleatória" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        </Field>
      </div>

      <button onClick={save} disabled={saving} className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold disabled:opacity-60">
        {saving ? "Salvando…" : "Salvar configurações"}
      </button>
    </div>
  );
}

// ====================== UI HELPERS ======================
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-background border border-border rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background">
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X size={18} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-muted-foreground uppercase mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="bg-background border border-dashed border-border rounded-2xl p-12 text-center">
      <Icon className="mx-auto text-muted-foreground mb-3" size={32} />
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{desc}</p>
    </div>
  );
}
