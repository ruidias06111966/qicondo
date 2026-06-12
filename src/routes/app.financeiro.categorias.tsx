import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCondominioAtivo } from "@/auth/useCondominio";
import {
  listarCategorias,
  criarCategoria,
  removerCategoria,
  semearCategoriasPadrao,
} from "@/lib/financeiro.functions";
import { Modal, Field, EmptyState, safeCall } from "@/components/financeiro/ui";
import { toast } from "sonner";
import { Tag, Plus, Loader2, Trash2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/app/financeiro/categorias")({
  head: () => ({ meta: [{ title: "Categorias — Financeiro" }] }),
  component: CategoriasPage,
});

const CORES = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];

function CategoriasPage() {
  const { condominioId } = useCondominioAtivo();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const seed = async () => {
    if (!condominioId || seeding) return;
    setSeeding(true);
    const r = await safeCall(semearCategoriasPadrao({ data: { condominio_id: condominioId } }));
    setSeeding(false);
    if (r) {
      toast.success(r.inseridas > 0 ? `${r.inseridas} categoria(s) padrão criada(s)` : "Já existem categorias padrão");
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("categorias:changed"));
      reload();
    }
  };

  const reload = () => {
    if (!condominioId) return;
    setLoading(true);
    safeCall(listarCategorias({ data: { condominio_id: condominioId } }))
      .then((r) => setRows(Array.isArray(r) ? r : []))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [condominioId]);

  // Recarrega quando outras telas alteram categorias
  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = () => reload();
    window.addEventListener("categorias:changed", h);
    return () => window.removeEventListener("categorias:changed", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominioId]);

  if (!condominioId) return null;

  const safeRows = Array.isArray(rows) ? rows : [];
  const receitas = safeRows.filter((r) => r.tipo === "receita");
  const despesas = safeRows.filter((r) => r.tipo === "despesa");

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">{safeRows.length} categoria(s)</p>
        <div className="flex gap-2">
          <button
            onClick={seed}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted disabled:opacity-60"
          >
            {seeding ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Criar categorias padrão
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90"
          >
            <Plus size={16} /> Nova categoria
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : safeRows.length === 0 ? (
        <div className="space-y-4">
          <EmptyState icon={Tag} title="Nenhuma categoria" desc="Crie categorias para organizar receitas e despesas, ou use o botão acima para gerar um conjunto padrão." />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          <Bloco titulo="Receitas" cor="emerald" itens={receitas} onDel={(id) => del(id)} deletingId={deletingId} />
          <Bloco titulo="Despesas" cor="rose" itens={despesas} onDel={(id) => del(id)} deletingId={deletingId} />
        </div>
      )}

      {showNew && (
        <ModalNova
          condominioId={condominioId}
          onClose={() => setShowNew(false)}
          onDone={() => {
            setShowNew(false);
            reload();
          }}
        />
      )}
    </div>
  );

  async function del(id: string) {
    if (!confirm("Excluir categoria?")) return;
    if (deletingId) return;
    setDeletingId(id);
    const ok = await safeCall(removerCategoria({ data: { id } }));
    setDeletingId(null);
    if (ok) {
      toast.success("Categoria excluída");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("categorias:changed"));
      }
      reload();
    }
  }
}

function Bloco({
  titulo,
  cor,
  itens,
  onDel,
  deletingId,
}: {
  titulo: string;
  cor: string;
  itens: any[];
  onDel: (id: string) => void;
  deletingId: string | null;
}) {
  return (
    <div className="bg-background border border-border rounded-2xl overflow-hidden">
      <div className={`px-5 py-3 border-b border-border bg-${cor}-50`}>
        <p className="font-semibold">{titulo}</p>
      </div>
      {itens.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground text-center">Nenhuma categoria.</p>
      ) : (
        <ul className="divide-y divide-border">
          {itens.map((c) => {
            const busy = deletingId === c.id;
            return (
              <li key={c.id} className="px-5 py-3 flex items-center gap-3">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.cor }} />
                <span className="flex-1 font-medium text-sm">{c.nome}</span>
                <button
                  onClick={() => onDel(c.id)}
                  disabled={busy || !!deletingId}
                  className="p-2 rounded hover:bg-muted text-rose-600 disabled:opacity-50"
                  aria-label="Excluir categoria"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ModalNova({
  condominioId,
  onClose,
  onDone,
}: {
  condominioId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"receita" | "despesa">("despesa");
  const [cor, setCor] = useState(CORES[0]);
  const [saving, setSaving] = useState(false);

  const corValida = /^#[0-9A-Fa-f]{6}$/.test(cor);

  const submit = async () => {
    const nomeTrim = nome.trim();
    if (!nomeTrim) return toast.error("Informe o nome da categoria");
    if (nomeTrim.length > 80) return toast.error("Nome muito longo (máx. 80)");
    if (!corValida) return toast.error("Cor inválida — use formato #RRGGBB");
    if (saving) return;
    setSaving(true);
    const r = await safeCall(
      criarCategoria({ data: { condominio_id: condominioId, nome: nomeTrim, tipo, cor } }),
    );
    setSaving(false);
    if (r) {
      toast.success(`Categoria "${nomeTrim}" criada`);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("categorias:changed"));
      }
      onDone();
    }
  };

  return (
    <Modal title="Nova categoria" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nome">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </Field>
        <Field label="Tipo">
          <div className="flex gap-2">
            {(["receita", "despesa"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={`flex-1 px-3 py-2 rounded-lg border text-sm font-semibold ${
                  tipo === t ? "border-primary bg-primary/10 text-primary" : "border-border"
                }`}
              >
                {t === "receita" ? "Receita" : "Despesa"}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Cor">
          <div className="flex flex-wrap items-center gap-2">
            {CORES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                className={`w-8 h-8 rounded-full border-2 ${cor === c ? "border-foreground" : "border-transparent"}`}
                style={{ backgroundColor: c }}
                aria-label={`Selecionar cor ${c}`}
              />
            ))}
            <input
              type="text"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              placeholder="#10B981"
              className={`w-28 px-2 py-1 rounded-lg border text-xs font-mono bg-background ${
                corValida ? "border-border" : "border-rose-500"
              }`}
            />
          </div>
          {!corValida && (
            <p className="text-xs text-rose-600 mt-1">Use o formato hexadecimal #RRGGBB.</p>
          )}
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-border text-sm font-semibold disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving || !corValida || !nome.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
