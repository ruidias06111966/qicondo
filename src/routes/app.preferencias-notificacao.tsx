import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/app/preferencias-notificacao")({
  component: PreferenciasPage,
});

type Prefs = {
  receber_comunicados: boolean;
  receber_cobrancas: boolean;
  receber_visitantes: boolean;
  receber_encomendas: boolean;
};

const DEFAULT: Prefs = {
  receber_comunicados: true,
  receber_cobrancas: true,
  receber_visitantes: true,
  receber_encomendas: true,
};

const ITENS: { key: keyof Prefs; titulo: string; desc: string }[] = [
  { key: "receber_comunicados", titulo: "Comunicados e informativos", desc: "Atas, convenção, avisos do síndico." },
  { key: "receber_cobrancas", titulo: "Cobranças e boletos", desc: "Lembretes de vencimento e 2ª via." },
  { key: "receber_visitantes", titulo: "Visitantes", desc: "Avisos de chegada e autorização." },
  { key: "receber_encomendas", titulo: "Encomendas", desc: "Aviso quando há encomendas para retirada." },
];

function PreferenciasPage() {
  const { user } = useAuth();
  const { condominioId } = useCondominioAtivo();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);

  useEffect(() => {
    if (!user || !condominioId) return;
    setLoading(true);
    supabase
      .from("wa_preferencias")
      .select("receber_comunicados, receber_cobrancas, receber_visitantes, receber_encomendas")
      .eq("user_id", user.id)
      .eq("condominio_id", condominioId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPrefs(data as Prefs);
        else setPrefs(DEFAULT);
      })
      .then(() => setLoading(false));
  }, [user, condominioId]);

  const salvar = async () => {
    if (!user || !condominioId) return;
    setSaving(true);
    const { error } = await supabase
      .from("wa_preferencias")
      .upsert(
        { user_id: user.id, condominio_id: condominioId, ...prefs },
        { onConflict: "user_id,condominio_id" },
      );
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Preferências salvas");
  };

  if (!user || !condominioId) {
    return <div className="p-6 text-muted-foreground">Selecione um condomínio.</div>;
  }
  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Bell />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold">Notificações por WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Escolha o que deseja receber. Você pode mudar a qualquer momento.</p>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-background divide-y divide-border">
        {ITENS.map((it) => (
          <div key={it.key} className="p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">{it.titulo}</p>
              <p className="text-xs text-muted-foreground">{it.desc}</p>
            </div>
            <Switch
              checked={prefs[it.key]}
              onCheckedChange={(v) => setPrefs((p) => ({ ...p, [it.key]: v }))}
            />
          </div>
        ))}
      </section>

      <div className="flex justify-end">
        <Button onClick={salvar} disabled={saving}>
          {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save size={16} className="mr-2" />}
          Salvar preferências
        </Button>
      </div>
    </div>
  );
}
