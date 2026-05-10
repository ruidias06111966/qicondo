import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCondominioAtivo } from "@/auth/useCondominio";
import {
  listarCategorias,
  criarCategoria,
  removerCategoria,
} from "@/server/financeiro.functions";
import { Modal, Field, EmptyState, safeCall } from "@/components/financeiro/ui";
import { toast } from "sonner";
import { Tag, Plus, Loader2, Trash2 } from "lucide-react";

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

  const reload = () => {
    if (!condominioId) return;
    setLoading(true);
    safeCall(listarCategorias({ data: { condominio_id: condominioId } }))
      .then((r) => setRows(Array.isArray(r) ? r : []))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [condominioId]);

  if (!condominioId) return null;

  const safeRows = Array.isArray(rows) ? rows : [];
  const receitas = safeRows.filter((r) => r.tipo === "receita");
  const despesas = safeRows.filter((r) => r.tipo === "despesa");

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-muted-foreground">{safeRows.length} categoria(s)</p>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90"
        >
          <Plus size={16} /> Nova categoria
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : safeRows.length === 0 ? (
        <EmptyState icon={Tag} title="Nenhuma categoria" desc="Crie categorias para organizar receitas e despesas." />
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          <Bloco titulo="Receitas" cor="emerald" itens={receitas} onDel={(id) => del(id)} />
          <Bloco titulo="Despesas" cor="rose" itens={despesas} onDel={(id) => del(id)} />
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

  function del(id: string) {
    if (!confirm("Excluir categoria?")) return;
    safeCall(removerCategoria({ data: { id } })).then((ok) => {
      if (ok) {
        toast.success("Excluída");
        reload();
      }
    });
  }
}

function Bloco({
  titulo,
  cor,
  itens,
  onDel,
}: {
  titulo: string;
  cor: string;
  itens: any[];
  onDel: (id: string) => void;
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
          {itens.map((c) => (
            <li key={c.id} className="px-5 py-3 flex items-center gap-3">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.cor }} />
              <span className="flex-1 font-medium text-sm">{c.nome}</span>
              <button
                onClick={() => onDel(c.id)}
                className="p-2 rounded hover:bg-muted text-rose-600"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
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

  const submit = async () => {
    const nomeTrim = nome.trim();
    if (!nomeTrim) return toast.error("Informe o nome da categoria");
    if (nomeTrim.length > 80) return toast.error("Nome muito longo (máx. 80)");
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
          <div className="flex flex-wrap gap-2">
            {CORES.map((c) => (
              <button
                key={c}
                onClick={() => setCor(c)}
                className={`w-8 h-8 rounded-full border-2 ${cor === c ? "border-foreground" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm font-semibold">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
