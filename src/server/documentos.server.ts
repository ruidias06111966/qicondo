import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getConfig, enviarTextoWA, upsertConversa, registrarMensagem } from "./whatsapp.server";

const BACKOFF_MIN = [1, 5, 30];

export async function checarSindico(supabase: any, userId: string, condominioId: string) {
  const { data: ok } = await supabase.rpc("is_sindico", {
    _user_id: userId, _condominio_id: condominioId,
  });
  if (!ok) throw new Error("forbidden");
}

/** Drena a fila do condomínio (chamado pelo cron e após enfileiramento). */
export async function drenarFila(condominioId: string, limite = 30) {
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

    await supabaseAdmin.from("wa_notif_jobs")
      .update({ status: "enviando" }).eq("id", job.id);

    let mensagem = job.mensagem;
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
