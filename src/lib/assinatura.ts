/**
 * A decisão de bloquear um condomínio por falta de pagamento.
 *
 * Está num ficheiro só, sem depender de rede nem de base de dados, porque é a
 * regra que tranca gente à porta. Um erro aqui não dá erro: dá um síndico em
 * dia que não consegue entrar na véspera da assembleia.
 *
 * A REGRA
 *
 * O QiGestão é o livro oficial de quem pagou. O QiCond guarda uma cópia com
 * data e obedece — mas só enquanto a cópia for recente.
 */

/**
 * Quantos dias um estado de bloqueio continua a valer sem ser reconfirmado.
 *
 * A assimetria que justifica isto: o caso doloroso não é o condomínio que deve
 * e continua a trabalhar — é o que JÁ PAGOU e fica bloqueado porque o QiCond
 * não conseguiu perguntar ao QiGestão se o pagamento entrou. Nessa situação
 * ninguém no QiCond tem como desfazer o engano, e quem liga a reclamar é quem
 * está em dia.
 *
 * Por isso o bloqueio expira e a falta de resposta nunca bloqueia. Sete dias
 * dão folga para uma avaria prolongada e são curtos o suficiente para a
 * inadimplência real não se arrastar. É um número, e muda-se aqui.
 */
export const TOLERANCIA_DIAS = 7;

/** Os estados que o QiGestão reporta e que significam "não pode trabalhar". */
const ESTADOS_QUE_BLOQUEIAM = new Set(["inadimplente", "cancelada"]);

export type AssinaturaEspelhada = {
  assinatura_status: string | null;
  assinatura_conhecida: boolean | null;
  assinatura_sincronizada_em: string | null;
  assinatura_fatura: FaturaEmAberto | null;
};

export type FaturaEmAberto = {
  numero: number;
  vencimento: string;
  valor: number;
  dias_atraso: number;
  token: string;
};

export type Veredicto = {
  bloqueado: boolean;
  /** Para a interface explicar porquê, e para diagnóstico. */
  motivo:
    | "em_dia"
    | "nunca_sincronizado"
    | "instalacao_desconhecida"
    | "estado_nao_bloqueia"
    | "bloqueio_expirado"
    | "inadimplente"
    | "cancelada";
  /** Dias desde a última confirmação, ou null se nunca houve. */
  diasDesdeSincronizacao: number | null;
};

/**
 * Decide se o condomínio deve ser bloqueado.
 *
 * Quatro saídas que NÃO bloqueiam, e cada uma por uma razão diferente:
 *
 * - nunca sincronizado: o QiCond ainda não falou com o QiGestão. Pode ser uma
 *   instalação nova ou uma variável de ambiente por preencher. De qualquer
 *   forma, silêncio não é dívida.
 * - instalação desconhecida: o QiGestão não conhece este condomínio. Também não
 *   é dívida — um condomínio pode existir antes de a assinatura ser criada.
 * - estado que não bloqueia: `ativa`, `teste`, `pausada`, ou qualquer valor que
 *   o QiGestão venha a inventar. Perante um estado novo, o QiCond não adivinha.
 * - bloqueio expirado: a cópia tem mais de `TOLERANCIA_DIAS` e já não é de
 *   confiança.
 */
export function avaliarAssinatura(a: AssinaturaEspelhada, agora: Date = new Date()): Veredicto {
  const sincronizadaEm = a.assinatura_sincronizada_em
    ? Date.parse(a.assinatura_sincronizada_em)
    : null;

  const dias =
    sincronizadaEm !== null && Number.isFinite(sincronizadaEm)
      ? Math.floor((agora.getTime() - sincronizadaEm) / 86_400_000)
      : null;

  if (dias === null) {
    return { bloqueado: false, motivo: "nunca_sincronizado", diasDesdeSincronizacao: null };
  }
  if (a.assinatura_conhecida === false) {
    return { bloqueado: false, motivo: "instalacao_desconhecida", diasDesdeSincronizacao: dias };
  }
  const estado = a.assinatura_status ?? "";
  if (!ESTADOS_QUE_BLOQUEIAM.has(estado)) {
    return { bloqueado: false, motivo: "estado_nao_bloqueia", diasDesdeSincronizacao: dias };
  }
  if (dias > TOLERANCIA_DIAS) {
    return { bloqueado: false, motivo: "bloqueio_expirado", diasDesdeSincronizacao: dias };
  }
  return {
    bloqueado: true,
    motivo: estado === "cancelada" ? "cancelada" : "inadimplente",
    diasDesdeSincronizacao: dias,
  };
}

/** O texto que o condómino vê. Curto, e sem culpar quem está a ler. */
export function mensagemDoBloqueio(v: Veredicto): string {
  return v.motivo === "cancelada"
    ? "A assinatura do QiCond deste condomínio foi encerrada."
    : "A mensalidade do QiCond está em atraso.";
}
