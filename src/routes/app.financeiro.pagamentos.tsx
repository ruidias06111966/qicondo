import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { supabase } from "@/integrations/supabase/client";
import {
  obterConfigPagamento,
  salvarConfigPagamento,
  executarAutomacaoLembretes,
} from "@/server/financeiro.functions";
import { brl, dateBR } from "@/lib/format";
import { Field, EmptyState, safeCall } from "@/components/financeiro/ui";
import { toast } from "sonner";
import { CreditCard, Loader2, Save, CheckCircle2, MessageCircle, Send } from "lucide-react";

export const Route = createFileRoute("/app/financeiro/pagamentos")({
  head: () => ({ meta: [{ title: "Pagamentos — Financeiro" }] }),
  component: PagamentosPage,
});

function PagamentosPage() {
  const { condominioId } = useCondominioAtivo();
  const [tab, setTab] = useState<"recebidos" | "config" | "automacao">("recebidos");

  if (!condominioId) return null;

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "recebidos", label: "Recebidos" },
    { id: "config", label: "Configuração PIX/Mercado Pago" },
    { id: "automacao", label: "Automação WhatsApp" },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "recebidos" && <PagamentosRecebidos condominioId={condominioId} />}
      {tab === "config" && <ConfigPagamento condominioId={condominioId} />}
      {tab === "automacao" && <AutomacaoWhatsApp condominioId={condominioId} />}
    </div>
  );
}

function PagamentosRecebidos({ condominioId }: { condominioId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("pagamentos")
      .select("*, cobrancas(competencia, unidades(numero, bloco))")
      .eq("condominio_id", condominioId)
      .order("pago_em", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setRows(data ?? []);
        setLoading(false);
      });
  }, [condominioId]);

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  if (rows.length === 0)
    return (
      <EmptyState
        icon={CreditCard}
        title="Nenhum pagamento registrado"
        desc="Os pagamentos aparecerão aqui assim que forem recebidos."
      />
    );

  const total = rows.reduce((s, r) => s + Number(r.valor), 0);

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        Total recebido: <strong className="text-foreground font-mono">{brl(total)}</strong> em {rows.length} pagamento(s)
      </p>
      <div className="bg-background border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Data</th>
              <th className="text-left px-4 py-3 font-semibold">Unidade</th>
              <th className="text-left px-4 py-3 font-semibold">Forma</th>
              <th className="text-right px-4 py-3 font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const u = r.cobrancas?.unidades;
              return (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">{dateBR(r.pago_em)}</td>
                  <td className="px-4 py-3 font-medium">
                    {u ? `${u.bloco ? u.bloco + "-" : ""}${u.numero}` : "—"}
                  </td>
                  <td className="px-4 py-3 capitalize">{r.forma}</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-600">
                    {brl(r.valor)}
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

function ConfigPagamento({ condominioId }: { condominioId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<any>(null);
  const [token, setToken] = useState("");
  const [pubKey, setPubKey] = useState("");
  const [pixChave, setPixChave] = useState("");
  const [multa, setMulta] = useState("2");
  const [juros, setJuros] = useState("0.033");
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    safeCall(obterConfigPagamento({ data: { condominio_id: condominioId } }))
      .then((r) => {
        setCfg(r);
        if (r) {
          setMulta(String(r.multa_percentual ?? 2));
          setJuros(String(r.juros_dia_percentual ?? 0.033));
          setAtivo(r.ativo ?? true);
        }
      })
      .finally(() => setLoading(false));
  }, [condominioId]);

  const submit = async () => {
    setSaving(true);
    const r = await safeCall(
      salvarConfigPagamento({
        data: {
          condominio_id: condominioId,
          mp_access_token: token || null,
          mp_public_key: pubKey || null,
          mp_webhook_secret: null,
          pix_chave: pixChave || null,
          multa_percentual: Number(multa),
          juros_dia_percentual: Number(juros),
          ativo,
        },
      }),
    );
    setSaving(false);
    if (r) {
      toast.success("Configuração salva");
      setToken("");
      setPubKey("");
      setPixChave("");
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="bg-background border border-border rounded-2xl p-6 max-w-2xl space-y-5">
      <div>
        <p className="font-semibold mb-1">Mercado Pago (PIX automático)</p>
        <p className="text-sm text-muted-foreground">
          Configure suas credenciais para gerar QR Code PIX direto no app.
        </p>
      </div>

      {cfg?.mp_token_configured && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
          <CheckCircle2 size={16} /> Token Mercado Pago já configurado.
        </div>
      )}

      <Field label="Access Token Mercado Pago (deixe em branco para manter)">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="APP_USR-..."
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
        />
      </Field>
      <Field label="Public Key">
        <input
          value={pubKey}
          onChange={(e) => setPubKey(e.target.value)}
          placeholder={cfg?.mp_public_key ?? ""}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
        />
      </Field>

      <div className="border-t border-border pt-5">
        <p className="font-semibold mb-3">Cobrança</p>
        <div className="space-y-3">
          <Field label="Chave PIX manual (caso não use Mercado Pago)">
            <input
              value={pixChave}
              onChange={(e) => setPixChave(e.target.value)}
              placeholder={cfg?.pix_chave_mascarada ?? "CPF, e-mail, telefone ou aleatória"}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Multa por atraso (%)">
              <input
                type="number"
                step="0.01"
                value={multa}
                onChange={(e) => setMulta(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </Field>
            <Field label="Juros ao dia (%)">
              <input
                type="number"
                step="0.001"
                value={juros}
                onChange={(e) => setJuros(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
            />
            Cobranças ativas
          </label>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={submit}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
        >
          <Save size={16} /> {saving ? "Salvando…" : "Salvar configuração"}
        </button>
      </div>
    </div>
  );
}
