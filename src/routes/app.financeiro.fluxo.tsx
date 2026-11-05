/**
 * Fluxo de caixa.
 *
 * O balancete diz quanto entrou e saiu no mês. Este ecrã diz em que dias — e é
 * essa a pergunta que decide se o condomínio chega ao dia 10 com dinheiro para
 * pagar o que vence no dia 10.
 *
 * DUAS COISAS SOBRE OS GRÁFICOS
 *
 * O movimento diário e o saldo corrido estão em gráficos separados, e não num
 * só com dois eixos. Duas escalas no mesmo desenho — centenas de movimento
 * contra milhares de saldo — fazem o leitor comparar alturas que não se
 * comparam.
 *
 * As cores vêm de `--viz-*`, validadas contra as duas superfícies do tema.
 * O verde fica abaixo de 3:1 de contraste no tema claro, e por isso a tabela
 * de movimento está sempre presente: quem não distingue a barra lê a linha.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Wallet, AlertTriangle, CalendarRange } from "lucide-react";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { EmptyState, safeCall } from "@/components/financeiro/ui";
import {
  concentracaoPagamentos,
  fluxoDeCaixa,
  NOME_DIA_SEMANA,
  type Concentracao,
  type FluxoDeCaixa,
} from "@/lib/fluxo.functions";
import { dataBR } from "@/lib/periodo";

export const Route = createFileRoute("/app/financeiro/fluxo")({
  head: () => ({ meta: [{ title: "Fluxo de caixa — QiCond" }] }),
  component: FluxoPage,
});

const brl = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brlCurto = (v: number) =>
  Math.abs(v) >= 1000
    ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`
    : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 });

const iso = (d: Date) => d.toISOString().slice(0, 10);
const primeiroDoMes = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const ultimoDoMes = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

type Periodo = { inicio: string; fim: string; rotulo: string };

function periodosRapidos(): Periodo[] {
  const hoje = new Date();
  const mesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const tresMeses = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
  const dozeMeses = new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1);
  return [
    { rotulo: "Este mês", inicio: iso(primeiroDoMes(hoje)), fim: iso(ultimoDoMes(hoje)) },
    {
      rotulo: "Mês passado",
      inicio: iso(primeiroDoMes(mesPassado)),
      fim: iso(ultimoDoMes(mesPassado)),
    },
    { rotulo: "3 meses", inicio: iso(primeiroDoMes(tresMeses)), fim: iso(ultimoDoMes(hoje)) },
    { rotulo: "12 meses", inicio: iso(primeiroDoMes(dozeMeses)), fim: iso(ultimoDoMes(hoje)) },
  ];
}

function FluxoPage() {
  const { condominioId } = useCondominioAtivo();
  const rapidos = useMemo(periodosRapidos, []);
  const [periodo, setPeriodo] = useState<Periodo>(rapidos[0]);
  const [fluxo, setFluxo] = useState<FluxoDeCaixa | null>(null);
  const [conc, setConc] = useState<Concentracao | null>(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!condominioId) return;
    setLoading(true);
    const args = { condominio_id: condominioId, inicio: periodo.inicio, fim: periodo.fim };
    const [f, c] = await Promise.all([
      safeCall(fluxoDeCaixa({ data: args })),
      safeCall(concentracaoPagamentos({ data: args })),
    ]);
    setFluxo((f ?? null) as FluxoDeCaixa | null);
    setConc((c ?? null) as Concentracao | null);
    setLoading(false);
  }, [condominioId, periodo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!condominioId) return null;

  const movimentou = (fluxo?.dias ?? []).filter((d) => d.entradas > 0 || d.saidas > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg">Fluxo de caixa</h2>
        <p className="text-sm text-muted-foreground">
          Regime de caixa, pela data do movimento: entra o que foi recebido, sai o que foi pago. A
          cobrança emitida e não paga está na inadimplência, que é outra pergunta.
        </p>
      </div>

      {/* Os filtros numa linha só, por cima de tudo o que eles mudam. */}
      <div className="flex flex-wrap items-center gap-2">
        <CalendarRange size={16} className="text-muted-foreground" />
        {rapidos.map((p) => (
          <button
            key={p.rotulo}
            onClick={() => setPeriodo(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              p.inicio === periodo.inicio && p.fim === periodo.fim
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:bg-muted"
            }`}
          >
            {p.rotulo}
          </button>
        ))}
        <div className="flex-1" />
        <input
          type="date"
          value={periodo.inicio}
          onChange={(e) => setPeriodo({ ...periodo, inicio: e.target.value, rotulo: "Escolhido" })}
          className="px-2 py-1.5 rounded-lg border border-border bg-background text-sm"
        />
        <span className="text-sm text-muted-foreground">a</span>
        <input
          type="date"
          value={periodo.fim}
          onChange={(e) => setPeriodo({ ...periodo, fim: e.target.value, rotulo: "Escolhido" })}
          className="px-2 py-1.5 rounded-lg border border-border bg-background text-sm"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      ) : !fluxo ? (
        <EmptyState
          icon={Wallet}
          title="Sem dados no período"
          desc="Escolha outro período, ou lance os primeiros pagamentos e despesas."
        />
      ) : (
        <>
          <Resumo f={fluxo} />
          <GraficoMovimento dias={fluxo.dias} />
          <GraficoSaldo dias={fluxo.dias} />
          <TabelaMovimento dias={movimentou} />
          {conc && <Concentracao c={conc} />}
        </>
      )}
    </div>
  );
}

function Resumo({ f }: { f: FluxoDeCaixa }) {
  const negativo = Number(f.saldo_minimo) < 0;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["Saldo de abertura", brl(f.saldo_abertura), dataBR(f.inicio)],
          ["Entradas", brl(f.entradas), "recebido no período"],
          ["Saídas", brl(f.saidas), "pago no período"],
          ["Saldo no fim", brl(f.saldo_final), dataBR(f.fim)],
        ].map(([t, v, s]) => (
          <div key={String(t)} className="bg-background border border-border rounded-2xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase">{t}</p>
            <p className="font-display text-xl font-extrabold mt-1">{v}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s}</p>
          </div>
        ))}
      </div>

      <div
        className={`flex gap-2 text-sm rounded-xl p-4 border ${
          negativo
            ? "bg-rose-50 border-rose-200 text-rose-900"
            : "bg-muted/50 border-border text-foreground"
        }`}
      >
        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
        <p>
          O saldo esteve mais baixo em{" "}
          <strong>{f.saldo_minimo_em ? dataBR(f.saldo_minimo_em) : "—"}</strong>, com{" "}
          <strong>{brl(f.saldo_minimo)}</strong>.
          {negativo
            ? " Ficou negativo: nesse dia o condomínio devia mais do que tinha em caixa."
            : " O total do período esconde este número, e é ele que diz se houve aperto."}
        </p>
      </div>
    </div>
  );
}

/** Tooltip em português, com os valores em reais. */
function Dica({
  active,
  payload,
  label,
  titulo,
}: {
  active?: boolean;
  payload?: { name?: string; dataKey?: string; value?: number; color?: string }[];
  label?: string | number;
  titulo: (l: string | number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold mb-1">{titulo(label ?? "")}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="text-xs flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.color }}
            aria-hidden
          />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-semibold ml-auto">{brl(Number(p.value ?? 0))}</span>
        </p>
      ))}
    </div>
  );
}

function Legenda({ itens }: { itens: { cor: string; rotulo: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      {itens.map((i) => (
        <span key={i.rotulo} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ background: i.cor }}
            aria-hidden
          />
          {i.rotulo}
        </span>
      ))}
    </div>
  );
}

const EIXO = { fill: "var(--muted-foreground)", fontSize: 11 };

function GraficoMovimento({
  dias,
}: {
  dias: { data: string; entradas: number; saidas: number }[];
}) {
  const dados = dias.map((d) => ({ ...d, rotulo: d.data.slice(8, 10) }));
  return (
    <div className="bg-background border border-border rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="font-semibold">Movimento do dia</p>
          <p className="text-xs text-muted-foreground">O que entrou e o que saiu, dia a dia.</p>
        </div>
        <Legenda
          itens={[
            { cor: "var(--viz-entradas)", rotulo: "Entradas" },
            { cor: "var(--viz-saidas)", rotulo: "Saídas" },
          ]}
        />
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={dados} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="rotulo"
            tick={EIXO}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={EIXO}
            axisLine={false}
            tickLine={false}
            width={52}
            tickFormatter={brlCurto}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            content={<Dica titulo={(l) => `Dia ${l}`} />}
          />
          <Bar
            dataKey="entradas"
            name="Entradas"
            fill="var(--viz-entradas)"
            radius={[4, 4, 0, 0]}
          />
          <Bar dataKey="saidas" name="Saídas" fill="var(--viz-saidas)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GraficoSaldo({ dias }: { dias: { data: string; saldo: number }[] }) {
  const dados = dias.map((d) => ({ ...d, rotulo: d.data.slice(8, 10) }));
  return (
    <div className="bg-background border border-border rounded-2xl p-5">
      <p className="font-semibold">Saldo em caixa</p>
      <p className="text-xs text-muted-foreground mb-4">
        Em gráfico próprio e não sobreposto ao movimento: a escala é outra, e alturas de escalas
        diferentes não se comparam.
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={dados} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="rotulo"
            tick={EIXO}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={EIXO}
            axisLine={false}
            tickLine={false}
            width={52}
            tickFormatter={brlCurto}
          />
          <ReferenceLine y={0} stroke="var(--viz-saidas)" strokeDasharray="4 4" />
          <Tooltip content={<Dica titulo={(l) => `Dia ${l}`} />} />
          <Line
            dataKey="saldo"
            name="Saldo"
            stroke="var(--viz-saldo)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * A tabela não é um extra. O verde das entradas fica abaixo de 3:1 de
 * contraste no tema claro, e a regra é que um gráfico nessas condições traz
 * sempre os números por escrito.
 */
function TabelaMovimento({
  dias,
}: {
  dias: { data: string; entradas: number; saidas: number; saldo: number }[];
}) {
  if (dias.length === 0) {
    return (
      <div className="bg-background border border-dashed border-border rounded-2xl p-6 text-center text-sm text-muted-foreground">
        Nenhum movimento no período.
      </div>
    );
  }
  return (
    <div className="bg-background border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <p className="font-semibold">Dias com movimento</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground uppercase bg-muted/40">
              <th className="text-left px-5 py-2.5">Data</th>
              <th className="text-right px-3 py-2.5">Entradas</th>
              <th className="text-right px-3 py-2.5">Saídas</th>
              <th className="text-right px-5 py-2.5">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {dias.map((d) => (
              <tr key={d.data} className="border-t border-border">
                <td className="px-5 py-2">{dataBR(d.data)}</td>
                <td className="px-3 py-2 text-right">{d.entradas > 0 ? brl(d.entradas) : "—"}</td>
                <td className="px-3 py-2 text-right">{d.saidas > 0 ? brl(d.saidas) : "—"}</td>
                <td
                  className={`px-5 py-2 text-right font-semibold ${Number(d.saldo) < 0 ? "text-rose-600" : ""}`}
                >
                  {brl(d.saldo)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Concentracao({ c }: { c: Concentracao }) {
  const dados = c.por_dia_do_mes;
  const pico = dados.reduce((a, b) => (b.despesas > a.despesas ? b : a), dados[0]);
  const picoReceb = dados.reduce((a, b) => (b.recebimentos > a.recebimentos ? b : a), dados[0]);
  const semana = [...c.por_dia_da_semana].sort((a, b) => b.despesas - a.despesas)[0];

  // Até que dia do mês sai metade da despesa. É o número que decide se o
  // vencimento da taxa está no sítio certo.
  const metade = useMemo(() => {
    let acc = 0;
    for (const d of dados) {
      acc += Number(d.percentagem);
      if (acc >= 50) return d.dia;
    }
    return null;
  }, [dados]);

  return (
    <div className="bg-background border border-border rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="font-semibold">Em que dias do mês sai o dinheiro</p>
          <p className="text-xs text-muted-foreground">
            Somado por dia do mês em todo o período escolhido. Com um período maior lê-se melhor o
            hábito.
          </p>
        </div>
        <Legenda
          itens={[
            { cor: "var(--viz-saidas)", rotulo: "Despesas pagas" },
            { cor: "var(--viz-entradas)", rotulo: "Recebimentos" },
          ]}
        />
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={dados} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="dia" tick={EIXO} axisLine={false} tickLine={false} />
          <YAxis
            tick={EIXO}
            axisLine={false}
            tickLine={false}
            width={52}
            tickFormatter={brlCurto}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            content={<Dica titulo={(l) => `Dia ${l} de cada mês`} />}
          />
          <Bar
            dataKey="despesas"
            name="Despesas pagas"
            fill="var(--viz-saidas)"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="recebimentos"
            name="Recebimentos"
            fill="var(--viz-entradas)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>

      {c.total_despesas > 0 && (
        <div className="mt-4 space-y-2 text-sm">
          <p>
            O dia de maior saída é o <strong>dia {pico.dia}</strong>, com {brl(pico.despesas)} —{" "}
            {Number(pico.percentagem).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% de
            tudo o que saiu. O de maior entrada é o <strong>dia {picoReceb.dia}</strong>.
          </p>
          {metade != null && (
            <p className="text-muted-foreground">
              Metade da despesa do mês já saiu até ao <strong>dia {metade}</strong>.
              {picoReceb.dia > metade
                ? " O grosso do dinheiro entra depois disso — é aí que nasce o aperto de caixa, e muda-se antecipando o vencimento, não pedindo empréstimo."
                : " O dinheiro entra antes, que é como deve ser."}
            </p>
          )}
          {semana && semana.despesas > 0 && (
            <p className="text-xs text-muted-foreground">
              Por dia da semana, o maior volume sai à {NOME_DIA_SEMANA[semana.dia]} (
              {semana.quantidade} lançamentos). Diz mais sobre o hábito de quem lança do que sobre o
              condomínio.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
