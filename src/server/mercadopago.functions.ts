import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Cria pagamento PIX no Mercado Pago para uma cobrança específica.
 * O síndico deve ter configurado o access_token em config_pagamento.
 */
export const criarPixCobranca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cobranca_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Busca cobrança (RLS garante que o usuário tem acesso)
    const { data: cob, error: cobErr } = await supabase
      .from("cobrancas")
      .select("id, condominio_id, unidade_id, valor, multa, juros, desconto, descricao, vencimento, status, mp_qr_code, mp_qr_code_base64, mp_ticket_url, mp_payment_id")
      .eq("id", data.cobranca_id)
      .single();
    if (cobErr || !cob) throw new Error("Cobrança não encontrada");

    if (cob.status === "paga" || cob.status === "cancelada") {
      throw new Error("Cobrança não pode receber novo PIX");
    }

    // Se já tem QR code válido, retorna o existente
    if (cob.mp_qr_code) {
      return {
        qr_code: cob.mp_qr_code,
        qr_code_base64: cob.mp_qr_code_base64,
        ticket_url: cob.mp_ticket_url,
        payment_id: cob.mp_payment_id,
      };
    }

    // Busca token MP do condomínio (admin para ler o token criptografado)
    const { data: cfg } = await supabaseAdmin
      .from("config_pagamento")
      .select("mp_access_token, ativo")
      .eq("condominio_id", cob.condominio_id)
      .maybeSingle();

    if (!cfg?.ativo || !cfg?.mp_access_token) {
      throw new Error("Pagamento online não está configurado neste condomínio");
    }

    // Busca dados do morador para o pagador
    const { data: morador } = await supabaseAdmin
      .from("unidade_moradores")
      .select("user_id, profiles!inner(nome_completo)")
      .eq("unidade_id", cob.unidade_id)
      .eq("principal", true)
      .maybeSingle();

    const valorTotal = Number(cob.valor) + Number(cob.multa) + Number(cob.juros) - Number(cob.desconto);
    const idemKey = `condozap-${cob.id}-${Date.now()}`;

    const resp = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.mp_access_token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idemKey,
      },
      body: JSON.stringify({
        transaction_amount: Number(valorTotal.toFixed(2)),
        description: cob.descricao || `WHATSCOND - Cobrança ${cob.id.slice(0, 8)}`,
        payment_method_id: "pix",
        external_reference: cob.id,
        date_of_expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        payer: {
          email: (morador as any)?.profiles?.email ?? `morador-${cob.unidade_id.slice(0, 8)}@condozap.app`,
          first_name: ((morador as any)?.profiles?.nome_completo ?? "Morador").split(" ")[0],
        },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Erro Mercado Pago [${resp.status}]: ${txt.slice(0, 300)}`);
    }
    const payment = await resp.json();
    const pix = payment.point_of_interaction?.transaction_data;

    if (!pix?.qr_code) {
      throw new Error("Mercado Pago não retornou QR Code");
    }

    await supabaseAdmin
      .from("cobrancas")
      .update({
        mp_payment_id: String(payment.id),
        mp_qr_code: pix.qr_code,
        mp_qr_code_base64: pix.qr_code_base64,
        mp_ticket_url: pix.ticket_url,
      })
      .eq("id", cob.id);

    return {
      qr_code: pix.qr_code,
      qr_code_base64: pix.qr_code_base64,
      ticket_url: pix.ticket_url,
      payment_id: String(payment.id),
    };
  });

// Verifica status no MP (polling do morador)
export const consultarStatusPix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cobranca_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: cob } = await context.supabase
      .from("cobrancas")
      .select("status, valor_pago, mp_payment_id, condominio_id")
      .eq("id", data.cobranca_id)
      .single();
    return cob;
  });
