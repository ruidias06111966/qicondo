/**
 * Assembleias virtuais.
 *
 * A Lei 14.309/2022 permitiu expressamente a assembleia por meio electrónico,
 * salvo se a convenção dispuser em contrário. Este módulo é isso: convocar,
 * pôr a ordem do dia a votos, apurar cada item pela maioria que a lei exige
 * para aquela matéria, e fechar com uma ata que registra tudo.
 *
 * Toda a escrita passa por funções `SECURITY DEFINER` na base — as tabelas têm
 * o privilégio de escrita revogado. Não é zelo: um UPDATE directo num voto ou
 * num resultado é fraude na deliberação, não um erro de dados.
 */
import { throwSafe } from "@/lib/safe-error";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

export type MaioriaTipo =
  | "maioria_presentes"
  | "maioria_condominos"
  | "dois_tercos_condominos"
  | "tres_quartos_condominos"
  | "unanimidade";

export type VotoOpcao = "sim" | "nao" | "abstencao";

export type AssembleiaStatus = "rascunho" | "convocada" | "em_curso" | "encerrada" | "cancelada";

/**
 * Cada matéria tem a sua maioria, e as bases são diferentes. "Dos presentes"
 * conta sobre quem apareceu; "dos condóminos" conta sobre o condomínio
 * inteiro, e quem não vota conta contra. Tratar os dois com o mesmo
 * denominador aprova deliberações que não foram aprovadas.
 */
export const MAIORIAS: { valor: MaioriaTipo; rotulo: string; nota: string }[] = [
  {
    valor: "maioria_presentes",
    rotulo: "Maioria dos presentes",
    nota: "Deliberações correntes (art. 1.352). Conta sobre os votos válidos de quem votou.",
  },
  {
    valor: "maioria_condominos",
    rotulo: "Maioria dos condóminos",
    nota: "Obras úteis (art. 1.341, II). Conta sobre todos os elegíveis — quem não vota conta contra.",
  },
  {
    valor: "dois_tercos_condominos",
    rotulo: "Dois terços dos condóminos",
    nota: "Alteração da convenção ou do regimento (art. 1.351) e obras voluptuárias (art. 1.341, I).",
  },
  {
    valor: "tres_quartos_condominos",
    rotulo: "Três quartos dos condóminos",
    nota: "Multa ao condómino de conduta reiterada ou antissocial (art. 1.337).",
  },
  {
    valor: "unanimidade",
    rotulo: "Unanimidade",
    nota: "Mudança da destinação do edifício ou da unidade (art. 1.351).",
  },
];

export type Resultado = {
  maioria: MaioriaTipo;
  base: string;
  peso_por_fracao: boolean;
  total_elegivel: number;
  unidades_elegiveis: number;
  presentes: number;
  votos_validos: number;
  sim: number;
  nao: number;
  abstencao: number;
  necessario: number;
  quorum_exigido: number;
  tem_quorum: boolean;
  aprovado: boolean;
  situacao: "sem_quorum" | "aprovado" | "rejeitado";
};

export type Pauta = {
  id: string;
  ordem: number;
  titulo: string;
  descricao: string | null;
  maioria: MaioriaTipo;
  aberta_em: string | null;
  fechada_em: string | null;
  resultado: Resultado | null;
};

export type Assembleia = {
  id: string;
  titulo: string;
  tipo: "ordinaria" | "extraordinaria";
  modo: "virtual" | "presencial" | "hibrida";
  status: AssembleiaStatus;
  edital: string | null;
  local: string | null;
  link_videoconferencia: string | null;
  inicio: string;
  fim: string;
  peso_por_fracao: boolean;
  exige_quitacao: boolean;
  quorum_instalacao: number;
  convocada_em: string | null;
  encerrada_em: string | null;
  ata: Json | null;
};

export type Elegibilidade = {
  unidade_id: string;
  bloco: string | null;
  numero: string;
  fracao_ideal: number | null;
  peso: number;
  elegivel: boolean;
  motivo: string | null;
  /** Se é este utilizador que exerce o voto da unidade. Numa unidade com um
   *  só dono coincide com ser proprietário; com vários, só o representante. */
  pode_votar: boolean;
  /** Quem representa a unidade, para a interface poder dizer a quem falar. */
  representante_nome: string | null;
};

const MAIORIA = z.enum([
  "maioria_presentes",
  "maioria_condominos",
  "dois_tercos_condominos",
  "tres_quartos_condominos",
  "unanimidade",
]);

export const listarAssembleias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ condominio_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("assembleias")
      .select(
        "id, titulo, tipo, modo, status, inicio, fim, convocada_em, encerrada_em, " +
          "peso_por_fracao, exige_quitacao, quorum_instalacao",
      )
      .eq("condominio_id", data.condominio_id)
      .order("inicio", { ascending: false });
    if (error) throwSafe(error);
    return (rows ?? []) as unknown as Assembleia[];
  });

export const obterAssembleia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [rAss, rPautas] = await Promise.all([
      supabase.from("assembleias").select("*").eq("id", data.id).single(),
      supabase
        .from("assembleia_pautas")
        .select("id, ordem, titulo, descricao, maioria, aberta_em, fechada_em, resultado")
        .eq("assembleia_id", data.id)
        .order("ordem"),
    ]);
    if (rAss.error) throwSafe(rAss.error);
    if (rPautas.error) throwSafe(rPautas.error);

    return {
      assembleia: rAss.data as unknown as Assembleia,
      pautas: (rPautas.data ?? []) as unknown as Pauta[],
    };
  });

/** Quem pode votar, e quem não pode e porquê. */
export const listarElegibilidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ assembleia_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("elegibilidade_assembleia", {
      _assembleia_id: data.assembleia_id,
    });
    if (error) throwSafe(error);
    return (rows ?? []) as unknown as Elegibilidade[];
  });

/** As unidades cujo voto este utilizador exerce neste condomínio.
 *
 *  Não basta ser proprietário: numa unidade com mais de um dono, o voto é um
 *  só e cabe a quem a representa (art. 1.335, III c/c art. 1.314). Com um
 *  único dono as duas condições coincidem, porque a designação é automática. */
export const minhasUnidades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ condominio_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("unidade_moradores")
      .select(
        "unidade_id, vinculo, representante, unidades!inner(id, bloco, numero, condominio_id)",
      )
      .eq("vinculo", "proprietario")
      .eq("unidades.condominio_id", data.condominio_id);
    if (error) throwSafe(error);

    // Devolve todas as unidades de que é dono, não só aquelas cujo voto exerce.
    // As outras a interface tem de mostrar na mesma, a dizer quem as
    // representa — caso contrário o coproprietário não vê a unidade em lado
    // nenhum e fica sem perceber porquê.
    return (rows ?? []).map((r: Record<string, unknown>) => {
      const u = r.unidades as { id: string; bloco: string | null; numero: string };
      return {
        unidade_id: u.id,
        bloco: u.bloco,
        numero: u.numero,
        representa: Boolean(r.representante),
      };
    });
  });

export const criarAssembleia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        condominio_id: z.string().uuid(),
        titulo: z.string().trim().min(3, "Informe o título").max(200),
        tipo: z.enum(["ordinaria", "extraordinaria"]),
        modo: z.enum(["virtual", "presencial", "hibrida"]),
        inicio: z.string().min(1, "Informe o início"),
        fim: z.string().min(1, "Informe o fim"),
        edital: z.string().trim().max(5000).optional().nullable(),
        local: z.string().trim().max(300).optional().nullable(),
        link: z.string().trim().max(500).optional().nullable(),
        peso_por_fracao: z.boolean(),
        exige_quitacao: z.boolean(),
        quorum_instalacao: z.number().min(0).max(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("criar_assembleia", {
      _condominio_id: data.condominio_id,
      _titulo: data.titulo,
      _tipo: data.tipo,
      _modo: data.modo,
      _inicio: new Date(data.inicio).toISOString(),
      _fim: new Date(data.fim).toISOString(),
      _edital: data.edital || undefined,
      _local: data.local || undefined,
      _link: data.link || undefined,
      _peso_por_fracao: data.peso_por_fracao,
      _exige_quitacao: data.exige_quitacao,
      _quorum_instalacao: data.quorum_instalacao,
    });
    if (error) throwSafe(error);
    return { id: id as unknown as string };
  });

export const adicionarPauta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        assembleia_id: z.string().uuid(),
        titulo: z.string().trim().min(3, "Informe o título").max(300),
        maioria: MAIORIA,
        descricao: z.string().trim().max(3000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("adicionar_pauta", {
      _assembleia_id: data.assembleia_id,
      _titulo: data.titulo,
      _maioria: data.maioria,
      _descricao: data.descricao || undefined,
    });
    if (error) throwSafe(error);
    return { id: id as unknown as string };
  });

export const removerPauta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pauta_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("remover_pauta", { _pauta_id: data.pauta_id });
    if (error) throwSafe(error);
    return { ok: true };
  });

export const convocarAssembleia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("convocar_assembleia", {
      _assembleia_id: data.id,
    });
    if (error) throwSafe(error);
    return { ok: true };
  });

export const abrirVotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pauta_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("abrir_votacao", { _pauta_id: data.pauta_id });
    if (error) throwSafe(error);
    return { ok: true };
  });

export const fecharVotacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pauta_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase.rpc("fechar_votacao", {
      _pauta_id: data.pauta_id,
    });
    if (error) throwSafe(error);
    return res as unknown as Resultado;
  });

/** O parcial, sem fixar. O síndico vê durante a votação; fixa-se ao fechar. */
export const apurarPauta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pauta_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase.rpc("apurar_pauta", {
      _pauta_id: data.pauta_id,
    });
    if (error) throwSafe(error);
    return res as unknown as Resultado;
  });

export const registrarVoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        pauta_id: z.string().uuid(),
        unidade_id: z.string().uuid(),
        opcao: z.enum(["sim", "nao", "abstencao"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("registrar_voto", {
      _pauta_id: data.pauta_id,
      _unidade_id: data.unidade_id,
      _opcao: data.opcao,
    });
    if (error) throwSafe(error);
    return { ok: true };
  });

/** Os votos de uma pauta. A RLS decide o que se vê: enquanto a votação está
 *  aberta, só o próprio; depois de fechada, todos — a ata é nominal. */
export const listarVotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pauta_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("assembleia_votos")
      .select("unidade_id, opcao, peso, registrado_em, unidades(bloco, numero)")
      .eq("pauta_id", data.pauta_id);
    if (error) throwSafe(error);
    return (rows ?? []).map((r: Record<string, unknown>) => {
      const u = r.unidades as { bloco: string | null; numero: string } | null;
      return {
        unidade_id: String(r.unidade_id),
        bloco: u?.bloco ?? null,
        numero: u?.numero ?? "?",
        opcao: r.opcao as VotoOpcao,
        peso: Number(r.peso),
        registrado_em: String(r.registrado_em),
      };
    });
  });

export const encerrarAssembleia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("encerrar_assembleia", {
      _assembleia_id: data.id,
    });
    if (error) throwSafe(error);
    return { ok: true };
  });

export const cancelarAssembleia = createServerFn({ method: "POST" })
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
    const { error } = await context.supabase.rpc("cancelar_assembleia", {
      _assembleia_id: data.id,
      _motivo: data.motivo || undefined,
    });
    if (error) throwSafe(error);
    return { ok: true };
  });

/** Regista a designação de representante de uma unidade.
 *
 *  A escolha é dos comproprietários; o que a administração faz é registá-la,
 *  e por isso só o síndico chama. Se qualquer coproprietário pudesse chamar a
 *  si a representação, bastava fazê-lo minutos antes da votação para tomar a
 *  unidade ao outro. */
export const definirRepresentante = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        unidade_id: z.string().uuid(),
        user_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("definir_representante", {
      _unidade_id: data.unidade_id,
      _user_id: data.user_id,
    });
    if (error) throwSafe(error);
    return { ok: true };
  });

export type ProprietarioDaUnidade = {
  user_id: string;
  nome: string;
  representante: boolean;
};

/** Os donos de uma unidade, para o síndico escolher quem a representa. */
export const proprietariosDaUnidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ unidade_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("proprietarios_da_unidade", {
      _unidade_id: data.unidade_id,
    });
    if (error) throwSafe(error);
    return (rows ?? []) as unknown as ProprietarioDaUnidade[];
  });
