import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getConfig, enviarTextoWA, upsertConversa, registrarMensagem } from "./whatsapp.server";

const BACKOFF_MIN = [1, 5, 30]; // minutos por tentativa

async function checarSindico(supabase: any, userId: string, condominioId: string) {
  const { data: ok } = await supabase.rpc("is_sindico", {
    _user_id: userId, _condominio_id: condominioId,
  });
  if (!ok) throw new Error("forbidden");
}

/** Enfileira manualmente (botão "Notificar agora" para qualquer documento aprovado/público). */
export const enfileirarNotificacaoDocumento = createServerFn({ method: "POST" })
  .inputValidator((d: { documento_id: string }) =>
    z.object({ documento_id: z.string().uuid() }).parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: doc } = await supabaseAdmin
      .from("documentos")
      .select("id, condominio_id, aprovado, visivel_publico")
      .eq("id", data.documento_id).maybeSingle();
    if (!doc) throw new Error("documento_nao_encontrado");
    if (!doc.aprovado || !doc.visivel_publico) throw new Error("documento_nao_publicavel");

    await checarSindico(context.supabase, context.userId, doc.condominio_id);

    const { data: count, error } = await supabaseAdmin.rpc("enqueue_documento_comunicado", {
      _documento_id: data.documento_id,
    });
    if (error) throw new Error(error.message);

    // Drena imediatamente
    const r = await drenarFila(doc.condominio_id, 50);
    return { enfileirados: count ?? 0, ...r };
  });

/** Histórico de notificações de um documento. */
export const historicoNotificacoesDocumento = createServerFn({ method: "GET" })
  .inputValidator((d: { documento_id: string }) =>
    z.object({ documento_id: z.string().uuid() }).parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: doc } = await supabaseAdmin
      .from("documentos").select("condominio_id").eq("id", data.documento_id).maybeSingle();
    if (!doc) throw new Error("documento_nao_encontrado");
    await checarSindico(context.supabase, context.userId, doc.condominio_id);

    const { data: jobs } = await supabaseAdmin
      .from("wa_notif_jobs")
      .select("id, destinatario_nome, destinatario_telefone, status, tentativas, ultimo_erro, enviado_em, created_at, proxima_tentativa")
      .eq("documento_id", data.documento_id)
      .order("created_at", { ascending: false });

    const total = jobs?.length ?? 0;
    const enviados = jobs?.filter((j) => j.status === "enviado").length ?? 0;
    const falhas = jobs?.filter((j) => j.status === "falha" || j.status === "desistido").length ?? 0;
    const pendentes = jobs?.filter((j) => j.status === "pendente" || j.status === "enviando").length ?? 0;
    return { total, enviados, falhas, pendentes, jobs: jobs ?? [] };
  });

/** Drena a fila do condomínio (chamado pelo cron e após enfileiramento). */
async function drenarFila(condominioId: string, limite = 30) {
  const cfg = await getConfig(condominioId);
  if (!cfg || !cfg.ativo || !cfg.phone_number_id || !cfg.access_token) {
    return { enviados: 0, falhas: 0, pulados: 0 };
  }

  const agora = new Date().toISOString();
  const { data: jobs } = await supabaseAdmin
    .from("wa_notif_jobs")
    .select("*")
    .eq("condominio_id", condominioId)
    .in("status", ["pendente", "falha"])
    .lte("proxima_tentativa", agora)
    .order("proxima_tentativa", { ascending: true })
    .limit(limite);

  let enviados = 0, falhas = 0, pulados = 0;
  for (const job of jobs ?? []) {
    if (job.tentativas >= job.max_tentativas) { pulados++; continue; }

    // marca enviando
    await supabaseAdmin.from("wa_notif_jobs")
      .update({ status: "enviando" }).eq("id", job.id);

    let mensagem = job.mensagem;
    // resolver placeholder do link assinado, se for documento
    if (job.documento_id && mensagem.includes("__SIGNED_LINK__")) {
      const { data: doc } = await supabaseAdmin
        .from("documentos").select("storage_path").eq("id", job.documento_id).single();
      if (doc) {
        const { data: signed } = await supabaseAdmin.storage
          .from("documentos-condo")
          .createSignedUrl(doc.storage_path, 60 * 60 * 24 * 7);
        mensagem = mensagem.replace("__SIGNED_LINK__", signed?.signedUrl ?? "");
      }
    }

    const r = await enviarTextoWA(cfg, job.destinatario_telefone, mensagem);
    const tentativas = job.tentativas + 1;

    if (r.ok) {
      enviados++;
      const conv = await upsertConversa(condominioId, job.destinatario_telefone, job.destinatario_nome);
      if (conv) {
        await registrarMensagem({
          conversaId: conv.id, condominioId,
          direcao: "saida", tipo: "texto", texto: mensagem,
          waMessageId: r.waMessageId ?? null, status: "enviada",
          contexto: job.contexto, contextoId: job.documento_id,
        });
      }
      await supabaseAdmin.from("wa_notif_jobs").update({
        status: "enviado", tentativas,
        enviado_em: new Date().toISOString(),
        wa_message_id: r.waMessageId ?? null, ultimo_erro: null,
      }).eq("id", job.id);
    } else {
      falhas++;
      const desistir = tentativas >= job.max_tentativas;
      const proxMin = BACKOFF_MIN[Math.min(tentativas - 1, BACKOFF_MIN.length - 1)] ?? 30;
      await supabaseAdmin.from("wa_notif_jobs").update({
        status: desistir ? "desistido" : "falha", tentativas,
        ultimo_erro: (r as any).error ?? "desconhecido",
        proxima_tentativa: new Date(Date.now() + proxMin * 60 * 1000).toISOString(),
      }).eq("id", job.id);
    }
  }
  return { enviados, falhas, pulados };
}

/** Reagenda jobs em falha do documento (botão "Reenviar falhas"). */
export const reenviarFalhasDocumento = createServerFn({ method: "POST" })
  .inputValidator((d: { documento_id: string }) =>
    z.object({ documento_id: z.string().uuid() }).parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: doc } = await supabaseAdmin
      .from("documentos").select("condominio_id").eq("id", data.documento_id).maybeSingle();
    if (!doc) throw new Error("documento_nao_encontrado");
    await checarSindico(context.supabase, context.userId, doc.condominio_id);

    await supabaseAdmin.from("wa_notif_jobs")
      .update({
        status: "pendente",
        tentativas: 0,
        proxima_tentativa: new Date().toISOString(),
        ultimo_erro: null,
      })
      .eq("documento_id", data.documento_id)
      .in("status", ["falha", "desistido"]);

    const r = await drenarFila(doc.condominio_id, 50);
    return r;
  });

export { drenarFila };
