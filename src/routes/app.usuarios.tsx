import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { useAuth } from "@/auth/AuthProvider";
import { safeCall } from "@/lib/safe-call";
import {
  listarUsuarios,
  convidarUsuario,
  revogarConvite,
  alterarRoleUsuario,
  removerUsuario,
} from "@/lib/usuarios.functions";
import { Users, UserPlus, Copy, Trash2, X, Loader2, Shield } from "lucide-react";

export const Route = createFileRoute("/app/usuarios")({
  head: () => ({ meta: [{ title: "Equipa — QiCond" }] }),
  component: UsuariosPage,
});

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  sindico: "Síndico",
  financeiro: "Financeiro",
  contador: "Contador",
  gestor: "Gestor",
  vendedor: "Vendedor",
  comercial: "Comercial",
  consulta: "Consulta",
  porteiro: "Porteiro",
  morador: "Morador",
};
const ROLES_CONVIDAR = ["admin", "financeiro", "gestor", "vendedor", "comercial", "contador", "consulta"] as const;

function UsuariosPage() {
  const { condominioId, isAdmin } = useCondominioAtivo();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [utilizadores, setUtilizadores] = useState<any[]>([]);
  const [convites, setConvites] = useState<any[]>([]);
  const [openInvite, setOpenInvite] = useState(false);
  const [linkConvite, setLinkConvite] = useState<string | null>(null);

  const recarregar = async () => {
    if (!condominioId) return;
    setLoading(true);
    const r = await safeCall(listarUsuarios({ data: { condominio_id: condominioId } }));
    if (r) {
      setUtilizadores(r.utilizadores);
      setConvites(r.convites);
    }
    setLoading(false);
  };

  useEffect(() => {
    recarregar();
  }, [condominioId]);

  if (!condominioId) {
    return <div className="p-6 text-muted-foreground">Selecione uma empresa.</div>;
  }
  if (!isAdmin) {
    return (
      <div className="p-6 max-w-xl">
        <div className="rounded-2xl border border-border bg-background p-6 text-center">
          <Shield className="mx-auto mb-3 text-muted-foreground" />
          <h2 className="font-display text-xl font-bold mb-1">Acesso restrito</h2>
          <p className="text-sm text-muted-foreground">Apenas administradores podem gerir a equipa.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Users size={14} /> Equipa da empresa
          </p>
          <h1 className="font-display text-3xl font-extrabold mt-1">Utilizadores</h1>
        </div>
        <button
          onClick={() => setOpenInvite(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <UserPlus size={16} /> Convidar utilizador
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <>
          {/* Utilizadores ativos */}
          <section className="bg-background border border-border rounded-2xl overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-semibold">Ativos ({utilizadores.length})</h2>
            </div>
            {utilizadores.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">Nenhum utilizador.</div>
            ) : (
              <div className="divide-y divide-border">
                {utilizadores.map((u) => (
                  <div key={u.user_id} className="px-6 py-4 flex items-center gap-4 flex-wrap">
                    <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      {(u.nome || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{u.nome || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{u.telefone || "—"}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {u.roles.map((r: string) => (
                        <span key={r} className="text-xs px-2 py-1 rounded-full bg-muted font-medium">
                          {ROLE_LABEL[r] ?? r}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <SelectRole
                        atual={u.roles[0]}
                        onChange={async (novo) => {
                          if (novo === u.roles[0]) return;
                          const r = await safeCall(
                            alterarRoleUsuario({
                              data: {
                                condominio_id: condominioId,
                                user_id: u.user_id,
                                role_antigo: u.roles[0] as any,
                                role_novo: novo as any,
                              },
                            }),
                          );
                          if (r) {
                            toast.success("Papel atualizado");
                            recarregar();
                          }
                        }}
                      />
                      {u.user_id !== user?.id && (
                        <button
                          onClick={async () => {
                            if (!confirm(`Remover ${u.nome || "este utilizador"} da empresa?`)) return;
                            const r = await safeCall(
                              removerUsuario({ data: { condominio_id: condominioId, user_id: u.user_id } }),
                            );
                            if (r) {
                              toast.success("Utilizador removido");
                              recarregar();
                            }
                          }}
                          className="p-2 rounded hover:bg-destructive/10 text-destructive"
                          title="Remover"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Convites pendentes */}
          <section className="bg-background border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-semibold">Convites ({convites.length})</h2>
            </div>
            {convites.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">Sem convites.</div>
            ) : (
              <div className="divide-y divide-border">
                {convites.map((c) => (
                  <div key={c.id} className="px-6 py-4 flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{c.nome || c.email}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.email} · {ROLE_LABEL[c.role] ?? c.role}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        c.status === "pendente"
                          ? "bg-amber-100 text-amber-700"
                          : c.status === "aceito"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {c.status}
                    </span>
                    {c.status === "pendente" && (
                      <button
                        onClick={async () => {
                          if (!confirm("Revogar este convite?")) return;
                          const r = await safeCall(
                            revogarConvite({ data: { condominio_id: condominioId, id: c.id } }),
                          );
                          if (r) {
                            toast.success("Convite revogado");
                            recarregar();
                          }
                        }}
                        className="p-2 rounded hover:bg-destructive/10 text-destructive"
                        title="Revogar"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {openInvite && (
        <ModalConvidar
          onClose={() => {
            setOpenInvite(false);
            setLinkConvite(null);
          }}
          onCriar={async (payload) => {
            const r = await safeCall(
              convidarUsuario({ data: { condominio_id: condominioId, ...payload } }),
            );
            if (r) {
              const link = `${window.location.origin}/auth/convite/${r.token}`;
              setLinkConvite(link);
              toast.success("Convite criado");
              recarregar();
            }
          }}
          link={linkConvite}
        />
      )}
    </div>
  );
}

function SelectRole({ atual, onChange }: { atual: string; onChange: (v: string) => void }) {
  // `sindico`, `porteiro` e `morador` não são atribuíveis por aqui, mas podem ser
  // o papel actual (contas antigas ou vindas de convite de morador). Sem esta
  // entrada o select mostrava "Administrador" para elas — e bastava um clique
  // acidental para promover alguém a admin.
  const opcoes = ROLES_CONVIDAR.includes(atual as (typeof ROLES_CONVIDAR)[number])
    ? [...ROLES_CONVIDAR]
    : [atual, ...ROLES_CONVIDAR];

  return (
    <select
      value={atual}
      onChange={(e) => onChange(e.target.value)}
      title="Alterar perfil"
      className="text-xs rounded-md border border-input bg-background px-2 py-1.5"
    >
      {opcoes.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABEL[r] ?? r}
        </option>
      ))}
    </select>
  );
}

function ModalConvidar({
  onClose,
  onCriar,
  link,
}: {
  onClose: () => void;
  onCriar: (p: { nome: string; email: string; role: string }) => Promise<void>;
  link: string | null;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("gestor");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onCriar({ nome, email, role });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold">Convidar utilizador</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        {link ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Convite gerado. Partilhe este link com o utilizador (válido 7 dias):
            </p>
            <div className="flex gap-2">
              <input readOnly value={link} className="flex-1 text-xs px-3 py-2 rounded-md border border-input bg-muted" />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(link);
                  toast.success("Link copiado");
                }}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
              >
                <Copy size={14} /> Copiar
              </button>
            </div>
            <button
              onClick={onClose}
              className="w-full mt-4 rounded-lg border border-input py-2 text-sm font-semibold hover:bg-muted"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                minLength={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Perfil</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {ROLES_CONVIDAR.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? <Loader2 className="inline animate-spin" size={16} /> : "Gerar convite"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
