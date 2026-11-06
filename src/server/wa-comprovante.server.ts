/**
 * O comprovante de pagamento que chega pelo WhatsApp.
 *
 * O PIX estático não avisa ninguém: o condómino paga e o sistema não sabe. O
 * comprovante, esse, existe — está no telefone de quem pagou, dois segundos
 * depois de pagar. Até aqui o webhook ignorava-o, porque só tratava texto.
 *
 * Isto NÃO dá baixa. Uma imagem pode ser de outro mês, de outro beneficiário,
 * ou de mais nada. A baixa continua a ser um acto do síndico com o extracto ao
 * lado; o que muda é que ele deixa de a fazer às cegas.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BUCKET_COMPROVANTES, caminhoDoAnexo } from "@/lib/anexo";
import {
  MIMES_COMPROVANTE,
  TAMANHO_MAXIMO_COMPROVANTE,
  nomeDoComprovante,
  validarMidiaComprovante,
  type CobrancaEmAberto,
} from "@/lib/comprovante";
import { baixarMidiaWA, type WaConfig } from "./whatsapp.server";

const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const brl = (n: number) =>
  `R$ ${Number(n || 0)
    .toFixed(2)
    .replace(".", ",")}`;

/** `2026-03` → `Mar/2026`. Vazio fica `—`, e não `NaN/undefined`. */
export function competenciaCurta(competencia: string | null | undefined): string {
  const [y, m] = String(competencia ?? "").split("-");
  const i = Number(m) - 1;
  return meses[i] ? `${meses[i]}/${y}` : "—";
}

/**
 * As cobranças que a unidade tem em aberto, com o total devido hoje.
 *
 * `pendente`, `vencida` e `parcial` — as três em que faz sentido comprovar. O
 * total inclui multa e juros porque é o que o condómino pagou, e é por esse
 * número que o síndico vai conferir o comprovante.
 */
export async function cobrancasEmAberto(unidadeId: string): Promise<CobrancaEmAberto[]> {
  const { data } = await supabaseAdmin
    .from("cobrancas")
    .select("id, competencia, vencimento, valor, multa, juros, desconto, valor_pago")
    .eq("unidade_id", unidadeId)
    .in("status", ["pendente", "vencida", "parcial"])
    .order("vencimento", { ascending: true })
    .limit(5);

  return (data ?? []).map((c: any) => ({
    id: c.id,
    competencia: c.competencia,
    vencimento: c.vencimento,
    total:
      Number(c.valor || 0) +
      Number(c.multa || 0) +
      Number(c.juros || 0) -
      Number(c.desconto || 0) -
      Number(c.valor_pago || 0),
  }));
}

/** A lista numerada que o condómino vê. Base 1, como a resposta que vai dar. */
export function listaNumerada(cobrancas: CobrancaEmAberto[]): string {
  return cobrancas
    .map((c, i) => `${i + 1}) ${competenciaCurta(c.competencia)} — ${brl(c.total)}`)
    .join("\n");
}

/**
 * As razões por que a base recusa, traduzidas.
 *
 * A função `registrar_comprovante_whatsapp` levanta códigos. Mandar o código
 * ao condómino é mandá-lo ligar ao síndico para perguntar o que significa.
 */
const RECUSAS: Record<string, string> = {
  conversa_desconhecida:
    "Não reconheço este número. Peça ao síndico para vincular o seu número à sua unidade.",
  numero_sem_unidade:
    "Este número ainda não está vinculado a uma unidade. Peça ao síndico para fazer o vínculo.",
  cobranca_de_outra_unidade: "Essa cobrança é de outra unidade.",
  cobranca_de_outro_condominio: "Essa cobrança não é deste condomínio.",
  cobranca_nao_encontrada: "Não encontrei essa cobrança.",
  cobranca_nao_comprovavel: "Essa cobrança não está em aberto — não há o que comprovar.",
  comprovantes_demais:
    "Essa cobrança já tem cinco comprovantes anexados. Fale com o síndico, que os documentos estão lá.",
};

export type ResultadoComprovante =
  { ok: true; anexoId: string; cobranca: CobrancaEmAberto } | { ok: false; mensagem: string };

/**
 * Descarrega a mídia da Meta, escreve no Storage e registra o anexo.
 *
 * A ordem importa. O ficheiro sobe primeiro e o registo vem depois, como no
 * resto dos anexos: um `storage_path` sem ficheiro é um registo a menos mau do
 * que um ficheiro no bucket que ninguém sabe a que cobrança pertence. Se o
 * registo falhar, o ficheiro é apagado — aqui dá, porque quem o escreveu foi
 * esta função e sabe o caminho.
 */
export async function guardarComprovante(params: {
  cfg: WaConfig;
  condominioId: string;
  telefone: string;
  mediaId: string;
  cobranca: CobrancaEmAberto;
}): Promise<ResultadoComprovante> {
  const { cfg, condominioId, telefone, mediaId, cobranca } = params;

  const baixa = await baixarMidiaWA(cfg, mediaId, {
    mimesAceitos: MIMES_COMPROVANTE,
    tamanhoMaximo: TAMANHO_MAXIMO_COMPROVANTE,
  });
  if (!baixa.ok) {
    // O `baixarMidiaWA` já recusa pelo tipo e pelo tamanho declarados; passar
    // pelo validador outra vez só serve para obter a frase em PT-BR.
    const comoRecusa = validarMidiaComprovante({
      mimeType: baixa.error === "tipo_nao_aceito" ? "application/octet-stream" : "image/jpeg",
      tamanho: baixa.error === "grande_demais" ? TAMANHO_MAXIMO_COMPROVANTE + 1 : 0,
    });
    return {
      ok: false,
      mensagem: comoRecusa.ok
        ? "Não consegui baixar o arquivo. Pode enviar de novo?"
        : comoRecusa.mensagem,
    };
  }

  const validacao = validarMidiaComprovante({ mimeType: baixa.mimeType, tamanho: baixa.tamanho });
  if (!validacao.ok) return { ok: false, mensagem: validacao.mensagem };

  const nome = nomeDoComprovante(cobranca.competencia, validacao.extensao);
  const caminho = caminhoDoAnexo(condominioId, "cobranca", cobranca.id, nome);

  const { error: erroUpload } = await supabaseAdmin.storage
    .from(BUCKET_COMPROVANTES)
    .upload(caminho, baixa.bytes, { contentType: validacao.mime, upsert: false });

  if (erroUpload) {
    console.error("[wa-comprovante] upload falhou", erroUpload.message);
    return {
      ok: false,
      mensagem: "Não consegui guardar o arquivo agora. Tente de novo em alguns minutos.",
    };
  }

  const { data: anexoId, error } = await supabaseAdmin.rpc("registrar_comprovante_whatsapp", {
    _condominio_id: condominioId,
    _cobranca_id: cobranca.id,
    _telefone: telefone,
    _storage_path: caminho,
    _nome_arquivo: nome,
    _mime_type: validacao.mime,
    _tamanho_bytes: baixa.tamanho,
  } as any);

  if (error) {
    // O registo é que manda. Sem ele, o ficheiro não pertence a nada.
    await supabaseAdmin.storage.from(BUCKET_COMPROVANTES).remove([caminho]);
    const codigo = String(error.message ?? "").match(/[a-z_]{6,}/)?.[0] ?? "";
    console.error("[wa-comprovante] registo falhou", error.message);
    return {
      ok: false,
      mensagem: RECUSAS[codigo] ?? "Não consegui registrar o comprovante. Fale com o síndico.",
    };
  }

  return { ok: true, anexoId: String(anexoId), cobranca };
}

/** O que se responde a quem acabou de mandar um comprovante que entrou. */
export function confirmacao(cobranca: CobrancaEmAberto): string {
  return (
    `✅ Comprovante recebido para ${competenciaCurta(cobranca.competencia)} (${brl(cobranca.total)}).\n\n` +
    "A cobrança continua em aberto até o síndico conferir no extrato — é ele que dá a baixa. " +
    "Guarde o seu comprovante até lá."
  );
}
