import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { EmptyState, Field, safeCall } from "@/components/financeiro/ui";
import {
  calcularBalancete,
  fecharBalancete,
  listarBalancetes,
  obterBalancete,
  publicarBalancete,
  reabrirBalancete,
  type Balancete,
  type CategoriaBalancete,
  type DadosBalancete,
} from "@/lib/balancete.functions";
import { abrirBalancetePDF } from "@/lib/balancete-impressao";
import { dataBR, limitesDoMes, mesAnterior, rotuloPeriodo } from "@/lib/periodo";
import { toast } from "sonner";
import {
  ArrowLeft,
  ClipboardList,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Printer,
  RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/app/prestacao-contas")({
  head: () => ({ meta: [{ title: "Prestação de contas" }] }),
  component: PrestacaoContasPage,
});

type Resumo = Omit<Balancete, "dados">;

function PrestacaoContasPage() {
  const { condominioId, podeGerirFinanceiro } = useCondominioAtivo();
  const [lista, setLista] = useState<Resumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [nomeCondominio, setNomeCondominio] = useState("Condomínio");

  const [aberto, setAberto] = useState<Balancete | null>(null);
  const [previsao, setPrevisao] = useState<DadosBalancete | null>(null);

  const [mes, setMes] = useState(mesAnterior());
  const [observacoes, setObservacoes] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!condominioId) return;
    setLoading(true);
    const r = await safeCall(listarBalancetes({ data: { condominio_id: condominioId } }));
    setLista((r ?? []) as Resumo[]);
    setLoading(false);
  }, [condominioId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!condominioId) return;
    supabase
      .from("condominios")
      .select("nome")
      .eq("id", condominioId)
      .single()
      .then(({ data }) => {
        if (data?.nome) setNomeCondominio(data.nome);
      });
  }, [condominioId]);

  const previsualizar = async () => {
    if (!condominioId) return;
    const { inicio, fim } = limitesDoMes(mes);
    setOcupado("previsao");
    const r = await safeCall(
      calcularBalancete({ data: { condominio_id: condominioId, inicio, fim } }),
    );
    setOcupado(null);
    if (r) {
      setPrevisao(r as DadosBalancete);
      setAberto(null);
    }
  };

  const fechar = async () => {
    if (!condominioId) return;
    const { inicio, fim } = limitesDoMes(mes);
    setOcupado("fechar");
    const r = await safeCall(
      fecharBalancete({
        data: { condominio_id: condominioId, inicio, fim, observacoes: observacoes || null },
      }),
    );
    setOcupado(null);
    if (r) {
      toast.success("Período fechado como rascunho. Revise e publique.");
      setPrevisao(null);
      setObservacoes("");
      await carregar();
      abrir(r.id);
    }
  };

  const abrir = async (id: string) => {
    setOcupado(id);
    const r = await safeCall(obterBalancete({ data: { id } }));
    setOcupado(null);
    if (r) {
      setAberto(r as Balancete);
      setPrevisao(null);
    }
  };

  const publicar = async (id: string) => {
    if (
      !confirm(
        "Publicar este balancete?\n\nA partir daqui todos os condóminos passam a ver " +
          "as contas deste período, incluindo as despesas linha a linha.",
      )
    )
      return;
    setOcupado(id);
    const r = await safeCall(publicarBalancete({ data: { id } }));
    setOcupado(null);
    if (r) {
      toast.success("Balancete publicado aos condóminos");
      await carregar();
      abrir(id);
    }
  };

  const reabrir = async (id: string) => {
    const motivo = prompt(
      "Reabrir este balancete para correcção.\n\n" +
        "Sai imediatamente da vista dos condóminos e o motivo fica no registo " +
        "de auditoria. Motivo:",
    );
    if (motivo === null) return;
    setOcupado(id);
    const r = await safeCall(reabrirBalancete({ data: { id, motivo: motivo || null } }));
    setOcupado(null);
    if (r) {
      toast.success("Balancete reaberto");
      await carregar();
      abrir(id);
    }
  };

  if (!condominioId) {
    return (
      <div className="p-10 text-muted-foreground">
        Selecione uma empresa para ver a prestação de contas.
      </div>
    );
  }

  // --- Documento aberto (gravado) ---------------------------------------
  if (aberto) {
    return (
      <div className="p-6 lg:p-10 max-w-5xl space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setAberto(null)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} /> Todos os períodos
          </button>
          <div className="flex-1" />
          <button
            onClick={() => abrirBalancetePDF(aberto, nomeCondominio)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-semibold"
          >
            <Printer size={16} /> Imprimir / PDF
          </button>
          {podeGerirFinanceiro &&
            (aberto.status === "rascunho" ? (
              <button
                onClick={() => publicar(aberto.id)}
                disabled={ocupado === aberto.id}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
              >
                <Eye size={16} /> Publicar aos condóminos
              </button>
            ) : (
              <button
                onClick={() => reabrir(aberto.id)}
                disabled={ocupado === aberto.id}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-semibold disabled:opacity-60"
              >
                <EyeOff size={16} /> Reabrir para correcção
              </button>
            ))}
        </div>

        <Documento
          dados={aberto.dados}
          titulo={rotuloPeriodo(aberto.periodo_inicio, aberto.periodo_fim)}
          estado={aberto.status}
          publicadoEm={aberto.publicado_em}
          observacoes={aberto.observacoes}
        />
      </div>
    );
  }

  // --- Lista + fecho de período ----------------------------------------
  return (
    <div className="p-6 lg:p-10 max-w-5xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold flex items-center gap-2">
          <ClipboardList size={26} /> Prestação de contas
        </h1>
        <p className="text-muted-foreground mt-1">
          {podeGerirFinanceiro
            ? "Feche o período, reveja e publique. Enquanto estiver em rascunho, só quem gere o financeiro vê."
            : "As contas do condomínio, período a período, como o síndico as publicou."}
        </p>
      </header>

      {podeGerirFinanceiro && (
        <div className="border border-border rounded-2xl p-5 space-y-4">
          <p className="font-semibold">Fechar um período</p>
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <Field label="Mês">
              <input
                type="month"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </Field>
            <Field label="Observações (opcional, saem no documento)">
              <input
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex.: obra do elevador aprovada na assembleia de 12/03"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </Field>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={previsualizar}
              disabled={ocupado === "previsao"}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-semibold disabled:opacity-60"
            >
              {ocupado === "previsao" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              Pré-visualizar
            </button>
            <button
              onClick={fechar}
              disabled={ocupado === "fechar"}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
            >
              <Lock size={16} /> Fechar período
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Fechar grava os números e as linhas tal como estão agora. Corrigir uma despesa depois
            disso não altera um balancete já fechado — é preciso reabri-lo e fechá-lo outra vez.
          </p>
        </div>
      )}

      {previsao && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-500">
            <Eye size={16} /> Pré-visualização — nada foi gravado
          </div>
          <Documento
            dados={previsao}
            titulo={rotuloPeriodo(previsao.periodo.inicio, previsao.periodo.fim)}
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : !lista.length ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhum período fechado"
          desc={
            podeGerirFinanceiro
              ? "Feche o primeiro período acima para começar a prestar contas."
              : "O síndico ainda não publicou nenhuma prestação de contas."
          }
        />
      ) : (
        <div className="border border-border rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Período</th>
                <th className="text-right px-4 py-3 font-semibold">Receitas</th>
                <th className="text-right px-4 py-3 font-semibold">Despesas</th>
                <th className="text-right px-4 py-3 font-semibold">Saldo final</th>
                <th className="text-left px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lista.map((b) => (
                <tr key={b.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium capitalize">
                    {rotuloPeriodo(b.periodo_inicio, b.periodo_fim)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {brl(Number(b.total_receitas))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {brl(Number(b.total_despesas))}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono font-semibold ${
                      Number(b.saldo_final) < 0 ? "text-rose-600" : ""
                    }`}
                  >
                    {brl(Number(b.saldo_final))}
                  </td>
                  <td className="px-4 py-3">
                    {b.status === "publicado" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-500">
                        <Eye size={13} /> Publicado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-500">
                        <EyeOff size={13} /> Rascunho
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => abrir(b.id)}
                      disabled={ocupado === b.id}
                      className="text-sm font-semibold text-primary hover:underline disabled:opacity-60"
                    >
                      {ocupado === b.id ? "A abrir…" : "Abrir"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** O documento em si. O mesmo render serve a pré-visualização e o gravado — se
 *  divergissem, o síndico publicaria algo diferente do que reviu. */
function Documento({
  dados,
  titulo,
  estado,
  publicadoEm,
  observacoes,
}: {
  dados: DadosBalancete;
  titulo: string;
  estado?: "rascunho" | "publicado";
  publicadoEm?: string | null;
  observacoes?: string | null;
}) {
  const d = dados;
  const temFundo = Number(d.receitas.fundo_reserva) > 0;

  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-border">
        <h2 className="font-display text-xl font-bold capitalize">{titulo}</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Regime de caixa: entram os valores efectivamente recebidos e pagos no período, pela data
          do movimento.
          {estado === "publicado" && publicadoEm
            ? ` Publicado em ${dataBR(publicadoEm)}.`
            : estado === "rascunho"
              ? " Rascunho — os condóminos ainda não veem."
              : ""}
        </p>
      </div>

      <table className="w-full text-sm">
        <tbody>
          <Linha rotulo="Saldo anterior" valor={d.saldo_anterior} />
          <Linha rotulo="(+) Receitas recebidas" valor={d.receitas.total} />
          <Linha rotulo="(−) Despesas pagas" valor={d.despesas.total} />
          <tr className="border-t-2 border-foreground">
            <td className="px-5 py-3 font-bold">Saldo final</td>
            <td
              className={`px-5 py-3 text-right font-mono font-bold text-base ${
                Number(d.saldo_final) < 0 ? "text-rose-600" : ""
              }`}
            >
              {brl(Number(d.saldo_final))}
            </td>
          </tr>
        </tbody>
      </table>

      {(temFundo || Number(d.inadimplencia.total) > 0) && (
        <div className="px-5 py-4 border-t border-border bg-muted/30 text-xs space-y-1.5">
          {temFundo && (
            <p>
              Das receitas, <strong>{brl(Number(d.receitas.fundo_reserva))}</strong> são fundo de
              reserva, de destino próprio, e {brl(Number(d.receitas.operacional))} são receita
              corrente.
            </p>
          )}
          {Number(d.inadimplencia.total) > 0 && (
            <p>
              À data de fecho havia <strong>{brl(Number(d.inadimplencia.total))}</strong> em atraso
              ({d.inadimplencia.cobrancas} cobrança(s) de {d.inadimplencia.unidades} unidade(s)),
              que não entram neste saldo por não terem sido recebidos.
            </p>
          )}
        </div>
      )}

      <Secao titulo="Receitas por categoria" cats={d.receitas.por_categoria} />
      <Secao titulo="Despesas por categoria" cats={d.despesas.por_categoria} />

      <div className="border-t border-border">
        <p className="px-5 pt-4 pb-2 font-semibold text-sm">Despesas — movimento</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-2 font-semibold">Data</th>
                <th className="text-left px-5 py-2 font-semibold">Descrição</th>
                <th className="text-left px-5 py-2 font-semibold">Fornecedor</th>
                <th className="text-left px-5 py-2 font-semibold">Categoria</th>
                <th className="text-right px-5 py-2 font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {d.lancamentos.despesas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-muted-foreground">
                    Nenhuma despesa no período
                  </td>
                </tr>
              ) : (
                d.lancamentos.despesas.map((l, i) => (
                  <tr key={i}>
                    <td className="px-5 py-2 whitespace-nowrap">{dataBR(l.data)}</td>
                    <td className="px-5 py-2">
                      {l.anexo_url ? (
                        <a
                          href={l.anexo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          {l.descricao}
                        </a>
                      ) : (
                        l.descricao
                      )}
                    </td>
                    <td className="px-5 py-2">{l.fornecedor || "—"}</td>
                    <td className="px-5 py-2">{l.categoria}</td>
                    <td className="px-5 py-2 text-right font-mono">{brl(Number(l.valor))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {observacoes && (
        <div className="px-5 py-4 border-t border-border text-sm">
          <p className="font-semibold mb-1">Observações</p>
          <p className="text-muted-foreground">{observacoes}</p>
        </div>
      )}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <tr className="border-t border-border">
      <td className="px-5 py-2.5">{rotulo}</td>
      <td className="px-5 py-2.5 text-right font-mono">{brl(Number(valor))}</td>
    </tr>
  );
}

function Secao({ titulo, cats }: { titulo: string; cats: CategoriaBalancete[] }) {
  return (
    <div className="border-t border-border">
      <p className="px-5 pt-4 pb-2 font-semibold text-sm">{titulo}</p>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-border">
          {cats.length === 0 ? (
            <tr>
              <td className="px-5 py-4 text-muted-foreground">Nada no período</td>
            </tr>
          ) : (
            cats.map((c) => (
              <tr key={c.categoria}>
                <td className="px-5 py-2 flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: c.cor ?? "#94a3b8" }}
                  />
                  {c.categoria}
                  {c.fundo_reserva && (
                    <span className="text-[10px] uppercase tracking-wide bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 px-1.5 py-0.5 rounded">
                      fundo de reserva
                    </span>
                  )}
                </td>
                <td className="px-5 py-2 text-right font-mono">{brl(Number(c.valor))}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
