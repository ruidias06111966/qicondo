import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PLANOS = ["basico", "profissional", "enterprise"] as const;
const ROLES = [
  "admin", "sindico", "financeiro", "gestor", "vendedor",
  "comercial", "contador", "consulta", "porteiro", "morador",
] as const;

async function ensurePlatformAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("forbidden");
}

async function logAdmin(
  supabase: any,
  adminUserId: string,
  acao: string,
  entidade?: string,
  entidade_id?: string,
  metadata?: any,
) {
  await supabase.from("admin_audit_log").insert({
    admin_user_id: adminUserId,
    acao,
    entidade,
    entidade_id,
    metadata,
  });
}

// ===== Estado / bootstrap =====
export const meuEstadoPlatform = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: meu }, { count }] = await Promise.all([
      supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
      supabase.from("platform_admins").select("user_id", { count: "exact", head: true }),
    ]);
    return {
      isPlatformAdmin: !!meu,
      totalAdmins: count ?? 0,
    };
  });

export const reclamarPlatformAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.rpc("claim_platform_admin");
    if (error) throw new Error(error.message);
    await logAdmin(supabase, userId, "platform_admin_reclamado");
    return { ok: true };
  });

// ===== Métricas globais =====
export const metricasGlobais = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensurePlatformAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase.rpc("admin_metricas_globais");
    if (error) throw new Error(error.message);
    return data as Record<string, any>;
  });

// ===== Listar empresas =====
export const listarEmpresas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensurePlatformAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("condominios")
      .select(
        "id, nome, cnpj, cidade, estado, plano, total_unidades, suspenso, motivo_suspensao, valor_mensal, assinatura_inicio, assinatura_fim, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Conta utilizadores por empresa
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("condominio_id, user_id");
    const userCount = new Map<string, Set<string>>();
    for (const r of roles ?? []) {
      const s = userCount.get(r.condominio_id) ?? new Set();
      s.add(r.user_id);
      userCount.set(r.condominio_id, s);
    }
    return (data ?? []).map((e: any) => ({
      ...e,
      total_utilizadores: userCount.get(e.id)?.size ?? 0,
    }));
  });

// ===== Detalhe + utilizadores de uma empresa =====
export const detalheEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ condominio_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensurePlatformAdmin(context.supabase, context.userId);
    const { supabase } = context;

    const { data: empresa, error: e1 } = await supabase
      .from("condominios").select("*").eq("id", data.condominio_id).maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!empresa) throw new Error("Empresa não encontrada");

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role, created_at")
      .eq("condominio_id", data.condominio_id);
    const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id, nome_completo, telefone, avatar_url").in("id", ids)
      : { data: [] as any[] };
    const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));

    const agg = new Map<string, any>();
    for (const r of roles ?? []) {
      const cur = agg.get(r.user_id);
      const p: any = byId.get(r.user_id);
      if (cur) cur.roles.push(r.role);
      else agg.set(r.user_id, {
        user_id: r.user_id, roles: [r.role],
        nome: p?.nome_completo ?? null, telefone: p?.telefone ?? null,
        avatar_url: p?.avatar_url ?? null, created_at: r.created_at,
      });
    }

    const { data: convites } = await supabase
      .from("convites")
      .select("id, email, nome, role, status, expira_em, created_at")
      .eq("condominio_id", data.condominio_id)
      .order("created_at", { ascending: false }).limit(200);

    return {
      empresa,
      utilizadores: Array.from(agg.values()),
      convites: convites ?? [],
    };
  });

// ===== Atualizar plano/assinatura =====
export const atualizarAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      condominio_id: z.string().uuid(),
      plano: z.enum(PLANOS).optional(),
      assinatura_inicio: z.string().optional().nullable(),
      assinatura_fim: z.string().optional().nullable(),
      valor_mensal: z.number().nonnegative().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensurePlatformAdmin(context.supabase, context.userId);
    const patch: any = {};
    if (data.plano !== undefined) patch.plano = data.plano;
    if (data.assinatura_inicio !== undefined) patch.assinatura_inicio = data.assinatura_inicio;
    if (data.assinatura_fim !== undefined) patch.assinatura_fim = data.assinatura_fim;
    if (data.valor_mensal !== undefined) patch.valor_mensal = data.valor_mensal;
    const { error } = await context.supabase.from("condominios").update(patch).eq("id", data.condominio_id);
    if (error) throw new Error(error.message);
    await logAdmin(context.supabase, context.userId, "assinatura_atualizada", "condominios", data.condominio_id, patch);
    return { ok: true };
  });

// ===== Suspender / reativar =====
export const definirSuspensao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      condominio_id: z.string().uuid(),
      suspenso: z.boolean(),
      motivo: z.string().max(500).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensurePlatformAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("condominios").update({
      suspenso: data.suspenso,
      motivo_suspensao: data.suspenso ? data.motivo ?? null : null,
    }).eq("id", data.condominio_id);
    if (error) throw new Error(error.message);
    await logAdmin(context.supabase, context.userId,
      data.suspenso ? "empresa_suspensa" : "empresa_reativada",
      "condominios", data.condominio_id, { motivo: data.motivo });
    return { ok: true };
  });

// ===== Apagar empresa =====
export const apagarEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    condominio_id: z.string().uuid(),
    confirmar_nome: z.string(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await ensurePlatformAdmin(context.supabase, context.userId);
    const { data: emp } = await context.supabase
      .from("condominios").select("nome").eq("id", data.condominio_id).maybeSingle();
    if (!emp) throw new Error("Empresa não encontrada");
    if (emp.nome.trim() !== data.confirmar_nome.trim()) {
      throw new Error("Nome de confirmação não bate certo");
    }
    const { error } = await context.supabase.from("condominios").delete().eq("id", data.condominio_id);
    if (error) throw new Error(error.message);
    await logAdmin(context.supabase, context.userId, "empresa_apagada", "condominios", data.condominio_id, { nome: emp.nome });
    return { ok: true };
  });

// ===== Alterar role de utilizador em empresa =====
export const alterarRoleEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    condominio_id: z.string().uuid(),
    user_id: z.string().uuid(),
    role_antigo: z.enum(ROLES),
    role_novo: z.enum(ROLES),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await ensurePlatformAdmin(context.supabase, context.userId);
    const { error: e1 } = await context.supabase.from("user_roles").delete()
      .eq("condominio_id", data.condominio_id)
      .eq("user_id", data.user_id)
      .eq("role", data.role_antigo);
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await context.supabase.from("user_roles").insert({
      condominio_id: data.condominio_id, user_id: data.user_id, role: data.role_novo,
    });
    if (e2) throw new Error(e2.message);
    await logAdmin(context.supabase, context.userId, "role_alterada", "user_roles", data.user_id, data);
    return { ok: true };
  });

export const removerUtilizadorEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    condominio_id: z.string().uuid(), user_id: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await ensurePlatformAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("user_roles").delete()
      .eq("condominio_id", data.condominio_id).eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    await logAdmin(context.supabase, context.userId, "utilizador_removido", "user_roles", data.user_id, { condominio_id: data.condominio_id });
    return { ok: true };
  });
