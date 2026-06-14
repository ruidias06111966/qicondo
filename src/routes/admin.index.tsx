import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Users, Layers, AlertTriangle, Loader2, Search, Pause, Play, Pencil, Trash2 } from "lucide-react";
import { metricasGlobais, listarEmpresas, atualizarAssinatura, definirSuspensao, apagarEmpresa } from "@/lib/platform.functions";
import { safeCall } from "@/lib/safe-call";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin Master — Visão geral" }] }),
  component: AdminIndex,
});

const PLANOS = ["basico", "profissional", "enterprise"] as const;
const PLANO_LABEL: Record<string, string> = { basico: "Básico", profissional: "Profissional", enterprise: "Enterprise" };

function AdminIndex() {
  const mFn = useServerFn(metricasGlobais);
  const eFn = useServerFn(listarEmpresas);
  const suspFn = useServerFn(definirSuspensao);
  const delFn = useServerFn(apagarEmpresa);
  const [m, setM] = useState<any>(null);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<any | null>(null);

  const reload = async () => {
    setLoading(true);
    const [a, b] = await Promise.all([safeCall(mFn()), safeCall(eFn())]);
    if (a) setM(a);
    if (b) setEmpresas(b);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const filtered = empresas.filter((e) =>
    [e.nome, e.cnpj, e.cidade].filter(Boolean).some((s: string) => s.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold">Visão geral da plataforma</h1>
        <p className="text-sm text-muted-foreground">Métricas, assinaturas e gestão de todas as empresas.</p>
      </header>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi label="Empresas" value={m?.total_empresas} icon={Building2} sub={`${m?.empresas_ativas ?? 0} ativas`} />
        <Kpi label="Utilizadores" value={m?.total_utilizadores} icon={Users} />
        <Kpi label="Unidades" value={m?.total_unidades} icon={Layers} />
      </div>
      {m?.empresas_suspensas > 0 && (
        <div className="flex items-center gap-2 text-sm bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
          <AlertTriangle size={16} className="text-amber-600" />
          {m.empresas_suspensas} empresa(s) suspensas.
        </div>
      )}

      {/* Empresas */}
      <section className="bg-background border border-border rounded-xl">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <h2 className="font-semibold">Empresas / Condomínios</h2>
          <div className="ml-auto relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Procurar..."
              className="pl-8 pr-3 py-1.5 text-sm bg-muted rounded-md border border-border w-64"
            />
          </div>
        </div>
        {loading ? (
          <div className="p-10 text-center"><Loader2 className="animate-spin inline text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Sem empresas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground bg-muted/50">
                <tr>
                  <th className="text-left p-3">Empresa</th>
                  <th className="text-left p-3">Plano</th>
                  <th className="text-right p-3">Users</th>
                  <th className="text-right p-3">Unidades</th>
                  <th className="text-left p-3">Validade</th>
                  <th className="text-left p-3">Estado</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3">
                      <Link to="/admin/empresas/$id" params={{ id: e.id }} className="font-medium hover:underline">{e.nome}</Link>
                      <div className="text-xs text-muted-foreground">{[e.cidade, e.estado].filter(Boolean).join(" / ") || "—"}</div>
                    </td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded text-xs bg-muted">{PLANO_LABEL[e.plano] ?? e.plano}</span></td>
                    <td className="p-3 text-right">{e.total_utilizadores}</td>
                    <td className="p-3 text-right">{e.total_unidades}</td>
                    
                    <td className="p-3 text-xs">{e.assinatura_fim ?? "—"}</td>
                    <td className="p-3">
                      {e.suspenso
                        ? <span className="px-2 py-0.5 rounded text-xs bg-destructive/10 text-destructive">Suspensa</span>
                        : <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-600">Ativa</span>}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button onClick={() => setEdit(e)} className="p-1.5 rounded hover:bg-muted" title="Editar assinatura"><Pencil size={14} /></button>
                      <button
                        onClick={async () => {
                          const motivo = e.suspenso ? null : prompt("Motivo da suspensão (opcional):") || null;
                          const r = await safeCall(suspFn({ data: { condominio_id: e.id, suspenso: !e.suspenso, motivo } }));
                          if (r) { toast.success(e.suspenso ? "Reativada" : "Suspensa"); reload(); }
                        }}
                        className="p-1.5 rounded hover:bg-muted"
                        title={e.suspenso ? "Reativar" : "Suspender"}
                      >{e.suspenso ? <Play size={14} /> : <Pause size={14} />}</button>
                      <button
                        onClick={async () => {
                          const c = prompt(`Digite o nome exato "${e.nome}" para apagar:`);
                          if (!c) return;
                          const r = await safeCall(delFn({ data: { condominio_id: e.id, confirmar_nome: c } }));
                          if (r) { toast.success("Empresa apagada"); reload(); }
                        }}
                        className="p-1.5 rounded hover:bg-muted text-destructive"
                        title="Apagar"
                      ><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {edit && <EditarAssinaturaModal empresa={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </div>
  );
}

function Kpi({ label, value, icon: Icon, sub }: any) {
  return (
    <div className="bg-background border border-border rounded-xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon size={16} className="text-muted-foreground" />
      </div>
      <div className="text-2xl font-bold mt-1">{value ?? "—"}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function EditarAssinaturaModal({ empresa, onClose, onSaved }: { empresa: any; onClose: () => void; onSaved: () => void }) {
  const fn = useServerFn(atualizarAssinatura);
  const [plano, setPlano] = useState(empresa.plano);
  const [inicio, setInicio] = useState(empresa.assinatura_inicio ?? "");
  const [fim, setFim] = useState(empresa.assinatura_fim ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur grid place-items-center z-50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-background border border-border rounded-xl p-6 w-full max-w-md space-y-4">
        <h3 className="font-semibold text-lg">Assinatura — {empresa.nome}</h3>
        <p className="text-xs text-muted-foreground">Valor da assinatura é sempre sob consulta — combinado fora do sistema.</p>
        <div className="space-y-3 text-sm">
          <Field label="Plano">
            <select value={plano} onChange={(e) => setPlano(e.target.value)} className="w-full bg-muted rounded px-3 py-2 border border-border">
              {PLANOS.map((p) => <option key={p} value={p}>{PLANO_LABEL[p]}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Início"><input type="date" value={inicio ?? ""} onChange={(e) => setInicio(e.target.value)} className="w-full bg-muted rounded px-3 py-2 border border-border" /></Field>
            <Field label="Fim"><input type="date" value={fim ?? ""} onChange={(e) => setFim(e.target.value)} className="w-full bg-muted rounded px-3 py-2 border border-border" /></Field>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded hover:bg-muted">Cancelar</button>
          <button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              const r = await safeCall(fn({ data: {
                condominio_id: empresa.id,
                plano,
                assinatura_inicio: inicio || null,
                assinatura_fim: fim || null,
              } }));
              setSaving(false);
              if (r) { toast.success("Assinatura atualizada"); onSaved(); }
            }}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded font-medium disabled:opacity-50"
          >{saving ? "A guardar..." : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs text-muted-foreground block mb-1">{label}</span>{children}</label>;
}
