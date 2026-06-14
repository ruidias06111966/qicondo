import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Trash2, Shield } from "lucide-react";
import { detalheEmpresa, alterarRoleEmpresa, removerUtilizadorEmpresa } from "@/lib/platform.functions";
import { safeCall } from "@/lib/safe-call";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/empresas/$id")({
  head: () => ({ meta: [{ title: "Empresa — Admin Master" }] }),
  component: AdminEmpresaDetalhe,
});

const ROLES = ["admin", "sindico", "financeiro", "gestor", "vendedor", "comercial", "contador", "consulta", "porteiro", "morador"] as const;
const LABEL: Record<string, string> = {
  admin: "Administrador", sindico: "Síndico", financeiro: "Financeiro", contador: "Contador",
  gestor: "Gestor", vendedor: "Vendedor", comercial: "Comercial", consulta: "Consulta",
  porteiro: "Porteiro", morador: "Morador",
};

function AdminEmpresaDetalhe() {
  const { id } = Route.useParams();
  const dFn = useServerFn(detalheEmpresa);
  const aFn = useServerFn(alterarRoleEmpresa);
  const rFn = useServerFn(removerUtilizadorEmpresa);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const r = await safeCall(dFn({ data: { condominio_id: id } }));
    if (r) setData(r);
    setLoading(false);
  };
  useEffect(() => { reload(); }, [id]);

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin inline" /></div>;
  if (!data) return <div className="p-10 text-center text-muted-foreground">Sem dados.</div>;

  const { empresa, utilizadores, convites } = data;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft size={14} /> Voltar</Link>
      <header>
        <h1 className="text-2xl font-bold">{empresa.nome}</h1>
        <p className="text-sm text-muted-foreground">
          {[empresa.cnpj, empresa.cidade, empresa.estado].filter(Boolean).join(" • ") || "—"}
        </p>
      </header>

      {/* Info */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Box label="Plano" value={empresa.plano} />
        <Box label="Unidades" value={empresa.total_unidades} />
        <Box label="Validade" value={empresa.assinatura_fim ?? "—"} />
      </div>

      {/* Utilizadores */}
      <section className="bg-background border border-border rounded-xl">
        <div className="p-4 border-b border-border font-semibold">Utilizadores ({utilizadores.length})</div>
        {utilizadores.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Sem utilizadores.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground bg-muted/50">
                <tr><th className="text-left p-3">Nome</th><th className="text-left p-3">Telefone</th><th className="text-left p-3">Perfis</th><th className="text-right p-3">Ações</th></tr>
              </thead>
              <tbody>
                {utilizadores.map((u: any) => (
                  <tr key={u.user_id} className="border-t border-border">
                    <td className="p-3">
                      <div className="font-medium">{u.nome || "(sem nome)"}</div>
                      <div className="text-xs text-muted-foreground font-mono">{u.user_id.slice(0, 8)}</div>
                    </td>
                    <td className="p-3 text-muted-foreground">{u.telefone || "—"}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r: string) => (
                          <select
                            key={r}
                            value={r}
                            onChange={async (e) => {
                              const novo = e.target.value;
                              if (novo === r) return;
                              const res = await safeCall(aFn({ data: { condominio_id: id, user_id: u.user_id, role_antigo: r as any, role_novo: novo as any } }));
                              if (res) { toast.success("Perfil alterado"); reload(); }
                            }}
                            className="text-xs bg-muted rounded px-2 py-1 border border-border"
                          >
                            {ROLES.map((rr) => <option key={rr} value={rr}>{LABEL[rr]}</option>)}
                          </select>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={async () => {
                          if (!confirm(`Remover ${u.nome || "utilizador"} desta empresa?`)) return;
                          const res = await safeCall(rFn({ data: { condominio_id: id, user_id: u.user_id } }));
                          if (res) { toast.success("Removido"); reload(); }
                        }}
                        className="p-1.5 rounded hover:bg-muted text-destructive"
                      ><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Convites */}
      <section className="bg-background border border-border rounded-xl">
        <div className="p-4 border-b border-border font-semibold">Convites ({convites.length})</div>
        {convites.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Sem convites.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground bg-muted/50">
                <tr><th className="text-left p-3">Email</th><th className="text-left p-3">Perfil</th><th className="text-left p-3">Estado</th><th className="text-left p-3">Expira</th></tr>
              </thead>
              <tbody>
                {convites.map((c: any) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="p-3">{c.email}</td>
                    <td className="p-3">{LABEL[c.role] ?? c.role}</td>
                    <td className="p-3"><span className="text-xs px-2 py-0.5 rounded bg-muted">{c.status}</span></td>
                    <td className="p-3 text-xs">{new Date(c.expira_em).toLocaleDateString("pt-PT")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Box({ label, value }: any) {
  return (
    <div className="bg-background border border-border rounded-xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-1 capitalize">{value ?? "—"}</div>
    </div>
  );
}
