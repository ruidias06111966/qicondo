/**
 * Gestão de unidades.
 *
 * As unidades eram criadas em bloco no onboarding e nunca mais tocadas: não
 * havia onde corrigir um número, atribuir um bloco, mudar a taxa mensal nem —
 * sobretudo — preencher a fração ideal, que o rateio de taxas extras exige.
 */
import { throwSafe } from "@/lib/safe-error";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * `unidades.fracao_ideal` é NUMERIC(8,6): seis casas decimais e oito dígitos no
 * total. Cabem tanto frações decimais (0,023456) como percentagens (2,3456),
 * que é como cada convenção as escreve — o rateio normaliza pela soma, por isso
 * as duas convenções funcionam desde que o condomínio use uma só.
 */
const FRACAO_MAX = 99.999999;

const UnidadeInput = z.object({
  condominio_id: z.string().uuid(),
  numero: z.string().trim().min(1, "Informe o número").max(20, "Máx. 20 caracteres"),
  bloco: z.string().trim().max(20, "Máx. 20 caracteres").optional().nullable(),
  fracao_ideal: z
    .number()
    .positive("Deve ser maior que zero")
    .max(FRACAO_MAX)
    .optional()
    .nullable(),
  taxa_mensal: z.number().min(0, "Não pode ser negativa").optional().nullable(),
  observacoes: z.string().trim().max(500).optional().nullable(),
});

export const listarUnidades = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ condominio_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("unidades")
      .select("id, bloco, numero, fracao_ideal, taxa_mensal, observacoes")
      .eq("condominio_id", data.condominio_id)
      .order("bloco", { ascending: true, nullsFirst: true })
      .order("numero", { ascending: true });
    if (error) throwSafe(error);
    return rows ?? [];
  });

export const criarUnidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UnidadeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("unidades")
      .insert({
        condominio_id: data.condominio_id,
        numero: data.numero,
        bloco: data.bloco || null,
        fracao_ideal: data.fracao_ideal ?? null,
        taxa_mensal: data.taxa_mensal ?? null,
        observacoes: data.observacoes || null,
      })
      .select()
      .single();
    if (error) throwSafe(error);
    return row;
  });

export const atualizarUnidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UnidadeInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, condominio_id, ...campos } = data;
    const { data: row, error } = await context.supabase
      .from("unidades")
      .update({
        numero: campos.numero,
        bloco: campos.bloco || null,
        fracao_ideal: campos.fracao_ideal ?? null,
        taxa_mensal: campos.taxa_mensal ?? null,
        observacoes: campos.observacoes || null,
      })
      .eq("id", id)
      .eq("condominio_id", condominio_id)
      .select()
      .single();
    if (error) throwSafe(error);
    return row;
  });

export const removerUnidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("unidades").delete().eq("id", data.id);
    if (error) throwSafe(error);
    return { ok: true };
  });

/**
 * Distribui a fração igualmente por todas as unidades.
 *
 * Não substitui a convenção — a fração real vem de lá e varia com a área. Serve
 * para o condomínio em que todas as unidades são iguais, e para dar um ponto de
 * partida a quem vai depois corrigir unidade a unidade. Sem isto, um prédio de
 * 120 apartamentos obriga a 120 edições antes de a primeira taxa extra sair.
 */
export const distribuirFracaoIgualmente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ condominio_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: unidades, error: erroLista } = await supabase
      .from("unidades")
      .select("id")
      .eq("condominio_id", data.condominio_id);
    if (erroLista) throwSafe(erroLista);
    if (!unidades?.length) throw new Error("O condomínio ainda não tem unidades");

    // Seis casas decimais é o que a coluna guarda. A soma pode não dar
    // exactamente 1 — e não faz mal: o rateio divide pela soma das frações,
    // não assume que valha 1.
    const fracao = Number((1 / unidades.length).toFixed(6));

    const { error } = await supabase
      .from("unidades")
      .update({ fracao_ideal: fracao })
      .eq("condominio_id", data.condominio_id);
    if (error) throwSafe(error);

    return { unidades: unidades.length, fracao };
  });

/**
 * Mostra o rateio antes de o gravar.
 *
 * Gerar cobranças é irreversível na prática — depois é apagar uma a uma. Ver a
 * lista antes é o que separa "confio no sistema" de "sei o que vai acontecer".
 */
export const previsualizarRateio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        condominio_id: z.string().uuid(),
        total: z.number().positive("Informe um valor maior que zero"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: quotas, error } = await supabase.rpc("ratear_por_fracao_ideal", {
      _condominio_id: data.condominio_id,
      _total: data.total,
    });
    if (error) throwSafe(error);

    const { data: unidades, error: erroUnidades } = await supabase
      .from("unidades")
      .select("id, bloco, numero, fracao_ideal")
      .eq("condominio_id", data.condominio_id);
    if (erroUnidades) throwSafe(erroUnidades);

    const porId = new Map((unidades ?? []).map((u) => [u.id, u]));
    const linhas = (quotas ?? [])
      .map((q: { unidade_id: string; valor: number }) => {
        const u = porId.get(q.unidade_id);
        return {
          unidade_id: q.unidade_id,
          bloco: u?.bloco ?? null,
          numero: u?.numero ?? "?",
          fracao_ideal: Number(u?.fracao_ideal ?? 0),
          valor: Number(q.valor),
        };
      })
      .sort(
        (a, b) =>
          (a.bloco ?? "").localeCompare(b.bloco ?? "") ||
          a.numero.localeCompare(b.numero, "pt-BR", { numeric: true }),
      );

    return {
      linhas,
      soma: linhas.reduce((acc, l) => acc + l.valor, 0),
    };
  });
