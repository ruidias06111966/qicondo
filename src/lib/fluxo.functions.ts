/**
 * Fluxo de caixa e concentração de pagamentos.
 *
 * O balancete responde "quanto entrou e saiu no período". Não responde
 * "quando" — e é o quando que decide se há dinheiro no dia 10 para pagar o que
 * vence no dia 10.
 *
 * O saldo corrido vem somado do banco e não é recalculado aqui: quem vê o
 * ecrã e quem imprime a folha têm de ver o mesmo número.
 */
import { throwSafe } from "@/lib/safe-error";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DiaDeFluxo = {
  data: string;
  entradas: number;
  saidas: number;
  saldo: number;
};

export type FluxoDeCaixa = {
  inicio: string;
  fim: string;
  saldo_abertura: number;
  entradas: number;
  saidas: number;
  resultado: number;
  saldo_final: number;
  saldo_minimo: number;
  saldo_minimo_em: string | null;
  dias: DiaDeFluxo[];
};

export type DiaDoMes = {
  dia: number;
  despesas: number;
  quantidade: number;
  recebimentos: number;
  percentagem: number;
};

export type DiaDaSemana = { dia: number; despesas: number; quantidade: number };

export type Concentracao = {
  inicio: string;
  fim: string;
  total_despesas: number;
  por_dia_do_mes: DiaDoMes[];
  por_dia_da_semana: DiaDaSemana[];
};

export const NOME_DIA_SEMANA = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

const Periodo = z.object({
  condominio_id: z.string().uuid(),
  inicio: z.string().min(10),
  fim: z.string().min(10),
});

export const fluxoDeCaixa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Periodo.parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("fluxo_de_caixa", {
      _condominio_id: data.condominio_id,
      _inicio: data.inicio,
      _fim: data.fim,
    });
    if (error) throwSafe(error);
    return r as unknown as FluxoDeCaixa;
  });

export const concentracaoPagamentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Periodo.parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("concentracao_pagamentos", {
      _condominio_id: data.condominio_id,
      _inicio: data.inicio,
      _fim: data.fim,
    });
    if (error) throwSafe(error);
    return r as unknown as Concentracao;
  });
