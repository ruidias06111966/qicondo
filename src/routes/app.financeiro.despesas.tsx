import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useCondominioAtivo } from "@/auth/useCondominio";
import {
  listarDespesas,
  listarCategorias,
  criarDespesa,
  removerDespesa,
} from "@/server/financeiro.functions";
import { brl, dateBR } from "@/lib/format";
import { Modal, Field, EmptyState, safeCall } from "@/components/financeiro/ui";
import { toast } from "sonner";
import { Wallet, Plus, Loader2, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/financeiro/despesas")({
  head: () => ({ meta: [{ title: "Despesas — Financeiro" }] }),
  component: DespesasPage,
});

function DespesasPage() {
  const { condominioId } = useCondominioAtivo();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [mes, setMes] = useState<string>("");

  const reload = () => {
    if (!condominioId) return;
    setLoading(true);
    safeCall(listarDespesas({ data: { condominio_id: condominioId, mes: mes || undefined } }))
      .then((r) => setRows(Array.isArray(r) ? r : []))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [condominioId, mes]);

  const totaisPorCategoria = useMemo(() => {
    const map = new Map<string, { nome: string; cor: string; total: number }>();
    rows.forEach((r) => {
      const nome = r.categorias_financeiras?.nome ?? "Sem categoria";
      const cor = r.categorias_financeiras?.cor ?? "#94a3b8";
      const cur = map.get(nome) ?? { nome, cor, total: 0 };
      cur.total += Number(r.valor);
      map.set(nome, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const totalGeral = rows.reduce((s, r) => s + Number(r.valor), 0);

  if (!condominioId) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
        />
        {mes && (
          <button onClick={() => setMes("")} className="text-sm text-muted-foreground hover:text-foreground">
            Limpar filtro
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90"
        >
          <Plus size={16} /> Nova despesa
        </button>
      </div>

      {!loading && totaisPorCategoria.length > 0 && (
        <div className="bg-background border border-border rounded-2xl p-5 mb-5">
          <div className="flex items-baseline justify-between mb-3">
            <p className="font-semibold">Por categoria</p>
            <p className="text-sm text-muted-foreground">
              Total: <strong className="text-foreground font-mono">{brl(totalGeral)}</strong>
            </p>
          </div>
          <div className="space-y-2">
            {totaisPorCategoria.map((c) => {
              const pct = totalGeral > 0 ? (c.total / totalGeral) * 100 : 0;
              return (
                <div key={c.nome}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{c.nome}</span>
                    <span className="font-mono text-muted-foreground">
                      {brl(c.total)} <span className="text-xs">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: c.cor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nenhuma despesa registrada"
          desc="Comece a registrar os gastos do condomínio."
        />
      ) : (
        <div className="bg-background border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Data</th>
                <th className="text-left px-4 py-3 font-semibold">Descrição</th>
                <th className="text-left px-4 py-3 font-semibold">Categoria</th>
                <th className="text-left px-4 py-3 font-semibold">Fornecedor</th>
                <th className="text-right px-4 py-3 font-semibold">Valor</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">{dateBR(r.data)}</td>
                  <td className="px-4 py-3 font-medium">{r.descricao}</td>
                  <td className="px-4 py-3">{r.categorias_financeiras?.nome ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.fornecedor ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-rose-600">- {brl(r.valor)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm("Excluir despesa?"))
                          safeCall(removerDespesa({ data: { id: r.id } })).then((ok) => {
                            if (ok) {
                              toast.success("Excluída");
                              reload();
                            }
                          });
                      }}
                      className="p-2 rounded hover:bg-muted text-rose-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <ModalNovaDespesa
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
}

function ModalNovaDespesa({
  condominioId,
  onClose,
  onDone,
}: {
  condominioId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [fornecedor, setFornecedor] = useState("");
  const [forma, setForma] = useState<any>("pix");
  const [categoriaId, setCategoriaId] = useState("");
  const [cats, setCats] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    safeCall(listarCategorias({ data: { condominio_id: condominioId } })).then((cs) =>
      setCats((cs ?? []).filter((c: any) => c.tipo === "despesa")),
    );
  }, [condominioId]);

  const submit = async () => {
    if (!descricao || !valor) return toast.error("Preencha descrição e valor");
    setSaving(true);
    const r = await safeCall(
      criarDespesa({
        data: {
          condominio_id: condominioId,
          categoria_id: categoriaId || null,
          fornecedor: fornecedor || null,
          descricao,
          valor: Number(valor),
          data,
          forma,
        },
      }),
    );
    setSaving(false);
    if (r) {
      toast.success("Despesa registrada");
      onDone();
    }
  };

  return (
    <Modal title="Nova despesa" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Descrição">
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor (R$)">
            <input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </Field>
          <Field label="Data">
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </Field>
        </div>
        <Field label="Categoria">
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          >
            <option value="">Sem categoria</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fornecedor">
          <input
            value={fornecedor}
            onChange={(e) => setFornecedor(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </Field>
        <Field label="Forma de pagamento">
          <select
            value={forma}
            onChange={(e) => setForma(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          >
            <option value="pix">PIX</option>
            <option value="boleto">Boleto</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="transferencia">Transferência</option>
            <option value="cartao">Cartão</option>
            <option value="outro">Outro</option>
          </select>
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
