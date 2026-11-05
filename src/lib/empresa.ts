/**
 * A empresa que comercializa o sistema — ponto único de verdade.
 *
 * Separado de `site.ts` porque são coisas diferentes: `site.ts` diz o que o
 * sistema é (nome, domínio, remetente) e muda quando se arranca um sistema
 * novo; este diz quem o vende, e é o mesmo em todos os sistemas da linha
 * QiDomínios.
 *
 * Está aqui e não espalhado pelas páginas porque estes dados aparecem no
 * rodapé, na página de contacto, nos termos de uso, na política de privacidade
 * e na página de LGPD. Um endereço de e-mail que muda em quatro sítios e fica
 * esquecido no quinto é um cliente que escreve para uma caixa que ninguém lê.
 *
 * Só dados públicos da pessoa colectiva: razão social, CNPJ, sede e canais de
 * contacto. Nada de CPF nem de dados pessoais do sócio — isso não tem razão
 * nenhuma para estar no código de uma aplicação web.
 *
 * Importado pelo cliente, por isso só constantes estáticas.
 */

/** Razão social, como consta no registo. */
export const RAZAO_SOCIAL = "QiDomínios Tecnologia e Sistemas Ltda";

/** Nome fantasia, que é o que o público vê. */
export const NOME_FANTASIA = "QiDomínios";

export const CNPJ = "69.940.536/0001-93";

/** Registo na Junta Comercial do Distrito Federal. */
export const NIRE = "53203990904";

/** Sede, como consta no registo. */
export const ENDERECO = {
  logradouro: "Condomínio Vila Verde, Conjunto A, Casa 04",
  bairro: "Sobradinho II",
  cidade: "Brasília",
  estado: "DF",
  cep: "73090-914",
} as const;

/** Uma linha, para rodapé e documentos. */
export const ENDERECO_LINHA = `${ENDERECO.logradouro} — ${ENDERECO.bairro}, ${ENDERECO.cidade}/${ENDERECO.estado}, CEP ${ENDERECO.cep}`;

/**
 * Cada caixa tem um dono e um propósito. Quem escreve para a errada é
 * reencaminhado, mas quem publica a errada obriga toda a gente a reencaminhar.
 */
export const EMAIL = {
  /** Formulário do site, propostas, imprensa. */
  contato: "contato@qidominios.com.br",
  /** Clientes com o sistema a correr. */
  suporte: "suporte@qidominios.com.br",
  /** Faturação, contratos, assuntos administrativos. */
  administrativo: "qidominios@qidominios.com.br",
  /**
   * Encarregado pelo tratamento de dados pessoais (art. 41 da LGPD). A lei
   * pede um canal identificado, não uma caixa genérica — por isso é o
   * endereço nominal do sócio-administrador e não `suporte@`.
   */
  encarregado: "ruidias@qidominios.com.br",
} as const;

/** WhatsApp e telefone, em E.164 sem o "+", como o wa.me exige. */
export const WHATSAPP = "5561982750884";

/** O mesmo número, como se escreve. */
export const TELEFONE_FORMATADO = "(61) 98275-0884";

/** Enquadramento tributário, para as condições comerciais e a fatura. */
export const REGIME_TRIBUTARIO = "Simples Nacional";
export const PORTE = "Microempresa";

/** Identificação completa, para rodapés legais e contratos. */
export const IDENTIFICACAO = `${RAZAO_SOCIAL}, CNPJ ${CNPJ}, com sede em ${ENDERECO_LINHA}`;
