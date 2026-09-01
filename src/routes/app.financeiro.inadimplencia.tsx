import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { supabase } from "@/integrations/supabase/client";
import { brl, dateBR } from "@/lib/format";
import { EmptyState } from "@/components/financeiro/ui";
import { emitChanged } from "@/lib/safe-call";
import { enviarLembretesInadimplencia } from "@/lib/financeiro.functions";
import { toast } from "sonner";
import { Loader2, CheckCircle2, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/app/financeiro/inadimplencia")({
  head: () => ({ meta: [{ title: "Inadimplência — Financeiro" }] }),
  component: InadimplenciaPage,
});

function InadimplenciaPage() {
  const { condominioId } = useCondominioAtivo();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const reload = () => {
    if (!condominioId) return;
    setLoading(true);
    supabase
      .from("cobrancas")
      .select("*, unidades(numero, bloco)")
      .eq("condominio_id", condominioId)
      .in("status", ["pendente", "vencida", "parcial"])
      .lt("vencimento", new Date().toISOString().slice(0, 10))
      .order("vencimento", { ascending: true })
      .then(({ data }) => {
        setRows(data ?? []);
        setLoading(false);
      });
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
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar lembretes");
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
      <div className="flex items-center gap-3 mb-4">
        <p className="text-sm text-muted-foreground">
          {sel.size > 0 ? `${sel.size} selecionada(s)` : `${rows.length} em atraso`}
        </p>
        <div className="flex-1" />
        <button
          onClick={enviarLembretes}
          disabled={sending || sel.size === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold text-sm disabled:opacity-50"
        >
          <MessageCircle size={16} />
          {sending ? "Enviando…" : "Enviar lembrete WhatsApp"}
        </button>
      </div>
      <div className="bg-background border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={sel.size === rows.length && rows.length > 0}
                  onChange={toggleAll}
                />
              </th>
              <th className="text-left px-4 py-3 font-semibold">Unidade</th>
              <th className="text-left px-4 py-3 font-semibold">Vencimento</th>
              <th className="text-left px-4 py-3 font-semibold">Dias atraso</th>
              <th className="text-right px-4 py-3 font-semibold">Saldo devedor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const restante =
                Number(r.valor) +
                Number(r.multa) +
                Number(r.juros) -
                Number(r.desconto) -
                Number(r.valor_pago);
              const dias = Math.floor(
                (Date.now() - new Date(r.vencimento).getTime()) / 86400000,
              );
              return (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
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
                    <span className="text-rose-600 font-semibold">{dias} dias</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-rose-600">
                    {brl(restante)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
