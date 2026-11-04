/**
 * Contagem de dias de atraso, no mesmo fuso em que o motor de inadimplência a
 * faz (`America/Sao_Paulo`).
 *
 * A versão anterior era `Math.floor((Date.now() - new Date(vencimento)) / 86400000)`.
 * `new Date("2026-10-05")` é meia-noite UTC, e `Date.now()` é o instante
 * actual: entre as 21h e a meia-noite de Brasília a divisão passava o dia
 * seguinte e a conta dava um dia a mais. Como a multa e os juros gravados pelo
 * `aplicar_encargos_atraso` são calculados sobre o dia civil de São Paulo, o
 * ecrã mostrava 31 dias ao lado de juros de 30 — e quem confere um balancete
 * nota a diferença antes de notar a explicação.
 */

/** O dia de hoje em São Paulo, no formato `aaaa-mm-dd`. */
export function hojeSP(agora: Date = new Date()): string {
  // en-CA formata como aaaa-mm-dd, que é o que a coluna `date` devolve.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

/**
 * Dias corridos entre o vencimento e hoje. Zero ou negativo significa que
 * ainda não está em atraso — é o mesmo limite que o motor usa
 * (`vencimento < hoje`).
 *
 * As duas datas são lidas como meia-noite UTC, por isso a diferença é um
 * número inteiro de dias e não há horas a arredondar.
 */
export function diasAtraso(vencimento: string, agora: Date = new Date()): number {
  return Math.round((Date.parse(hojeSP(agora)) - Date.parse(vencimento)) / 86400000);
}
