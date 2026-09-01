/**
 * Destino a abrir depois de autenticar.
 *
 * Usado pelo fluxo de convite: `/auth/convite/:token` guarda o destino, manda o
 * utilizador para `/auth/login` (ou `/auth/cadastro`) e, quando a sessão fica
 * activa, voltamos ao convite em vez de cair no painel/onboarding — que era
 * onde o convite se perdia.
 */

const KEY = "qicond.destino_pos_login";

/**
 * Aceita apenas caminhos internos. Bloqueia URLs absolutos e `//host`, que o
 * browser trata como protocol-relative — caso contrário o `?next=` seria um
 * open redirect para fora do domínio.
 */
export function caminhoInternoSeguro(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const v = valor.trim();
  if (!v.startsWith("/") || v.startsWith("//")) return null;
  if (/[\r\n]/.test(v)) return null;
  return v;
}

/** `validateSearch` partilhado pelas rotas de autenticação. */
export function validarNext(search: Record<string, unknown>): { next?: string } {
  const next = caminhoInternoSeguro(search.next);
  return next ? { next } : {};
}

export function guardarDestino(path: string): void {
  const seguro = caminhoInternoSeguro(path);
  if (!seguro || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(KEY, seguro);
  } catch {
    // sessionStorage indisponível (modo privado / SSR) — o `?next=` cobre o caso
  }
}

export function lerDestino(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return caminhoInternoSeguro(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function limparDestino(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nada a fazer
  }
}

/**
 * Para onde ir após autenticar: o destino pedido (`?next=` ou o guardado) tem
 * prioridade; senão, painel para quem já pertence a uma empresa e onboarding
 * para quem ainda não pertence.
 */
export function destinoAposLogin(next: string | undefined, hasAnyRole: boolean): string {
  const alvo = caminhoInternoSeguro(next) ?? lerDestino();
  if (alvo) return alvo;
  return hasAnyRole ? "/app" : "/onboarding";
}
