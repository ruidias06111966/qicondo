/**
 * Cartas de cobrança e certidões de nada consta.
 *
 * As duas coisas no mesmo ecrã de propósito: saem da mesma dívida, e são
 * mutuamente exclusivas. Com valores em aberto só há carta; sem valores em
 * aberto só há certidão. O ecrã mostra a dívida primeiro e deixa o botão que
 * faz sentido — em vez de deixar escolher e devolver erro.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { FileCheck, Printer, Search, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { EmptyState, Field, safeCall } from "@/components/financeiro/ui";
import {
  cartaCobranca,
  conferirCertidao,
  dividaDaUnidade,
  emitirNadaConsta,
  listarCertidoes,
  type Certidao,
  type Conferencia,
  type Divida,
} from "@/lib/certidao.functions";
import { abrirCartaPDF, abrirNadaConstaPDF } from "@/lib/certidao-impressao";
import { listarUnidades } from "@/lib/unidades.functions";
import { dataBR } from "@/lib/periodo";

export const Route = createFileRoute("/app/financeiro/certidoes")({
  head: () => ({ meta: [{ title: "Cartas e certidões — QiCond" }] }),
  component: CertidoesPage,
});

const brl = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Unidade = { id: string; bloco: string | null; numero: string };

const rotuloUnidade = (u: { bloco: string | null; numero: string }) =>
  u.bloco ? `${u.bloco} · ${u.numero}` : u.numero;

function CertidoesPage() {
  const { condominioId } = useCondominioAtivo();
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [unidadeId, setUnidadeId] = useState("");
  const [divida, setDivida] = useState<Divida | null>(null);
  const [carregandoDivida, setCarregandoDivida] = useState(false);
  const [certidoes, setCertidoes] = useState<Certidao[]>([]);
  const [prazo, setPrazo] = useState(10);
  const [validade, setValidade] = useState(30);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    if (!condominioId) return;
    const [us, cs] = await Promise.all([
      safeCall(listarUnidades({ data: { condominio_id: condominioId } })),
      safeCall(listarCertidoes({ data: { condominio_id: condominioId } })),
    ]);
    setUnidades((us ?? []) as Unidade[]);
    setCertidoes((cs ?? []) as Certidao[]);
  }, [condominioId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!unidadeId) {
      setDivida(null);
      return;
    }
    let activo = true;
    setCarregandoDivida(true);
    safeCall(dividaDaUnidade({ data: { unidade_id: unidadeId } })).then((d) => {
      if (!activo) return;
      setDivida((d ?? null) as Divida | null);
      setCarregandoDivida(false);
    });
    return () => {
      activo = false;
    };
  }, [unidadeId]);

  const gerarCarta = async () => {
    if (!unidadeId) return;
    setOcupado(true);
    const c = await safeCall(cartaCobranca({ data: { unidade_id: unidadeId, prazo_dias: prazo } }));
    setOcupado(false);
    if (c) abrirCartaPDF(c);
  };

  const emitir = async () => {
    if (!unidadeId) return;
    setOcupado(true);
    const r = await safeCall(
      emitirNadaConsta({ data: { unidade_id: unidadeId, validade_dias: validade } }),
    );
    if (r && condominioId) {
      const cs = ((await safeCall(listarCertidoes({ data: { condominio_id: condominioId } }))) ??
        []) as Certidao[];
      setCertidoes(cs);
      const nova = cs.find((c) => c.id === r.id);
      toast.success(nova ? `Certidão ${nova.codigo} emitida` : "Certidão emitida");
      if (nova) abrirNadaConstaPDF(nova);
    }
    setOcupado(false);
  };

  if (!condominioId) return null;

  const temDivida = !!divida && Number(divida.total) > 0;
  const temAcordo = !!divida && divida.acordos_ativos.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg">Cartas e certidões</h2>
        <p className="text-sm text-muted-foreground">
          A carta de cobrança notifica o débito; o nada consta certifica que não há. Os dois saem da
          dívida apurada hoje.
        </p>
      </div>

      <div className="bg-background border border-border rounded-2xl p-5 space-y-4">
        <Field label="Unidade">
          <select
            value={unidadeId}
            onChange={(e) => setUnidadeId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          >
            <option value="">Escolha a unidade…</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {rotuloUnidade(u)}
              </option>
            ))}
          </select>
        </Field>

        {carregandoDivida && <p className="text-sm text-muted-foreground">A apurar a dívida…</p>}

        {divida && !carregandoDivida && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ["Principal", divida.principal],
                ["Multa", divida.multa],
                ["Juros", divida.juros],
                ["Total", divida.total],
              ].map(([rotulo, valor], i) => (
                <div
                  key={String(rotulo)}
                  className={`rounded-xl border border-border p-3 ${i === 3 ? "bg-muted" : ""}`}
                >
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    {String(rotulo)}
                  </p>
                  <p className="font-display text-lg font-bold">{brl(Number(valor))}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Apurado em {dataBR(divida.referencia)}. Multa e juros correm por dia de atraso.
            </p>

            {divida.itens.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground uppercase">
                      <th className="text-left py-2">Cobrança</th>
                      <th className="text-left py-2">Vencimento</th>
                      <th className="text-right py-2">Dias</th>
                      <th className="text-right py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {divida.itens.map((i) => (
                      <tr key={i.cobranca_id} className="border-t border-border">
                        <td className="py-2">
                          {i.descricao ?? "Cobrança"}
                          {i.de_acordo && (
                            <span className="ml-2 text-xs text-violet-700">
                              parcela {i.parcela_num} de acordo
                            </span>
                          )}
                        </td>
                        <td className="py-2">{dataBR(i.vencimento)}</td>
                        <td className="py-2 text-right">{i.dias_atraso}</td>
                        <td className="py-2 text-right font-semibold">
                          {brl(Number(i.principal) + Number(i.multa) + Number(i.juros))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {temAcordo && (
              <div className="flex gap-2 text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <p>
                  Há acordo de parcelamento em cumprimento ({divida.acordos_ativos.length}). Um
                  acordo activo é dívida parcelada, e o art. 1.345 transfere-a a quem adquire a
                  fração — por isso não se emite nada consta enquanto durar.
                </p>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4 pt-2">
              <div className="rounded-xl border border-border p-4 space-y-3">
                <p className="font-semibold text-sm">Carta de cobrança</p>
                <Field label="Prazo para pagamento (dias)">
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={prazo}
                    onChange={(e) => setPrazo(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </Field>
                <button
                  onClick={gerarCarta}
                  disabled={!temDivida || ocupado}
                  className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Printer size={16} /> Gerar carta
                </button>
                {!temDivida && (
                  <p className="text-xs text-muted-foreground">
                    Sem valores em aberto não há o que cobrar.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-border p-4 space-y-3">
                <p className="font-semibold text-sm">Nada consta</p>
                <Field label="Validade (dias)">
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={validade}
                    onChange={(e) => setValidade(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </Field>
                <button
                  onClick={emitir}
                  disabled={temDivida || temAcordo || ocupado}
                  className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <ShieldCheck size={16} /> Emitir certidão
                </button>
                {(temDivida || temAcordo) && (
                  <p className="text-xs text-muted-foreground">
                    {temDivida
                      ? "A unidade tem valores em aberto."
                      : "A unidade tem acordo em cumprimento."}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <Conferir />

      <div>
        <h3 className="font-semibold mb-3">Certidões emitidas</h3>
        {certidoes.length === 0 ? (
          <EmptyState
            icon={FileCheck}
            title="Nenhuma certidão emitida"
            desc="O nada consta é o documento que o tabelião pede na venda da fração."
          />
        ) : (
          <div className="space-y-2">
            {certidoes.map((c) => {
              const expirada = new Date(c.valida_ate) < new Date(new Date().toDateString());
              return (
                <div
                  key={c.id}
                  className="bg-background border border-border rounded-xl p-4 flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono font-semibold text-sm">{c.codigo}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.unidade ? rotuloUnidade(c.unidade) : "—"} · emitida em{" "}
                      {dataBR(c.emitida_em)} · válida até {dataBR(c.valida_ate)}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${
                      expirada
                        ? "bg-muted text-muted-foreground"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {expirada ? "expirada" : "válida"}
                  </span>
                  <button
                    onClick={() => abrirNadaConstaPDF(c)}
                    className="p-2 rounded-lg hover:bg-muted"
                    title="Imprimir"
                  >
                    <Printer size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Conferência pelo código, para quem recebe a certidão e quer validá-la. */
function Conferir() {
  const [codigo, setCodigo] = useState("");
  const [r, setR] = useState<Conferencia | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const conferir = async () => {
    if (codigo.trim().length < 6) return;
    setOcupado(true);
    const res = await safeCall(conferirCertidao({ data: { codigo } }));
    setR((res ?? null) as Conferencia | null);
    setOcupado(false);
  };

  return (
    <div className="bg-background border border-border rounded-2xl p-5 space-y-3">
      <p className="font-semibold text-sm">Conferir uma certidão</p>
      <div className="flex gap-2">
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="NC-2026-0001-AB12CD34"
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
        />
        <button
          onClick={conferir}
          disabled={ocupado}
          className="px-4 py-2 rounded-lg border border-border text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"
        >
          <Search size={16} /> Conferir
        </button>
      </div>
      {r && (
        <div
          className={`text-sm rounded-xl p-3 border ${
            r.valida
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          {r.valida ? (
            <p>
              Certidão {r.codigo} válida até {dataBR(String(r.valida_ate))}
              {r.dados ? ` — ${rotuloUnidade(r.dados.unidade)}` : ""}.
            </p>
          ) : (
            <p>
              {r.motivo === "expirada"
                ? `Certidão ${r.codigo} expirou em ${dataBR(String(r.valida_ate))}.`
                : "Código não encontrado."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
