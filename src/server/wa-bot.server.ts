// Roteador do bot conversacional do WhatsApp.
// Recebe mensagens do morador, atualiza estado em wa_bot_estado e responde.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enviarTextoWA, type WaConfig } from "./whatsapp.server";

const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const brl = (n: number) => `R$ ${Number(n || 0).toFixed(2).replace(".", ",")}`;
const dt = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

const MENU = `Olá! 👋 Sou o assistente do condomínio. Escolha uma opção:

1️⃣ Segunda via de boleto / PIX
2️⃣ Status das minhas reservas
3️⃣ Abrir uma ocorrência
4️⃣ Falar com o síndico
5️⃣ Documentos oficiais (atas, convenção, regimento)

Responda apenas com o número.`;

type Conversa = {
  id: string;
  condominio_id: string;
  telefone: string;
  unidade_id: string | null;
  user_id: string | null;
  nome: string | null;
};

export async function processarMensagemBot(
  cfg: WaConfig,
  conversa: Conversa,
  textoIn: string,
  contexto?: { tipo: string; id: string } | null,
) {
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

  const limparEstado = () => setEstado("menu", null, {});

  // Carrega estado atual
  const { data: estado } = await supabaseAdmin
    .from("wa_bot_estado")
    .select("*")
    .eq("conversa_id", conversa.id)
    .maybeSingle();

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

  // Confirmação de visitante (resposta a notificação)
  if (contexto?.tipo === "visitante" && (txt === "sim" || txt === "s" || txt === "não" || txt === "nao" || txt === "n")) {
    return confirmarVisitante(conversa, contexto.id, txt.startsWith("s"), responder);
  }

  await limparEstado();
  return responder(`Não entendi 🤔\n\n${MENU}`);
}

async function iniciarSegundaVia(c: Conversa, responder: (s: string) => Promise<void>, setEstado: any) {
  const { data: cobs } = await supabaseAdmin
    .from("cobrancas")
    .select("id, competencia, vencimento, valor, multa, juros, desconto, status, mp_qr_code, mp_ticket_url")
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
    const total = Number(cb.valor || 0) + Number(cb.multa || 0) + Number(cb.juros || 0) - Number(cb.desconto || 0);
    return `${i + 1}) ${comp} — ${brl(total)} — vence ${dt(cb.vencimento)}`;
  });

  await setEstado("segunda_via_boleto", "escolher", { ids: cobs.map((c: any) => c.id) });
  return responder(
    `Você tem ${cobs.length} cobrança(s) em aberto:\n\n${linhas.join("\n")}\n\nResponda com o número para receber o PIX/boleto, ou 0 para voltar.`,
  );
}

async function statusReservas(c: Conversa, responder: (s: string) => Promise<void>, limpar: () => Promise<any>) {
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

async function iniciarOcorrencia(c: Conversa, responder: (s: string) => Promise<void>, setEstado: any) {
  await setEstado("abrir_ocorrencia", "titulo", {});
  return responder("Vamos abrir uma ocorrência. 📝\n\nQual é o título? (ex.: lâmpada queimada na garagem)\n\nResponda 0 para cancelar.");
}

async function continuarFluxo(
  estado: any,
  txt: string,
  c: Conversa,
  _cfg: WaConfig,
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
    const { data: cb } = await supabaseAdmin
      .from("cobrancas")
      .select("competencia, vencimento, valor, multa, juros, desconto, mp_qr_code, mp_ticket_url")
      .eq("id", ids[idx])
      .single();
    await limpar();
    if (!cb) return responder("Cobrança não encontrada.");
    const total = Number(cb.valor || 0) + Number(cb.multa || 0) + Number(cb.juros || 0) - Number(cb.desconto || 0);
    let msg = `💰 Cobrança de ${cb.competencia} — Total ${brl(total)} — vence ${dt(cb.vencimento)}\n\n`;
    if (cb.mp_qr_code) msg += `PIX Copia e Cola:\n${cb.mp_qr_code}\n\n`;
    if (cb.mp_ticket_url) msg += `Boleto: ${cb.mp_ticket_url}\n`;
    if (!cb.mp_qr_code && !cb.mp_ticket_url) msg += "O síndico ainda não emitiu cobrança bancária para este lançamento.";
    return responder(msg);
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
      return responder(`✅ Ocorrência aberta! Protocolo: ${oc.id.slice(0, 8)}\n\nA gestão recebeu sua solicitação.`);
    }
  }

  await limpar();
  return responder(`Voltando ao menu.\n\n${"1️⃣ Boleto  2️⃣ Reservas  3️⃣ Ocorrência  4️⃣ Falar com síndico"}`);
}

async function confirmarVisitante(
  c: Conversa,
  visitanteId: string,
  autorizar: boolean,
  responder: (s: string) => Promise<void>,
) {
  const acao = autorizar ? "autorizar_visitante" : "recusar_visitante";
  const args = autorizar ? { _visitante_id: visitanteId } : { _visitante_id: visitanteId, _motivo: "Recusado pelo morador via WhatsApp" };
  const { error } = await supabaseAdmin.rpc(acao as any, args as any);
  if (error) return responder("Não consegui processar. Tente pelo app.");
  return responder(autorizar ? "✅ Visitante autorizado. Boa visita!" : "❌ Visitante recusado.");
}
