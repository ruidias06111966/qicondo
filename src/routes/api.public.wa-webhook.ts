// Webhook Meta Cloud API: GET (verify) + POST (eventos).
// Path público: /api/public/wa-webhook
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getConfigByPhoneNumberId,
  upsertConversa,
  registrarMensagem,
  verifySignature,
} from "@/server/whatsapp.server";
import { processarMensagemBot } from "@/server/wa-bot.server";

export const Route = createFileRoute("/api/public/wa-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        if (mode !== "subscribe" || !token) return new Response("forbidden", { status: 403 });
        const { data } = await supabaseAdmin
          .from("wa_config")
          .select("condominio_id")
          .eq("webhook_verify_token", token)
          .maybeSingle();
        if (!data) return new Response("forbidden", { status: 403 });
        return new Response(challenge ?? "ok", { status: 200 });
      },
      POST: async ({ request }) => {
        const raw = await request.text();
        let body: any = {};
        try { body = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }

        try {
          for (const entry of body.entry ?? []) {
            for (const change of entry.changes ?? []) {
              const value = change.value || {};
              const phoneNumberId: string | undefined = value.metadata?.phone_number_id;
              if (!phoneNumberId) continue;

              const cfg = await getConfigByPhoneNumberId(phoneNumberId);
              if (!cfg || !cfg.ativo) continue;

              // Verifica assinatura quando há app_secret
              if (cfg.app_secret) {
                const sig = request.headers.get("x-hub-signature-256");
                if (!verifySignature(cfg.app_secret, raw, sig)) {
                  console.warn("[wa-webhook] assinatura inválida", cfg.condominio_id);
                  continue;
                }
              }

              // Atualizações de status (sent/delivered/read/failed)
              for (const st of value.statuses ?? []) {
                const map: Record<string, string> = {
                  sent: "enviada", delivered: "entregue", read: "lida", failed: "falha",
                };
                const novo = map[st.status] ?? null;
                if (!novo || !st.id) continue;
                const upd: any = { status: novo };
                if (novo === "entregue") upd.entregue_em = new Date().toISOString();
                if (novo === "lida") upd.lido_em = new Date().toISOString();
                await supabaseAdmin.from("wa_mensagens").update(upd).eq("wa_message_id", st.id);
              }

              // Mensagens recebidas
              for (const msg of value.messages ?? []) {
                const from: string = msg.from;
                const profileName: string | undefined = value.contacts?.[0]?.profile?.name;
                const conv = await upsertConversa(cfg.condominio_id, from, profileName ?? null);
                if (!conv) continue;

                let texto: string | null = null;
                if (msg.type === "text") texto = msg.text?.body ?? null;
                else if (msg.type === "interactive") texto = msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? null;
                else if (msg.type === "button") texto = msg.button?.text ?? null;

                await registrarMensagem({
                  conversaId: conv.id,
                  condominioId: cfg.condominio_id,
                  direcao: "entrada",
                  tipo: "texto",
                  texto,
                  payload: msg,
                  waMessageId: msg.id,
                  status: "recebida",
                });

                if (texto) {
                  await processarMensagemBot(cfg as any, conv as any, texto, null);
                }
              }
            }
          }
          return new Response("ok", { status: 200 });
        } catch (e: any) {
          console.error("[wa-webhook] erro", e);
          return new Response("ok", { status: 200 }); // sempre 200 p/ Meta não reentregar em loop
        }
      },
    },
  },
});
