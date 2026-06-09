import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { safeCall } from "@/lib/safe-call";
import { Users, Mail, Loader2, Plus, Copy, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/app/moradores")({
  head: () => ({ meta: [{ title: "Utilizadores — QiCond" }] }),
  component: MoradoresPage,
});

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  sindico: "Síndico (legado)",
  financeiro: "Financeiro",
  contador: "Contador",
  gestor: "Gestor",
  vendedor: "Vendedor",
  comercial: "Comercial",
  consulta: "Consulta",
  porteiro: "Porteiro",
  morador: "Morador",
};

type Membro = { user_id: string; role: string; nome: string | null; telefone: string | null; email: string | null };

function MoradoresPage() {
  const { condominioId, isSindico } = useCondominioAtivo();
  const [loading, setLoading] = useState(true);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [convites, setConvites] = useState<any[]>([]);
  const [plano, setPlano] = useState<string>("basico");
  const [limite, setLimite] = useState<number | null>(3);
  const [usados, setUsados] = useState<number>(0);

  // form convite
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [role, setRole] = useState("morador");
  const [enviando, setEnviando] = useState(false);
  const [filtroEquipe, setFiltroEquipe] = useState(true);

  const carregar = async () => {
    if (!condominioId) return;
    setLoading(true);
    const rolesRes = await safeCall(supabase
      .from("user_roles")
      .select("user_id, role")
      .eq("condominio_id", condominioId));
    const roles = rolesRes?.data ?? [];
    const ids = roles.map((r) => r.user_id);
    const profsRes = ids.length
      ? await safeCall(supabase.from("profiles").select("id, nome_completo, telefone").in("id", ids))
      : null;
    const profs = profsRes?.data ?? [];
    const merged: Membro[] = roles.map((r) => {
      const p = profs.find((x: any) => x.id === r.user_id);
      return { user_id: r.user_id, role: r.role, nome: p?.nome_completo ?? null, telefone: p?.telefone ?? null, email: null };
    });
    setMembros(merged);

    const cRes = await safeCall(supabase
      .from("convites")
      .select("id, email, nome, role, status, expira_em, token, created_at")
      .eq("condominio_id", condominioId)
      .order("created_at", { ascending: false }));
    setConvites(cRes?.data ?? []);

    // Plano + limite + uso actual
    const condRes = await safeCall(
      supabase.from("condominios").select("plano").eq("id", condominioId).maybeSingle(),
    );
    const planoAtual = (condRes?.data as any)?.plano ?? "basico";
    setPlano(planoAtual);
    const [limRes, usoRes] = await Promise.all([
      supabase.rpc("limite_usuarios_plano", { _condominio_id: condominioId }),
      supabase.rpc("contar_usuarios_empresa", { _condominio_id: condominioId }),
    ]);
    setLimite((limRes.data as number | null) ?? null);
    setUsados((usoRes.data as number | null) ?? 0);

    setLoading(false);
  };

  useEffect(() => { carregar(); }, [condominioId]);


  async function convidar() {
    if (!condominioId || !email.trim()) { toast.error("Informe o e-mail"); return; }
    setEnviando(true);
    const token = crypto.randomUUID().replace(/-/g, "");
    // hash via subtle crypto
    const enc = new TextEncoder().encode(token);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    const token_hash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

    const uid = (await supabase.auth.getUser()).data.user!.id;
    const { error } = await supabase.from("convites").insert({
      condominio_id: condominioId,
      email: email.trim().toLowerCase(),
      nome: nome.trim() || null,
      role: role as any,
      enviado_por: uid,
      token,
      token_hash,
    });
    setEnviando(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Convite criado");
    setEmail(""); setNome(""); setRole("morador"); setOpen(false);
    carregar();
  }

  function copiarLink(token: string) {
    const url = `${window.location.origin}/auth/convite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  }

  if (!isSindico) {
    return (
      <div className="p-6 max-w-3xl">
        <div className="rounded-lg border border-border bg-background p-6 flex gap-3">
          <AlertCircle className="text-amber-500 shrink-0" />
          <div>
            <p className="font-semibold">Acesso restrito</p>
            <p className="text-sm text-muted-foreground">Apenas administradores da empresa podem gerir utilizadores e convites.</p>
          </div>
        </div>
      </div>
    );
  }

  const PERFIS_EQUIPE = new Set(["admin", "sindico", "financeiro", "contador", "gestor", "vendedor", "comercial", "consulta", "porteiro"]);
  const membrosVisiveis = filtroEquipe
    ? membros.filter((m) => PERFIS_EQUIPE.has(m.role))
    : membros;

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Users /></div>
          <div>
            <h1 className="text-2xl font-display font-bold">Utilizadores</h1>
            <p className="text-sm text-muted-foreground">Convide a equipa da empresa (Administrador, Financeiro, Gestor, Vendedor, Comercial, Contador, Consulta) e os moradores.</p>
          </div>
        </div>
        <Button onClick={() => setOpen((v) => !v)}><Plus size={16} className="mr-2" /> Novo utilizador</Button>
      </header>

      <div className="flex gap-2">
        <button
          onClick={() => setFiltroEquipe(true)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${filtroEquipe ? "bg-primary text-primary-foreground" : "bg-surface border border-border text-foreground hover:border-primary"}`}
        >
          Equipa interna
        </button>
        <button
          onClick={() => setFiltroEquipe(false)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${!filtroEquipe ? "bg-primary text-primary-foreground" : "bg-surface border border-border text-foreground hover:border-primary"}`}
        >
          Todos (incluir moradores)
        </button>
      </div>

      {open && (
        <section className="rounded-xl border border-border bg-background p-5 space-y-4">
          <h2 className="font-semibold">Convidar novo utilizador</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div>
              <Label>E-mail *</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@dominio.com" />
            </div>
            <div>
              <Label>Perfil *</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador — acesso total</SelectItem>
                  <SelectItem value="financeiro">Financeiro — cobranças, pagamentos, despesas</SelectItem>
                  <SelectItem value="contador">Contador — financeiro + CNAB</SelectItem>
                  <SelectItem value="gestor">Gestor — operação e relatórios</SelectItem>
                  <SelectItem value="vendedor">Vendedor — leads e prospecção</SelectItem>
                  <SelectItem value="comercial">Comercial — leads e propostas</SelectItem>
                  <SelectItem value="consulta">Consulta — só leitura</SelectItem>
                  <SelectItem value="porteiro">Porteiro — encomendas, visitantes, ocorrências</SelectItem>
                  <SelectItem value="morador">Morador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Após criar o convite, copie o link e envie por e-mail ou WhatsApp. O utilizador cria a conta (ou faz login) e fica automaticamente ligado à empresa com este perfil.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={convidar} disabled={enviando}>
              {enviando ? <Loader2 size={16} className="animate-spin mr-2" /> : <Mail size={16} className="mr-2" />} Gerar convite
            </Button>
          </div>
        </section>
      )}

      {loading ? <div className="text-muted-foreground flex items-center gap-2"><Loader2 className="animate-spin" /> A carregar…</div> : (
        <>
          <section>
            <h2 className="font-semibold mb-3">Utilizadores ativos ({membrosVisiveis.length})</h2>
            <div className="grid gap-2">
              {membrosVisiveis.length === 0 && <p className="text-sm text-muted-foreground">Nenhum utilizador além de si.</p>}
              {membrosVisiveis.map((m) => (
                <div key={`${m.user_id}-${m.role}`} className="rounded-lg border border-border bg-background p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{m.nome || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground">{m.telefone || "—"}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-muted font-medium">{ROLE_LABELS[m.role] ?? m.role}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-semibold mb-3">Convites pendentes</h2>
            <div className="grid gap-2">
              {convites.filter((c) => c.status === "pendente").length === 0 && <p className="text-sm text-muted-foreground">Sem convites pendentes.</p>}
              {convites.filter((c) => c.status === "pendente").map((c) => (
                <div key={c.id} className="rounded-lg border border-border bg-background p-3 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-medium text-sm">{c.nome || c.email}</p>
                    <p className="text-xs text-muted-foreground">{c.email} · {ROLE_LABELS[c.role] ?? c.role} · expira {new Date(c.expira_em).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => copiarLink(c.token)}>
                    <Copy size={12} className="mr-1" /> Copiar link
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
