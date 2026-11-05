/**
 * Plano de contas.
 *
 * Esta página substituiu a de "Categorias": é a mesma tabela. A categoria
 * financeira passou a ter código, pai e a marca de sintética, e isso é o plano
 * de contas — não há uma segunda árvore a manter alinhada com esta.
 *
 * Duas coisas que a interface deixa visíveis de propósito:
 *
 *   as contas de grupo aparecem a cinzento e sem cor, porque não aceitam
 *   lançamento — quem procura onde lançar vê logo quais não servem;
 *
 *   uma conta que já tem lançamentos mostra-o, porque é o que decide se pode
 *   ser desactivada sem deixar o histórico sem classificação.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ListTree,
  Plus,
  Loader2,
  Sparkles,
  EyeOff,
  Eye,
  PiggyBank,
  Pencil,
  Ban,
} from "lucide-react";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { Modal, Field, EmptyState, safeCall } from "@/components/financeiro/ui";
import {
  planoDeContas,
  semearPlanoDeContas,
  criarConta,
  atualizarConta,
  desativarConta,
  type ContaDoPlano,
} from "@/lib/contabil.functions";

export const Route = createFileRoute("/app/financeiro/plano-contas")({
  head: () => ({ meta: [{ title: "Plano de contas — QiCond" }] }),
  component: PlanoDeContasPage,
});

const CORES = [
  "#10B981",
  "#3B82F6",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#64748B",
];

function PlanoDeContasPage() {
  const { condominioId } = useCondominioAtivo();
  const [contas, setContas] = useState<ContaDoPlano[]>([]);
  const [loading, setLoading] = useState(true);
  const [inativas, setInativas] = useState(false);
  const [semeando, setSemeando] = useState(false);
  const [nova, setNova] = useState(false);
  const [editando, setEditando] = useState<ContaDoPlano | null>(null);

  const carregar = useCallback(async () => {
    if (!condominioId) return;
    setLoading(true);
    const r = await safeCall(
      planoDeContas({ data: { condominio_id: condominioId, incluir_inativas: inativas } }),
    );
    setContas((r ?? []) as ContaDoPlano[]);
    setLoading(false);
  }, [condominioId, inativas]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const semear = async () => {
    if (!condominioId || semeando) return;
    setSemeando(true);
    const r = await safeCall(semearPlanoDeContas({ data: { condominio_id: condominioId } }));
    setSemeando(false);
    if (!r) return;
    const partes: string[] = [];
    if (r.criadas) partes.push(`${r.criadas} conta(s) criada(s)`);
    if (r.adotadas) partes.push(`${r.adotadas} categoria(s) existente(s) codificada(s)`);
    toast.success(partes.length ? partes.join(", ") : "O plano já estava montado");
    if (r.com_sufixo > 0) {
      toast.warning(
        `${r.com_sufixo} conta(s) nasceram com o código no nome: havia já uma categoria com o mesmo nome e com lançamentos. Nada foi apagado — confira e junte à mão.`,
        { duration: 12000 },
      );
    }
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("categorias:changed"));
    carregar();
  };

  const desativar = async (c: ContaDoPlano) => {
    if (!confirm(`Desativar "${c.nome}"? Os lançamentos antigos continuam classificados nela.`))
      return;
    const r = await safeCall(desativarConta({ data: { categoria_id: c.id } }));
    if (r) {
      toast.success("Conta desativada");
      carregar();
    }
  };

  const receitas = useMemo(() => contas.filter((c) => c.tipo === "receita"), [contas]);
  const despesas = useMemo(() => contas.filter((c) => c.tipo === "despesa"), [contas]);
  const semCodigo = useMemo(() => contas.filter((c) => !c.codigo), [contas]);

  if (!condominioId) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="font-semibold text-lg">Plano de contas</h2>
          <p className="text-sm text-muted-foreground">
            A conta contábil é a mesma categoria que o lançamento usa — com código e grupo. É por
            esta árvore que a prestação de contas agrupa as receitas e as despesas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setInativas((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
          >
            {inativas ? <Eye size={15} /> : <EyeOff size={15} />}
            {inativas ? "A mostrar inativas" : "Só ativas"}
          </button>
          <button
            onClick={semear}
            disabled={semeando}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-60"
          >
            {semeando ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            Montar plano padrão
          </button>
          <button
            onClick={() => setNova(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={15} /> Nova conta
          </button>
        </div>
      </div>

      {semCodigo.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <strong>
            {semCodigo.length} conta(s) sem código:{" "}
            {semCodigo
              .slice(0, 6)
              .map((c) => c.nome)
              .join(", ")}
            {semCodigo.length > 6 ? "…" : ""}
          </strong>
          <p className="mt-1">
            Funcionam para lançar, mas ficam fora dos grupos da prestação de contas. Dê-lhes um
            código e um grupo, ou mova os lançamentos para a conta padrão equivalente.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 p-8 text-muted-foreground">
          <Loader2 className="animate-spin" size={18} /> A carregar…
        </div>
      ) : contas.length === 0 ? (
        <EmptyState
          icon={ListTree}
          title="Sem plano de contas"
          desc="Use «Montar plano padrão» para criar a árvore de um condomínio brasileiro."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Coluna
            titulo="Receitas"
            contas={receitas}
            onEditar={setEditando}
            onDesativar={desativar}
          />
          <Coluna
            titulo="Despesas"
            contas={despesas}
            onEditar={setEditando}
            onDesativar={desativar}
          />
        </div>
      )}

      {nova && (
        <FormConta
          condominioId={condominioId}
          grupos={contas.filter((c) => c.sintetica)}
          onClose={() => setNova(false)}
          onSaved={() => {
            setNova(false);
            carregar();
          }}
        />
      )}

      {editando && (
        <FormConta
          condominioId={condominioId}
          conta={editando}
          grupos={contas.filter((c) => c.sintetica && c.id !== editando.id)}
          onClose={() => setEditando(null)}
          onSaved={() => {
            setEditando(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}

function Coluna({
  titulo,
  contas,
  onEditar,
  onDesativar,
}: {
  titulo: string;
  contas: ContaDoPlano[];
  onEditar: (c: ContaDoPlano) => void;
  onDesativar: (c: ContaDoPlano) => void;
}) {
  return (
    <section className="bg-background border border-border rounded-2xl overflow-hidden">
      <header className="px-5 py-3 border-b border-border">
        <h3 className="font-display font-bold">{titulo}</h3>
      </header>
      <ul className="divide-y divide-border">
        {contas.map((c) => (
          <li
            key={c.id}
            className={`flex items-center gap-3 px-5 py-2.5 ${
              c.sintetica ? "bg-muted/40" : ""
            } ${c.ativo ? "" : "opacity-50"}`}
            style={{ paddingLeft: `${20 + (c.nivel - 1) * 18}px` }}
          >
            <span className="font-mono text-xs text-muted-foreground w-14 shrink-0">
              {c.codigo ?? "—"}
            </span>

            {c.sintetica ? (
              <span className="w-2.5 h-2.5 shrink-0" />
            ) : (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: c.cor ?? "#64748B" }}
              />
            )}

            <span
              className={`flex-1 truncate text-sm ${
                c.sintetica ? "font-bold uppercase tracking-wide text-xs" : ""
              }`}
              title={c.nome}
            >
              {c.nome}
            </span>

            {c.fundo_reserva && (
              <span className="shrink-0" title="Fundo de reserva: não é receita corrente">
                <PiggyBank size={14} className="text-teal-600" />
              </span>
            )}

            {c.em_uso && (
              <span className="text-[10px] uppercase font-semibold text-muted-foreground shrink-0">
                em uso
              </span>
            )}

            <button
              onClick={() => onEditar(c)}
              className="p-1 rounded hover:bg-muted text-muted-foreground shrink-0"
              title="Editar"
            >
              <Pencil size={14} />
            </button>

            {c.ativo && (
              <button
                onClick={() => onDesativar(c)}
                className="p-1 rounded hover:bg-muted text-muted-foreground shrink-0"
                title="Desativar"
              >
                <Ban size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function FormConta({
  condominioId,
  conta,
  grupos,
  onClose,
  onSaved,
}: {
  condominioId: string;
  conta?: ContaDoPlano;
  grupos: ContaDoPlano[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const edicao = !!conta;
  const [nome, setNome] = useState(conta?.nome ?? "");
  const [codigo, setCodigo] = useState(conta?.codigo ?? "");
  const [tipo, setTipo] = useState<"receita" | "despesa">(conta?.tipo ?? "despesa");
  const [pai, setPai] = useState(conta?.conta_pai_id ?? "");
  const [sintetica, setSintetica] = useState(conta?.sintetica ?? false);
  const [fundo, setFundo] = useState(conta?.fundo_reserva ?? false);
  const [cor, setCor] = useState(conta?.cor ?? CORES[0]);
  const [salvando, setSalvando] = useState(false);

  // O pai tem de ser do mesmo tipo: a validação está no banco, mas oferecer
  // opções que vão ser recusadas é fazer o utilizador descobrir à força.
  const paisPossiveis = grupos.filter((g) => g.tipo === tipo);

  const salvar = async () => {
    if (!nome.trim()) {
      toast.error("Informe o nome da conta");
      return;
    }
    setSalvando(true);
    const r = edicao
      ? await safeCall(
          atualizarConta({
            data: {
              categoria_id: conta!.id,
              nome: nome.trim(),
              codigo: codigo.trim() || undefined,
              conta_pai_id: pai || undefined,
              sintetica,
              fundo_reserva: fundo,
              cor,
            },
          }),
        )
      : await safeCall(
          criarConta({
            data: {
              condominio_id: condominioId,
              nome: nome.trim(),
              tipo,
              codigo: codigo.trim() || undefined,
              conta_pai_id: pai || undefined,
              sintetica,
              fundo_reserva: fundo,
              cor,
            },
          }),
        );
    setSalvando(false);
    if (!r) return;
    toast.success(edicao ? "Conta atualizada" : "Conta criada");
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("categorias:changed"));
    onSaved();
  };

  return (
    <Modal title={edicao ? "Editar conta" : "Nova conta"} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nome">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={120}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Energia elétrica"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Código">
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              maxLength={20}
              inputMode="numeric"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
              placeholder="2.2.01"
            />
          </Field>
          <Field label="Natureza">
            <select
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value as "receita" | "despesa");
                setPai("");
              }}
              disabled={edicao}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
            >
              <option value="despesa">Despesa</option>
              <option value="receita">Receita</option>
            </select>
          </Field>
        </div>

        {edicao && (
          <p className="-mt-2 text-xs text-muted-foreground">
            A natureza não se muda: os lançamentos já feitos nesta conta mudariam de lado no
            balancete.
          </p>
        )}

        <Field label="Conta superior">
          <select
            value={pai}
            onChange={(e) => setPai(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">— nenhuma (conta de primeiro nível) —</option>
            {paisPossiveis.map((g) => (
              <option key={g.id} value={g.id}>
                {g.codigo ? `${g.codigo} · ` : ""}
                {g.nome}
              </option>
            ))}
          </select>
        </Field>

        <label className="flex items-start gap-3 rounded-lg border border-border p-3">
          <input
            type="checkbox"
            checked={sintetica}
            onChange={(e) => setSintetica(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-sm">
            <strong>Conta de grupo</strong>
            <span className="block text-xs text-muted-foreground">
              Agrupa outras contas e não aceita lançamentos. O banco recusa qualquer despesa,
              cobrança ou rubrica de orçamento lançada aqui.
            </span>
          </span>
        </label>

        {!sintetica && (
          <>
            <label className="flex items-start gap-3 rounded-lg border border-border p-3">
              <input
                type="checkbox"
                checked={fundo}
                onChange={(e) => setFundo(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-sm">
                <strong>Fundo de reserva</strong>
                <span className="block text-xs text-muted-foreground">
                  Sai do saldo operacional do balancete. É poupança com destino próprio, não receita
                  corrente.
                </span>
              </span>
            </label>

            <Field label="Cor">
              <div className="flex flex-wrap gap-2">
                {CORES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCor(c)}
                    className={`w-7 h-7 rounded-full border-2 ${
                      cor === c ? "border-foreground" : "border-transparent"
                    }`}
                    style={{ background: c }}
                    aria-label={`Cor ${c}`}
                  />
                ))}
              </div>
            </Field>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {salvando && <Loader2 size={15} className="animate-spin" />}
            {edicao ? "Guardar" : "Criar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
