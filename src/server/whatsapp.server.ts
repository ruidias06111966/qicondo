// Helpers server-side da Meta Cloud API. Importar APENAS de *.functions.ts ou rotas server.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHmac, timingSafeEqual } from "crypto";

const GRAPH = "https://graph.facebook.com/v21.0";

export type WaConfig = {
  condominio_id: string;
  ativo: boolean;
  phone_number_id: string | null;
  access_token: string | null;
  app_secret: string | null;
  webhook_verify_token: string | null;
  saudacao: string | null;
};

export function normalizarTel(input: string | null | undefined): string | null {
  if (!input) return null;
  let n = input.replace(/\D/g, "");
  if (!n) return null;
  if (n.length === 10 || n.length === 11) n = "55" + n;
  return n;
}

export async function getConfigByPhoneNumberId(phoneNumberId: string): Promise<WaConfig | null> {
  const { data } = await supabaseAdmin
    .from("wa_config")
    .select("*")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();
  return (data as any) ?? null;
}

export async function getConfig(condominioId: string): Promise<WaConfig | null> {
  const { data } = await supabaseAdmin
    .from("wa_config")
    .select("*")
    .eq("condominio_id", condominioId)
    .maybeSingle();
  return (data as any) ?? null;
}

export function verifySignature(appSecret: string, rawBody: string, signature: string | null): boolean {
  if (!signature || !signature.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const got = signature.slice("sha256=".length);
  try {
    return timingSafeEqual(Buffer.from(got, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export async function upsertConversa(condominioId: string, telefone: string, nome?: string | null) {
  const tel = normalizarTel(telefone);
  if (!tel) return null;
  const { data: existing } = await supabaseAdmin
    .from("wa_conversas")
    .select("*")
    .eq("condominio_id", condominioId)
    .eq("telefone", tel)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from("wa_conversas")
      .update({
        ultimo_contato: new Date().toISOString(),
        janela_24h_expira: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        nome: nome ?? existing.nome,
      })
      .eq("id", existing.id);
    return existing;
  }

  // Tenta vincular a um morador existente pelo telefone
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, nome_completo")
    .eq("telefone", tel)
    .maybeSingle();

  let unidadeId: string | null = null;
  if (profile?.id) {
    const { data: vinc } = await supabaseAdmin
      .from("unidade_moradores")
      .select("unidade_id, unidades!inner(condominio_id)")
      .eq("user_id", profile.id)
      .eq("unidades.condominio_id", condominioId)
      .limit(1)
      .maybeSingle();
    unidadeId = (vinc as any)?.unidade_id ?? null;
  }

  const { data: novo } = await supabaseAdmin
    .from("wa_conversas")
    .insert({
      condominio_id: condominioId,
      telefone: tel,
      nome: nome ?? profile?.nome_completo ?? null,
      user_id: profile?.id ?? null,
      unidade_id: unidadeId,
      janela_24h_expira: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    })
    .select("*")
    .single();
  return novo;
}

export async function registrarMensagem(params: {
  conversaId: string;
  condominioId: string;
  direcao: "entrada" | "saida";
  tipo?: "texto" | "template" | "interativo" | "midia" | "localizacao" | "sistema";
  texto?: string | null;
  payload?: any;
  waMessageId?: string | null;
  status?: "pendente" | "enviada" | "entregue" | "lida" | "falha" | "recebida";
  contexto?: string | null;
  contextoId?: string | null;
}) {
  const { data } = await supabaseAdmin
    .from("wa_mensagens")
    .insert({
      conversa_id: params.conversaId,
      condominio_id: params.condominioId,
      direcao: params.direcao,
      tipo: params.tipo ?? "texto",
      texto: params.texto ?? null,
      payload: params.payload ?? null,
      wa_message_id: params.waMessageId ?? null,
      status: params.status ?? (params.direcao === "entrada" ? "recebida" : "pendente"),
      contexto: params.contexto ?? null,
      contexto_id: params.contextoId ?? null,
      enviado_em: params.direcao === "saida" && params.status === "enviada" ? new Date().toISOString() : null,
    })
    .select("*")
    .single();
  return data;
}

/** Envia uma mensagem de texto via Meta Cloud API. */
export async function enviarTextoWA(cfg: WaConfig, telefone: string, texto: string) {
  if (!cfg.ativo || !cfg.phone_number_id || !cfg.access_token) {
    return { ok: false, error: "wa_nao_configurado" as const };
  }
  const tel = normalizarTel(telefone);
  if (!tel) return { ok: false, error: "telefone_invalido" as const };

  const res = await fetch(`${GRAPH}/${cfg.phone_number_id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: tel,
      type: "text",
      text: { body: texto.slice(0, 4000) },
    }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: json?.error?.message || `http_${res.status}`, raw: json };
  }
  return { ok: true, waMessageId: json?.messages?.[0]?.id as string | undefined, raw: json };
}

/** Envia um template aprovado. */
export async function enviarTemplateWA(
  cfg: WaConfig,
  telefone: string,
  template: string,
  parametros: string[],
  idioma = "pt_BR",
) {
  if (!cfg.ativo || !cfg.phone_number_id || !cfg.access_token) {
    return { ok: false, error: "wa_nao_configurado" as const };
  }
  const tel = normalizarTel(telefone);
  if (!tel) return { ok: false, error: "telefone_invalido" as const };

  const components = parametros.length
    ? [{ type: "body", parameters: parametros.map((p) => ({ type: "text", text: p })) }]
    : [];

  const res = await fetch(`${GRAPH}/${cfg.phone_number_id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: tel,
      type: "template",
      template: { name: template, language: { code: idioma }, components },
    }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: json?.error?.message || `http_${res.status}`, raw: json };
  return { ok: true, waMessageId: json?.messages?.[0]?.id as string | undefined, raw: json };
}
