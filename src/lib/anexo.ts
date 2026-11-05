/**
 * Constantes e aritmética dos anexos de comprovação.
 *
 * Separado de `contabil.functions.ts` pela mesma razão que `site.ts` está
 * separado de `site.server.ts`: isto é importado pelo cliente e não pode
 * arrastar nada de servidor atrás.
 */

export const BUCKET_COMPROVANTES = "comprovantes-condo";

export type AnexoTipo =
  | "nota_fiscal"
  | "recibo"
  | "comprovante_pagamento"
  | "boleto"
  | "contrato"
  | "extrato_bancario"
  | "outro";

export type EntidadeAnexo = "despesa" | "pagamento" | "cobranca" | "infracao";

export const ROTULO_ANEXO: Record<AnexoTipo, string> = {
  nota_fiscal: "Nota fiscal",
  recibo: "Recibo",
  comprovante_pagamento: "Comprovante de pagamento",
  boleto: "Boleto",
  contrato: "Contrato",
  extrato_bancario: "Extrato bancário",
  outro: "Outro",
};

/**
 * As duas provas que a prestação de contas exige são diferentes, e faltam
 * separadamente: uma diz que a despesa existiu, a outra que saiu dinheiro.
 */
export const TIPOS_FISCAIS: AnexoTipo[] = ["nota_fiscal", "recibo"];
export const TIPOS_COMPROVANTE: AnexoTipo[] = ["comprovante_pagamento", "extrato_bancario"];

/**
 * O caminho no Storage tem de começar pelo id do condomínio: é por esse
 * primeiro segmento que as políticas do bucket decidem quem lê e quem escreve,
 * e a função `registrar_anexo` recusa qualquer outro. É por isso que o caminho
 * se monta aqui e não no sítio onde se chama o upload.
 *
 * O nome do ficheiro não entra no caminho. Vai para a coluna `nome_arquivo`,
 * onde um acento ou um espaço não fazem mal; no caminho fariam — e um nome
 * repetido colidiria com o anexo anterior.
 */
export function caminhoDoAnexo(
  condominioId: string,
  entidade: EntidadeAnexo,
  entidadeId: string,
  nomeArquivo: string,
  uuid: () => string = () => crypto.randomUUID(),
): string {
  return `${condominioId}/${entidade}/${entidadeId}/${uuid()}.${extensaoSegura(nomeArquivo)}`;
}

/** Última extensão do nome, reduzida a letras e dígitos. `bin` se não houver. */
export function extensaoSegura(nomeArquivo: string): string {
  const pedacos = String(nomeArquivo ?? "").split(".");
  if (pedacos.length < 2) return "bin";
  const crua = pedacos[pedacos.length - 1];
  const limpa = crua
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8);
  return limpa || "bin";
}
