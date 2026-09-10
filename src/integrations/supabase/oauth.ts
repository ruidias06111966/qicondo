/**
 * Login social através do Supabase Auth.
 *
 * Cada fornecedor tem de estar activo em Authentication → Providers, e o URL
 * `<origem>/auth/callback` tem de constar da lista de Redirect URLs do projeto.
 */
import { supabase } from "./client";

export type ProvedorOAuth = "google" | "azure" | "apple";

/**
 * Inicia o fluxo OAuth. Em caso de sucesso o browser é redirecionado para o
 * fornecedor, pelo que o código a seguir à chamada não chega a correr; só
 * retorna de facto quando há erro.
 */
export async function entrarComOAuth(
  provider: ProvedorOAuth,
  opcoes?: { redirectTo?: string },
): Promise<{ error: Error | null }> {
  const redirectTo =
    opcoes?.redirectTo ??
    (typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined);

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      // Sem isto o Google só devolve refresh token no primeiro consentimento,
      // e a sessão deixa de se renovar em logins seguintes.
      ...(provider === "google"
        ? { queryParams: { access_type: "offline", prompt: "consent" } }
        : {}),
    },
  });

  return { error: error ?? null };
}
