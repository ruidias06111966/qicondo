/**
 * O aviso de mensalidade em atraso, e o bloqueio quando ela se arrasta.
 *
 * Dois princípios de desenho, ambos deliberados:
 *
 * 1. Quem está bloqueado paga aqui mesmo. Um ecrã que diz "fale com o
 *    suporte" transforma uma cobrança de um minuto num telefonema de dois
 *    dias. O link da fatura do QiGestão traz o Pix.
 *
 * 2. O bloqueio é de interface, e não no RLS. Os dados financeiros de um
 *    condomínio são dele; trancá-los na base por causa de uma mensalidade em
 *    atraso é desproporcionado, ainda por cima a partir de uma cópia que pode
 *    estar errada.
 */
import { AlertTriangle, ExternalLink } from "lucide-react";
import { avaliarAssinatura, mensagemDoBloqueio, type AssinaturaEspelhada } from "@/lib/assinatura";
import { brl } from "@/lib/format";
import { QIGESTAO_FATURA_URL } from "@/lib/site";

/** Avisa antes de bloquear: a partir deste atraso, aparece a faixa. */
const DIAS_PARA_AVISAR = 1;

export function AvisoAssinatura({ assinatura }: { assinatura: AssinaturaEspelhada | null }) {
  if (!assinatura) return null;
  const v = avaliarAssinatura(assinatura);
  const fatura = assinatura.assinatura_fatura;

  if (v.bloqueado) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
        <div className="max-w-md w-full rounded-xl border border-border bg-background p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg">{mensagemDoBloqueio(v)}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                O acesso ao painel fica suspenso até a regularização. Os dados do condomínio
                continuam guardados.
              </p>
            </div>
          </div>

          {fatura ? (
            <div className="rounded-lg border border-border p-4 space-y-1">
              <p className="text-sm text-muted-foreground">Fatura {fatura.numero}</p>
              <p className="text-2xl font-bold">{brl(Number(fatura.valor))}</p>
              <p className="text-sm text-muted-foreground">
                Vencida há {fatura.dias_atraso} {fatura.dias_atraso === 1 ? "dia" : "dias"}
              </p>
            </div>
          ) : null}

          {fatura?.token ? (
            <a
              href={`${QIGESTAO_FATURA_URL}/${fatura.token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:opacity-90"
            >
              Pagar com Pix <ExternalLink size={15} />
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  // Ainda não bloqueia, mas há fatura em atraso: a faixa evita a surpresa de
  // chegar ao bloqueio sem aviso nenhum.
  if (fatura && fatura.dias_atraso >= DIAS_PARA_AVISAR) {
    return (
      <div className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-500/5 px-4 py-2 text-sm">
        <AlertTriangle size={15} className="text-amber-600 shrink-0" />
        <span>
          Mensalidade do QiCond vencida há {fatura.dias_atraso}{" "}
          {fatura.dias_atraso === 1 ? "dia" : "dias"}.
        </span>
        {fatura.token ? (
          <a
            href={`${QIGESTAO_FATURA_URL}/${fatura.token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary hover:underline ml-auto shrink-0"
          >
            Pagar
          </a>
        ) : null}
      </div>
    );
  }

  return null;
}
