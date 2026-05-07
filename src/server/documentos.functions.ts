import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getConfig, enviarTextoWA, upsertConversa, registrarMensagem } from "./whatsapp.server";

export const notificarDocumentoWA = createServerFn({ method: "POST" })
  .inputValidator((d: { documento_id: string }) =>
    z.object({ documento_id: z.string().uuid() }).parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    // Carrega documento
    const { data: doc } = await supabaseAdmin
      .from("documentos")
      .select("id, condominio_id, titulo, categoria, storage_path, aprovado, visivel_publico")
      .eq("id", data.documento_id)
      .maybeSingle();
    if (!doc) throw new Error("documento_nao_encontrado");
    if (!doc.aprovado || !doc.visivel_publico) throw new Error("documento_nao_publicavel");

    // Verifica permissão (síndico)
    const { data: ok } = await context.supabase.rpc("is_sindico", {
      _user_id: context.userId,
      _condominio_id: doc.condominio_id,
    });
    if (!ok) throw new Error("forbidden");

    // Config WA
    const cfg = await getConfig(doc.condominio_id);
    if (!cfg || !cfg.ativo || !cfg.phone_number_id || !cfg.access_token) {
      throw new Error("wa_nao_configurado");
    }

    // Link assinado (7 dias)
    const { data: signed } = await supabaseAdmin.storage
      .from("documentos-condo")
      .createSignedUrl(doc.storage_path, 60 * 60 * 24 * 7);
    if (!signed?.signedUrl) throw new Error("falha_link");

    // Nome do condomínio
    const { data: cond } = await supabaseAdmin
      .from("condominios").select("nome").eq("id", doc.condominio_id).maybeSingle();

    // Lista moradores com telefone
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("condominio_id", doc.condominio_id);
    const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    if (ids.length === 0) return { enviados: 0, falhas: 0, total: 0 };

    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, nome_completo, telefone")
      .in("id", ids);

    const destinatarios = (profs ?? []).filter((p) => p.telefone);

    const mensagem = `📢 *${cond?.nome ?? "Condomínio"}*\n\nNovo documento publicado:\n\n📄 *${doc.titulo}*\n_${doc.categoria}_\n\nAcesse (link válido por 7 dias):\n${signed.signedUrl}\n\nResponda *menu* para mais opções.`;

    let enviados = 0;
    let falhas = 0;
    for (const p of destinatarios) {
      const conv = await upsertConversa(doc.condominio_id, p.telefone!, p.nome_completo);
      const r = await enviarTextoWA(cfg, p.telefone!, mensagem);
      if (r.ok) {
        enviados++;
        if (conv) {
          await registrarMensagem({
            conversaId: conv.id,
            condominioId: doc.condominio_id,
            direcao: "saida",
            tipo: "texto",
            texto: mensagem,
            waMessageId: r.waMessageId ?? null,
            status: "enviada",
            contexto: "documento",
            contextoId: doc.id,
          });
        }
      } else {
        falhas++;
      }
    }

    // Audit
    await supabaseAdmin.from("audit_log").insert({
      condominio_id: doc.condominio_id,
      user_id: context.userId,
      acao: "documento_notificado_wa",
      entidade: "documentos",
      entidade_id: doc.id,
      metadata: { enviados, falhas, total: destinatarios.length },
    });

    return { enviados, falhas, total: destinatarios.length };
  });
