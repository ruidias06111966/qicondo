/**
 * Identidade do sistema — ponto único de verdade.
 *
 * Convenção partilhada por todos os sistemas: cada um vive num subdomínio de
 * `qidominios.com.br` com o seu próprio nome, e envia a partir de `notify.`
 * desse mesmo host. Num sistema novo mudam-se `NOME_SISTEMA` e `SUBDOMINIO`
 * aqui, e nada mais no código precisa de saber o domínio.
 *
 *   sistema   →  qicond.qidominios.com.br
 *   remetente →  notify.qicond.qidominios.com.br
 *
 * O remetente é um subdomínio próprio de propósito: mantém a reputação de envio
 * deste sistema separada da dos restantes, para que um problema de entrega num
 * não arraste os outros.
 *
 * Este ficheiro é importado tanto pelo cliente como pelo servidor, por isso só
 * contém constantes estáticas — nada de `process.env`, que não existe no
 * browser. Para o URL efetivo em runtime, ver `urlBase()` em `site.server.ts`.
 */

/** Nome apresentado ao utilizador, em e-mails e no site. */
export const NOME_SISTEMA = "QiCond";

/** Subdomínio deste sistema dentro do domínio comum. */
export const SUBDOMINIO = "qicond";

/** Domínio comum a todos os sistemas. */
export const DOMINIO_RAIZ = "qidominios.com.br";

/** Host público da aplicação. */
export const HOST = `${SUBDOMINIO}.${DOMINIO_RAIZ}`;

/** URL canónico, sem barra final. Usado em metadados e como valor de recurso. */
export const URL_SITE = `https://${HOST}`;

/** Domínio de envio. Tem de estar verificado na Resend, com SPF e DKIM. */
export const DOMINIO_REMETENTE = `notify.${HOST}`;

/** Cabeçalho `From` das mensagens transacionais. */
export const REMETENTE = `${NOME_SISTEMA} <noreply@${DOMINIO_REMETENTE}>`;

// ---------------------------------------------------------------------------
// QiGestão Assinaturas
// ---------------------------------------------------------------------------
// O sistema que cobra as mensalidades do QiCond às administradoras. Fica aqui,
// e não espalhado pelo código, pela mesma razão que o host deste sistema: é
// domínio, e domínio vive num ficheiro só.
//
// A URL da API usada pelo cron é variável de ambiente (`QIGESTAO_URL`), não
// esta constante — esta serve só para montar o link público de uma fatura, que
// vai para o browser do síndico.

/** Host do QiGestão Assinaturas, no mesmo padrão dos restantes sistemas. */
export const QIGESTAO_HOST = `qigestao-assinaturas.${DOMINIO_RAIZ}`;

/** Prefixo do link público de uma fatura: junta-se-lhe o token. */
export const QIGESTAO_FATURA_URL = `https://${QIGESTAO_HOST}/f`;
