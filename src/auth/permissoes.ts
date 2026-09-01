import type { Role } from "./useCondominio";

/**
 * Grupos de papéis usados para filtrar menus, abas e guardas de rota.
 *
 * Fonte única de verdade no cliente — devem espelhar as políticas RLS
 * (ver `supabase/migrations`). A RLS continua a ser a barreira real; estes
 * grupos servem para não mostrar (nem deixar navegar para) ecrãs vazios.
 */

/** Gestão total da empresa. `admin` herda tudo de `sindico`. */
export const ADMIN: Role[] = ["sindico", "admin"];

/** Pode criar/editar cobranças, despesas, categorias e config de pagamento. */
export const FIN_GERIR: Role[] = ["sindico", "admin", "contador", "financeiro"];

/**
 * Pode abrir o módulo financeiro. Moradores entram para consultar as próprias
 * cobranças (política "Morador vê próprias cobranças").
 */
export const FIN_VER: Role[] = [...FIN_GERIR, "morador", "gestor", "consulta"];

/** Portaria: quem regista encomendas e visitantes. */
export const PORTARIA: Role[] = ["sindico", "admin", "porteiro"];

/** Verdadeiro quando o papel activo pertence ao grupo (ou o grupo é aberto). */
export function temAcesso(role: Role | null, grupo?: Role[]): boolean {
  if (!grupo) return true;
  return !!role && grupo.includes(role);
}
