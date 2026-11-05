/**
 * Advertências e multas por infração.
 *
 * Os tectos legais vivem no banco, em `aplicar_multa`, e não aqui. O que esta
 * camada tem é o mesmo cálculo repetido *para mostrar* — o ecrã avisa que
 * 2.400 passa do limite antes de o síndico gravar, em vez de o deixar
 * preencher tudo e apanhar um erro. Se as duas contas divergirem, a que vale é
 * a do banco: é ela que recusa.
 */
import { throwSafe } from "@/lib/safe-error";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InfracaoTipo = "advertencia" | "multa";
export type InfracaoStatus = "vigente" | "cancelada";

/** O fundamento da multa, que é o que determina o tecto. */
export type InfracaoBase = "convencao" | "art_1336_p2" | "art_1337_caput" | "art_1337_unico";

export const ROTULO_BASE: Record<InfracaoBase, string> = {
  convencao: "Valor previsto na convenção",
  art_1336_p2: "Art. 1.336, §2º — convenção omissa",
  art_1337_caput: "Art. 1.337, caput — descumprimento reiterado",
  art_1337_unico: "Art. 1.337, § único — comportamento antissocial",
};

/** O múltiplo da contribuição mensal que cada fundamento admite. */
export const TECTO_BASE: Record<InfracaoBase, number | null> = {
  convencao: null, // o tecto é o que a convenção fixar
  art_1336_p2: 5,
  art_1337_caput: 5,
  art_1337_unico: 10,
};

/** O quórum que cada fundamento exige, para o ecrã lembrar quem delibera. */
export const QUORUM_BASE: Record<InfracaoBase, string | null> = {
  convencao: null,
  art_1336_p2: "dois terços dos condóminos restantes",
  art_1337_caput: "três quartos dos condóminos restantes",
  art_1337_unico: "três quartos dos condóminos restantes",
};

export type Infracao = {
  id: string;
  numero: number;
  unidade_id: string;
  tipo: InfracaoTipo;
  data_ocorrencia: string;
  descricao: string;
  local: string | null;
  base_legal: InfracaoBase | null;
  valor: number | null;
  referencia_mensal: number | null;
  deliberacao: string | null;
  assembleia_id: string | null;
  cobranca_id: string | null;
  status: InfracaoStatus;
  cancelada_em: string | null;
  cancelamento_motivo: string | null;
  unidade: { bloco: string | null; numero: string } | null;
};

export type Reincidencia = {
  advertencias: number;
  multas: number;
  total: number;
  primeira: string | null;
  ultima: string | null;
  valor_multas: number;
};

export const listarInfracoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ condominio_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("infracoes")
      // Numa só linha: a inferência de tipos do cliente Supabase só funciona
      // sobre um literal.
      .select(
        "id, numero, unidade_id, tipo, data_ocorrencia, descricao, local, base_legal, valor, referencia_mensal, deliberacao, assembleia_id, cobranca_id, status, cancelada_em, cancelamento_motivo, unidades!inner(bloco, numero)",
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
        tipo: r.tipo as InfracaoTipo,
        data_ocorrencia: String(r.data_ocorrencia),
        descricao: String(r.descricao),
        local: (r.local as string) ?? null,
        base_legal: (r.base_legal as InfracaoBase) ?? null,
        valor: r.valor == null ? null : Number(r.valor),
        referencia_mensal: r.referencia_mensal == null ? null : Number(r.referencia_mensal),
        deliberacao: (r.deliberacao as string) ?? null,
        assembleia_id: (r.assembleia_id as string) ?? null,
        cobranca_id: (r.cobranca_id as string) ?? null,
        status: r.status as InfracaoStatus,
        cancelada_em: (r.cancelada_em as string) ?? null,
        cancelamento_motivo: (r.cancelamento_motivo as string) ?? null,
        unidade: u ? { bloco: u.bloco, numero: u.numero } : null,
      } satisfies Infracao;
    });
  });

/**
 * O histórico vigente de uma unidade. É o que sustenta "reiteradamente" do
 * art. 1.337 — e o que o condómino precisa de poder contestar.
 */
export const reincidenciaDaUnidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ unidade_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("reincidencia_da_unidade", {
      _unidade_id: data.unidade_id,
    });
    if (error) throwSafe(error);
    return r as unknown as Reincidencia;
  });

export const registrarAdvertencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        condominio_id: z.string().uuid(),
        unidade_id: z.string().uuid(),
        data_ocorrencia: z.string().min(1, "Informe a data da ocorrência"),
        descricao: z.string().trim().min(10, "Descreva a ocorrência em pelo menos 10 caracteres"),
        local: z.string().trim().max(200).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("registrar_advertencia", {
      _condominio_id: data.condominio_id,
      _unidade_id: data.unidade_id,
      _data_ocorrencia: data.data_ocorrencia,
      _descricao: data.descricao,
      _local: data.local ?? undefined,
    });
    if (error) throwSafe(error);
    return { id: String(id) };
  });

export const aplicarMulta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        condominio_id: z.string().uuid(),
        unidade_id: z.string().uuid(),
        data_ocorrencia: z.string().min(1, "Informe a data da ocorrência"),
        descricao: z.string().trim().min(10, "Descreva a ocorrência em pelo menos 10 caracteres"),
        base_legal: z.enum(["convencao", "art_1336_p2", "art_1337_caput", "art_1337_unico"]),
        valor: z.number().positive("O valor da multa tem de ser positivo"),
        vencimento: z.string().min(1, "Informe o vencimento"),
        local: z.string().trim().max(200).optional().nullable(),
        categoria_id: z.string().uuid().optional().nullable(),
        deliberacao: z.string().trim().max(1000).optional().nullable(),
        assembleia_id: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("aplicar_multa", {
      _condominio_id: data.condominio_id,
      _unidade_id: data.unidade_id,
      _data_ocorrencia: data.data_ocorrencia,
      _descricao: data.descricao,
      _base_legal: data.base_legal,
      _valor: data.valor,
      _vencimento: data.vencimento,
      _local: data.local ?? undefined,
      _categoria_id: data.categoria_id ?? undefined,
      _deliberacao: data.deliberacao ?? undefined,
      _assembleia_id: data.assembleia_id ?? undefined,
    });
    if (error) throwSafe(error);
    return { id: String(id) };
  });

export const cancelarInfracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        infracao_id: z.string().uuid(),
        motivo: z.string().trim().min(5, "Diga por que a infração foi cancelada"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("cancelar_infracao", {
      _infracao_id: data.infracao_id,
      _motivo: data.motivo,
    });
    if (error) throwSafe(error);
    return { ok: true };
  });
