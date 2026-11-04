import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { supabase } from "@/integrations/supabase/client";
import { brl, dateBR } from "@/lib/format";
import { EmptyState } from "@/components/financeiro/ui";
import { emitChanged } from "@/lib/safe-call";
import {
  enviarLembretesInadimplencia,
  recalcularEncargos,
  relatorioInadimplencia,
  type LinhaInadimplencia,
} from "@/lib/financeiro.functions";
import { toast } from "sonner";
import { Loader2, CheckCircle2, MessageCircle, RefreshCw } from "lucide-react";
import { diasAtraso, hojeSP } from "@/lib/atraso";

export const Route = createFileRoute("/app/financeiro/inadimplencia")({
  head: () => ({ meta: [{ title: "Inadimplência — Financeiro" }] }),
  component: InadimplenciaPage,
});

type Cobranca = {
  id: string;
  vencimento: string;
  valor: number;
  multa: number;
  juros: number;
  desconto: number;
  valor_pago: number;
  unidades: { numero: string; bloco: string | null } | null;
};

function InadimplenciaPage() {
  const { condominioId } = useCondominioAtivo();
  const [vista, setVista] = useState<"unidade" | "cobranca">("unidade");
  const [rows, setRows] = useState<Cobranca[]>([]);
  const [porUnidade, setPorUnidade] = useState<LinhaInadimplencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [recalculando, setRecalculando] = useState(false);

  const reload = useCallback(() => {
    if (!condominioId) return;
    setLoading(true);
    Promise.all([
      supabase
        .from("cobrancas")
        .select(
          "id, vencimento, valor, multa, juros, desconto, valor_pago, unidades(numero, bloco)",
        )
        .eq("condominio_id", condominioId)
        .in("status", ["pendente", "vencida", "parcial"])
        .lt("vencimento", hojeSP())
        .order("vencimento", { ascending: true }),
      relatorioInadimplencia({ data: { condominio_id: condominioId } }).catch(() => null),
    ]).then(([cobrancas, relatorio]) => {
      setRows((cobrancas.data ?? []) as unknown as Cobranca[]);
      setPorUnidade(relatorio?.linhas ?? []);
      setLoading(false);
    });
  }, [condominioId]);

  useEffect(reload, [reload]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = () => reload();
    window.addEventListener("cobrancas:changed", h);
    window.addEventListener("pagamentos:changed", h);
    return () => {
      window.removeEventListener("cobrancas:changed", h);
      window.removeEventListener("pagamentos:changed", h);
    };
  }, [reload]);

  const totais = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          principal:
            acc.principal +
            Math.max(Number(r.valor) - Number(r.desconto) - Number(r.valor_pago), 0),
          multa: acc.multa + Number(r.multa),
          juros: acc.juros + Number(r.juros),
          total:
            acc.total +
            Number(r.valor) +
            Number(r.multa) +
            Number(r.juros) -
            Number(r.desconto) -
            Number(r.valor_pago),
        }),
        { principal: 0, multa: 0, juros: 0, total: 0 },
      ),
    [rows],
  );

  const toggle = (id: string) => {
    const n = new Set(sel);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSel(n);
  };
  const toggleAll = () => {
    if (sel.size === rows.length) setSel(new Set());
    else setSel(new Set(rows.map((r) => r.id)));
  };

  const recalcular = async () => {
    if (!condominioId || recalculando) return;
    setRecalculando(true);
    try {
      const r = await recalcularEncargos({ data: { condominio_id: condominioId } });
      toast.success(
        r.cobrancas > 0
          ? `Multa e juros actualizados em ${r.cobrancas} cobrança(s)`
          : "Já estava tudo em dia — nenhuma cobrança mudou",
      );
      emitChanged("cobrancas:changed");
      reload();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Erro ao recalcular encargos");
    } finally {
      setRecalculando(false);
    }
  };

  const enviarLembretes = async () => {
    if (sel.size === 0) return toast.error("Selecione ao menos uma cobrança");
    setSending(true);
    try {
      const r = await enviarLembretesInadimplencia({
        data: { condominio_id: condominioId, cobranca_ids: Array.from(sel) },
      });
      toast.success(`${r.enfileirados} lembrete(s) enfileirados via WhatsApp`);
      if (r.falhas > 0) {
        toast.warning(`${r.falhas} cobrança(s) não puderam ser processadas`);
      }
      emitChanged("wa:changed");
      setSel(new Set());
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Erro ao enviar lembretes");
    } finally {
      setSending(false);
    }
  };

  if (!condominioId) return null;
  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  if (rows.length === 0)
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Sem inadimplência 🎉"
        desc="Todas as cobranças estão em dia."
      />
    );

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-4 mb-5">
        <Cartao rotulo="Principal em aberto" valor={totais.principal} />
        <Cartao rotulo="Multa" valor={totais.multa} />
        <Cartao rotulo="Juros" valor={totais.juros} />
        <Cartao rotulo="Total devido" valor={totais.total} destaque />
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="inline-flex rounded-lg border border-border overflow-hidden text-sm">
          <button
            onClick={() => setVista("unidade")}
            className={`px-3 py-1.5 font-semibold ${vista === "unidade" ? "bg-muted" : ""}`}
          >
            Por unidade
          </button>
          <button
            onClick={() => setVista("cobranca")}
            className={`px-3 py-1.5 font-semibold border-l border-border ${
              vista === "cobranca" ? "bg-muted" : ""
            }`}
          >
            Por cobrança
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          {vista === "cobranca" && sel.size > 0
            ? `${sel.size} selecionada(s)`
            : `${rows.length} cobrança(s) em atraso · ${porUnidade.length || "—"} unidade(s)`}
        </p>
        <div className="flex-1" />
        <button
          onClick={recalcular}
          disabled={recalculando}
          title="Recalcula multa e juros até hoje. O agendamento diário já faz isto de madrugada."
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border font-semibold text-sm disabled:opacity-50"
        >
          <RefreshCw size={16} className={recalculando ? "animate-spin" : ""} />
          {recalculando ? "Recalculando…" : "Recalcular encargos"}
        </button>
        {vista === "cobranca" && (
          <button
            onClick={enviarLembretes}
            disabled={sending || sel.size === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold text-sm disabled:opacity-50"
          >
            <MessageCircle size={16} />
            {sending ? "Enviando…" : "Enviar lembrete WhatsApp"}
          </button>
        )}
      </div>

      <div className="bg-background border border-border rounded-2xl overflow-x-auto">
        {vista === "unidade" ? (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Unidade</th>
                <th className="text-left px-4 py-3 font-semibold">Cobranças</th>
                <th className="text-left px-4 py-3 font-semibold">Atraso máx.</th>
                <th className="text-right px-4 py-3 font-semibold">Principal</th>
                <th className="text-right px-4 py-3 font-semibold">Multa</th>
                <th className="text-right px-4 py-3 font-semibold">Juros</th>
                <th className="text-right px-4 py-3 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {porUnidade.map((l) => (
                <tr key={l.unidade_id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    {l.bloco ? `${l.bloco}-` : ""}
                    {l.numero}
                  </td>
                  <td className="px-4 py-3">{l.cobrancas}</td>
                  <td className="px-4 py-3">
                    <span className="text-rose-600 font-semibold">{l.dias_atraso_max} dias</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      desde {dateBR(l.vencimento_mais_antigo)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{brl(l.principal)}</td>
                  <td className="px-4 py-3 text-right font-mono">{brl(l.multa)}</td>
                  <td className="px-4 py-3 text-right font-mono">{brl(l.juros)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-rose-600">
                    {brl(l.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todas"
                    checked={sel.size === rows.length && rows.length > 0}
                    onChange={toggleAll}
                  />
                </th>
                <th className="text-left px-4 py-3 font-semibold">Unidade</th>
                <th className="text-left px-4 py-3 font-semibold">Vencimento</th>
                <th className="text-left px-4 py-3 font-semibold">Dias atraso</th>
                <th className="text-right px-4 py-3 font-semibold">Principal</th>
                <th className="text-right px-4 py-3 font-semibold">Multa</th>
                <th className="text-right px-4 py-3 font-semibold">Juros</th>
                <th className="text-right px-4 py-3 font-semibold">Saldo devedor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const principal = Math.max(
                  Number(r.valor) - Number(r.desconto) - Number(r.valor_pago),
                  0,
                );
                const restante =
                  Number(r.valor) +
                  Number(r.multa) +
                  Number(r.juros) -
                  Number(r.desconto) -
                  Number(r.valor_pago);
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Selecionar cobrança de ${r.unidades?.numero ?? "unidade"}`}
                        checked={sel.has(r.id)}
                        onChange={() => toggle(r.id)}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {r.unidades?.bloco ? `${r.unidades.bloco}-` : ""}
                      {r.unidades?.numero}
                    </td>
                    <td className="px-4 py-3">{dateBR(r.vencimento)}</td>
                    <td className="px-4 py-3">
                      <span className="text-rose-600 font-semibold">
                        {diasAtraso(r.vencimento)} dias
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{brl(principal)}</td>
                    <td className="px-4 py-3 text-right font-mono">{brl(Number(r.multa))}</td>
                    <td className="px-4 py-3 text-right font-mono">{brl(Number(r.juros))}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-rose-600">
                      {brl(restante)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {totais.multa === 0 && totais.juros === 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          Multa e juros estão a zero em todas as cobranças. O cálculo corre todas as noites; se
          estas cobranças acabaram de ser lançadas, use «Recalcular encargos». As taxas vêm de
          Financeiro → Configuração (por omissão 2% de multa e 0,0333% ao dia).
        </p>
      )}
    </div>
  );
}

function Cartao({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: number;
  destaque?: boolean;
}) {
  return (
    <div className="border border-border rounded-xl p-4">
      <p className="text-xs uppercase text-muted-foreground font-semibold">{rotulo}</p>
      <p className={`font-mono text-lg mt-1 ${destaque ? "text-rose-600 font-bold" : ""}`}>
        {brl(valor)}
      </p>
    </div>
  );
}
