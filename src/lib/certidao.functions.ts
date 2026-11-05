/**
 * Carta de cobrança e nada consta.
 *
 * Os dois documentos saem da mesma fonte — `divida_da_unidade` — e é de
 * propósito. A carta afirma que há dívida e quanto; a certidão afirma que não
 * há. Se cada uma calculasse por seu lado, era possível emitir hoje uma carta
 * de R$ 1.200 e um nada consta para a mesma unidade.
 *
 * O cálculo não vive aqui. A dívida tem multa e juros que dependem da
 * configuração do condomínio e dos dias de atraso à data de hoje; está no
 * banco, no mesmo motor que a inadimplência usa.
 */
import { throwSafe } from "@/lib/safe-error";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ItemDivida = {
  cobranca_id: string;
  descricao: string | null;
  competencia: string;
  vencimento: string;
  principal: number;
  multa: number;
  juros: number;
  dias_atraso: number;
  de_acordo: boolean;
  parcela_num: number | null;
};

export type AcordoAtivo = {
  acordo_id: string;
  numero: number;
  data_acordo: string;
  valor_total: number;
  num_parcelas: number;
  em_aberto: number;
};

export type Divida = {
  referencia: string;
  principal: number;
  multa: number;
  juros: number;
  total: number;
  itens: ItemDivida[];
  acordos_ativos: AcordoAtivo[];
};

export type CabecalhoCondominio = {
  nome: string;
  cnpj: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
};

export type CartaCobranca = {
  emitida_em: string;
  prazo_dias: number;
  vence_em: string;
  condominio: CabecalhoCondominio;
  unidade: { bloco: string | null; numero: string };
  proprietarios: string[];
  divida: Divida;
};

export type Certidao = {
  id: string;
  numero: number;
  codigo: string;
  unidade_id: string;
  emitida_em: string;
  valida_ate: string;
  dados: DadosCertidao;
  unidade: { bloco: string | null; numero: string } | null;
};

/** A fotografia gravada na emissão. Ver o comentário da coluna `dados`. */
export type DadosCertidao = {
  emitida_em: string;
  valida_ate: string;
  condominio: CabecalhoCondominio;
  unidade: { bloco: string | null; numero: string };
  proprietarios: string[];
  referencia: string;
};

export type Conferencia = {
  valida: boolean;
  motivo: string | null;
  codigo?: string;
  numero?: number;
  emitida_em?: string;
  valida_ate?: string;
  dados?: DadosCertidao;
};

/** A dívida de uma unidade à data de hoje, linha a linha. */
export const dividaDaUnidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ unidade_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("divida_da_unidade", {
      _unidade_id: data.unidade_id,
    });
    if (error) throwSafe(error);
    return r as unknown as Divida;
  });

/**
 * O conteúdo da carta. Recusa quando não há dívida — uma carta de cobrança de
 * zero é um erro que se manda por correio.
 */
export const cartaCobranca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        unidade_id: z.string().uuid(),
        prazo_dias: z.number().int().min(1).max(90).default(10),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("carta_cobranca", {
      _unidade_id: data.unidade_id,
      _prazo_dias: data.prazo_dias,
    });
    if (error) throwSafe(error);
    return r as unknown as CartaCobranca;
  });

export const emitirNadaConsta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        unidade_id: z.string().uuid(),
        validade_dias: z.number().int().min(1).max(180).default(30),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("emitir_nada_consta", {
      _unidade_id: data.unidade_id,
      _validade_dias: data.validade_dias,
    });
    if (error) throwSafe(error);
    return { id: String(id) };
  });

export const listarCertidoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ condominio_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("certidoes")
      .select(
        "id, numero, codigo, unidade_id, emitida_em, valida_ate, dados, unidades!inner(bloco, numero)",
      )
      .eq("condominio_id", data.condominio_id)
      .order("numero", { ascending: false });
    if (error) throwSafe(error);

    return (rows ?? []).map((r: Record<string, unknown>) => {
      const u = r.unidades as { bloco: string | null; numero: string } | null;
      return {
        id: String(r.id),
        numero: Number(r.numero),
        codigo: String(r.codigo),
        unidade_id: String(r.unidade_id),
        emitida_em: String(r.emitida_em),
        valida_ate: String(r.valida_ate),
        dados: r.dados as DadosCertidao,
        unidade: u ? { bloco: u.bloco, numero: u.numero } : null,
      } satisfies Certidao;
    });
  });

/**
 * Conferir pelo código. Só para quem já tem conta no condomínio — ver a nota
 * na migração sobre por que isto não está aberto ao anónimo.
 */
export const conferirCertidao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ codigo: z.string().trim().min(6, "Informe o código da certidão") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("conferir_certidao", {
      _codigo: data.codigo,
    });
    if (error) throwSafe(error);
    return r as unknown as Conferencia;
  });
