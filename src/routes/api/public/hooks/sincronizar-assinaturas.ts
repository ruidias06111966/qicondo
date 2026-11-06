import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Conversa diária com o QiGestão, nos dois sentidos:
//
//   1. ANUNCIA os condomínios que ele ainda não conhece — "este existe e é meu
//      cliente". Cria lá o cliente e a assinatura, em `teste`.
//   2. PERGUNTA o estado de cada um e guarda a resposta.
//
// O QiGestão é o livro oficial; isto é a cópia.
//
// POR QUE É QUE O ANÚNCIO VIVE AQUI, E NÃO NA CRIAÇÃO DO CONDOMÍNIO
//
// Foi a primeira ideia: chamar o QiGestão no momento em que alguém cria um
// condomínio. Tem três problemas. Se o QiGestão estiver em baixo, ou a criação
// falha ou o condomínio nasce por anunciar e ninguém volta a tentar. Os
// condomínios que já existiam antes desta integração nunca seriam anunciados.
// E teria de ser repetido em cada sistema Qi, no sítio onde cada um cria o seu
// inquilino — que é diferente em todos.
//
// Aqui é um sítio só, repete-se sozinho todos os dias até resultar, e apanha o
// que já existia. O custo é a latência: um condomínio criado hoje só é
// anunciado amanhã. Não dói, porque a assinatura nasce em `teste` e nada é
// cobrado no primeiro dia.
//
// Agendado por pg_cron, autenticado com o CRON_SECRET.

/** Quantos condomínios por execução. Mantém a chamada curta e previsível. */
const LOTE = 200;

type EstadoRemoto = {
  conhecida: boolean;
  ativa: boolean;
  status: string | null;
  assinatura_id?: string;
  fatura_em_aberto?: {
    numero: number;
    vencimento: string;
    valor: number;
    dias_atraso: number;
    token: string;
  } | null;
};

type CondominioParaSincronizar = {
  id: string;
  nome: string;
  documento: string | null;
  cidade: string | null;
  uf: string | null;
  telefone: string | null;
  email: string | null;
  conhecida: boolean | null;
};

export const Route = createFileRoute("/api/public/hooks/sincronizar-assinaturas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token =
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          request.headers.get("x-cron-secret");
        const expected = process.env.CRON_SECRET;
        if (!expected || !token || token !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const base = process.env.QIGESTAO_URL?.replace(/\/$/, "");
        const chave = process.env.QIGESTAO_TOKEN;
        if (!base || !chave) {
          // 503 e não 500: não é avaria, é configuração em falta. Enquanto
          // assim estiver, nenhum condomínio é bloqueado — o
          // `avaliarAssinatura` trata "nunca sincronizado" como "pode
          // trabalhar".
          return Response.json(
            { erro: "Defina QIGESTAO_URL e QIGESTAO_TOKEN para sincronizar as assinaturas." },
            { status: 503 },
          );
        }

        const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !serviceKey) return new Response("Missing service config", { status: 500 });
        const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

        const cabecalho = { authorization: `Bearer ${chave}` };

        const perguntar = async (id: string): Promise<EstadoRemoto> => {
          const r = await fetch(
            `${base}/api/integracao/estado?externo_id=${encodeURIComponent(id)}`,
            { headers: cabecalho },
          );
          if (!r.ok) throw new Error(`estado: HTTP ${r.status}`);
          return (await r.json()) as EstadoRemoto;
        };

        const anunciar = async (c: CondominioParaSincronizar) => {
          const r = await fetch(`${base}/api/integracao/assinatura`, {
            method: "POST",
            headers: { ...cabecalho, "content-type": "application/json" },
            body: JSON.stringify({
              externo_id: c.id,
              nome: c.nome,
              documento: c.documento,
              email: c.email,
              telefone: c.telefone,
              cidade: c.cidade,
              uf: c.uf,
            }),
          });
          if (!r.ok) throw new Error(`assinatura: HTTP ${r.status}`);
        };

        const { data: condos, error } = await sb.rpc("condominios_para_sincronizar", {
          _limite: LOTE,
        });
        if (error) return Response.json({ erro: error.message }, { status: 500 });

        const agora = new Date().toISOString();
        let atualizados = 0;
        let anunciados = 0;
        const falhas: { condominio: string; erro: string }[] = [];

        for (const c of (condos ?? []) as CondominioParaSincronizar[]) {
          try {
            let estado = await perguntar(c.id);

            // Desconhecido: anuncia e pergunta de novo, para a cópia já ficar
            // com o estado real em vez de esperar pelo dia seguinte.
            if (!estado.conhecida) {
              await anunciar(c);
              anunciados++;
              estado = await perguntar(c.id);
            }

            await sb
              .from("condominios")
              .update({
                assinatura_conhecida: estado.conhecida,
                assinatura_status: estado.status,
                assinatura_externa_id: estado.assinatura_id ?? null,
                assinatura_fatura: estado.fatura_em_aberto ?? null,
                assinatura_sincronizada_em: agora,
              })
              .eq("id", c.id);
            atualizados++;
          } catch (err) {
            // Uma falha num condomínio não pode parar os outros: a cópia dele
            // fica com a data antiga e expira sozinha ao fim de sete dias.
            falhas.push({
              condominio: c.id,
              erro: err instanceof Error ? err.message : String(err),
            });
          }
        }

        if (falhas.length) console.error("[sincronizar-assinaturas]", JSON.stringify(falhas));
        return Response.json({
          verificados: condos?.length ?? 0,
          anunciados,
          atualizados,
          falhas: falhas.length,
        });
      },
    },
  },
});
