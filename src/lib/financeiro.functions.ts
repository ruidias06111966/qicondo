import { throwSafe } from "@/lib/safe-error";
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
    if (error) throwSafe(error);
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
    if (error) throwSafe(error);
    return rows ?? [];
  });

export const removerCategoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("categorias_financeiras")
      .delete()
      .eq("id", data.id);
    if (error) throwSafe(error);
    return { ok: true };
  });

const CATEGORIAS_PADRAO: Array<{ nome: string; tipo: "receita" | "despesa"; cor: string }> = [
  { nome: "Taxa condominial", tipo: "receita", cor: "#10B981" },
  { nome: "Fundo de reserva", tipo: "receita", cor: "#14B8A6" },
  { nome: "Multas e juros", tipo: "receita", cor: "#F59E0B" },
  { nome: "Taxa de uso de áreas", tipo: "receita", cor: "#3B82F6" },
  { nome: "Outras receitas", tipo: "receita", cor: "#8B5CF6" },
  { nome: "Água", tipo: "despesa", cor: "#3B82F6" },
  { nome: "Energia", tipo: "despesa", cor: "#F59E0B" },
  { nome: "Limpeza", tipo: "despesa", cor: "#14B8A6" },
  { nome: "Manutenção", tipo: "despesa", cor: "#EF4444" },
  { nome: "Segurança", tipo: "despesa", cor: "#8B5CF6" },
  { nome: "Administração", tipo: "despesa", cor: "#EC4899" },
  { nome: "Salários e encargos", tipo: "despesa", cor: "#F97316" },
  { nome: "Outras despesas", tipo: "despesa", cor: "#64748B" },
];

export const semearCategoriasPadrao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ condominio_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: existentes, error: errSel } = await supabase
      .from("categorias_financeiras")
      .select("nome, tipo")
      .eq("condominio_id", data.condominio_id);
    if (errSel) throwSafe(errSel);
    const chaves = new Set(
      (existentes ?? []).map((c) => `${c.tipo}|${(c.nome || "").toLowerCase()}`),
    );
    const novas = CATEGORIAS_PADRAO.filter(
      (c) => !chaves.has(`${c.tipo}|${c.nome.toLowerCase()}`),
    ).map((c) => ({ ...c, condominio_id: data.condominio_id }));
    if (novas.length === 0) return { inseridas: 0 };
    const { error } = await supabase.from("categorias_financeiras").insert(novas);
    if (error) throwSafe(error);
    return { inseridas: novas.length };
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
    if (error) throwSafe(error);
    return rows ?? [];
  });

/**
 * Três maneiras de pôr valor nas cobranças de um lote:
 *
 * - `taxa_unidade`: cada unidade paga a taxa mensal cadastrada nela.
 * - `valor_unico`:  todas pagam o mesmo. Serve para quando é mesmo igual.
 * - `fracao_ideal`: `valor` é o TOTAL e reparte-se na proporção da fração de
 *                   cada unidade. É o modo correcto para taxas extras — uma
 *                   obra não se divide em partes iguais entre a cobertura e a
 *                   quitinete (Código Civil, art. 1.336, I).
 */
const GerarLoteInput = z.object({
  condominio_id: z.string().uuid(),
  categoria_id: z.string().uuid().nullable(),
  competencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  descricao: z.string().max(500).optional().nullable(),
  modo: z.enum(["taxa_unidade", "valor_unico", "fracao_ideal"]),
  valor: z.number().min(0),
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
      _modo: data.modo,
      _valor: data.valor,
    });
    if (error) throwSafe(error);
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
    if (error) throwSafe(error);
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
    if (error) throwSafe(error);
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
  forma: z
    .enum(["pix", "boleto", "dinheiro", "transferencia", "cartao", "outro"])
    .optional()
    .nullable(),
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
    if (error) throwSafe(error);
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
    if (error) throwSafe(error);
    return rows ?? [];
  });

export const removerDespesa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("despesas").delete().eq("id", data.id);
    if (error) throwSafe(error);
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

    const [rCob, rPag, rDesp, rVenc] = await Promise.all([
      supabase
        .from("cobrancas")
        .select("valor, valor_pago, multa, juros, desconto, status")
        .eq("condominio_id", data.condominio_id)
        .gte("competencia", inicio)
        .lt("competencia", fim),
      supabase
        .from("pagamentos")
        .select("valor")
        .eq("condominio_id", data.condominio_id)
        .gte("pago_em", inicio)
        .lt("pago_em", fim),
      supabase
        .from("despesas")
        .select("valor")
        .eq("condominio_id", data.condominio_id)
        .gte("data", inicio)
        .lt("data", fim),
      supabase
        .from("cobrancas")
        .select("id, valor, valor_pago, multa, juros, desconto")
        .eq("condominio_id", data.condominio_id)
        .in("status", ["pendente", "vencida", "parcial"])
        .lt("vencimento", new Date().toISOString().slice(0, 10)),
    ]);

    // Sem isto, um erro de RLS/rede virava silenciosamente "R$ 0,00" no painel —
    // indistinguível de um mês legitimamente vazio.
    for (const r of [rCob, rPag, rDesp, rVenc]) {
      if (r.error) throwSafe(r.error);
    }
    const { data: cob } = rCob;
    const { data: pag } = rPag;
    const { data: desp } = rDesp;
    const { data: vencidas } = rVenc;

    // Inclui `juros`, tal como o cálculo de inadimplência abaixo — antes os dois
    // números usavam fórmulas diferentes para o mesmo saldo.
    const totalCobrado = (cob ?? []).reduce(
      (s, c: any) => s + Number(c.valor) + Number(c.multa) + Number(c.juros) - Number(c.desconto),
      0,
    );
    const totalRecebidoMes = (pag ?? []).reduce((s, p: any) => s + Number(p.valor), 0);
    const totalDespesas = (desp ?? []).reduce((s, d: any) => s + Number(d.valor), 0);
    const totalInadimplencia = (vencidas ?? []).reduce(
      (s, c: any) =>
        s +
        Math.max(
          0,
          Number(c.valor) +
            Number(c.multa) +
            Number(c.juros) -
            Number(c.desconto) -
            Number(c.valor_pago),
        ),
      0,
    );
    const qtdInadimplentes = (vencidas ?? []).length;

    return {
      totalCobrado,
      totalRecebidoMes,
      totalDespesas,
      totalInadimplencia,
      qtdInadimplentes,
      saldoMes: totalRecebidoMes - totalDespesas,
    };
  });

// ===== Config Pagamento (conta bancária do condomínio) =====
const ConfigInput = z.object({
  condominio_id: z.string().uuid(),
  pix_chave: z.string().max(200).optional().nullable(),
  multa_percentual: z.number().min(0).max(50),
  juros_dia_percentual: z.number().min(0).max(5),
  ativo: z.boolean(),
  // Saldo de abertura: o condomínio que adopta o sistema a meio da vida tem
  // dinheiro no banco que o sistema nunca viu. Sem isto, o saldo acumulado do
  // balancete fica errado para sempre. `saldo_inicial_data` é a data a que o
  // saldo se refere; movimentos anteriores a ela são ignorados no acumulado,
  // porque já estão dentro do saldo.
  saldo_inicial: z.number().optional(),
  saldo_inicial_data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
    .optional()
    .nullable(),
  // Conta bancária do condomínio (opcionais)
  banco_nome: z.string().max(120).optional().nullable(),
  banco_agencia: z.string().max(20).optional().nullable(),
  banco_conta: z.string().max(40).optional().nullable(),
  banco_tipo_conta: z.string().max(40).optional().nullable(),
  banco_titular: z.string().max(200).optional().nullable(),
  banco_cnpj: z.string().max(20).optional().nullable(),
  instrucoes_boleto: z.string().max(1000).optional().nullable(),
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
    if (data.banco_nome !== undefined) payload.banco_nome = data.banco_nome;
    if (data.banco_agencia !== undefined) payload.banco_agencia = data.banco_agencia;
    if (data.banco_conta !== undefined) payload.banco_conta = data.banco_conta;
    if (data.banco_tipo_conta !== undefined) payload.banco_tipo_conta = data.banco_tipo_conta;
    if (data.banco_titular !== undefined) payload.banco_titular = data.banco_titular;
    if (data.banco_cnpj !== undefined) payload.banco_cnpj = data.banco_cnpj;
    if (data.instrucoes_boleto !== undefined) payload.instrucoes_boleto = data.instrucoes_boleto;
    if (data.saldo_inicial !== undefined) payload.saldo_inicial = data.saldo_inicial;
    if (data.saldo_inicial_data !== undefined)
      payload.saldo_inicial_data = data.saldo_inicial_data || null;
    if (data.wa_automacao_ativa !== undefined) payload.wa_automacao_ativa = data.wa_automacao_ativa;
    if (data.wa_dias_pre_vencimento) payload.wa_dias_pre_vencimento = data.wa_dias_pre_vencimento;
    if (data.wa_dias_pos_vencimento) payload.wa_dias_pos_vencimento = data.wa_dias_pos_vencimento;
    if (data.wa_template_lembrete) payload.wa_template_lembrete = data.wa_template_lembrete;
    if (data.wa_template_vencida) payload.wa_template_vencida = data.wa_template_vencida;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("config_pagamento").upsert(payload);
    if (error) throwSafe(error);
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
        "condominio_id, pix_chave, multa_percentual, juros_dia_percentual, dias_envio_lembrete, ativo, banco_nome, banco_agencia, banco_conta, banco_tipo_conta, banco_titular, banco_cnpj, instrucoes_boleto, saldo_inicial, saldo_inicial_data, wa_automacao_ativa, wa_dias_pre_vencimento, wa_dias_pos_vencimento, wa_template_lembrete, wa_template_vencida",
      )
      .eq("condominio_id", data.condominio_id)
      .maybeSingle();
    if (!row) return null;
    const pix = row.pix_chave as string | null;
    const conta = row.banco_conta as string | null;
    return {
      condominio_id: row.condominio_id,
      pix_chave_mascarada: pix && pix.length >= 4 ? "****" + pix.slice(-4) : null,
      multa_percentual: row.multa_percentual,
      juros_dia_percentual: row.juros_dia_percentual,
      dias_envio_lembrete: row.dias_envio_lembrete,
      ativo: row.ativo,
      banco_nome: row.banco_nome,
      banco_agencia: row.banco_agencia,
      banco_conta_mascarada: conta && conta.length >= 2 ? "****" + conta.slice(-2) : null,
      banco_tipo_conta: row.banco_tipo_conta,
      banco_titular: row.banco_titular,
      banco_cnpj: row.banco_cnpj,
      instrucoes_boleto: row.instrucoes_boleto,
      saldo_inicial: Number(row.saldo_inicial ?? 0),
      saldo_inicial_data: row.saldo_inicial_data,
      wa_automacao_ativa: row.wa_automacao_ativa ?? false,
      wa_dias_pre_vencimento: row.wa_dias_pre_vencimento ?? [3, 1],
      wa_dias_pos_vencimento: row.wa_dias_pos_vencimento ?? [1, 7, 15],
      wa_template_lembrete: row.wa_template_lembrete ?? "",
      wa_template_vencida: row.wa_template_vencida ?? "",
    };
  });

/**
 * Primeiro dia do mês seguinte a `mes` ("YYYY-MM"), em `YYYY-MM-DD`.
 *
 * Usa `Date.UTC`: `new Date(y, m, 1)` cria a data no fuso local e `toISOString()`
 * converte para UTC, o que devolvia o dia anterior em qualquer fuso a leste de
 * Greenwich — cortando um dia inteiro de todos os filtros de competência.
 */
function proximoMes(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

// ===== WhatsApp lembretes =====

/**
 * Enfileira o lembrete de uma cobrança. Partilhado pelo envio individual e pelo
 * envio em lote — antes o lote reinvocava a server function e passava-lhe um
 * `context`, argumento que o `inputValidator` ignora, refazendo a validação do
 * JWT e a checagem de permissão a cada id da lista.
 *
 * Assume que a permissão já foi verificada pelo chamador.
 */
async function enfileirarLembrete(supabase: any, cobrancaId: string): Promise<number> {
  const { data: cob, error } = await supabase
    .from("cobrancas")
    .select(
      "id, condominio_id, unidade_id, valor, multa, juros, desconto, valor_pago, vencimento, unidades(numero, bloco)",
    )
    .eq("id", cobrancaId)
    .single();
  if (error || !cob) throw new Error("cobranca_nao_encontrada");

  const { data: mors } = await supabase
    .from("unidade_moradores")
    .select("user_id")
    .eq("unidade_id", cob.unidade_id);

  const userIds = (mors ?? []).map((m: any) => m.user_id);
  if (userIds.length === 0) return 0;

  const { data: profs } = await supabase
    .from("profiles")
    .select("id, nome_completo, telefone")
    .in("id", userIds);

  const restante =
    Number(cob.valor) +
    Number(cob.multa) +
    Number(cob.juros) -
    Number(cob.desconto) -
    Number(cob.valor_pago);
  const u = (cob as any).unidades;
  const unidadeLabel = u ? `${u.bloco ? u.bloco + "-" : ""}${u.numero}` : "sua unidade";
  const venc = new Date(cob.vencimento).toLocaleDateString("pt-BR");
  const valor = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    restante,
  );

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
  return count;
}

/**
 * Confirma que o utilizador gere o financeiro desta empresa.
 *
 * Usa `pode_gerir_financeiro` (sindico | admin | contador | financeiro) — a mesma
 * regra de `podeGerirFinanceiro` no cliente. Antes verificava-se apenas
 * `is_sindico OR is_contador`, o que recusava tudo a quem tem o perfil
 * `financeiro` depois de a UI já lhe ter mostrado o módulo inteiro.
 */
async function checarGestorFinanceiro(supabase: any, userId: string, condominioId: string) {
  const { data: pode } = await supabase.rpc("pode_gerir_financeiro", {
    _user_id: userId,
    _condominio_id: condominioId,
  } as any);
  if (!pode) throw new Error("forbidden");
}

export const enviarLembreteCobranca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cobranca_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ enfileirados: number }> => {
    const { supabase, userId } = context;
    const { data: cob } = await supabase
      .from("cobrancas")
      .select("condominio_id")
      .eq("id", data.cobranca_id)
      .maybeSingle();
    if (!cob) throw new Error("cobranca_nao_encontrada");
    await checarGestorFinanceiro(supabase, userId, cob.condominio_id);

    return { enfileirados: await enfileirarLembrete(supabase, data.cobranca_id) };
  });

export const enviarLembretesInadimplencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        condominio_id: z.string().uuid(),
        cobranca_ids: z.array(z.string().uuid()).min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ enfileirados: number; falhas: number }> => {
    const { supabase, userId } = context;
    await checarGestorFinanceiro(supabase, userId, data.condominio_id);

    let total = 0;
    let falhas = 0;
    for (const id of data.cobranca_ids) {
      try {
        total += await enfileirarLembrete(supabase, id);
      } catch (e) {
        // Uma cobrança inválida não deve abortar o lote, mas tem de ser contada
        // — antes o `catch {}` devolvia "0 enfileirados" sem qualquer indicação.
        falhas++;
        console.error("[enviarLembretesInadimplencia] falhou para", id, e);
      }
    }
    return { enfileirados: total, falhas };
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
    await checarGestorFinanceiro(supabase, userId, data.condominio_id);

    const inicio = `${data.mes}-01`;
    const fim = proximoMes(data.mes);

    const [{ data: cond }, { data: cobs }, { data: pags }, { data: desps }] = await Promise.all([
      supabase.from("condominios").select("nome, cnpj").eq("id", data.condominio_id).maybeSingle(),
      supabase
        .from("cobrancas")
        .select(
          "competencia, vencimento, valor, valor_pago, multa, juros, desconto, status, descricao, unidades(numero, bloco), categorias_financeiras(nome)",
        )
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
        data_inicio: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        data_fim: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
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
    if (error) throwSafe(error);
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
      _user_id: userId,
      _condominio_id: orig.condominio_id,
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
    if (insErr) throwSafe(insErr);
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
      .select(
        "wa_automacao_ativa, wa_dias_pre_vencimento, wa_dias_pos_vencimento, wa_template_lembrete, wa_template_vencida",
      )
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
      .select(
        "id, vencimento, valor, valor_pago, multa, juros, desconto, condominio_id, unidade_id, unidades(numero, bloco)",
      )
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
        Number(cob.valor) +
        Number(cob.multa) +
        Number(cob.juros) -
        Number(cob.desconto) -
        Number(cob.valor_pago);
      const u = (cob as any).unidades;
      const unidadeLabel = u ? `${u.bloco ? u.bloco + "-" : ""}${u.numero}` : "sua unidade";
      const venc = new Date(cob.vencimento).toLocaleDateString("pt-BR");
      const valor = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
        restante,
      );

      cobCount++;
      const inicioHoje = new Date();
      inicioHoje.setHours(0, 0, 0, 0);
      const inicioHojeISO = inicioHoje.toISOString();
      for (const p of profs ?? []) {
        const tel = (p.telefone ?? "").replace(/\D/g, "");
        if (tel.length < 10) continue;
        const telFinal = tel.length <= 11 ? "55" + tel : tel;

        // Idempotência: já existe notificação hoje para essa cobrança + telefone?
        const { data: jaExiste } = await supabaseAdmin
          .from("notificacoes_whatsapp")
          .select("id")
          .eq("contexto", "cobranca")
          .eq("contexto_id", cob.id)
          .eq("destinatario_telefone", telFinal)
          .gte("created_at", inicioHojeISO)
          .limit(1)
          .maybeSingle();
        if (jaExiste) continue;

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

// ===== Inadimplência: encargos de atraso =====
//
// A multa e os juros são gravados em `cobrancas.multa` e `cobrancas.juros` pelo
// agendamento diário (migração `motor_inadimplencia`). Estas duas funções
// existem para o síndico não ter de esperar pela madrugada depois de corrigir
// uma taxa, e para ver a dívida agrupada por unidade em vez de cobrança a
// cobrança.

export const recalcularEncargos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ condominio_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: n, error } = await context.supabase.rpc("aplicar_encargos_atraso", {
      _condominio_id: data.condominio_id,
    });
    if (error) throwSafe(error);
    return { cobrancas: Number(n ?? 0) };
  });

export type LinhaInadimplencia = {
  unidade_id: string;
  bloco: string | null;
  numero: string;
  cobrancas: number;
  dias_atraso_max: number;
  principal: number;
  multa: number;
  juros: number;
  total: number;
  vencimento_mais_antigo: string;
};

export const relatorioInadimplencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ condominio_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("relatorio_inadimplencia", {
      _condominio_id: data.condominio_id,
    });
    if (error) throwSafe(error);

    const linhas: LinhaInadimplencia[] = (rows ?? []).map((r: Record<string, unknown>) => ({
      unidade_id: String(r.unidade_id),
      bloco: (r.bloco as string | null) ?? null,
      numero: String(r.numero),
      cobrancas: Number(r.cobrancas),
      dias_atraso_max: Number(r.dias_atraso_max),
      principal: Number(r.principal),
      multa: Number(r.multa),
      juros: Number(r.juros),
      total: Number(r.total),
      vencimento_mais_antigo: String(r.vencimento_mais_antigo),
    }));

    return {
      linhas,
      total: linhas.reduce((acc, l) => acc + l.total, 0),
      unidades: linhas.length,
    };
  });

/**
 * Marca (ou desmarca) uma categoria de receita como fundo de reserva.
 *
 * No condomínio brasileiro o fundo de reserva não é receita corrente: é
 * poupança com destino próprio, e misturá-lo no saldo operacional faz o
 * condomínio parecer mais folgado do que está. O balancete separa-o — mas só
 * sabe quais são as categorias que alguém marcou aqui.
 *
 * Qual delas é não se adivinha pelo nome: o `semearCategoriasPadrao` cria uma
 * chamada "Fundo de reserva", e cada condomínio chama-lhe o que quer.
 */
export const definirFundoReserva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), fundo_reserva: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("categorias_financeiras")
      .update({ fundo_reserva: data.fundo_reserva })
      .eq("id", data.id)
      .select("id, fundo_reserva")
      .single();
    if (error) throwSafe(error);
    return row;
  });
