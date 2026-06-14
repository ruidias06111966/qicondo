import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { condominioSchema } from "@/auth/validators";
import { generateCondoCode } from "@/lib/code";
import { Logo } from "@/components/site/Logo";
import { Building2, Users, Sparkles, ArrowRight, Loader2, LogOut } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Bem-vindo — QiCond" }] }),
  component: OnboardingPage,
});

type Step = "intro" | "criar" | "entrar" | "criar-unidades" | "pronto";

function OnboardingPage() {
  const navigate = useNavigate();
  const { user, loading, hasAnyRole, profile, refresh, signOut } = useAuth();
  const [step, setStep] = useState<Step>("intro");
  const [condId, setCondId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // form criar empresa
  const [cond, setCond] = useState({ nome: "", cnpj: "", endereco: "", cidade: "", estado: "", cep: "", whatsapp_numero: "" });
  const [responsavel, setResponsavel] = useState("");
  const [telefoneResp, setTelefoneResp] = useState("");
  const [plano, setPlano] = useState<"basico" | "profissional" | "enterprise">("basico");
  // entrar com código
  const [codigo, setCodigo] = useState("");
  // unidades
  const [qtd, setQtd] = useState(10);
  const [taxa, setTaxa] = useState("");

  // Pré-preencher responsável/telefone a partir do perfil
  useEffect(() => {
    if (profile?.nome_completo && !responsavel) setResponsavel(profile.nome_completo);
    if (profile?.telefone && !telefoneResp) setTelefoneResp(profile.telefone);
  }, [profile]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth/login" });
    if (!loading && user && hasAnyRole) navigate({ to: "/app" });
  }, [loading, user, hasAnyRole, navigate]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  async function criarCondominio() {
    const parsed = condominioSchema.safeParse(cond);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (!responsavel.trim()) { toast.error("Informe o nome do responsável"); return; }
    setBusy(true);
    // garante sessão hidratada antes do RPC
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      setBusy(false);
      toast.error("Sessão expirada. Faça login novamente.");
      navigate({ to: "/auth/login" });
      return;
    }
    // Actualiza perfil do responsável
    await supabase.from("profiles").update({
      nome_completo: responsavel.trim(),
      telefone: telefoneResp.trim() || null,
    }).eq("id", user!.id);

    const codigo_publico = generateCondoCode();
    const { data: novoId, error } = await supabase.rpc("criar_condominio", {
      _nome: parsed.data.nome,
      _cnpj: parsed.data.cnpj || "",
      _endereco: parsed.data.endereco || "",
      _cidade: parsed.data.cidade || "",
      _estado: parsed.data.estado || "",
      _cep: parsed.data.cep || "",
      _whatsapp_numero: parsed.data.whatsapp_numero || "",
      _codigo_publico: codigo_publico,
    });
    if (error || !novoId) { setBusy(false); toast.error(error?.message ?? "Falha"); return; }
    // Nota: o plano é atribuído pelo administrador da plataforma após contratação.
    setBusy(false);
    setCondId(novoId as string);
    await refresh();
    toast.success("Empresa cadastrada!");
    setStep("criar-unidades");
  }

  async function criarUnidades() {
    if (!condId) return;
    if (qtd < 1 || qtd > 200) { toast.error("Entre 1 e 200 unidades"); return; }
    setBusy(true);
    const taxaNum = taxa ? Number(taxa.replace(",", ".")) : null;
    const rows = Array.from({ length: qtd }, (_, i) => ({
      condominio_id: condId,
      numero: String(i + 1).padStart(2, "0"),
      taxa_mensal: taxaNum,
    }));
    const { error } = await supabase.from("unidades").insert(rows);
    if (!error) {
      await supabase.from("condominios").update({ total_unidades: qtd }).eq("id", condId);
    }
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${qtd} unidades criadas`);
    await refresh();
    setStep("pronto");
  }

  async function entrarComCodigo() {
    if (!codigo.trim()) { toast.error("Informe o código"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("join_condominio_by_code", { _codigo: codigo.trim() });
    setBusy(false);
    if (error) {
      const msg = error.message.includes("codigo_nao_encontrado") ? "Código não encontrado" : error.message;
      toast.error(msg);
      return;
    }
    const nome = (data as Array<{ nome: string }> | null)?.[0]?.nome ?? "empresa";
    toast.success(`Bem-vindo a ${nome}!`);
    await refresh();
    navigate({ to: "/app" });
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="h-16 px-6 flex items-center justify-between border-b border-border bg-background">
        <Logo />
        <button onClick={() => signOut().then(() => navigate({ to: "/" }))} className="text-sm text-muted-foreground flex items-center gap-2 hover:text-foreground">
          <LogOut size={16} /> Sair
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        {step === "intro" && (
          <div>
            <p className="text-sm text-muted-foreground">Olá, {(profile?.nome_completo || user.email || "").split(" ")[0]}</p>
            <h1 className="font-display text-4xl font-extrabold mt-2">Como vai usar o QiCond?</h1>
            <p className="mt-3 text-muted-foreground">Escolha o ponto de partida. Pode sempre adicionar mais empresas ou aceitar novos convites depois.</p>

            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              <button onClick={() => setStep("criar")} className="text-left p-6 rounded-2xl border-2 border-border hover:border-primary bg-background transition-colors group">
                <div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center"><Building2 size={20} /></div>
                <h3 className="mt-4 font-display font-bold text-lg">Cadastrar a minha empresa</h3>
                <p className="mt-1 text-sm text-muted-foreground">Crio a empresa e fico como Administrador. Depois convido a equipa.</p>
                <span className="mt-3 inline-flex items-center text-sm text-primary font-semibold group-hover:gap-2 gap-1 transition-all">Começar <ArrowRight size={14} /></span>
              </button>

              <button onClick={() => setStep("entrar")} className="text-left p-6 rounded-2xl border-2 border-border hover:border-primary bg-background transition-colors group">
                <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Users size={20} /></div>
                <h3 className="mt-4 font-display font-bold text-lg">Entrar com código</h3>
                <p className="mt-1 text-sm text-muted-foreground">Já tenho o código público partilhado pelo Administrador da empresa.</p>
                <span className="mt-3 inline-flex items-center text-sm text-primary font-semibold group-hover:gap-2 gap-1 transition-all">Entrar <ArrowRight size={14} /></span>
              </button>
            </div>
          </div>
        )}

        {step === "criar" && (
          <Card title="Dados da empresa" subtitle="Pode editar tudo depois em Empresa.">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Nome da empresa*" value={cond.nome} onChange={(v) => setCond({ ...cond, nome: v })} className="sm:col-span-2" />
              <Input label="CNPJ" value={cond.cnpj} onChange={(v) => setCond({ ...cond, cnpj: v })} />
              <Input label="WhatsApp da empresa" value={cond.whatsapp_numero} onChange={(v) => setCond({ ...cond, whatsapp_numero: v })} />
              <Input label="Responsável*" value={responsavel} onChange={setResponsavel} placeholder="Nome do administrador" />
              <Input label="Telefone do responsável" value={telefoneResp} onChange={setTelefoneResp} placeholder="+5511999990000" />
              <Input label="Endereço" value={cond.endereco} onChange={(v) => setCond({ ...cond, endereco: v })} className="sm:col-span-2" />
              <Input label="Cidade" value={cond.cidade} onChange={(v) => setCond({ ...cond, cidade: v })} />
              <Input label="UF" maxLength={2} value={cond.estado} onChange={(v) => setCond({ ...cond, estado: v.toUpperCase() })} />
              <Input label="CEP" value={cond.cep} onChange={(v) => setCond({ ...cond, cep: v })} />
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Plano pretendido*</label>
                <div className="mt-2 grid sm:grid-cols-3 gap-2">
                  {([
                    { id: "basico", nome: "Básico", desc: "Utilizadores ilimitados" },
                    { id: "profissional", nome: "Profissional", desc: "Utilizadores ilimitados" },
                    { id: "enterprise", nome: "Enterprise", desc: "Multi-empresa · ilimitado" },
                  ] as const).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlano(p.id)}
                      className={`text-left p-3 rounded-lg border-2 transition ${plano === p.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                    >
                      <p className="font-semibold text-sm">{p.nome}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
                      <p className="text-xs text-primary mt-1 font-medium">Sob consulta</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Ficará automaticamente registado como <b>Administrador</b> desta empresa. Depois convida a equipa em <b>Utilizadores</b>.
            </p>
            <Actions>
              <button onClick={() => setStep("intro")} className="btn-ghost">Voltar</button>
              <button onClick={criarCondominio} disabled={busy} className="btn-primary">
                {busy && <Loader2 size={16} className="animate-spin" />} Continuar
              </button>
            </Actions>
          </Card>
        )}

        {step === "criar-unidades" && (
          <Card title="Unidades do condomínio" subtitle="Quantas unidades existem? Você pode editar valores e blocos depois.">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Quantidade*" type="number" value={String(qtd)} onChange={(v) => setQtd(Number(v) || 0)} />
              <Input label="Taxa mensal padrão (R$)" placeholder="350,00" value={taxa} onChange={setTaxa} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Vamos criar unidades numeradas de 01 até {String(qtd).padStart(2, "0")}.</p>
            <Actions>
              <button onClick={() => setStep("pronto")} className="btn-ghost">Pular por agora</button>
              <button onClick={criarUnidades} disabled={busy} className="btn-primary">
                {busy && <Loader2 size={16} className="animate-spin" />} Criar unidades
              </button>
            </Actions>
          </Card>
        )}

        {step === "entrar" && (
          <Card title="Entrar com código" subtitle="Use o código público partilhado pelo Administrador (ex: COND-A1B2C3).">
            <Input label="Código da empresa" value={codigo} onChange={(v) => setCodigo(v.toUpperCase())} placeholder="COND-XXXXXX" />
            <p className="mt-3 text-xs text-muted-foreground">
              Não tem código? Peça ao Administrador para enviar um <b>link de convite</b> com o seu perfil já definido.
            </p>
            <Actions>
              <button onClick={() => setStep("intro")} className="btn-ghost">Voltar</button>
              <button onClick={entrarComCodigo} disabled={busy} className="btn-primary">
                {busy && <Loader2 size={16} className="animate-spin" />} Entrar
              </button>
            </Actions>
          </Card>
        )}

        {step === "pronto" && (
          <Card title="Tudo pronto!" subtitle="A sua empresa já está no QiCond.">
            <div className="flex items-start gap-3 p-4 bg-primary/5 rounded-lg">
              <Sparkles className="text-primary shrink-0" />
              <div className="text-sm">
                <p className="font-semibold">Próximos passos sugeridos</p>
                <ul className="mt-2 list-disc pl-5 text-muted-foreground space-y-1">
                  <li>Convidar a equipa em <b>Utilizadores</b></li>
                  <li>Configurar dados bancários em <b>Financeiro → Pagamentos</b></li>
                  <li>Ligar o WhatsApp oficial</li>
                </ul>
              </div>
            </div>
            <Actions>
              <button onClick={async () => { await refresh(); navigate({ to: "/app" }); }} className="btn-primary">Ir para o painel <ArrowRight size={16} /></button>
            </Actions>
          </Card>
        )}
      </main>

      <style>{`
        .btn-primary{display:inline-flex;align-items:center;gap:.5rem;background:var(--color-primary);color:var(--color-primary-foreground);font-weight:600;font-size:.875rem;padding:.625rem 1rem;border-radius:.5rem;}
        .btn-primary:hover{background:var(--color-primary-deep);}
        .btn-primary:disabled{opacity:.6;}
        .btn-ghost{font-weight:600;font-size:.875rem;padding:.625rem 1rem;color:var(--color-muted-foreground);}
        .btn-ghost:hover{color:var(--color-foreground);}
      `}</style>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-background border border-border rounded-2xl p-6 sm:p-8">
      <h1 className="font-display text-2xl font-extrabold">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex items-center justify-end gap-3">{children}</div>;
}

function Input({ label, value, onChange, type = "text", placeholder, maxLength, className = "" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; maxLength?: number; className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );
}
