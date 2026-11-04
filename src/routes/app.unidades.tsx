import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCondominioAtivo } from "@/auth/useCondominio";
import {
  listarUnidades,
  criarUnidade,
  atualizarUnidade,
  removerUnidade,
  distribuirFracaoIgualmente,
} from "@/lib/unidades.functions";
import { Modal, Field, EmptyState, safeCall } from "@/components/financeiro/ui";
import { toast } from "sonner";
import { Building2, Plus, Loader2, Trash2, Pencil, Scale, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/app/unidades")({
  head: () => ({ meta: [{ title: "Unidades" }] }),
  component: UnidadesPage,
});

type Unidade = {
  id: string;
  bloco: string | null;
  numero: string;
  fracao_ideal: number | null;
  taxa_mensal: number | null;
  observacoes: string | null;
};

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function UnidadesPage() {
  const { condominioId } = useCondominioAtivo();
  const [rows, setRows] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Unidade | "nova" | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);
  const [distribuindo, setDistribuindo] = useState(false);

  const carregar = useCallback(async () => {
    if (!condominioId) return;
    setLoading(true);
    const r = await safeCall(listarUnidades({ data: { condominio_id: condominioId } }));
    setRows((r ?? []) as Unidade[]);
    setLoading(false);
  }, [condominioId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // O rateio por fração ideal recusa-se a correr se alguma unidade ficar por
  // preencher, por isso o aviso aparece aqui, onde se resolve.
  const semFracao = useMemo(
    () => rows.filter((u) => u.fracao_ideal == null || Number(u.fracao_ideal) <= 0).length,
    [rows],
  );
  const somaFracoes = useMemo(
    () => rows.reduce((acc, u) => acc + Number(u.fracao_ideal ?? 0), 0),
    [rows],
  );

  const distribuir = async () => {
    if (!condominioId || distribuindo) return;
    if (
      !confirm(
        "Isto substitui a fração ideal de TODAS as unidades por um valor igual.\n\n" +
          "A fração real vem da convenção do condomínio e varia com a área. " +
          "Use só se todas as unidades forem iguais, ou como ponto de partida.\n\nContinuar?",
      )
    )
      return;
    setDistribuindo(true);
    const r = await safeCall(distribuirFracaoIgualmente({ data: { condominio_id: condominioId } }));
    setDistribuindo(false);
    if (r) {
      toast.success(`Fração de ${r.fracao} aplicada a ${r.unidades} unidade(s)`);
      carregar();
    }
  };

  const apagar = async (id: string) => {
    if (!confirm("Apagar esta unidade? As cobranças e reservas ligadas a ela também saem.")) return;
    setApagando(id);
    const r = await safeCall(removerUnidade({ data: { id } }));
    setApagando(null);
    if (r) {
      toast.success("Unidade removida");
      carregar();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Building2 size={22} /> Unidades
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {rows.length} unidade(s) · soma das frações: {somaFracoes.toFixed(6)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={distribuir}
            disabled={distribuindo || !rows.length}
            className="px-4 py-2 rounded-lg border border-border text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
          >
            {distribuindo ? <Loader2 size={16} className="animate-spin" /> : <Scale size={16} />}
            Fração igual para todas
          </button>
          <button
            onClick={() => setEditando("nova")}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2"
          >
            <Plus size={16} /> Nova unidade
          </button>
        </div>
      </div>

      {semFracao > 0 && rows.length > 0 && (
        <div className="flex gap-3 p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-sm">
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="font-semibold">{semFracao} unidade(s) sem fração ideal preenchida</p>
            <p className="text-muted-foreground mt-0.5">
              Enquanto faltar alguma, não é possível gerar uma taxa extra rateada por fração — o
              sistema recusa, em vez de dividir errado em silêncio.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : !rows.length ? (
        <EmptyState
          icon={Building2}
          title="Nenhuma unidade cadastrada"
          desc="Cadastre as unidades para gerar cobranças e aceitar reservas."
        />
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Bloco</th>
                  <th className="text-left font-semibold px-4 py-3">Número</th>
                  <th className="text-right font-semibold px-4 py-3">Fração ideal</th>
                  <th className="text-right font-semibold px-4 py-3">Taxa mensal</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-3">{u.bloco || "—"}</td>
                    <td className="px-4 py-3 font-medium">{u.numero}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {u.fracao_ideal == null || Number(u.fracao_ideal) <= 0 ? (
                        <span className="text-amber-600 font-semibold">a preencher</span>
                      ) : (
                        Number(u.fracao_ideal).toFixed(6)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {u.taxa_mensal == null ? "—" : moeda(Number(u.taxa_mensal))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditando(u)}
                          className="p-2 rounded-lg hover:bg-muted"
                          aria-label={`Editar unidade ${u.numero}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => apagar(u.id)}
                          disabled={apagando === u.id}
                          className="p-2 rounded-lg hover:bg-muted text-destructive disabled:opacity-60"
                          aria-label={`Apagar unidade ${u.numero}`}
                        >
                          {apagando === u.id ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Trash2 size={15} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editando && condominioId && (
        <ModalUnidade
          condominioId={condominioId}
          unidade={editando === "nova" ? null : editando}
          onClose={() => setEditando(null)}
          onDone={() => {
            setEditando(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}

function ModalUnidade({
  condominioId,
  unidade,
  onClose,
  onDone,
}: {
  condominioId: string;
  unidade: Unidade | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [bloco, setBloco] = useState(unidade?.bloco ?? "");
  const [numero, setNumero] = useState(unidade?.numero ?? "");
  const [fracao, setFracao] = useState(
    unidade?.fracao_ideal != null ? String(unidade.fracao_ideal) : "",
  );
  const [taxa, setTaxa] = useState(unidade?.taxa_mensal != null ? String(unidade.taxa_mensal) : "");
  const [observacoes, setObservacoes] = useState(unidade?.observacoes ?? "");
  const [saving, setSaving] = useState(false);

  // Vírgula é o separador decimal que se usa aqui; aceitar os dois evita que
  // "0,023456" entre como 0 e passe despercebido.
  const paraNumero = (v: string) => {
    const limpo = v.trim().replace(",", ".");
    if (!limpo) return null;
    const n = Number(limpo);
    return Number.isFinite(n) ? n : null;
  };

  const submit = async () => {
    const payload = {
      condominio_id: condominioId,
      numero: numero.trim(),
      bloco: bloco.trim() || null,
      fracao_ideal: paraNumero(fracao),
      taxa_mensal: paraNumero(taxa),
      observacoes: observacoes.trim() || null,
    };
    setSaving(true);
    const r = await safeCall(
      unidade
        ? atualizarUnidade({ data: { ...payload, id: unidade.id } })
        : criarUnidade({ data: payload }),
    );
    setSaving(false);
    if (r) {
      toast.success(unidade ? "Unidade atualizada" : "Unidade criada");
      onDone();
    }
  };

  return (
    <Modal title={unidade ? `Unidade ${unidade.numero}` : "Nova unidade"} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bloco (opcional)">
            <input
              value={bloco}
              onChange={(e) => setBloco(e.target.value)}
              placeholder="A"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </Field>
          <Field label="Número">
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="101"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </Field>
        </div>

        <Field label="Fração ideal">
          <input
            value={fracao}
            onChange={(e) => setFracao(e.target.value)}
            placeholder="0,023456"
            inputMode="decimal"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm tabular-nums"
          />
        </Field>
        <p className="text-xs text-muted-foreground -mt-2">
          Como está na convenção do condomínio. Tanto faz usar fração (0,023456) ou percentagem
          (2,3456) — desde que todas as unidades sigam a mesma. É por aqui que se rateia uma taxa
          extra.
        </p>

        <Field label="Taxa mensal (R$)">
          <input
            value={taxa}
            onChange={(e) => setTaxa(e.target.value)}
            placeholder="450,00"
            inputMode="decimal"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm tabular-nums"
          />
        </Field>

        <Field label="Observações (opcional)">
          <input
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving || !numero.trim()}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
