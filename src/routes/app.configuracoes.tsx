import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, MessageCircle, Users, FileText, Wallet, Settings, Bell } from "lucide-react";
import { useCondominioAtivo } from "@/auth/useCondominio";

export const Route = createFileRoute("/app/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — QiCond" }] }),
  component: ConfigPage,
});

type Role =
  | "sindico" | "admin" | "morador" | "contador" | "porteiro"
  | "financeiro" | "gestor" | "vendedor" | "comercial" | "consulta";
type Item = { to: string; icon: typeof Building2; title: string; desc: string; roles?: Role[] };

const ADMIN: Role[] = ["sindico", "admin"];
const FINANCEIRO: Role[] = ["sindico", "admin", "contador", "financeiro"];

const ITEMS: Item[] = [
  { to: "/app/condominio", icon: Building2, title: "Dados da empresa", desc: "Nome, CNPJ, endereço e código público.", roles: ADMIN },
  { to: "/app/moradores", icon: Users, title: "Utilizadores e moradores", desc: "Convide a equipa (Administrador, Financeiro, Gestor, Vendedor, Comercial, Contador, Consulta) e os moradores.", roles: ADMIN },
  { to: "/app/documentos", icon: FileText, title: "Documentos oficiais", desc: "Atas, convenções, regimentos." },
  { to: "/app/whatsapp", icon: MessageCircle, title: "WhatsApp Bot", desc: "Integração Meta Cloud API.", roles: ADMIN },
  { to: "/app/financeiro", icon: Wallet, title: "Financeiro", desc: "Cobranças, pagamentos, CNAB.", roles: FINANCEIRO },
  { to: "/app/preferencias-notificacao", icon: Bell, title: "Preferências de notificação", desc: "Escolha o que recebe pelo WhatsApp." },
];

function ConfigPage() {
  const { role } = useCondominioAtivo();
  const items = ITEMS.filter((it) => !it.roles || (role && it.roles.includes(role as Role)));

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Settings /></div>
        <div>
          <h1 className="text-2xl font-display font-bold">Configurações</h1>
          <p className="text-sm text-muted-foreground">Acesso rápido a todas as áreas administrativas.</p>
        </div>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => (
          <Link key={it.to} to={it.to} className="group rounded-xl border border-border bg-background p-5 hover:border-primary transition-colors">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
              <it.icon size={18} />
            </div>
            <p className="font-semibold group-hover:text-primary">{it.title}</p>
            <p className="text-sm text-muted-foreground mt-1">{it.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
