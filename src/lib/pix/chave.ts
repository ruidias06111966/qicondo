/**
 * A chave Pix: normalização e validação do lado do cliente.
 *
 * Isto espelha, de propósito, a restrição `condominios_chave_pix_forma` da
 * migração 20261106030000. A duplicação não é descuido: o banco é a autoridade
 * — é lá que a regra tem de estar para que nenhum caminho a contorne — mas um
 * síndico que escreva "(61) 99999-8888" merece ouvir "o Pix guarda o telefone
 * como +5561999998888" e não um erro de restrição do Postgres.
 *
 * Se as duas divergirem, a do banco ganha, e é essa que se corrige primeiro.
 */

export const TIPOS_CHAVE = ["cpf", "cnpj", "email", "telefone", "aleatoria"] as const;
export type TipoChavePix = (typeof TIPOS_CHAVE)[number];

export const ROTULO_TIPO: Record<TipoChavePix, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  telefone: "Telefone",
  aleatoria: "Chave aleatória",
};

export const EXEMPLO_TIPO: Record<TipoChavePix, string> = {
  cpf: "000.000.000-00",
  cnpj: "00.000.000/0000-00",
  email: "sindico@condominio.com.br",
  telefone: "(61) 99999-8888",
  aleatoria: "123e4567-e12b-12d1-a456-426655440000",
};

/**
 * Põe a chave na forma em que o DICT a conhece, que é a forma que tem de ir
 * dentro do BR Code.
 *
 * O CPF, o CNPJ e o telefone perdem a pontuação; o telefone ganha o `+55` se
 * não o tiver. O e-mail passa a minúsculas porque o DICT não distingue caixa
 * e um "Sindico@..." gravado assim confundiria quem comparasse à mão. A chave
 * aleatória passa a minúsculas porque é como o DICT a emite.
 */
export function normalizarChave(tipo: TipoChavePix, valor: string): string {
  const bruto = valor.trim();
  switch (tipo) {
    case "cpf":
    case "cnpj":
      return bruto.replace(/\D/g, "");
    case "telefone": {
      const digitos = bruto.replace(/\D/g, "");
      // Um número colado com o 55 à frente já traz o país; sem ele, DDD mais
      // número dão dez ou onze dígitos e falta acrescentá-lo.
      const sem55 = digitos.startsWith("55") && digitos.length > 11 ? digitos.slice(2) : digitos;
      return `+55${sem55}`;
    }
    case "email":
      return bruto.toLowerCase();
    case "aleatoria":
      return bruto.toLowerCase();
  }
}

const FORMA: Record<TipoChavePix, RegExp> = {
  cpf: /^\d{11}$/,
  cnpj: /^\d{14}$/,
  telefone: /^\+55\d{10,11}$/,
  email: /^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/,
  aleatoria: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
};

/**
 * Diz o que está errado com a chave já normalizada, ou `null` se estiver bem.
 *
 * Devolve a explicação e não um booleano porque a diferença entre "tem onze
 * dígitos a mais" e "falta o arroba" é a diferença entre o síndico corrigir
 * em dez segundos e desistir.
 */
export function erroDaChave(tipo: TipoChavePix, chaveNormalizada: string): string | null {
  if (!chaveNormalizada) return "Informe a chave Pix.";
  if (chaveNormalizada.length > 77) {
    // 77 é o que sobra para a chave dentro do template 26 do BR Code, sem
    // informação adicional (nota 22 do manual do BACEN).
    return "A chave é demasiado longa para caber num QR Code (máximo 77 caracteres).";
  }
  if (FORMA[tipo].test(chaveNormalizada)) return null;

  switch (tipo) {
    case "cpf":
      return `Um CPF tem 11 dígitos; este tem ${chaveNormalizada.replace(/\D/g, "").length}.`;
    case "cnpj":
      return `Um CNPJ tem 14 dígitos; este tem ${chaveNormalizada.replace(/\D/g, "").length}.`;
    case "telefone":
      return "O telefone precisa de DDD e número — por exemplo (61) 99999-8888.";
    case "email":
      return "E-mail inválido.";
    case "aleatoria":
      return "A chave aleatória é a sequência que o banco gera, com hífenes e 36 caracteres.";
  }
}
