import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const mask = (s: string | null) => (s ? s.slice(0, 4) + "•••" + s.slice(-4) : null);

export const obterConfigWA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { condominio_id: string }) => z.object({ condominio_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r } = await context.supabase.rpc("is_sindico", {
      _user_id: context.userId, _condominio_id: data.condominio_id,
    });
    if (!r) throw new Error("forbidden");
    const { data: cfg } = await supabaseAdmin.from("wa_config").select("*").eq("condominio_id", data.condominio_id).maybeSingle();
    if (!cfg) return null;
    return {
      ...cfg,
      access_token: mask(cfg.access_token),
      app_secret: mask(cfg.app_secret),
      webhook_verify_token: cfg.webhook_verify_token,
    };
  });

export const salvarConfigWA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) =>
    z.object({
      condominio_id: z.string().uuid(),
      ativo: z.boolean(),
      phone_number_id: z.string().nullable(),
      business_account_id: z.string().nullable(),
      display_phone: z.string().nullable(),
      webhook_verify_token: z.string().nullable(),
      access_token: z.string().nullable(),
      app_secret: z.string().nullable(),
      saudacao: z.string().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("is_sindico", {
      _user_id: context.userId, _condominio_id: data.condominio_id,
    });
    if (!ok) throw new Error("forbidden");

    const { data: existing } = await supabaseAdmin.from("wa_config").select("access_token, app_secret").eq("condominio_id", data.condominio_id).maybeSingle();
    const payload: any = { ...data };
    if (data.access_token?.includes("•••")) payload.access_token = existing?.access_token ?? null;
    if (data.app_secret?.includes("•••")) payload.app_secret = existing?.app_secret ?? null;

    const { error } = await supabaseAdmin.from("wa_config").upsert(payload, { onConflict: "condominio_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
