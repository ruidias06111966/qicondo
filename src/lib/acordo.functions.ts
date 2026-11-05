/**
 * Acordos de parcelamento de dívida.
 *
 * Toda a aritmética vive no banco, em `_acordo_calcular`. Aqui não se soma
 * nada: a simulação que o ecrã mostra e o acordo que fica gravado vêm da
 * mesma função, e é a simulação que o condómino vê que o vincula. Replicar a
 * conta em TypeScript criaria duas respostas possíveis para a mesma dívida.
 */
import { throwSafe } from "@/lib/safe-error";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AcordoStatus = "ativo" | "quitado" | "rescindido" | "cancelado";

export const ROTULO_STATUS_ACORDO: Record<AcordoStatus, string> = {
  ativo: "Em cumprimento",
  quitado: "Quitado",
  rescindido: "Rescindido",
  cancelado: "Cancelado",
};

export type Acordo = {
  id: string;
  numero: number;
  unidade_id: string;
  data_acordo: string;
  valor_principal: number;
  valor_multa: number;
  valor_juros: number;
  valor_desconto: number;
  valor_entrada: number;
  valor_total: number;
  num_parcelas: number;
  status: AcordoStatus;
  autorizacao: string | null;
  observacoes: string | null;
  rescisao_motivo: string | null;
  unidade: { bloco: string | null; numero: string } | null;
};

/** Uma parcela do acordo, que é uma cobrança como qualquer outra. */
export type ParcelaAcordo = {
  id: string;
  parcela_num: number;
  vencimento: string;
  valor: number;
  valor_pago: number;
  multa: number;
  juros: number;
  status: string;
  descricao: string | null;
};

export type SimulacaoAcordo = {
  data_acordo: string;
  principal: number;
  multa: number;
  juros: number;
  desconto: number;
  total: number;
  entrada: number;
  a_parcelar: number;
  num_parcelas: number;
  itens: {
    cobranca_id: string;
    descricao: string | null;
    vencimento: string;
    principal: number;
    multa: number;
    juros: number;
  }[];
  parcelas: { numero: number; vencimento: string; valor: number }[];
};

const EntradaSimulacao = z.object({
  condominio_id: z.string().uuid(),
  unidade_id: z.string().uuid(),
  cobranca_ids: z.array(z.string().uuid()).min(1, "Escolha ao menos uma cobrança"),
  desconto: z.number().min(0).default(0),
  entrada: z.number().min(0).default(0),
  num_parcelas: z.number().int().min(1).max(60),
  primeiro_vencimento: z.string().min(1, "Informe o primeiro vencimento"),
});

/** As cobranças em aberto de uma unidade, que são as candidatas a consolidar. */
export const cobrancasParaAcordo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ condominio_id: z.string().uuid(), unidade_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("cobrancas")
      .select("id, descricao, competencia, vencimento, valor, valor_pago, desconto, status")
      .eq("condominio_id", data.condominio_id)
      .eq("unidade_id", data.unidade_id)
      .in("status", ["pendente", "vencida", "parcial"])
      .order("vencimento");
    if (error) throwSafe(error);

    return (rows ?? []).map((r) => ({
      id: String(r.id),
      descricao: r.descricao,
      competencia: String(r.competencia),
      vencimento: String(r.vencimento),
      valor: Number(r.valor),
      valor_pago: Number(r.valor_pago),
      desconto: Number(r.desconto),
      status: String(r.status),
    }));
  });

export const simularAcordo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EntradaSimulacao.parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("simular_acordo", {
      _condominio_id: data.condominio_id,
      _unidade_id: data.unidade_id,
      _cobranca_ids: data.cobranca_ids,
      _desconto: data.desconto,
      _entrada: data.entrada,
      _num_parcelas: data.num_parcelas,
      _primeiro_vencimento: data.primeiro_vencimento,
    });
    if (error) throwSafe(error);
    return r as unknown as SimulacaoAcordo;
  });

export const criarAcordo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    EntradaSimulacao.extend({
      categoria_id: z.string().uuid().optional().nullable(),
      autorizacao: z.string().trim().max(300).optional().nullable(),
      observacoes: z.string().trim().max(1000).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("criar_acordo", {
      _condominio_id: data.condominio_id,
      _unidade_id: data.unidade_id,
      _cobranca_ids: data.cobranca_ids,
      _desconto: data.desconto,
      _entrada: data.entrada,
      _num_parcelas: data.num_parcelas,
      _primeiro_vencimento: data.primeiro_vencimento,
      _categoria_id: data.categoria_id ?? undefined,
      _autorizacao: data.autorizacao ?? undefined,
      _observacoes: data.observacoes ?? undefined,
    });
    if (error) throwSafe(error);
    return { id: String(id) };
  });

export const listarAcordos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ condominio_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("acordos")
      // Numa só linha de propósito: a inferência de tipos do cliente Supabase
      // só funciona sobre um literal, e com concatenação perde-se.
      .select(
        "id, numero, unidade_id, data_acordo, valor_principal, valor_multa, valor_juros, valor_desconto, valor_entrada, valor_total, num_parcelas, status, autorizacao, observacoes, rescisao_motivo, unidades!inner(bloco, numero)",
      )
      .eq("condominio_id", data.condominio_id)
      .order("numero", { ascending: false });
    if (error) throwSafe(error);

    return (rows ?? []).map((r: Record<string, unknown>) => {
      const u = r.unidades as { bloco: string | null; numero: string } | null;
      return {
        id: String(r.id),
        numero: Number(r.numero),
        unidade_id: String(r.unidade_id),
        data_acordo: String(r.data_acordo),
        valor_principal: Number(r.valor_principal),
        valor_multa: Number(r.valor_multa),
        valor_juros: Number(r.valor_juros),
        valor_desconto: Number(r.valor_desconto),
        valor_entrada: Number(r.valor_entrada),
        valor_total: Number(r.valor_total),
        num_parcelas: Number(r.num_parcelas),
        status: r.status as AcordoStatus,
        autorizacao: (r.autorizacao as string) ?? null,
        observacoes: (r.observacoes as string) ?? null,
        rescisao_motivo: (r.rescisao_motivo as string) ?? null,
        unidade: u ? { bloco: u.bloco, numero: u.numero } : null,
      } satisfies Acordo;
    });
  });

/** As parcelas de um acordo, com o que já foi pago de cada uma. */
export const parcelasDoAcordo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ acordo_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("cobrancas")
      .select("id, parcela_num, vencimento, valor, valor_pago, multa, juros, status, descricao")
      .eq("acordo_id", data.acordo_id)
      .not("parcela_num", "is", null)
      .order("parcela_num");
    if (error) throwSafe(error);

    return (rows ?? []).map((r) => ({
      id: String(r.id),
      parcela_num: Number(r.parcela_num),
      vencimento: String(r.vencimento),
      valor: Number(r.valor),
      valor_pago: Number(r.valor_pago),
      multa: Number(r.multa),
      juros: Number(r.juros),
      status: String(r.status),
      descricao: r.descricao,
    })) satisfies ParcelaAcordo[];
  });

export const rescindirAcordo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        acordo_id: z.string().uuid(),
        motivo: z.string().trim().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("rescindir_acordo", {
      _acordo_id: data.acordo_id,
      _motivo: data.motivo ?? undefined,
    });
    if (error) throwSafe(error);
    return { ok: true };
  });
