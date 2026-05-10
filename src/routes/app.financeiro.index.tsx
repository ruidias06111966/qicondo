import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { resumoFinanceiro, exportarRelatorioFinanceiro } from "@/server/financeiro.functions";
import { brl } from "@/lib/format";
import { Stat, safeCall } from "@/components/financeiro/ui";
import { baixarCSV, abrirPDF } from "@/lib/exportar-relatorio";
import { toast } from "sonner";
import {
  Wallet, TrendingUp, TrendingDown, AlertTriangle, FileText, Loader2, Download, Printer,
} from "lucide-react";

export const Route = createFileRoute("/app/financeiro/")({
  head: () => ({ meta: [{ title: "Financeiro — Visão geral" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { condominioId } = useCondominioAtivo();
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [resumo, setResumo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<null | "csv" | "pdf">(null);

  const reload = () => {
    if (!condominioId) return;
    setLoading(true);
    safeCall(resumoFinanceiro({ data: { condominio_id: condominioId, mes } }))
      .then((r) => setResumo(r))
      .finally(() => setLoading(false));
  };

  useEffect(reload, [condominioId, mes]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = () => reload();
    window.addEventListener("categorias:changed", h);
    return () => window.removeEventListener("categorias:changed", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominioId, mes]);

  const exportar = async (tipo: "csv" | "pdf") => {
    if (!condominioId || exporting) return;
    setExporting(tipo);
    const rel = await safeCall(
      exportarRelatorioFinanceiro({ data: { condominio_id: condominioId, mes } }),
    );
    setExporting(null);
    if (!rel) return;
    if (tipo === "csv") {
      baixarCSV(rel as any);
      toast.success("CSV exportado");
    } else {
      abrirPDF(rel as any);
      toast.success("Relatório aberto — use Imprimir para salvar em PDF");
    }
  };

  if (!condominioId) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">Competência</p>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </div>
        <div className="flex-1" />
        <button
          onClick={() => exportar("csv")}
          disabled={!!exporting}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm font-semibold hover:bg-muted disabled:opacity-60"
        >
          {exporting === "csv" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          CSV
        </button>
        <button
          onClick={() => exportar("pdf")}
          disabled={!!exporting}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm font-semibold hover:bg-muted disabled:opacity-60"
        >
          {exporting === "pdf" ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
          PDF
        </button>
      </div>

      {loading || !resumo ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
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
              <p className="text-sm text-muted-foreground mt-1">
                {resumo.qtdInadimplentes} cobrança(s) vencida(s)
              </p>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
              <p className="text-sm font-semibold text-primary uppercase mb-2">Dica</p>
              <p className="text-sm">
                Configure o Mercado Pago em <strong>Pagamentos</strong> para gerar PIX automático
                e o morador pagar direto pelo WhatsApp.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
