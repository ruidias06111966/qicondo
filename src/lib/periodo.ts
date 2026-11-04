/**
 * Períodos do balancete.
 *
 * Aritmética de calendário feita toda em UTC e a partir de strings `aaaa-mm-dd`.
 * Com `new Date("2026-03-01")` e os getters locais, o último dia de Fevereiro e
 * o mês anterior a Janeiro saem errados em fusos negativos — e um balancete com
 * o período errado soma o mês errado.
 */

export const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

/** `aaaa-mm-dd` → `dd/mm/aaaa`. Lê os pedaços, não constrói uma Date. */
export function dataBR(iso: string): string {
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** O mês anterior ao de `agora`, em `aaaa-mm`. É o período que normalmente se fecha. */
export function mesAnterior(agora: Date = new Date()): string {
  const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** `aaaa-mm` → primeiro e último dia desse mês, como `aaaa-mm-dd`. */
export function limitesDoMes(mes: string): { inicio: string; fim: string } {
  const [a, m] = mes.split("-").map(Number);
  // Dia 0 do mês seguinte é o último dia deste.
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimo).padStart(2, "0")}` };
}

/**
 * Rótulo do período. Um mês civil completo diz-se pelo nome do mês — "março de
 * 2026" lê-se melhor num balancete do que "01/03/2026 a 31/03/2026". Qualquer
 * outro intervalo mostra as duas datas.
 */
export function rotuloPeriodo(inicio: string, fim: string): string {
  const [ai, mi, di] = inicio.slice(0, 10).split("-").map(Number);
  const [af, mf, df] = fim.slice(0, 10).split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(af, mf, 0)).getUTCDate();
  if (ai === af && mi === mf && di === 1 && df === ultimoDia) {
    return `${MESES[mi - 1]} de ${ai}`;
  }
  return `${dataBR(inicio)} a ${dataBR(fim)}`;
}
