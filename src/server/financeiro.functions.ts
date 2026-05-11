import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ===== Categorias =====
const CategoriaInput = z.object({
  condominio_id: z.string().uuid(),
  nome: z.string().trim().min(1, "Informe o nome").max(80, "Máx. 80 caracteres"),
  tipo: z.enum(["receita", "despesa"]),
  cor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve estar no formato hex (#RRGGBB)")
    .optional(),
});

export const criarCategoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CategoriaInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Verifica duplicidade no escopo do condomínio + tipo (case-insensitive)
    const { data: dup } = await supabase
      .from("categorias_financeiras")
      .select("id")
      .eq("condominio_id", data.condominio_id)
      .eq("tipo", data.tipo)
      .ilike("nome", data.nome)
      .maybeSingle();
    if (dup) throw new Error(`Já existe uma categoria de ${data.tipo} com esse nome`);

    const { data: row, error } = await supabase
      .from("categorias_financeiras")
      .insert({ ...data, cor: data.cor ?? "#10B981" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listarCategorias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ condominio_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("categorias_financeiras")
      .select("*")
      .eq("condominio_id", data.condominio_id)
      .order("tipo")
      .order("nome");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const removerCategoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("categorias_financeiras").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Cobranças =====
export const listarCobrancas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        condominio_id: z.string().uuid(),
        status: z.enum(["pendente", "paga", "vencida", "cancelada", "parcial"]).optional(),
        competencia: z.string().optional(),
        unidade_id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("cobrancas")
      .select("*, unidades(numero, bloco), categorias_financeiras(nome, cor)")
      .eq("condominio_id", data.condominio_id)
      .order("vencimento", { ascending: false })
      .limit(500);
    if (data.status) q = q.eq("status", data.status);
    if (data.competencia) q = q.eq("competencia", data.competencia);
    if (data.unidade_id) q = q.eq("unidade_id", data.unidade_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const GerarLoteInput = z.object({
  condominio_id: z.string().uuid(),
  categoria_id: z.string().uuid().nullable(),
  competencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  descricao: z.string().max(500).optional().nullable(),
  usar_taxa_unidade: z.boolean(),
  valor_padrao: z.number().min(0),
});

export const gerarCobrancasLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GerarLoteInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: count, error } = await supabase.rpc("gerar_cobrancas_lote", {
      _condominio_id: data.condominio_id,
      _categoria_id: data.categoria_id as any,
      _competencia: data.competencia,
      _vencimento: data.vencimento,
      _descricao: (data.descricao ?? null) as any,
      _usar_taxa_unidade: data.usar_taxa_unidade,
      _valor_padrao: data.valor_padrao,
    });
    if (error) throw new Error(error.message);
    return { criadas: count as number };
  });

export const cancelarCobranca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("cobrancas")
      .update({ status: "cancelada" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const PagamentoManualInput = z.object({
  cobranca_id: z.string().uuid(),
  valor: z.number().min(0.01),
  forma: z.enum(["pix", "boleto", "dinheiro", "transferencia", "cartao", "outro"]),
  pago_em: z.string(),
  observacoes: z.string().max(500).optional().nullable(),
});

export const registrarPagamentoManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PagamentoManualInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("registrar_pagamento_manual", {
      _cobranca_id: data.cobranca_id,
      _valor: data.valor,
      _forma: data.forma,
      _pago_em: data.pago_em,
      _observacoes: (data.observacoes ?? null) as any,
    });
    if (error) throw new Error(error.message);
    return { id };
  });

// ===== Despesas =====
const DespesaInput = z.object({
  condominio_id: z.string().uuid(),
  categoria_id: z.string().uuid().nullable(),
  fornecedor: z.string().max(200).optional().nullable(),
  descricao: z.string().min(1).max(500),
  valor: z.number().min(0),
  data: z.string(),
  forma: z.enum(["pix", "boleto", "dinheiro", "transferencia", "cartao", "outro"]).optional().nullable(),
});

export const criarDespesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DespesaInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("despesas")
      .insert({ ...data, registrado_por: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listarDespesas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ condominio_id: z.string().uuid(), mes: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("despesas")
      .select("*, categorias_financeiras(nome, cor)")
      .eq("condominio_id", data.condominio_id)
      .order("data", { ascending: false })
      .limit(500);
    if (data.mes) {
      q = q.gte("data", `${data.mes}-01`).lt("data", proximoMes(data.mes));
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const removerDespesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("despesas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Resumo Dashboard =====
export const resumoFinanceiro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ condominio_id: z.string().uuid(), mes: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const inicio = `${data.mes}-01`;
    const fim = proximoMes(data.mes);

    const [{ data: cob }, { data: pag }, { data: desp }, { data: vencidas }] = await Promise.all([
      supabase.from("cobrancas").select("valor, valor_pago, multa, juros, desconto, status").eq("condominio_id", data.condominio_id).gte("competencia", inicio).lt("competencia", fim),
      supabase.from("pagamentos").select("valor").eq("condominio_id", data.condominio_id).gte("pago_em", inicio).lt("pago_em", fim),
      supabase.from("despesas").select("valor").eq("condominio_id", data.condominio_id).gte("data", inicio).lt("data", fim),
      supabase.from("cobrancas").select("id, valor, valor_pago, multa, juros, desconto").eq("condominio_id", data.condominio_id).in("status", ["pendente", "vencida", "parcial"]).lt("vencimento", new Date().toISOString().slice(0, 10)),
    ]);

    const totalCobrado = (cob ?? []).reduce((s, c: any) => s + Number(c.valor) + Number(c.multa) - Number(c.desconto), 0);
    const totalRecebidoMes = (pag ?? []).reduce((s, p: any) => s + Number(p.valor), 0);
    const totalDespesas = (desp ?? []).reduce((s, d: any) => s + Number(d.valor), 0);
    const totalInadimplencia = (vencidas ?? []).reduce(
      (s, c: any) => s + Math.max(0, Number(c.valor) + Number(c.multa) + Number(c.juros) - Number(c.desconto) - Number(c.valor_pago)),
      0,
    );
    const qtdInadimplentes = (vencidas ?? []).length;

    return { totalCobrado, totalRecebidoMes, totalDespesas, totalInadimplencia, qtdInadimplentes, saldoMes: totalRecebidoMes - totalDespesas };
  });

// ===== Config Pagamento (Mercado Pago) =====
const ConfigInput = z.object({
  condominio_id: z.string().uuid(),
  mp_access_token: z.string().optional().nullable(),
  mp_public_key: z.string().optional().nullable(),
  mp_webhook_secret: z.string().optional().nullable(),
  pix_chave: z.string().max(200).optional().nullable(),
  multa_percentual: z.number().min(0).max(50),
  juros_dia_percentual: z.number().min(0).max(5),
  ativo: z.boolean(),
  // Automação WhatsApp (opcionais — só atualiza se enviados)
  wa_automacao_ativa: z.boolean().optional(),
  wa_dias_pre_vencimento: z.array(z.number().int().min(0).max(60)).max(10).optional(),
  wa_dias_pos_vencimento: z.array(z.number().int().min(0).max(120)).max(10).optional(),
  wa_template_lembrete: z.string().min(10).max(1000).optional(),
  wa_template_vencida: z.string().min(10).max(1000).optional(),
});

export const salvarConfigPagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ConfigInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isSind } = await context.supabase.rpc("is_sindico", {
      _user_id: context.userId,
      _condominio_id: data.condominio_id,
    } as any);
    if (!isSind) throw new Error("forbidden");

    const payload: any = {
      condominio_id: data.condominio_id,
      pix_chave: data.pix_chave,
      multa_percentual: data.multa_percentual,
      juros_dia_percentual: data.juros_dia_percentual,
      ativo: data.ativo,
    };
    if (data.mp_access_token) payload.mp_access_token = data.mp_access_token;
    if (data.mp_public_key) payload.mp_public_key = data.mp_public_key;
    if (data.mp_webhook_secret) payload.mp_webhook_secret = data.mp_webhook_secret;
    if (data.wa_automacao_ativa !== undefined) payload.wa_automacao_ativa = data.wa_automacao_ativa;
    if (data.wa_dias_pre_vencimento) payload.wa_dias_pre_vencimento = data.wa_dias_pre_vencimento;
    if (data.wa_dias_pos_vencimento) payload.wa_dias_pos_vencimento = data.wa_dias_pos_vencimento;
    if (data.wa_template_lembrete) payload.wa_template_lembrete = data.wa_template_lembrete;
    if (data.wa_template_vencida) payload.wa_template_vencida = data.wa_template_vencida;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("config_pagamento").upsert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const obterConfigPagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ condominio_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isSind } = await context.supabase.rpc("is_sindico", {
      _user_id: context.userId,
      _condominio_id: data.condominio_id,
    } as any);
    if (!isSind) throw new Error("forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("config_pagamento")
      .select(
        "condominio_id, mp_public_key, pix_chave, multa_percentual, juros_dia_percentual, dias_envio_lembrete, ativo, mp_access_token, mp_webhook_secret, wa_automacao_ativa, wa_dias_pre_vencimento, wa_dias_pos_vencimento, wa_template_lembrete, wa_template_vencida",
      )
      .eq("condominio_id", data.condominio_id)
      .maybeSingle();
    if (!row) return null;
    const pix = row.pix_chave as string | null;
    return {
      condominio_id: row.condominio_id,
      mp_public_key: row.mp_public_key,
      pix_chave_mascarada: pix && pix.length >= 4 ? "****" + pix.slice(-4) : null,
      multa_percentual: row.multa_percentual,
      juros_dia_percentual: row.juros_dia_percentual,
      dias_envio_lembrete: row.dias_envio_lembrete,
      ativo: row.ativo,
      mp_token_configured: !!row.mp_access_token,
      mp_webhook_configured: !!row.mp_webhook_secret,
      wa_automacao_ativa: row.wa_automacao_ativa ?? false,
      wa_dias_pre_vencimento: row.wa_dias_pre_vencimento ?? [3, 1],
      wa_dias_pos_vencimento: row.wa_dias_pos_vencimento ?? [1, 7, 15],
      wa_template_lembrete: row.wa_template_lembrete ?? "",
      wa_template_vencida: row.wa_template_vencida ?? "",
    };
  });

function proximoMes(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m, 1);
  return d.toISOString().slice(0, 10);
}

// ===== WhatsApp lembretes =====
export const enviarLembreteCobranca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cobranca_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ enfileirados: number }> => {
    const { supabase, userId } = context;
    const { data: cob, error } = await supabase
      .from("cobrancas")
      .select("id, condominio_id, unidade_id, valor, multa, juros, desconto, valor_pago, vencimento, unidades(numero, bloco)")
      .eq("id", data.cobranca_id)
      .single();
    if (error || !cob) throw new Error("cobranca_nao_encontrada");

    const { data: isSind } = await supabase.rpc("is_sindico", { _user_id: userId, _condominio_id: cob.condominio_id } as any);
    const { data: isCont } = await supabase.rpc("is_contador", { _user_id: userId, _condominio_id: cob.condominio_id } as any);
    if (!isSind && !isCont) throw new Error("forbidden");

    const { data: mors } = await supabase
      .from("unidade_moradores")
      .select("user_id")
      .eq("unidade_id", cob.unidade_id);

    const userIds = (mors ?? []).map((m: any) => m.user_id);
    if (userIds.length === 0) return { enfileirados: 0 };

    const { data: profs } = await supabase
      .from("profiles")
      .select("id, nome_completo, telefone")
      .in("id", userIds);

    const restante =
      Number(cob.valor) + Number(cob.multa) + Number(cob.juros) -
      Number(cob.desconto) - Number(cob.valor_pago);
    const u = (cob as any).unidades;
    const unidadeLabel = u ? `${u.bloco ? u.bloco + "-" : ""}${u.numero}` : "sua unidade";
    const venc = new Date(cob.vencimento).toLocaleDateString("pt-BR");
    const valor = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(restante);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let count = 0;
    for (const p of profs ?? []) {
      const tel = (p.telefone ?? "").replace(/\D/g, "");
      if (tel.length < 10) continue;
      const telFinal = tel.length <= 11 ? "55" + tel : tel;
      const msg = `Olá ${p.nome_completo ?? ""}! Lembrete da cobrança da ${unidadeLabel}: vencimento ${venc}, saldo devedor ${valor}. Acesse o app para pagar via PIX.`;
      const { error: insErr } = await supabaseAdmin.from("notificacoes_whatsapp").insert({
        condominio_id: cob.condominio_id,
        unidade_id: cob.unidade_id,
        destinatario_user_id: p.id,
        destinatario_telefone: telFinal,
        destinatario_nome: p.nome_completo,
        mensagem: msg,
        contexto: "cobranca",
        contexto_id: cob.id,
        status: "pendente",
        link_wa: `https://wa.me/${telFinal}?text=${encodeURIComponent(msg)}`,
      });
      if (!insErr) count++;
    }
    return { enfileirados: count };
  });

export const enviarLembretesInadimplencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cobranca_ids: z.array(z.string().uuid()).min(1).max(200) }).parse(d))
  .handler(async ({ data, context }): Promise<{ enfileirados: number }> => {
    let total = 0;
    for (const id of data.cobranca_ids) {
      try {
        const r = await (enviarLembreteCobranca as any)({ data: { cobranca_id: id }, context });
        total += r?.enfileirados ?? 0;
      } catch {}
    }
    return { enfileirados: total };
  });

// ===== Exportação de relatórios =====
const RelatorioInput = z.object({
  condominio_id: z.string().uuid(),
  mes: z.string().regex(/^\d{4}-\d{2}$/),
});

export const exportarRelatorioFinanceiro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RelatorioInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isSind } = await supabase.rpc("is_sindico", {
      _user_id: userId,
      _condominio_id: data.condominio_id,
    } as any);
    const { data: isCont } = await supabase.rpc("is_contador", {
      _user_id: userId,
      _condominio_id: data.condominio_id,
    } as any);
    if (!isSind && !isCont) throw new Error("forbidden");

    const inicio = `${data.mes}-01`;
    const fim = proximoMes(data.mes);

    const [{ data: cond }, { data: cobs }, { data: pags }, { data: desps }] = await Promise.all([
      supabase.from("condominios").select("nome, cnpj").eq("id", data.condominio_id).maybeSingle(),
      supabase
        .from("cobrancas")
        .select("competencia, vencimento, valor, valor_pago, multa, juros, desconto, status, descricao, unidades(numero, bloco), categorias_financeiras(nome)")
        .eq("condominio_id", data.condominio_id)
        .gte("competencia", inicio)
        .lt("competencia", fim)
        .order("vencimento"),
      supabase
        .from("pagamentos")
        .select("pago_em, valor, forma, cobrancas(competencia, unidades(numero, bloco))")
        .eq("condominio_id", data.condominio_id)
        .gte("pago_em", inicio)
        .lt("pago_em", fim)
        .order("pago_em"),
      supabase
        .from("despesas")
        .select("data, descricao, fornecedor, valor, forma, categorias_financeiras(nome)")
        .eq("condominio_id", data.condominio_id)
        .gte("data", inicio)
        .lt("data", fim)
        .order("data"),
    ]);

    return {
      condominio: cond ?? null,
      mes: data.mes,
      cobrancas: cobs ?? [],
      pagamentos: pags ?? [],
      despesas: desps ?? [],
    };
  });

// ===== Automação WhatsApp — execução =====
function renderTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

/** Placeholders obrigatórios em qualquer template de cobrança. */
export const PLACEHOLDERS_OBRIGATORIOS = ["nome", "unidade", "vencimento", "valor"] as const;

// ===== Histórico de notificações WhatsApp =====
export const listarNotificacoesWA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        condominio_id: z.string().uuid(),
        data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        status: z.enum(["pendente", "enviado", "falhou"]).optional(),
        contexto: z.enum(["encomenda", "visitante", "reserva", "cobranca"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("notificacoes_whatsapp")
      .select("*")
      .eq("condominio_id", data.condominio_id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status) q = q.eq("status", data.status);
    if (data.contexto) q = q.eq("contexto", data.contexto);
    if (data.data_inicio) q = q.gte("created_at", `${data.data_inicio}T00:00:00`);
    if (data.data_fim) q = q.lte("created_at", `${data.data_fim}T23:59:59`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const reenviarNotificacaoWA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: orig, error } = await supabase
      .from("notificacoes_whatsapp")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !orig) throw new Error("notificacao_nao_encontrada");
    const { data: isSind } = await supabase.rpc("is_sindico", {
      _user_id: userId, _condominio_id: orig.condominio_id,
    } as any);
    if (!isSind) throw new Error("forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: novo, error: insErr } = await supabaseAdmin
      .from("notificacoes_whatsapp")
      .insert({
        condominio_id: orig.condominio_id,
        unidade_id: orig.unidade_id,
        destinatario_user_id: orig.destinatario_user_id,
        destinatario_telefone: orig.destinatario_telefone,
        destinatario_nome: orig.destinatario_nome,
        mensagem: orig.mensagem,
        contexto: orig.contexto,
        contexto_id: orig.contexto_id,
        status: "pendente",
        link_wa: orig.link_wa,
      })
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);
    return novo;
  });

export const executarAutomacaoLembretes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ condominio_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ enfileirados: number; cobrancas: number }> => {
    const { supabase, userId } = context;
    const { data: isSind } = await supabase.rpc("is_sindico", {
      _user_id: userId,
      _condominio_id: data.condominio_id,
    } as any);
    if (!isSind) throw new Error("forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cfg } = await supabaseAdmin
      .from("config_pagamento")
      .select("wa_automacao_ativa, wa_dias_pre_vencimento, wa_dias_pos_vencimento, wa_template_lembrete, wa_template_vencida")
      .eq("condominio_id", data.condominio_id)
      .maybeSingle();
    if (!cfg || !cfg.wa_automacao_ativa) return { enfileirados: 0, cobrancas: 0 };

    const hoje = new Date();
    const isoDia = (d: Date) => d.toISOString().slice(0, 10);
    const datasAlvo: { data: string; tipo: "pre" | "pos" }[] = [];
    for (const d of cfg.wa_dias_pre_vencimento ?? []) {
      const dt = new Date(hoje);
      dt.setDate(dt.getDate() + d);
      datasAlvo.push({ data: isoDia(dt), tipo: "pre" });
    }
    for (const d of cfg.wa_dias_pos_vencimento ?? []) {
      const dt = new Date(hoje);
      dt.setDate(dt.getDate() - d);
      datasAlvo.push({ data: isoDia(dt), tipo: "pos" });
    }

    const datasUnicas = Array.from(new Set(datasAlvo.map((x) => x.data)));
    const { data: cobs } = await supabase
      .from("cobrancas")
      .select("id, vencimento, valor, valor_pago, multa, juros, desconto, condominio_id, unidade_id, unidades(numero, bloco)")
      .eq("condominio_id", data.condominio_id)
      .in("vencimento", datasUnicas)
      .in("status", ["pendente", "vencida", "parcial"]);

    let count = 0;
    let cobCount = 0;
    for (const cob of cobs ?? []) {
      const tipo = datasAlvo.find((x) => x.data === cob.vencimento)?.tipo ?? "pre";
      const tpl = tipo === "pre" ? cfg.wa_template_lembrete : cfg.wa_template_vencida;
      if (!tpl) continue;

      const { data: mors } = await supabase
        .from("unidade_moradores")
        .select("user_id")
        .eq("unidade_id", cob.unidade_id);
      const userIds = (mors ?? []).map((m: any) => m.user_id);
      if (userIds.length === 0) continue;
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nome_completo, telefone")
        .in("id", userIds);

      const restante =
        Number(cob.valor) + Number(cob.multa) + Number(cob.juros) - Number(cob.desconto) - Number(cob.valor_pago);
      const u = (cob as any).unidades;
      const unidadeLabel = u ? `${u.bloco ? u.bloco + "-" : ""}${u.numero}` : "sua unidade";
      const venc = new Date(cob.vencimento).toLocaleDateString("pt-BR");
      const valor = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(restante);

      cobCount++;
      for (const p of profs ?? []) {
        const tel = (p.telefone ?? "").replace(/\D/g, "");
        if (tel.length < 10) continue;
        const telFinal = tel.length <= 11 ? "55" + tel : tel;
        const msg = renderTemplate(tpl, {
          nome: p.nome_completo ?? "",
          unidade: unidadeLabel,
          vencimento: venc,
          valor,
        });
        const { error: insErr } = await supabaseAdmin.from("notificacoes_whatsapp").insert({
          condominio_id: cob.condominio_id,
          unidade_id: cob.unidade_id,
          destinatario_user_id: p.id,
          destinatario_telefone: telFinal,
          destinatario_nome: p.nome_completo,
          mensagem: msg,
          contexto: "cobranca",
          contexto_id: cob.id,
          status: "pendente",
          link_wa: `https://wa.me/${telFinal}?text=${encodeURIComponent(msg)}`,
        });
        if (!insErr) count++;
      }
    }
    return { enfileirados: count, cobrancas: cobCount };
  });
