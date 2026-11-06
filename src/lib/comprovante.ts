/**
 * Regras do comprovante de pagamento que chega pelo WhatsApp.
 *
 * Aqui só a parte que não fala com ninguém: o que se aceita, com que nome se
 * guarda, e a qual cobrança pertence. O download da Meta e a escrita no
 * Storage ficam do lado do servidor — isto tem de poder ser testado sem rede.
 *
 * Importado pelo cliente (o ecrã do síndico usa os rótulos), por isso não
 * arrasta nada de servidor atrás. A mesma razão de `site.ts` estar separado de
 * `site.server.ts`.
 */

/**
 * O que se aceita como comprovante.
 *
 * Os três formatos de imagem que a Meta entrega e o PDF que os bancos mandam
 * por e-mail. Nada mais: um ficheiro que o síndico não consegue abrir no
 * telefone não serve de prova, e um que o navegador executa não devia estar
 * num bucket que ele vai abrir.
 */
export const MIMES_COMPROVANTE = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export type MimeComprovante = (typeof MIMES_COMPROVANTE)[number];

/**
 * Cinco megabytes.
 *
 * Uma fotografia de ecrã de telemóvel dá entre 100 KB e 2 MB; um PDF de banco,
 * menos de 200 KB. O tecto não está aqui para rejeitar comprovantes legítimos:
 * está para que um vídeo de trinta segundos mandado por engano não vá ao
 * bucket. A Meta entrega imagens até 5 MB e documentos até 100 MB, por isso o
 * limite tem de ser nosso.
 */
export const TAMANHO_MAXIMO_COMPROVANTE = 5 * 1024 * 1024;

/** Quantos comprovantes uma cobrança aceita. Igual ao tecto da migração. */
export const COMPROVANTES_POR_COBRANCA = 5;

const EXTENSAO: Record<MimeComprovante, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export type RecusaMidia = {
  ok: false;
  /** Código para o registo. */
  motivo: "tipo_nao_aceito" | "grande_demais" | "vazio";
  /** O que se diz ao condómino, em PT-BR e sem jargão. */
  mensagem: string;
};

/**
 * Aceita ou recusa o ficheiro, com a frase que o bot vai responder.
 *
 * A mensagem vem daqui e não do sítio da chamada de propósito: uma recusa sem
 * explicação faz o condómino reenviar o mesmo ficheiro três vezes e depois
 * ligar ao síndico.
 */
export function validarMidiaComprovante(m: {
  mimeType?: string | null;
  tamanho?: number | null;
}): { ok: true; mime: MimeComprovante; extensao: string } | RecusaMidia {
  const mime = String(m.mimeType ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (!MIMES_COMPROVANTE.includes(mime as MimeComprovante)) {
    return {
      ok: false,
      motivo: "tipo_nao_aceito",
      mensagem:
        "Só consigo guardar foto (JPG, PNG, WEBP) ou PDF. Se mandou áudio ou vídeo, tire uma foto do comprovante ou envie o PDF do banco.",
    };
  }

  const tamanho = Number(m.tamanho ?? 0);
  if (!Number.isFinite(tamanho) || tamanho <= 0) {
    return {
      ok: false,
      motivo: "vazio",
      mensagem: "O arquivo chegou vazio. Pode enviar de novo?",
    };
  }
  if (tamanho > TAMANHO_MAXIMO_COMPROVANTE) {
    return {
      ok: false,
      motivo: "grande_demais",
      mensagem: `O arquivo tem ${Math.round(tamanho / 1024 / 1024)} MB e o limite é 5 MB. Envie uma foto do comprovante em vez do arquivo inteiro.`,
    };
  }

  return { ok: true, mime: mime as MimeComprovante, extensao: EXTENSAO[mime as MimeComprovante] };
}

/**
 * O nome com que o comprovante aparece ao síndico.
 *
 * Não é o nome que veio do telefone: numa foto de WhatsApp ele é
 * `IMG-20260315-WA0007.jpg`, que não diz nada a quem está a conferir. A
 * competência diz.
 */
export function nomeDoComprovante(
  competencia: string | null | undefined,
  extensao: string,
): string {
  const comp = String(competencia ?? "").slice(0, 7);
  const sufixo = /^\d{4}-\d{2}$/.test(comp) ? comp : "sem-competencia";
  return `comprovante-${sufixo}.${extensao}`;
}

export type CobrancaEmAberto = {
  id: string;
  competencia: string;
  vencimento: string;
  /** Total devido hoje, já com multa e juros. */
  total: number;
};

export type EscolhaCobranca =
  | { tipo: "uma"; cobranca: CobrancaEmAberto }
  | { tipo: "nenhuma" }
  | { tipo: "ambigua"; cobrancas: CobrancaEmAberto[] }
  | { tipo: "numero_invalido"; cobrancas: CobrancaEmAberto[] };

/**
 * A qual cobrança pertence o comprovante que acabou de chegar.
 *
 * Com uma cobrança em aberto não se pergunta nada: perguntar "qual?" a quem só
 * tem uma é fazer o condómino trabalhar para o sistema. Com várias pergunta-se,
 * porque adivinhar aqui é anexar a prova de Março à cobrança de Abril e depois
 * dar baixa na errada.
 *
 * `escolhido` é o número que o condómino respondeu, se já respondeu — base 1,
 * como aparece na mensagem.
 */
export function escolherCobranca(
  cobrancas: CobrancaEmAberto[],
  escolhido?: string | null,
): EscolhaCobranca {
  const lista = cobrancas ?? [];
  if (lista.length === 0) return { tipo: "nenhuma" };

  if (escolhido != null && String(escolhido).trim() !== "") {
    const cru = String(escolhido).trim();
    // Dígitos e mais nada. O `parseInt` é permissivo: dá 1 para `"1.5x"` e
    // para `"1 - março"`, o que fazia uma resposta sem sentido escolher a
    // primeira cobrança em silêncio. Melhor pedir outra vez.
    if (!/^\d+$/.test(cru)) return { tipo: "numero_invalido", cobrancas: lista };
    const n = Number.parseInt(cru, 10);
    if (n < 1 || n > lista.length) {
      return { tipo: "numero_invalido", cobrancas: lista };
    }
    return { tipo: "uma", cobranca: lista[n - 1] };
  }

  if (lista.length === 1) return { tipo: "uma", cobranca: lista[0] };
  return { tipo: "ambigua", cobrancas: lista };
}
