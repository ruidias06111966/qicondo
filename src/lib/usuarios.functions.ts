import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES = [
  "admin",
  "financeiro",
  "gestor",
  "vendedor",
  "comercial",
  "contador",
  "consulta",
  "porteiro",
  "morador",
] as const;
const RoleEnum = z.enum(ROLES);

async function ensureAdmin(supabase: any, userId: string, condominioId: string) {
  const { data } = await supabase.rpc("is_sindico", {
    _user_id: userId,
    _condominio_id: condominioId,
  } as any);
  if (!data) throw new Error("forbidden");
}

// ===== Listar utilizadores ativos + convites pendentes =====
export const listarUsuarios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ condominio_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId, data.condominio_id);

    const { data: roles, error: e1 } = await supabase
      .from("user_roles")
      .select("user_id, role, created_at")
      .eq("condominio_id", data.condominio_id);
    if (e1) throw new Error(e1.message);

    const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id, nome_completo, telefone, avatar_url").in("id", ids)
      : { data: [] as any[] };
    const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));

    // Agrega múltiplos roles do mesmo user
    const agg = new Map<string, { user_id: string; roles: string[]; nome: string | null; telefone: string | null; avatar_url: string | null; created_at: string }>();
    for (const r of roles ?? []) {
      const p: any = byId.get(r.user_id);
      const cur = agg.get(r.user_id);
      if (cur) cur.roles.push(r.role);
      else
        agg.set(r.user_id, {
          user_id: r.user_id,
          roles: [r.role],
          nome: p?.nome_completo ?? null,
          telefone: p?.telefone ?? null,
          avatar_url: p?.avatar_url ?? null,
          created_at: r.created_at,
        });
    }

    const { data: convites } = await supabase
      .from("convites")
      .select("id, email, nome, role, status, expira_em, created_at")
      .eq("condominio_id", data.condominio_id)
      .order("created_at", { ascending: false })
      .limit(200);

    return {
      utilizadores: Array.from(agg.values()).sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "")),
      convites: convites ?? [],
    };
  });

// ===== Criar convite =====
export const convidarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        condominio_id: z.string().uuid(),
        nome: z.string().trim().min(2).max(120),
        email: z.string().trim().toLowerCase().email(),
        role: RoleEnum,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId, data.condominio_id);

    // Gerar token aleatório (32 bytes -> base64url ~43 chars)
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = Buffer.from(bytes)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // Hash sha256 hex (compatível com aceitar_convite RPC)
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const token_hash = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { data: row, error } = await supabase
      .from("convites")
      .insert({
        condominio_id: data.condominio_id,
        email: data.email,
        nome: data.nome,
        role: data.role,
        token,
        token_hash,
        enviado_por: userId,
      })
      .select("id, email, nome, role, expira_em")
      .single();
    if (error) {
      // Mensagens amigáveis para o trigger de limite de plano
      if (/limite_plano_atingido/.test(error.message)) {
        throw new Error("Limite de utilizadores do plano atingido. Faça upgrade para adicionar mais.");
      }
      throw new Error(error.message);
    }

    return { convite: row, token };
  });

// ===== Revogar convite =====
export const revogarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ condominio_id: z.string().uuid(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId, data.condominio_id);
    const { error } = await context.supabase
      .from("convites")
      .update({ status: "cancelado" })
      .eq("id", data.id)
      .eq("condominio_id", data.condominio_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Alterar role =====
export const alterarRoleUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        condominio_id: z.string().uuid(),
        user_id: z.string().uuid(),
        role_antigo: RoleEnum,
        role_novo: RoleEnum,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId, data.condominio_id);
    if (data.user_id === userId && data.role_antigo === "admin" && data.role_novo !== "admin") {
      throw new Error("Não pode remover o seu próprio papel de admin.");
    }
    // Apaga o antigo e adiciona o novo (user_roles tem unique user_id+condominio_id+role)
    const { error: e1 } = await supabase
      .from("user_roles")
      .delete()
      .eq("condominio_id", data.condominio_id)
      .eq("user_id", data.user_id)
      .eq("role", data.role_antigo);
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await supabase.from("user_roles").insert({
      condominio_id: data.condominio_id,
      user_id: data.user_id,
      role: data.role_novo,
    });
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

// ===== Remover utilizador da empresa =====
export const removerUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ condominio_id: z.string().uuid(), user_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId, data.condominio_id);
    if (data.user_id === userId) throw new Error("Não pode remover-se a si próprio.");
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("condominio_id", data.condominio_id)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
