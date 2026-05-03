import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ===== Categorias =====
const CategoriaInput = z.object({
  condominio_id: z.string().uuid(),
  nome: z.string().min(1).max(80),
  tipo: z.enum(["receita", "despesa"]),
  cor: z.string().max(20).optional(),
});

export const criarCategoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CategoriaInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
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
});

export const salvarConfigPagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ConfigInput.parse(d))
  .handler(async ({ data, context }) => {
    const payload: any = {
      condominio_id: data.condominio_id,
      pix_chave: data.pix_chave,
      multa_percentual: data.multa_percentual,
      juros_dia_percentual: data.juros_dia_percentual,
      ativo: data.ativo,
    };
    if (data.mp_access_token) payload.mp_access_token = data.mp_access_token;
    if (data.mp_public_key) payload.mp_public_key = data.mp_public_key;
    const { error } = await context.supabase.from("config_pagamento").upsert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const obterConfigPagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ condominio_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("config_pagamento")
      .select("condominio_id, mp_public_key, pix_chave, multa_percentual, juros_dia_percentual, dias_envio_lembrete, ativo, mp_access_token")
      .eq("condominio_id", data.condominio_id)
      .maybeSingle();
    if (!row) return null;
    return {
      ...row,
      mp_access_token: row.mp_access_token ? "•••••••••••" + (row.mp_access_token as string).slice(-4) : null,
      mp_token_configured: !!row.mp_access_token,
    };
  });

function proximoMes(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m, 1);
  return d.toISOString().slice(0, 10);
}
