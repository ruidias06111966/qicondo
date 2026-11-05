/**
 * Planilha orçamentária anual.
 *
 * A aritmética vive no banco, em `resumo_orcamento`: é a mesma conta que o
 * ecrã mostra e que fica no registo da aprovação em assembleia. Repeti-la em
 * TypeScript criaria duas respostas possíveis para a mesma quota — e a quota é
 * o que o condómino vai pagar durante doze meses.
 *
 * O que vive aqui é a *sugestão* de índice por rubrica. É palpite de
 * interface, não regra: o banco guarda o que o síndico escolher, e é ele que
 * responde pela escolha.
 */
import { throwSafe } from "@/lib/safe-error";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OrcamentoStatus = "rascunho" | "aprovado";

export type IndiceReajuste =
  "ipca" | "inpc" | "igpm" | "incc" | "cct" | "tarifa" | "manual" | "nenhum";

export const ROTULO_INDICE: Record<IndiceReajuste, string> = {
  ipca: "IPCA — inflação oficial",
  inpc: "INPC — consumo de renda baixa",
  igpm: "IGP-M — tradicional, volátil",
  incc: "INCC — custo da construção",
  cct: "Convenção coletiva da categoria",
  tarifa: "Reajuste da concessionária",
  manual: "Valor próprio",
  nenhum: "Sem reajuste",
};

/** Uma linha de ajuda por índice, para quem nunca escolheu nenhum. */
export const AJUDA_INDICE: Record<IndiceReajuste, string> = {
  ipca: "Serve a administração, seguros e serviços em geral.",
  inpc: "Acompanha o consumo das famílias de renda mais baixa. É o mais próximo da folha quando não há convenção à mão.",
  igpm: "Tradicional nos aluguéis. Oscila com câmbio e commodities — use com cuidado.",
  incc: "Para obras e reformas, que seguem o custo da construção e não a inflação ao consumidor.",
  cct: "O reajuste que a convenção coletiva deu à categoria. É o número certo para salários e encargos.",
  tarifa: "O reajuste que a concessionária publicou. Água e energia não seguem índice de inflação.",
  manual: "Um número seu — uma proposta já recebida, um contrato assinado. Explique na observação.",
  nenhum: "A rubrica repete o ano anterior sem reajuste.",
};

/**
 * Sugestão por nome de rubrica. Deliberadamente grosseira e deliberadamente no
 * cliente: acertar em dois terços poupa trabalho, e errar não estraga nada
 * porque o síndico vê e troca.
 */
export function sugerirIndice(nomeCategoria: string): IndiceReajuste {
  const n = nomeCategoria.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/salari|encargo|folha|funcionario|zelador|porteir/.test(n)) return "cct";
  if (/agua|energia|luz|gas|esgoto|saneament/.test(n)) return "tarifa";
  if (/obra|reforma|pintura|construc|benfeitor/.test(n)) return "incc";
  if (/limpeza|conservac|seguranc|portaria|jardin/.test(n)) return "cct";
  return "ipca";
}

export type Orcamento = {
  id: string;
  ano: number;
  ano_base: number;
  status: OrcamentoStatus;
  inadimplencia_prevista: number;
  fundo_reserva_percentual: number;
  premissas: string | null;
  assembleia_id: string | null;
  aprovado_em: string | null;
  aplicado_em: string | null;
};

export type OrcamentoItem = {
  id: string;
  categoria_id: string;
  categoria: string;
  realizado_base: number;
  indice: IndiceReajuste;
  percentual: number;
  valor_previsto: number;
  observacao: string | null;
  ordem: number;
};

export type ResumoOrcamento = {
  ano: number;
  ano_base: number;
  status: OrcamentoStatus;
  despesa_prevista: number;
  fundo_reserva: number;
  fundo_reserva_percentual: number;
  necessidade: number;
  inadimplencia_prevista: number;
  provisao_inadimplencia: number;
  a_arrecadar: number;
  arrecadacao_mensal: number;
  realizado_base: number;
  taxa_mensal_actual: number;
  variacao_percentual: number | null;
};

export type QuotaUnidade = {
  unidade_id: string;
  bloco: string | null;
  numero: string;
  fracao_ideal: number | null;
  taxa_actual: number | null;
  quota_mensal: number;
};

export type RubricaComparada = {
  categoria_id: string;
  nome: string;
  previsto_ano: number;
  previsto_ate_mes: number;
  realizado: number;
  desvio: number;
};

export type OrcadoRealizado = {
  ano: number;
  ate_mes: number;
  previsto_ano: number;
  previsto_ate_mes: number;
  realizado: number;
  desvio: number;
  rubricas: RubricaComparada[];
};

export type RealizadoAno = {
  ano: number;
  total: number;
  sem_categoria: number;
  categorias: { categoria_id: string; nome: string; valor: number }[];
};

const uuid = z.string().uuid();

export const listarOrcamentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ condominio_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("orcamentos")
      .select(
        "id, ano, ano_base, status, inadimplencia_prevista, fundo_reserva_percentual, premissas, assembleia_id, aprovado_em, aplicado_em",
      )
      .eq("condominio_id", data.condominio_id)
      .order("ano", { ascending: false });
    if (error) throwSafe(error);

    return (rows ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      ano: Number(r.ano),
      ano_base: Number(r.ano_base),
      status: r.status as OrcamentoStatus,
      inadimplencia_prevista: Number(r.inadimplencia_prevista),
      fundo_reserva_percentual: Number(r.fundo_reserva_percentual),
      premissas: (r.premissas as string) ?? null,
      assembleia_id: (r.assembleia_id as string) ?? null,
      aprovado_em: (r.aprovado_em as string) ?? null,
      aplicado_em: (r.aplicado_em as string) ?? null,
    })) satisfies Orcamento[];
  });

/** O realizado de um ano, para a pré-visualização antes de criar o orçamento. */
export const realizadoPorCategoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ condominio_id: uuid, ano: z.number().int().min(2000).max(2100) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("realizado_por_categoria", {
      _condominio_id: data.condominio_id,
      _ano: data.ano,
    });
    if (error) throwSafe(error);
    return r as unknown as RealizadoAno;
  });

export const criarOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        condominio_id: uuid,
        ano: z.number().int().min(2000).max(2100),
        ano_base: z.number().int().min(2000).max(2100),
        inadimplencia: z.number().min(0).max(99).default(0),
        fundo_reserva: z.number().min(0).max(100).default(0),
        premissas: z.string().trim().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("criar_orcamento", {
      _condominio_id: data.condominio_id,
      _ano: data.ano,
      _ano_base: data.ano_base,
      _inadimplencia: data.inadimplencia,
      _fundo_reserva: data.fundo_reserva,
      _premissas: data.premissas ?? undefined,
    });
    if (error) throwSafe(error);
    return { id: String(id) };
  });

export const rubricasDoOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orcamento_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("orcamento_itens")
      .select(
        "id, categoria_id, realizado_base, indice, percentual, valor_previsto, observacao, ordem, categorias_financeiras!inner(nome)",
      )
      .eq("orcamento_id", data.orcamento_id)
      .order("ordem");
    if (error) throwSafe(error);

    return (rows ?? []).map((r: Record<string, unknown>) => {
      const c = r.categorias_financeiras as { nome: string } | null;
      return {
        id: String(r.id),
        categoria_id: String(r.categoria_id),
        categoria: c?.nome ?? "—",
        realizado_base: Number(r.realizado_base),
        indice: r.indice as IndiceReajuste,
        percentual: Number(r.percentual),
        valor_previsto: Number(r.valor_previsto),
        observacao: (r.observacao as string) ?? null,
        ordem: Number(r.ordem),
      } satisfies OrcamentoItem;
    });
  });

export const resumoOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orcamento_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("resumo_orcamento", {
      _orcamento_id: data.orcamento_id,
    });
    if (error) throwSafe(error);
    return r as unknown as ResumoOrcamento;
  });

export const quotasDoOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orcamento_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("quotas_do_orcamento", {
      _orcamento_id: data.orcamento_id,
    });
    if (error) throwSafe(error);

    return ((rows ?? []) as Record<string, unknown>[]).map((r) => ({
      unidade_id: String(r.unidade_id),
      bloco: (r.bloco as string) ?? null,
      numero: String(r.numero),
      fracao_ideal: r.fracao_ideal == null ? null : Number(r.fracao_ideal),
      taxa_actual: r.taxa_actual == null ? null : Number(r.taxa_actual),
      quota_mensal: Number(r.quota_mensal),
    })) satisfies QuotaUnidade[];
  });

export const atualizarOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orcamento_id: uuid,
        inadimplencia: z.number().min(0).max(99).optional().nullable(),
        fundo_reserva: z.number().min(0).max(100).optional().nullable(),
        premissas: z.string().trim().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("atualizar_orcamento", {
      _orcamento_id: data.orcamento_id,
      _inadimplencia: data.inadimplencia ?? undefined,
      _fundo_reserva: data.fundo_reserva ?? undefined,
      _premissas: data.premissas ?? undefined,
    });
    if (error) throwSafe(error);
    return { ok: true };
  });

export const atualizarRubrica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        item_id: uuid,
        indice: z.enum(["ipca", "inpc", "igpm", "incc", "cct", "tarifa", "manual", "nenhum"]),
        percentual: z.number().gt(-100).max(1000),
        valor_previsto: z.number().min(0).optional().nullable(),
        observacao: z.string().trim().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: valor, error } = await context.supabase.rpc("atualizar_item_orcamento", {
      _item_id: data.item_id,
      _indice: data.indice,
      _percentual: data.percentual,
      _valor_previsto: data.valor_previsto ?? undefined,
      _observacao: data.observacao ?? undefined,
    });
    if (error) throwSafe(error);
    return { valor_previsto: Number(valor) };
  });

export const aprovarOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orcamento_id: uuid, assembleia_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("aprovar_orcamento", {
      _orcamento_id: data.orcamento_id,
      _assembleia_id: data.assembleia_id,
    });
    if (error) throwSafe(error);
    return { ok: true };
  });

export const orcadoXRealizado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orcamento_id: uuid,
        ate_mes: z.number().int().min(0).max(12).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("orcado_x_realizado", {
      _orcamento_id: data.orcamento_id,
      _ate_mes: data.ate_mes ?? undefined,
    });
    if (error) throwSafe(error);
    return r as unknown as OrcadoRealizado;
  });

/**
 * Do orçamento aprovado para as cobranças do ano.
 *
 * Escreve a quota em cada unidade e gera os doze lotes. Separado da aprovação
 * de propósito: a assembleia aprova em Novembro e a cobrança começa em
 * Janeiro, e entre as duas coisas há actas a lavrar.
 */
export const aplicarOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orcamento_id: uuid,
        categoria_id: uuid,
        dia_vencimento: z.number().int().min(1).max(31).default(10),
        ate_mes: z.number().int().min(1).max(12).default(12),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("aplicar_orcamento", {
      _orcamento_id: data.orcamento_id,
      _categoria_id: data.categoria_id,
      _dia_vencimento: data.dia_vencimento,
      _ate_mes: data.ate_mes,
    });
    if (error) throwSafe(error);
    return r as unknown as {
      ano: number;
      unidades_actualizadas: number;
      cobrancas_geradas: number;
      meses: number;
      dia_vencimento: number;
    };
  });
