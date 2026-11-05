/**
 * Índices económicos do Banco Central.
 *
 * O SGS publica as quatro séries em JSON, sem chave e sem registo. Os códigos
 * foram confirmados contra a API, comparando seis meses de cada uma — não
 * foram tirados de memória, e vale a pena que assim fique: um código trocado
 * mete o IGP-M onde devia estar o IPCA, e ninguém dá por isso até a assembleia
 * perguntar.
 *
 * O INCC tem duas séries: a 192, que acompanha o IGP-DI e fica um mês atrás, e
 * a 7456, que é o componente do IGP-M e sai ao mesmo tempo que ele. Usa-se a
 * 7456, a mais actual.
 *
 * A busca vive aqui e não no banco de propósito. O Postgres do Supabase não
 * faz chamadas HTTP, e dar-lhe essa capacidade por causa disto seria abrir
 * muito para ganhar pouco.
 */
import { throwSafe } from "@/lib/safe-error";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Os quatro que vêm de série publicada. Os outros são escolha de quem orça. */
export type IndicePublicado = "ipca" | "inpc" | "igpm" | "incc";

const SERIE_SGS: Record<IndicePublicado, number> = {
  ipca: 433,
  inpc: 188,
  igpm: 189,
  incc: 7456,
};

export const INDICE_PUBLICADO: IndicePublicado[] = ["ipca", "inpc", "igpm", "incc"];

export type AcumuladoIndice = {
  indice: IndicePublicado;
  meses: number;
  acumulado: number | null;
  completo: boolean;
  primeira: string | null;
  ultima: string | null;
};

type MedicaoSGS = { data: string; valor: string };

const ddmmyyyy = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

/**
 * Busca uma série. Devolve `null` em vez de rebentar: uma série em baixo não
 * pode impedir as outras três de serem actualizadas.
 */
async function buscarSerie(codigo: number, de: Date, ate: Date): Promise<MedicaoSGS[] | null> {
  const url =
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados` +
    `?formato=json&dataInicial=${ddmmyyyy(de)}&dataFinal=${ddmmyyyy(ate)}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return null;
    const corpo = (await r.json()) as unknown;
    // Em erro o SGS responde 200 com um objecto `{erro:{...}}` em vez da lista.
    if (!Array.isArray(corpo)) return null;
    return corpo as MedicaoSGS[];
  } catch {
    return null;
  }
}

/**
 * Lê as quatro séries e grava o que vier. Devolve o que gravou e o que falhou,
 * porque uma actualização silenciosamente parcial é pior do que nenhuma: quem
 * a vê fica a pensar que tem o número do mês e tem o do trimestre passado.
 */
export const atualizarIndices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ate = new Date();
    const de = new Date(ate);
    // Vinte e quatro meses: doze para o acumulado e doze de folga, para o
    // acumulado até uma data anterior continuar a ter com que ser calculado.
    de.setMonth(de.getMonth() - 24);

    const resultados = await Promise.all(
      INDICE_PUBLICADO.map(async (indice) => ({
        indice,
        serie: await buscarSerie(SERIE_SGS[indice], de, ate),
      })),
    );

    const dados: { indice: string; competencia: string; variacao: number }[] = [];
    const falhou: IndicePublicado[] = [];

    for (const { indice, serie } of resultados) {
      if (!serie) {
        falhou.push(indice);
        continue;
      }
      for (const m of serie) {
        const [, mes, ano] = m.data.split("/");
        const variacao = Number(m.valor);
        if (!mes || !ano || !Number.isFinite(variacao)) continue;
        dados.push({ indice, competencia: `${ano}-${mes}-01`, variacao });
      }
    }

    if (dados.length === 0) {
      throw new Error(
        "Não foi possível ler nenhuma série do Banco Central. Tente de novo daqui a pouco.",
      );
    }

    const { data: gravadas, error } = await context.supabase.rpc("registrar_indices", {
      _dados: dados,
    });
    if (error) throwSafe(error);

    return {
      lidas: dados.length,
      gravadas: Number(gravadas ?? 0),
      falhou,
    };
  });

/** O acumulado de doze meses dos quatro, que é o que o orçamento usa. */
export const indicesParaOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ate: z.string().optional().nullable() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("indices_para_orcamento", {
      _ate: data.ate ?? undefined,
    });
    if (error) throwSafe(error);
    return (r ?? []) as unknown as AcumuladoIndice[];
  });
