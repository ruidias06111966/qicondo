import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { drenarFila, checarSindico } from "./documentos.server";

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
