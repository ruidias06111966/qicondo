import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Valida assinatura HMAC do webhook do Mercado Pago.
 * Formato do header x-signature: "ts=1234567890,v1=abc..."
 * Manifesto: id:[paymentId];request-id:[x-request-id];ts:[ts];
 */
function verifyMpSignature(opts: {
  secret: string;
  signatureHeader: string | null;
  requestId: string | null;
  paymentId: string;
}): boolean {
  if (!opts.signatureHeader) return false;
  const parts = Object.fromEntries(
    opts.signatureHeader.split(",").map((p) => {
      const [k, ...rest] = p.trim().split("=");
      return [k, rest.join("=")];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${opts.paymentId};request-id:${opts.requestId ?? ""};ts:${ts};`;
  const hmac = createHmac("sha256", opts.secret).update(manifest).digest("hex");
  try {
    const a = Buffer.from(hmac, "hex");
    const b = Buffer.from(v1, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Webhook do Mercado Pago - notificação de pagamentos
 * URL pública: https://<projeto>.lovable.app/api/public/mp-webhook
 *
 * Configurar no painel do Mercado Pago do condomínio.
 * MP envia notificação de status; consultamos a API para confirmar e atualizamos a cobrança.
 */
export const Route = createFileRoute("/api/public/mp-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const type = body?.type ?? body?.topic;
          const paymentId = body?.data?.id ?? body?.resource ?? null;

          if (type !== "payment" || !paymentId) {
            return new Response(JSON.stringify({ ignored: true }), { status: 200 });
          }

          // Localiza cobrança pelo mp_payment_id
          const { data: cob } = await supabaseAdmin
            .from("cobrancas")
            .select("id, condominio_id, valor, multa, juros, desconto, valor_pago, status")
            .eq("mp_payment_id", String(paymentId))
            .maybeSingle();

          if (!cob) {
            // Resposta neutra para não vazar existência
            return new Response("ok", { status: 200 });
          }

          // Verifica assinatura HMAC do MP usando o segredo do condomínio
          const { data: cfgSec } = await supabaseAdmin
            .from("config_pagamento")
            .select("mp_webhook_secret")
            .eq("condominio_id", cob.condominio_id)
            .maybeSingle();

          if (!cfgSec?.mp_webhook_secret) {
            console.warn("[MP Webhook] sem secret configurado para condomínio", cob.condominio_id);
            return new Response("Webhook não configurado", { status: 401 });
          }

          const ok = verifyMpSignature({
            secret: cfgSec.mp_webhook_secret,
            signatureHeader: request.headers.get("x-signature"),
            requestId: request.headers.get("x-request-id"),
            paymentId: String(paymentId),
          });
          if (!ok) {
            return new Response("Assinatura inválida", { status: 401 });
          }

          // Token do condomínio para confirmar com MP
          const { data: cfg } = await supabaseAdmin
            .from("config_pagamento")
            .select("mp_access_token")
            .eq("condominio_id", cob.condominio_id)
            .maybeSingle();

          if (!cfg?.mp_access_token) {
            return new Response("Sem token MP", { status: 200 });
          }

          const resp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${cfg.mp_access_token}` },
          });
          if (!resp.ok) return new Response("Erro consulta MP", { status: 200 });
          const payment = await resp.json();

          if (payment.status !== "approved") {
            return new Response(JSON.stringify({ status: payment.status }), { status: 200 });
          }

          const valorRecebido = Number(payment.transaction_amount);
          const valorTotal = Number(cob.valor) + Number(cob.multa) + Number(cob.juros) - Number(cob.desconto);
          const novoPago = Number(cob.valor_pago) + valorRecebido;

          // Idempotência: se já registramos pagamento com esse mp_payment_id, ignora
          const { data: jaPago } = await supabaseAdmin
            .from("pagamentos")
            .select("id")
            .eq("mp_payment_id", String(paymentId))
            .maybeSingle();

          if (jaPago) {
            return new Response(JSON.stringify({ ok: true, dedup: true }), { status: 200 });
          }

          await supabaseAdmin.from("pagamentos").insert({
            condominio_id: cob.condominio_id,
            cobranca_id: cob.id,
            valor: valorRecebido,
            forma: "pix",
            pago_em: payment.date_approved ?? new Date().toISOString(),
            mp_payment_id: String(paymentId),
            observacoes: "Pagamento confirmado via Mercado Pago",
          });

          await supabaseAdmin
            .from("cobrancas")
            .update({
              valor_pago: novoPago,
              status: novoPago >= valorTotal ? "paga" : "parcial",
              pago_em: novoPago >= valorTotal ? (payment.date_approved ?? new Date().toISOString()) : null,
            })
            .eq("id", cob.id);

          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        } catch (e: any) {
          console.error("MP Webhook error:", e);
          return new Response(JSON.stringify({ error: "internal_error" }), { status: 200 });
        }
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
