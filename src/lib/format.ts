export const brl = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n ?? 0));

export const dateBR = (s: string | Date | null | undefined) => {
  if (!s) return "—";
  const d = typeof s === "string" ? new Date(s) : s;
  return d.toLocaleDateString("pt-BR");
};

export const dateTimeBR = (s: string | Date | null | undefined) => {
  if (!s) return "—";
  const d = typeof s === "string" ? new Date(s) : s;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

export const timeBR = (s: string | Date | null | undefined) => {
  if (!s) return "—";
  const d = typeof s === "string" ? new Date(s) : s;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

export const competenciaBR = (s: string | null | undefined) => {
  if (!s) return "—";
  const [y, m] = s.split("-");
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${meses[Number(m) - 1]}/${y}`;
};
