/**
 * Prestação de contas por conta contábil.
 *
 * O balancete já dava os totais do período numa lista plana por categoria.
 * Isto dá a árvore — cada grupo com o subtotal dos seus — e, ao lado de cada
 * conta, quantos dos seus lançamentos têm documento.
 *
 * SEM GRÁFICO, E DE PROPÓSITO
 *
 * Quem lê uma prestação de contas quer os números, não a forma. Um gráfico de
 * barras por conta com sessenta contas é ilegível, e com seis esconde as
 * outras cinquenta e quatro. O que esta página mostra em vez disso é a lacuna
 * documental, que é a pergunta que o conselho fiscal faz e que nenhum gráfico
 * responde: de tudo o que foi pago, o que é que não tem papel.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileWarning, CalendarRange, Scale, Receipt, Loader2 } from "lucide-react";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { EmptyState, Stat, safeCall } from "@/components/financeiro/ui";
import {
  prestacaoPorConta,
  pendenciasDocumentais,
  type LinhaPrestacao,
  type Pendencia,
} from "@/lib/contabil.functions";
import { dataBR } from "@/lib/periodo";

export const Route = createFileRoute("/app/financeiro/prestacao")({
  head: () => ({ meta: [{ title: "Prestação de contas — QiCond" }] }),
  component: PrestacaoPage,
});

const brl = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const iso = (d: Date) => d.toISOString().slice(0, 10);
const primeiroDoMes = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const ultimoDoMes = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

type Periodo = { inicio: string; fim: string; rotulo: string };

function periodosRapidos(): Periodo[] {
  const hoje = new Date();
  const mesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const tresMeses = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
  return [
    { rotulo: "Este mês", inicio: iso(primeiroDoMes(hoje)), fim: iso(ultimoDoMes(hoje)) },
    {
      rotulo: "Mês passado",
      inicio: iso(primeiroDoMes(mesPassado)),
      fim: iso(ultimoDoMes(mesPassado)),
    },
    { rotulo: "Trimestre", inicio: iso(primeiroDoMes(tresMeses)), fim: iso(ultimoDoMes(hoje)) },
    {
      rotulo: "Exercício",
      inicio: `${hoje.getFullYear()}-01-01`,
      fim: `${hoje.getFullYear()}-12-31`,
    },
  ];
}

function PrestacaoPage() {
  const { condominioId } = useCondominioAtivo();
  const rapidos = useMemo(periodosRapidos, []);
  const [periodo, setPeriodo] = useState<Periodo>(rapidos[0]);
  const [linhas, setLinhas] = useState<LinhaPrestacao[]>([]);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!condominioId) return;
    setLoading(true);
    const args = { condominio_id: condominioId, inicio: periodo.inicio, fim: periodo.fim };
    const [p, d] = await Promise.all([
      safeCall(prestacaoPorConta({ data: args })),
      safeCall(pendenciasDocumentais({ data: args })),
    ]);
    setLinhas((p ?? []) as LinhaPrestacao[]);
    setPendencias((d ?? []) as Pendencia[]);
    setLoading(false);
  }, [condominioId, periodo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!condominioId) return null;

  const comMovimento = linhas.filter((l) => l.lancamentos > 0);
  const receitas = comMovimento.filter((l) => l.tipo === "receita");
  const despesas = comMovimento.filter((l) => l.tipo === "despesa");

  // O total do tipo é a raiz, não a soma das linhas: somar a árvore inteira
  // contaria cada lançamento uma vez por cada antepassado que tem.
  const totalDe = (tipo: "receita" | "despesa") =>
    comMovimento.find((l) => l.tipo === tipo && l.nivel === 1)?.valor ??
    comMovimento.filter((l) => l.tipo === tipo && !l.sintetica).reduce((s, l) => s + l.valor, 0);

  const totalReceitas = totalDe("receita");
  const totalDespesas = totalDe("despesa");

  const folhas = comMovimento.filter((l) => !l.sintetica);
  const lancamentos = folhas.reduce((s, l) => s + l.lancamentos, 0);
  const documentados = folhas.reduce((s, l) => s + l.documentados, 0);

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <h2 className="font-semibold text-lg">Prestação de contas</h2>
        <p className="text-sm text-muted-foreground">
          Receitas e despesas do período agrupadas pelo plano de contas, com a prova documental de
          cada conta. O regime é de caixa: entra o que foi recebido, sai o que foi pago.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <CalendarRange size={16} className="text-muted-foreground" />
        {rapidos.map((p) => (
          <button
            key={p.rotulo}
            onClick={() => setPeriodo(p)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold border ${
              periodo.rotulo === p.rotulo
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {p.rotulo}
          </button>
        ))}
        <span className="text-xs text-muted-foreground ml-1">
          {dataBR(periodo.inicio)} a {dataBR(periodo.fim)}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 p-8 text-muted-foreground">
          <Loader2 className="animate-spin" size={18} /> A carregar…
        </div>
      ) : comMovimento.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="Sem movimento no período"
          desc="Não há receitas recebidas nem despesas pagas entre estas datas."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Receipt} label="Receitas" value={brl(totalReceitas)} tone="success" />
            <Stat icon={Receipt} label="Despesas" value={brl(totalDespesas)} tone="danger" />
            <Stat
              icon={Scale}
              label="Resultado"
              value={brl(totalReceitas - totalDespesas)}
              tone={totalReceitas - totalDespesas >= 0 ? "success" : "danger"}
            />
            <Stat
              icon={FileWarning}
              label="Com documento"
              value={`${documentados} de ${lancamentos}`}
              tone={documentados === lancamentos ? "success" : "danger"}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Tabela titulo="Receitas" linhas={receitas} />
            <Tabela titulo="Despesas" linhas={despesas} />
          </div>
        </>
      )}

      <section className="space-y-3">
        <div className="max-w-3xl">
          <h3 className="font-semibold">Pendências documentais</h3>
          <p className="text-sm text-muted-foreground">
            Despesas do período sem nota fiscal, sem comprovante de pagamento, ou sem nenhum dos
            dois. São provas diferentes: uma mostra que a despesa existiu, a outra que saiu
            dinheiro.
          </p>
        </div>

        {loading ? null : pendencias.length === 0 ? (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
            Todas as despesas do período têm nota e comprovante.
          </div>
        ) : (
          <div className="bg-background border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Data</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Conta</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Despesa</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Valor</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Falta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendencias.map((p) => (
                  <tr key={p.despesa_id}>
                    <td className="px-4 py-2.5 whitespace-nowrap">{dataBR(p.data)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      <span className="font-mono text-xs">{p.conta_codigo ?? "—"}</span>{" "}
                      {p.conta_nome ?? "sem conta"}
                    </td>
                    <td className="px-4 py-2.5">
                      {p.descricao}
                      {p.fornecedor && (
                        <span className="text-muted-foreground"> · {p.fornecedor}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap">
                      {brl(p.valor)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex flex-wrap gap-1.5">
                        {!p.tem_fiscal && (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                            nota fiscal
                          </span>
                        )}
                        {!p.tem_comprovante && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                            comprovante
                          </span>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
              Anexe os documentos na aba <strong>Despesas</strong>, no botão de anexos de cada
              lançamento.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function Tabela({ titulo, linhas }: { titulo: string; linhas: LinhaPrestacao[] }) {
  if (linhas.length === 0) return null;
  return (
    <section className="bg-background border border-border rounded-2xl overflow-hidden">
      <header className="px-5 py-3 border-b border-border">
        <h3 className="font-display font-bold">{titulo}</h3>
      </header>
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left font-semibold">Conta</th>
            <th className="px-4 py-2 text-right font-semibold">Valor</th>
            <th className="px-4 py-2 text-right font-semibold">Documentos</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {linhas.map((l) => {
            const completo = l.documentados === l.lancamentos;
            return (
              <tr key={l.conta_id} className={l.sintetica ? "bg-muted/30 font-semibold" : ""}>
                <td className="px-4 py-2" style={{ paddingLeft: `${16 + (l.nivel - 1) * 16}px` }}>
                  <span className="font-mono text-xs text-muted-foreground">{l.codigo ?? "—"}</span>{" "}
                  <span className={l.sintetica ? "uppercase text-xs tracking-wide" : ""}>
                    {l.nome}
                  </span>
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">{brl(l.valor)}</td>
                <td
                  className={`px-4 py-2 text-right whitespace-nowrap text-xs ${
                    completo ? "text-muted-foreground" : "font-semibold text-rose-600"
                  }`}
                >
                  {l.documentados} de {l.lancamentos}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
