/**
 * Resolução do URL público em runtime.
 *
 * Separado de `src/lib/site.ts` porque lê `process.env`, que não existe no
 * browser — e por estar sob `src/server/`, o `importProtection` do
 * `vite.config.ts` faz o build falhar se alguma vez for importado a partir de
 * código de cliente.
 */
import { URL_SITE } from "@/lib/site";

/**
 * URL público, sem barra final.
 *
 * `SITE_URL` sobrepõe-se ao domínio canónico nos ambientes que não correm em
 * produção — pré-visualizações e testes —, para que os links enviados por
 * e-mail apontem para o sítio de onde partiram.
 */
export function urlBase(): string {
  return (process.env.SITE_URL ?? URL_SITE).replace(/\/$/, "");
}
