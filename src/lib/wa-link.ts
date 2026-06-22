/**
 * Helpers partilhados para construir links wa.me com validação e formato
 * de telefone padronizados em todo o site (Contato, Preços, Home, etc.).
 */

/** Número oficial do QiCond (E.164 sem o "+", como exigido pelo wa.me). */
export const WHATSAPP_NUMBER = "5561982750884";

/** DDDs brasileiros válidos. */
export const DDD_VALIDOS = new Set([
  "11","12","13","14","15","16","17","18","19",
  "21","22","24","27","28","31","32","33","34","35","37","38",
  "41","42","43","44","45","46","47","48","49",
  "51","53","54","55","61","62","63","64","65","66","67","68","69",
  "71","73","74","75","77","79",
  "81","82","83","84","85","86","87","88","89",
  "91","92","93","94","95","96","97","98","99",
]);

/** Remove tudo que não for dígito. */
export function limparDigitos(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

/** Máscara progressiva: (XX) XXXX-XXXX ou (XX) XXXXX-XXXX. */
export function formatarTelefone(v: string): string {
  const digits = limparDigitos(v).slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Devolve mensagem de erro detalhada ou null se válido. */
export function erroTelefone(v: string): string | null {
  const digits = limparDigitos(v);
  if (digits.length === 0) return "Informe o telefone.";
  if (digits.length < 10) return "Telefone incompleto. Digite o DDD + número.";
  if (digits.length > 11) return "Telefone muito longo. Use apenas DDD + número.";
  const ddd = digits.slice(0, 2);
  if (!DDD_VALIDOS.has(ddd)) return `DDD inválido (${ddd}). Escolha um DDD brasileiro válido.`;
  if (digits.length === 11) {
    if (digits[2] !== "9") return "Formato inválido. Celulares no Brasil começam com 9 após o DDD.";
    if (digits[3] === "0" || digits[3] === "1") return "Formato inválido. O número não pode começar com 0 ou 1.";
  }
  if (digits.length === 10) {
    if (digits[2] === "9") return "Formato inválido. Fixos não usam o 9.";
    if (digits[2] === "0" || digits[2] === "1") return "Formato inválido. O número não pode começar com 0 ou 1.";
  }
  return null;
}

export function telefoneValido(v: string): boolean {
  return erroTelefone(v) === null;
}

/** Converte para "+55 XXXXXXXXXXX" pronto para imprimir na mensagem. */
export function telefoneE164BR(v: string): string {
  const digits = limparDigitos(v);
  return digits ? `+55 ${digits}` : "";
}

/**
 * Constrói o URL wa.me com a mensagem já codificada.
 * Destino padrão: número oficial do QiCond.
 */
export function buildWaUrl(mensagem: string, destino: string = WHATSAPP_NUMBER): string {
  const tel = limparDigitos(destino) || WHATSAPP_NUMBER;
  return `https://wa.me/${tel}?text=${encodeURIComponent(mensagem)}`;
}
