/**
 * Plano de contas, anexos de comprovação e prestação de contas por conta.
 *
 * A conta contábil é a categoria financeira, com código e hierarquia — não há
 * uma segunda árvore. O porquê está no cabeçalho da migração
 * `20261105230000_plano_de_contas.sql`.
 *
 * O upload do ficheiro não passa por aqui: vai do browser direito para o
 * Storage, como já faz a página dos documentos. O que estas funções fazem é
 * registar o que o ficheiro é — número da nota, data, valor — para o anexo
 * valer como prova sem ter de ser aberto.
 */
import { throwSafe } from "@/lib/safe-error";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AnexoTipo, EntidadeAnexo } from "@/lib/anexo";

export {
  BUCKET_COMPROVANTES,
  ROTULO_ANEXO,
  TIPOS_FISCAIS,
  TIPOS_COMPROVANTE,
  caminhoDoAnexo,
  extensaoSegura,
} from "@/lib/anexo";
export type { AnexoTipo, EntidadeAnexo };

export type TipoLancamento = "receita" | "despesa";

export type ContaDoPlano = {
  id: string;
  codigo: string | null;
  nome: string;
  tipo: TipoLancamento;
  sintetica: boolean;
  fundo_reserva: boolean;
  cor: string | null;
  ativo: boolean;
  conta_pai_id: string | null;
  nivel: number;
  em_uso: boolean;
};

export type Anexo = {
  id: string;
  tipo: AnexoTipo;
  storage_path: string;
  nome_arquivo: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  documento_numero: string | null;
  documento_data: string | null;
  valor: number | null;
  observacao: string | null;
  created_at: string;
};

export type LinhaPrestacao = {
  conta_id: string;
  codigo: string | null;
  nome: string;
  tipo: TipoLancamento;
  nivel: number;
  sintetica: boolean;
  valor: number;
  lancamentos: number;
  documentados: number;
};

export type Pendencia = {
  despesa_id: string;
  data: string;
  fornecedor: string | null;
  descricao: string;
  valor: number;
  conta_codigo: string | null;
  conta_nome: string | null;
  tem_fiscal: boolean;
  tem_comprovante: boolean;
};

const Entidade = z.enum(["despesa", "pagamento", "cobranca", "infracao"]);
const Tipo = z.enum([
  "nota_fiscal",
  "recibo",
  "comprovante_pagamento",
  "boleto",
  "contrato",
  "extrato_bancario",
  "outro",
]);

const Periodo = z.object({
  condominio_id: z.string().uuid(),
  inicio: z.string().min(10),
  fim: z.string().min(10),
});

// ===== Plano de contas =====

export const planoDeContas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        condominio_id: z.string().uuid(),
        incluir_inativas: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("plano_de_contas", {
      _condominio_id: data.condominio_id,
      _incluir_inativas: data.incluir_inativas ?? false,
    });
    if (error) throwSafe(error);
    return (r ?? []) as unknown as ContaDoPlano[];
  });

export const semearPlanoDeContas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ condominio_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("semear_plano_contas", {
      _condominio_id: data.condominio_id,
    });
    if (error) throwSafe(error);
    return r as unknown as { criadas: number; adotadas: number; com_sufixo: number };
  });

export const criarConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        condominio_id: z.string().uuid(),
        nome: z.string().min(1).max(120),
        tipo: z.enum(["receita", "despesa"]),
        codigo: z.string().max(20).optional(),
        conta_pai_id: z.string().uuid().optional(),
        sintetica: z.boolean().optional(),
        fundo_reserva: z.boolean().optional(),
        cor: z.string().max(9).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("criar_conta", {
      _condominio_id: data.condominio_id,
      _nome: data.nome,
      _tipo: data.tipo,
      _codigo: data.codigo ?? undefined,
      _conta_pai_id: data.conta_pai_id ?? undefined,
      _sintetica: data.sintetica ?? false,
      _fundo_reserva: data.fundo_reserva ?? false,
      _cor: data.cor ?? "#64748B",
    });
    if (error) throwSafe(error);
    return r as unknown as string;
  });

export const atualizarConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        categoria_id: z.string().uuid(),
        nome: z.string().min(1).max(120).optional(),
        codigo: z.string().max(20).optional(),
        conta_pai_id: z.string().uuid().optional(),
        sintetica: z.boolean().optional(),
        fundo_reserva: z.boolean().optional(),
        cor: z.string().max(9).optional(),
        ativo: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("atualizar_conta", {
      _categoria_id: data.categoria_id,
      _nome: data.nome ?? undefined,
      _codigo: data.codigo ?? undefined,
      _conta_pai_id: data.conta_pai_id ?? undefined,
      _sintetica: data.sintetica ?? undefined,
      _fundo_reserva: data.fundo_reserva ?? undefined,
      _cor: data.cor ?? undefined,
      _ativo: data.ativo ?? undefined,
    });
    if (error) throwSafe(error);
    return { ok: true };
  });

export const desativarConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ categoria_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("desativar_conta", {
      _categoria_id: data.categoria_id,
    });
    if (error) throwSafe(error);
    return { ok: true };
  });

// ===== Anexos =====

export const registrarAnexo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        condominio_id: z.string().uuid(),
        entidade: Entidade,
        entidade_id: z.string().uuid(),
        tipo: Tipo,
        storage_path: z.string().min(1).max(500),
        nome_arquivo: z.string().min(1).max(260),
        mime_type: z.string().max(120).optional(),
        tamanho_bytes: z.number().int().positive().optional(),
        documento_numero: z.string().max(60).optional(),
        documento_data: z.string().min(10).optional(),
        valor: z.number().nonnegative().optional(),
        observacao: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("registrar_anexo", {
      _condominio_id: data.condominio_id,
      _entidade: data.entidade,
      _entidade_id: data.entidade_id,
      _tipo: data.tipo,
      _storage_path: data.storage_path,
      _nome_arquivo: data.nome_arquivo,
      _mime_type: data.mime_type ?? undefined,
      _tamanho_bytes: data.tamanho_bytes ?? undefined,
      _documento_numero: data.documento_numero ?? undefined,
      _documento_data: data.documento_data ?? undefined,
      _valor: data.valor ?? undefined,
      _observacao: data.observacao ?? undefined,
    });
    if (error) throwSafe(error);
    return r as unknown as string;
  });

/**
 * Devolve o caminho no Storage para quem chama apagar o ficheiro. A linha vai
 * primeiro: um ficheiro órfão no bucket é menos mau do que um registo a
 * apontar para um ficheiro que já não existe.
 */
export const removerAnexo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ anexo_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("remover_anexo", {
      _anexo_id: data.anexo_id,
    });
    if (error) throwSafe(error);
    return { storage_path: r as unknown as string };
  });

/**
 * Quantos documentos tem cada lançamento de uma lista, numa chamada só.
 *
 * Sem isto, a coluna de anexos de uma tabela de cinquenta despesas fazia
 * cinquenta chamadas. Vai directo à tabela: a RLS é que decide o que se vê, e
 * um `listar_anexos` por linha não acrescentava segurança nenhuma.
 */
export const resumoAnexos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        condominio_id: z.string().uuid(),
        entidade: Entidade,
        entidade_ids: z.array(z.string().uuid()).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.entidade_ids.length === 0) return {} as Record<string, number>;
    const { data: r, error } = await context.supabase
      .from("anexos")
      .select("entidade_id")
      .eq("condominio_id", data.condominio_id)
      .eq("entidade", data.entidade)
      .in("entidade_id", data.entidade_ids);
    if (error) throwSafe(error);
    const contas: Record<string, number> = {};
    for (const linha of r ?? []) {
      contas[linha.entidade_id] = (contas[linha.entidade_id] ?? 0) + 1;
    }
    return contas;
  });

export const listarAnexos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        condominio_id: z.string().uuid(),
        entidade: Entidade,
        entidade_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("listar_anexos", {
      _condominio_id: data.condominio_id,
      _entidade: data.entidade,
      _entidade_id: data.entidade_id,
    });
    if (error) throwSafe(error);
    return (r ?? []) as unknown as Anexo[];
  });

// ===== Relatórios =====

export const prestacaoPorConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Periodo.parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("prestacao_por_conta", {
      _condominio_id: data.condominio_id,
      _inicio: data.inicio,
      _fim: data.fim,
    });
    if (error) throwSafe(error);
    return (r ?? []) as unknown as LinhaPrestacao[];
  });

export const pendenciasDocumentais = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Periodo.parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("pendencias_documentais", {
      _condominio_id: data.condominio_id,
      _inicio: data.inicio,
      _fim: data.fim,
    });
    if (error) throwSafe(error);
    return (r ?? []) as unknown as Pendencia[];
  });
