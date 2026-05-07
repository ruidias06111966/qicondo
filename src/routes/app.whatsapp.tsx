import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { obterConfigWA, salvarConfigWA } from "@/server/whatsapp.functions";
import { Loader2, MessageCircle, Save, Copy, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/app/whatsapp")({
  component: WhatsAppPage,
});

type Form = {
  ativo: boolean;
  phone_number_id: string;
  business_account_id: string;
  display_phone: string;
  webhook_verify_token: string;
  access_token: string;
  app_secret: string;
  saudacao: string;
  template_comunicado: string;
};

const TEMPLATE_DEFAULT = `📢 *{{condominio}}*

Novo {{categoria}} publicado:

📄 *{{titulo}}*

Acesse (link válido por 7 dias):
{{link}}

Responda *menu* para mais opções.`;

const EMPTY: Form = {
  ativo: false,
  phone_number_id: "",
  business_account_id: "",
  display_phone: "",
  webhook_verify_token: "",
  access_token: "",
  app_secret: "",
  saudacao: "Olá! 👋 Eu sou o assistente do seu condomínio. Como posso ajudar?\n\n1️⃣ 2ª via de boleto\n2️⃣ Status de reserva\n3️⃣ Abrir ocorrência",
  template_comunicado: TEMPLATE_DEFAULT,
};

function genToken() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function WhatsAppPage() {
  const { condominioId, isSindico } = useCondominioAtivo();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/public/wa-webhook`
    : "";

  useEffect(() => {
    if (!condominioId) return;
    setLoading(true);
    obterConfigWA({ data: { condominio_id: condominioId } })
      .then((cfg) => {
        if (cfg) {
          setForm({
            ativo: cfg.ativo ?? false,
            phone_number_id: cfg.phone_number_id ?? "",
            business_account_id: cfg.business_account_id ?? "",
            display_phone: cfg.display_phone ?? "",
            webhook_verify_token: cfg.webhook_verify_token ?? "",
            access_token: cfg.access_token ?? "",
            app_secret: cfg.app_secret ?? "",
            saudacao: cfg.saudacao ?? EMPTY.saudacao,
            template_comunicado: (cfg as any).template_comunicado ?? TEMPLATE_DEFAULT,
          });
        } else {
          setForm({ ...EMPTY, webhook_verify_token: genToken() });
        }
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [condominioId]);

  if (!isSindico) {
    return (
      <div className="p-6 max-w-3xl">
        <div className="rounded-lg border border-border bg-background p-6 flex gap-3">
          <AlertCircle className="text-amber-500 shrink-0" />
          <div>
            <p className="font-semibold">Acesso restrito</p>
            <p className="text-sm text-muted-foreground">Apenas síndicos podem configurar o WhatsApp.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" /> Carregando…
      </div>
    );
  }

  const update = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success("Copiado");
  };

  const save = async () => {
    if (!condominioId) return;
    if (form.ativo && (!form.phone_number_id || !form.access_token || !form.webhook_verify_token)) {
      toast.error("Preencha Phone Number ID, Access Token e Verify Token para ativar.");
      return;
    }
    setSaving(true);
    try {
      await salvarConfigWA({
        data: {
          condominio_id: condominioId,
          ativo: form.ativo,
          phone_number_id: form.phone_number_id || null,
          business_account_id: form.business_account_id || null,
          display_phone: form.display_phone || null,
          webhook_verify_token: form.webhook_verify_token || null,
          access_token: form.access_token || null,
          app_secret: form.app_secret || null,
          saudacao: form.saudacao || null,
          template_comunicado: form.template_comunicado || null,
        },
      });
      toast.success("Configuração salva");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <MessageCircle />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">WhatsApp</h1>
            <p className="text-sm text-muted-foreground">Configure a integração oficial Meta Cloud API.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-1 rounded-full ${form.ativo ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
            {form.ativo ? "Ativo" : "Inativo"}
          </span>
          <Switch checked={form.ativo} onCheckedChange={(v) => update("ativo", v)} />
        </div>
      </header>

      {/* Webhook */}
      <section className="rounded-xl border border-border bg-background p-5 space-y-4">
        <div>
          <h2 className="font-semibold flex items-center gap-2"><CheckCircle2 size={18} className="text-primary" /> Webhook</h2>
          <p className="text-xs text-muted-foreground">Use estes valores no painel da Meta &gt; Webhooks.</p>
        </div>
        <div>
          <Label className="text-xs">Callback URL</Label>
          <div className="flex gap-2 mt-1">
            <Input readOnly value={webhookUrl} className="font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={() => copy(webhookUrl)}><Copy size={14} /></Button>
          </div>
        </div>
        <div>
          <Label className="text-xs">Verify Token</Label>
          <div className="flex gap-2 mt-1">
            <Input
              value={form.webhook_verify_token}
              onChange={(e) => update("webhook_verify_token", e.target.value)}
              className="font-mono text-xs"
            />
            <Button type="button" variant="outline" size="icon" onClick={() => copy(form.webhook_verify_token)}><Copy size={14} /></Button>
            <Button type="button" variant="outline" onClick={() => update("webhook_verify_token", genToken())}>Gerar</Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Cole exatamente esse valor no campo "Verify token" da Meta.</p>
        </div>
      </section>

      {/* Credenciais */}
      <section className="rounded-xl border border-border bg-background p-5 space-y-4">
        <h2 className="font-semibold">Credenciais Meta</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="pnid">Phone Number ID *</Label>
            <Input id="pnid" value={form.phone_number_id} onChange={(e) => update("phone_number_id", e.target.value)} placeholder="123456789012345" />
          </div>
          <div>
            <Label htmlFor="waba">Business Account ID</Label>
            <Input id="waba" value={form.business_account_id} onChange={(e) => update("business_account_id", e.target.value)} placeholder="987654321098765" />
          </div>
          <div>
            <Label htmlFor="disp">Telefone exibido</Label>
            <Input id="disp" value={form.display_phone} onChange={(e) => update("display_phone", e.target.value)} placeholder="+55 11 90000-0000" />
          </div>
        </div>

        <div>
          <Label htmlFor="tok">Access Token *</Label>
          <div className="flex gap-2 mt-1">
            <Input
              id="tok"
              type={showToken ? "text" : "password"}
              value={form.access_token}
              onChange={(e) => update("access_token", e.target.value)}
              placeholder="EAAG…"
              className="font-mono text-xs"
            />
            <Button type="button" variant="outline" size="icon" onClick={() => setShowToken((v) => !v)}>
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Token permanente do System User com permissão whatsapp_business_messaging.</p>
        </div>

        <div>
          <Label htmlFor="sec">App Secret</Label>
          <div className="flex gap-2 mt-1">
            <Input
              id="sec"
              type={showSecret ? "text" : "password"}
              value={form.app_secret}
              onChange={(e) => update("app_secret", e.target.value)}
              placeholder="App Secret do app Meta"
              className="font-mono text-xs"
            />
            <Button type="button" variant="outline" size="icon" onClick={() => setShowSecret((v) => !v)}>
              {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Usado para validar a assinatura HMAC dos webhooks (recomendado).</p>
        </div>
      </section>

      {/* Bot */}
      <section className="rounded-xl border border-border bg-background p-5 space-y-3">
        <h2 className="font-semibold">Mensagem de boas-vindas</h2>
        <Textarea rows={6} value={form.saudacao} onChange={(e) => update("saudacao", e.target.value)} />
      </section>

      <div className="flex justify-end gap-2 sticky bottom-4">
        <Button onClick={save} disabled={saving} className="shadow-lg">
          {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save size={16} className="mr-2" />}
          Salvar configuração
        </Button>
      </div>
    </div>
  );
}
