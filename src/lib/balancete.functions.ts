/**
 * Prestação de contas: o balancete.
 *
 * O sistema registava receitas e despesas e nunca as juntou num documento. E
 * `despesas` só é legível por quem gere o financeiro — um condómino nunca pôde
 * ver em que é que o dinheiro dele foi gasto.
 *
 * O balancete fecha as duas lacunas: é um documento por período, em regime de
 * caixa, que o síndico fecha e publica. Publicado, passa a ser legível por
 * qualquer membro do condomínio (política RLS "Membros veem balancetes
 * publicados"), sem que isso abra a tabela de despesas a ninguém.
 */
import { throwSafe } from "@/lib/safe-error";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Uma linha do desdobramento por categoria. */
export type CategoriaBalancete = {
  categoria: string;
  cor: string | null;
  valor: number;
  fundo_reserva?: boolean;
};

/** Um recebimento, tal como ficou gravado na fotografia. */
export type LancamentoReceita = {
  data: string;
  descricao: string;
  unidade: string | null;
  categoria: string;
  forma: string | null;
  valor: number;
};

/** Uma despesa, tal como ficou gravada na fotografia. */
export type LancamentoDespesa = {
  data: string;
  descricao: string;
  fornecedor: string | null;
  categoria: string;
  forma: string | null;
  anexo_url: string | null;
  valor: number;
};

/**
 * O documento. É o que `calcular_balancete` devolve e o que fica em
 * `balancetes.dados` — a mesma forma nos dois casos, de propósito: o que o
 * síndico vê antes de fechar é exactamente o que fica gravado.
 */
export type DadosBalancete = {
  periodo: { inicio: string; fim: string };
  saldo_anterior: number;
  saldo_inicial_considerado: number;
  receitas: {
    total: number;
    fundo_reserva: number;
    operacional: number;
    por_categoria: CategoriaBalancete[];
  };
  despesas: { total: number; por_categoria: CategoriaBalancete[] };
  saldo_final: number;
  inadimplencia: { total: number; cobrancas: number; unidades: number };
  lancamentos: { receitas: LancamentoReceita[]; despesas: LancamentoDespesa[] };
};

export type Balancete = {
  id: string;
  periodo_inicio: string;
  periodo_fim: string;
  status: "rascunho" | "publicado";
  saldo_anterior: number;
  total_receitas: number;
  total_despesas: number;
  saldo_final: number;
  inadimplencia: number;
  observacoes: string | null;
  fechado_em: string;
  publicado_em: string | null;
  dados: DadosBalancete;
};

const Periodo = z.object({
  condominio_id: z.string().uuid(),
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
});

/**
 * Pré-visualização. Calcula sem gravar, para o síndico ver antes de fechar.
 *
 * Restrita a quem gere o financeiro: devolve as despesas linha a linha, com
 * fornecedores e anexos. O condómino não passa por aqui — lê a fotografia já
 * publicada.
 */
export const calcularBalancete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Periodo.parse(d))
  .handler(async ({ data, context }) => {
    const { data: dados, error } = await context.supabase.rpc("calcular_balancete", {
      _condominio_id: data.condominio_id,
      _inicio: data.inicio,
      _fim: data.fim,
    });
    if (error) throwSafe(error);
    return dados as unknown as DadosBalancete;
  });

/**
 * Fecha o período: grava a fotografia como rascunho.
 *
 * Recusa se já existir um balancete publicado para o mesmo período — nesse caso
 * é preciso reabrir primeiro, e a reabertura fica no registo de auditoria.
 */
export const fecharBalancete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    Periodo.extend({ observacoes: z.string().trim().max(2000).optional().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("fechar_balancete", {
      _condominio_id: data.condominio_id,
      _inicio: data.inicio,
      _fim: data.fim,
      _observacoes: data.observacoes || null,
    });
    if (error) throwSafe(error);
    return { id: id as unknown as string };
  });

/** Publica: é a partir daqui que os condóminos veem. */
export const publicarBalancete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("publicar_balancete", {
      _balancete_id: data.id,
    });
    if (error) throwSafe(error);
    return { ok: true };
  });

/**
 * Reabre um balancete publicado, para corrigir.
 *
 * Sai da vista dos condóminos no momento em que é reaberto. O motivo vai para o
 * registo de auditoria: um documento que desaparece de quem já o leu tem de
 * deixar rasto.
 */
export const reabrirBalancete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        motivo: z.string().trim().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("reabrir_balancete", {
      _balancete_id: data.id,
      _motivo: data.motivo || null,
    });
    if (error) throwSafe(error);
    return { ok: true };
  });

/**
 * Lista os balancetes do condomínio.
 *
 * Não filtra por estado: a RLS é que decide. Quem gere o financeiro recebe os
 * rascunhos também; o condómino recebe só os publicados. Filtrar aqui seria
 * duplicar a regra num sítio onde ela não é a barreira real.
 */
export const listarBalancetes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ condominio_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("balancetes")
      .select(
        "id, periodo_inicio, periodo_fim, status, saldo_anterior, total_receitas, " +
          "total_despesas, saldo_final, inadimplencia, observacoes, fechado_em, publicado_em",
      )
      .eq("condominio_id", data.condominio_id)
      .order("periodo_inicio", { ascending: false });
    if (error) throwSafe(error);
    return (rows ?? []) as unknown as Omit<Balancete, "dados">[];
  });

/** Abre um balancete, com a fotografia completa. */
export const obterBalancete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("balancetes")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throwSafe(error);
    return row as unknown as Balancete;
  });
