// Roteador do bot conversacional do WhatsApp.
// Recebe mensagens do morador, atualiza estado em wa_bot_estado e responde.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { escolherCobranca, type CobrancaEmAberto } from "@/lib/comprovante";
import { montarBrCode } from "@/lib/pix/brcode";
import {
  cobrancasEmAberto,
  competenciaCurta,
  confirmacao,
  guardarComprovante,
  listaNumerada,
} from "./wa-comprovante.server";
import { enviarTextoWA, type WaConfig } from "./whatsapp.server";

const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const brl = (n: number) =>
  `R$ ${Number(n || 0)
    .toFixed(2)
    .replace(".", ",")}`;
const dt = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

const MENU = `Olá! 👋 Sou o assistente do condomínio. Escolha uma opção:

1️⃣ Segunda via de boleto / PIX
2️⃣ Status das minhas reservas
3️⃣ Abrir uma ocorrência
4️⃣ Falar com o síndico
5️⃣ Documentos oficiais (atas, convenção, regimento)
6️⃣ Enviar comprovante de pagamento

Responda apenas com o número.`;

type Conversa = {
  id: string;
  condominio_id: string;
  telefone: string;
  unidade_id: string | null;
  user_id: string | null;
  nome: string | null;
};

/**
 * Responder, guardar estado e limpá-lo.
 *
 * Estavam fechados dentro do `processarMensagemBot`. O caminho da mídia precisa
 * exactamente dos mesmos, e duplicá-los era garantir que um dia divergiam —
 * tipicamente no `wa_mensagens`, que deixaria de registar metade das respostas.
 */
function ajudantes(cfg: WaConfig, conversa: Conversa) {
  const responder = async (texto: string) => {
    const r = await enviarTextoWA(cfg, conversa.telefone, texto);
    await supabaseAdmin.from("wa_mensagens").insert({
      conversa_id: conversa.id,
      condominio_id: conversa.condominio_id,
      direcao: "saida",
      tipo: "texto",
      texto,
      wa_message_id: r.ok ? r.waMessageId : null,
      status: r.ok ? "enviada" : "falha",
      erro: r.ok ? null : (r as any).error,
      enviado_em: r.ok ? new Date().toISOString() : null,
    });
  };

  const setEstado = async (intent: string, passo: string | null, dados: any = {}) => {
    await supabaseAdmin.from("wa_bot_estado").upsert(
      {
        conversa_id: conversa.id,
        intent: intent as any,
        passo,
        dados,
        expira_em: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
      { onConflict: "conversa_id" },
    );
  };

  const lerEstado = async () => {
    const { data } = await supabaseAdmin
      .from("wa_bot_estado")
      .select("*")
      .eq("conversa_id", conversa.id)
      .maybeSingle();
    return data as any;
  };

  return { responder, setEstado, limparEstado: () => setEstado("menu", null, {}), lerEstado };
}

export async function processarMensagemBot(
  cfg: WaConfig,
  conversa: Conversa,
  textoIn: string,
  contexto?: { tipo: string; id: string } | null,
) {
  const { responder, setEstado, limparEstado, lerEstado } = ajudantes(cfg, conversa);
  const estado = await lerEstado();

  const txt = (textoIn || "").trim().toLowerCase();

  // Comandos globais
  if (["menu", "0", "voltar", "cancelar", "oi", "olá", "ola"].includes(txt)) {
    await limparEstado();
    return responder(cfg.saudacao ? `${cfg.saudacao}\n\n${MENU}` : MENU);
  }

  // Sem unidade vinculada
  if (!conversa.unidade_id) {
    return responder(
      "Não consegui localizar seu cadastro. Peça ao síndico para vincular este número (" +
        conversa.telefone +
        ") à sua unidade.",
    );
  }

  // Estado ativo
  if (estado?.intent && estado.intent !== "menu") {
    return continuarFluxo(estado, txt, conversa, cfg, responder, setEstado, limparEstado);
  }

  // Menu inicial
  if (txt === "1") return iniciarSegundaVia(conversa, responder, setEstado);
  if (txt === "2") return statusReservas(conversa, responder, limparEstado);
  if (txt === "3") return iniciarOcorrencia(conversa, responder, setEstado);
  if (txt === "4") {
    await limparEstado();
    return responder(
      "Tudo bem! Em breve um responsável entrará em contato. Você também pode mandar sua mensagem agora que repasso.",
    );
  }
  if (txt === "5") return iniciarDocumentos(conversa, responder, setEstado);
  if (txt === "6") return iniciarComprovante(conversa, responder, setEstado);

  // Confirmação de visitante (resposta a notificação)
  if (
    contexto?.tipo === "visitante" &&
    (txt === "sim" || txt === "s" || txt === "não" || txt === "nao" || txt === "n")
  ) {
    return confirmarVisitante(conversa, contexto.id, txt.startsWith("s"), responder);
  }

  await limparEstado();
  return responder(`Não entendi 🤔\n\n${MENU}`);
}

async function iniciarSegundaVia(
  c: Conversa,
  responder: (s: string) => Promise<void>,
  setEstado: any,
) {
  const { data: cobs } = await supabaseAdmin
    .from("cobrancas")
    .select(
      "id, competencia, vencimento, valor, multa, juros, desconto, status, mp_qr_code, mp_ticket_url",
    )
    .eq("unidade_id", c.unidade_id!)
    .in("status", ["pendente", "vencida", "parcial"])
    .order("vencimento", { ascending: true })
    .limit(5);

  if (!cobs || cobs.length === 0) {
    await setEstado("menu", null, {});
    return responder("✅ Você não tem cobranças em aberto. Tudo em dia!");
  }

  const linhas = cobs.map((cb: any, i: number) => {
    const [y, m] = (cb.competencia || "").split("-");
    const comp = m ? `${meses[Number(m) - 1]}/${y}` : "—";
    const total =
      Number(cb.valor || 0) +
      Number(cb.multa || 0) +
      Number(cb.juros || 0) -
      Number(cb.desconto || 0);
    return `${i + 1}) ${comp} — ${brl(total)} — vence ${dt(cb.vencimento)}`;
  });

  await setEstado("segunda_via_boleto", "escolher", { ids: cobs.map((c: any) => c.id) });
  return responder(
    `Você tem ${cobs.length} cobrança(s) em aberto:\n\n${linhas.join("\n")}\n\nResponda com o número para receber o PIX/boleto, ou 0 para voltar.`,
  );
}

async function statusReservas(
  c: Conversa,
  responder: (s: string) => Promise<void>,
  limpar: () => Promise<any>,
) {
  await limpar();
  const { data } = await supabaseAdmin
    .from("reservas")
    .select("id, inicio, fim, status, areas_comuns:area_id(nome)")
    .eq("unidade_id", c.unidade_id!)
    .gte("inicio", new Date(Date.now() - 7 * 86400000).toISOString())
    .order("inicio", { ascending: true })
    .limit(10);
  if (!data || data.length === 0) return responder("Você não tem reservas recentes.");
  const linhas = data.map((r: any) => {
    const area = r.areas_comuns?.nome ?? "Área";
    const ini = new Date(r.inicio);
    const dia = ini.toLocaleDateString("pt-BR");
    const hora = ini.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return `• ${area} — ${dia} ${hora} — ${r.status}`;
  });
  return responder(`📅 Suas reservas:\n\n${linhas.join("\n")}`);
}

async function iniciarOcorrencia(
  c: Conversa,
  responder: (s: string) => Promise<void>,
  setEstado: any,
) {
  await setEstado("abrir_ocorrencia", "titulo", {});
  return responder(
    "Vamos abrir uma ocorrência. 📝\n\nQual é o título? (ex.: lâmpada queimada na garagem)\n\nResponda 0 para cancelar.",
  );
}

async function iniciarDocumentos(
  c: Conversa,
  responder: (s: string) => Promise<void>,
  setEstado: any,
) {
  const { data: docs } = await supabaseAdmin
    .from("documentos")
    .select("id, titulo, categoria")
    .eq("condominio_id", c.condominio_id)
    .eq("aprovado", true)
    .eq("visivel_publico", true)
    .order("created_at", { ascending: false })
    .limit(10);
  if (!docs || docs.length === 0) {
    await setEstado("menu", null, {});
    return responder("📂 Nenhum documento público disponível no momento.");
  }
  const linhas = docs.map((d: any, i: number) => `${i + 1}) [${d.categoria}] ${d.titulo}`);
  await setEstado("documentos", "escolher", { ids: docs.map((d: any) => d.id) });
  return responder(
    `📂 Documentos disponíveis:\n\n${linhas.join("\n")}\n\nResponda com o número para receber o link, ou 0 para voltar.`,
  );
}

/**
 * O PIX da cobrança, pela função real.
 *
 * O que estava aqui lia `mp_qr_code` e `mp_ticket_url` — colunas do Mercado
 * Pago, que nunca foram preenchidas porque o Mercado Pago não está em uso. O
 * condómino pedia a segunda via e recebia "o síndico ainda não emitiu cobrança
 * bancária para este lançamento", sempre, desde que a funcionalidade existe.
 *
 * O `pix_da_cobranca` calcula multa e juros devidos hoje, por isso o valor é o
 * de hoje e não o do dia da emissão.
 */
async function mandarPix(cobrancaId: string, responder: (s: string) => Promise<void>) {
  const { data, error } = await supabaseAdmin.rpc("pix_da_cobranca", {
    _cobranca_id: cobrancaId,
  } as any);

  const pix = Array.isArray(data) ? (data[0] as any) : (data as any);
  if (error || !pix?.chave) {
    // O caso mais comum é o condomínio não ter chave PIX configurada. Dizê-lo
    // é melhor do que um "tente mais tarde" que não dá nada a fazer.
    console.error("[wa-bot] pix_da_cobranca", error?.message);
    return responder(
      "O condomínio ainda não cadastrou a chave PIX. Peça ao síndico para cadastrá-la no sistema — sem isso não consigo gerar o código.",
    );
  }

  // O BR Code não vem da base: a função devolve os campos e o payload é
  // montado aqui, pelo mesmo `montarBrCode` que o ecrã usa. Um gerador só, e
  // não dois que um dia divergem no CRC.
  let brcode: string;
  try {
    brcode = montarBrCode({
      chave: pix.chave,
      nome: pix.recebedor,
      cidade: pix.cidade,
      centavos: Number(pix.centavos),
      txid: pix.txid,
    });
  } catch (e) {
    // Um payload que o gerador recusa é melhor do que um QR que o banco
    // recusa. Aqui ainda se consegue dizer que o problema é do cadastro.
    console.error("[wa-bot] montarBrCode", e instanceof Error ? e.message : e);
    return responder(
      "Não consegui gerar o código PIX com os dados cadastrados do condomínio. Avise o síndico.",
    );
  }

  const composicao: string[] = [`${brl(Number(pix.principal))} de principal`];
  if (Number(pix.multa) > 0) composicao.push(`${brl(Number(pix.multa))} de multa`);
  if (Number(pix.juros) > 0) composicao.push(`${brl(Number(pix.juros))} de juros`);

  const linhas = [`💰 ${pix.descricao ?? "Cobrança"}`, `Total: ${brl(Number(pix.centavos) / 100)}`];
  // A composição só se escreve quando há mais do que principal: «R$ 400,00 (R$
  // 400,00 de principal)» não explica nada a ninguém.
  if (composicao.length > 1) linhas.push(`(${composicao.join(" + ")})`);
  linhas.push("", `Recebedor: ${pix.recebedor}`, "", "PIX Copia e Cola:", brcode, "");
  linhas.push(
    "Depois de pagar, mande o comprovante aqui (opção 6). O PIX não me avisa do pagamento — é o síndico que confere no extrato e dá a baixa.",
  );
  return responder(linhas.join("\n"));
}

/**
 * Começa o envio de comprovante.
 *
 * Com uma cobrança em aberto não se pergunta qual: perguntar a quem só tem uma
 * é fazer o condómino trabalhar para o sistema.
 */
async function iniciarComprovante(
  c: Conversa,
  responder: (s: string) => Promise<void>,
  setEstado: any,
) {
  const abertas = await cobrancasEmAberto(c.unidade_id!);
  const escolha = escolherCobranca(abertas);

  if (escolha.tipo === "nenhuma") {
    await setEstado("menu", null, {});
    return responder("✅ Você não tem cobranças em aberto. Não há comprovante a enviar.");
  }

  if (escolha.tipo === "uma") {
    await setEstado("enviar_comprovante", "aguardar_ficheiro", {
      cobranca: escolha.cobranca,
    });
    return responder(
      `Vou anexar o comprovante à cobrança de ${competenciaCurta(escolha.cobranca.competencia)} (${brl(escolha.cobranca.total)}).\n\n` +
        "Mande agora a *foto* ou o *PDF* do comprovante. 📎\n\nResponda 0 para cancelar.",
    );
  }

  await setEstado("enviar_comprovante", "escolher", { abertas });
  return responder(
    `Você tem ${abertas.length} cobranças em aberto:\n\n${listaNumerada(abertas)}\n\n` +
      "Responda com o número da que pagou, ou 0 para voltar.",
  );
}

/**
 * Uma imagem ou um PDF que chegou à conversa.
 *
 * Dois caminhos. Se o condómino estava no fluxo da opção 6, já se sabe a que
 * cobrança pertence. Se mandou a foto sem mais nada — que é o que as pessoas
 * fazem — resolve-se com o que se sabe: uma cobrança em aberto, anexa-se; mais
 * do que uma, pergunta-se, e guarda-se o id da mídia para anexar depois da
 * resposta. A Meta guarda a mídia catorze dias, por isso não há pressa.
 */
export async function processarMidiaBot(
  cfg: WaConfig,
  conversa: Conversa,
  midia: { mediaId: string },
) {
  const { responder, setEstado, limparEstado, lerEstado } = ajudantes(cfg, conversa);

  if (!conversa.unidade_id) {
    return responder(
      `Recebi o arquivo, mas não consigo localizar seu cadastro. Peça ao síndico para vincular este número (${conversa.telefone}) à sua unidade.`,
    );
  }

  const estado = await lerEstado();
  const anexar = async (cobranca: CobrancaEmAberto) => {
    const r = await guardarComprovante({
      cfg,
      condominioId: conversa.condominio_id,
      telefone: conversa.telefone,
      mediaId: midia.mediaId,
      cobranca,
    });
    await limparEstado();
    return responder(r.ok ? confirmacao(r.cobranca) : r.mensagem);
  };

  if (estado?.intent === "enviar_comprovante" && estado.passo === "aguardar_ficheiro") {
    const guardada = estado.dados?.cobranca as CobrancaEmAberto | undefined;
    if (guardada?.id) return anexar(guardada);
  }

  const abertas = await cobrancasEmAberto(conversa.unidade_id);
  const escolha = escolherCobranca(abertas);

  if (escolha.tipo === "nenhuma") {
    await limparEstado();
    return responder(
      "Recebi o arquivo, mas você não tem cobranças em aberto — não há onde anexá-lo. Se for de outra coisa, fale com o síndico.",
    );
  }

  if (escolha.tipo === "uma") return anexar(escolha.cobranca);

  // Várias. Guarda-se a mídia e pergunta-se, em vez de adivinhar: adivinhar é
  // anexar a prova de Março à cobrança de Abril e dar baixa na errada.
  await setEstado("enviar_comprovante", "escolher_da_midia", {
    abertas,
    media_id: midia.mediaId,
  });
  return responder(
    `Recebi o comprovante. 📎\n\nVocê tem ${abertas.length} cobranças em aberto:\n\n${listaNumerada(abertas)}\n\n` +
      "Responda com o número da que este comprovante paga.",
  );
}

async function continuarFluxo(
  estado: any,
  txt: string,
  c: Conversa,
  cfg: WaConfig,
  responder: (s: string) => Promise<void>,
  setEstado: any,
  limpar: () => Promise<any>,
) {
  if (estado.intent === "segunda_via_boleto" && estado.passo === "escolher") {
    const idx = parseInt(txt, 10) - 1;
    const ids: string[] = estado.dados?.ids ?? [];
    if (Number.isNaN(idx) || idx < 0 || idx >= ids.length) {
      return responder("Número inválido. Tente novamente ou envie 0 para voltar.");
    }
    await limpar();
    return mandarPix(ids[idx], responder);
  }

  if (estado.intent === "enviar_comprovante") {
    // A lista foi guardada no estado, e não relida: entre a pergunta e a
    // resposta o síndico pode ter dado baixa numa, e então o número 2 passava
    // a apontar para outra cobrança — sem o condómino perceber.
    const abertas: CobrancaEmAberto[] = estado.dados?.abertas ?? [];

    if (estado.passo === "escolher" || estado.passo === "escolher_da_midia") {
      const escolha = escolherCobranca(abertas, txt);
      if (escolha.tipo !== "uma") {
        return responder(
          `Não entendi o número. Responda com um de 1 a ${abertas.length}, ou 0 para voltar.\n\n${listaNumerada(abertas)}`,
        );
      }

      // Veio de uma mídia que já está à espera: anexa-se agora.
      if (estado.passo === "escolher_da_midia") {
        const mediaId = String(estado.dados?.media_id ?? "");
        if (!mediaId) {
          await limpar();
          return responder("Perdi o arquivo. Pode enviar de novo?");
        }
        const r = await guardarComprovante({
          cfg,
          condominioId: c.condominio_id,
          telefone: c.telefone,
          mediaId,
          cobranca: escolha.cobranca,
        });
        await limpar();
        return responder(r.ok ? confirmacao(r.cobranca) : r.mensagem);
      }

      await setEstado("enviar_comprovante", "aguardar_ficheiro", { cobranca: escolha.cobranca });
      return responder(
        `Certo: ${competenciaCurta(escolha.cobranca.competencia)} (${brl(escolha.cobranca.total)}).\n\n` +
          "Mande agora a *foto* ou o *PDF* do comprovante. 📎",
      );
    }

    if (estado.passo === "aguardar_ficheiro") {
      // Chegou texto onde se esperava um ficheiro. O estado não se limpa: a
      // pessoa está a caminho de mandar a foto.
      return responder(
        "Estou esperando a foto ou o PDF do comprovante. 📎\n\nResponda 0 se quiser desistir.",
      );
    }
  }

  if (estado.intent === "abrir_ocorrencia") {
    if (estado.passo === "titulo") {
      if (txt.length < 3) return responder("Título muito curto. Tente novamente.");
      await setEstado("abrir_ocorrencia", "descricao", { titulo: txt });
      return responder("Ótimo. Agora descreva o que está acontecendo:");
    }
    if (estado.passo === "descricao") {
      if (txt.length < 5) return responder("Descrição muito curta.");
      const { data: oc, error } = await (supabaseAdmin as any)
        .from("ocorrencias")
        .insert({
          condominio_id: c.condominio_id,
          unidade_id: c.unidade_id,
          aberta_por: c.user_id,
          titulo: estado.dados.titulo,
          descricao: txt,
          categoria: "outros",
          prioridade: "media",
        })
        .select("id")
        .single();
      await limpar();
      if (error || !oc) return responder("Não consegui registrar agora. Tente pelo app.");
      return responder(
        `✅ Ocorrência aberta! Protocolo: ${oc.id.slice(0, 8)}\n\nA gestão recebeu sua solicitação.`,
      );
    }
  }

  if (estado.intent === "documentos" && estado.passo === "escolher") {
    const idx = parseInt(txt, 10) - 1;
    const ids: string[] = estado.dados?.ids ?? [];
    if (Number.isNaN(idx) || idx < 0 || idx >= ids.length) {
      return responder("Número inválido. Tente novamente ou envie 0 para voltar.");
    }
    const { data: doc } = await supabaseAdmin
      .from("documentos")
      .select("titulo, storage_path")
      .eq("id", ids[idx])
      .single();
    await limpar();
    if (!doc) return responder("Documento não encontrado.");
    const { data: signed } = await supabaseAdmin.storage
      .from("documentos-condo")
      .createSignedUrl(doc.storage_path, 60 * 60 * 24);
    if (!signed?.signedUrl) return responder("Não consegui gerar o link agora. Tente pelo app.");
    return responder(`📄 ${doc.titulo}\n\nLink válido por 24h:\n${signed.signedUrl}`);
  }

  await limpar();
  return responder(
    `Voltando ao menu.\n\n${"1️⃣ Boleto  2️⃣ Reservas  3️⃣ Ocorrência  4️⃣ Falar com síndico"}`,
  );
}

async function confirmarVisitante(
  c: Conversa,
  visitanteId: string,
  autorizar: boolean,
  responder: (s: string) => Promise<void>,
) {
  const acao = autorizar ? "autorizar_visitante" : "recusar_visitante";
  const args = autorizar
    ? { _visitante_id: visitanteId }
    : { _visitante_id: visitanteId, _motivo: "Recusado pelo morador via WhatsApp" };
  const { error } = await supabaseAdmin.rpc(acao as any, args as any);
  if (error) return responder("Não consegui processar. Tente pelo app.");
  return responder(autorizar ? "✅ Visitante autorizado. Boa visita!" : "❌ Visitante recusado.");
}
