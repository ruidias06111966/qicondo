import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Pergunta ao QiGestão, uma vez por dia, quais condomínios estão em dia, e
// guarda a resposta em `condominios`. O QiGestão é o livro oficial; isto é a
// cópia.
//
// Agendado por pg_cron (POST diário), autenticado com o CRON_SECRET — o mesmo
// padrão das outras rotas internas.
//
// A rota NÃO bloqueia ninguém: só grava. Quem decide é o `avaliarAssinatura`,
// na interface, e um condomínio que falhe a sincronização fica com a cópia
// anterior, que expira ao fim de sete dias.

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

        const base = process.env.QIGESTAO_URL;
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

        // Os mais desactualizados primeiro: assim uma falha a meio não deixa
        // sempre os mesmos condomínios para trás.
        const { data: condos, error } = await sb
          .from("condominios")
          .select("id, nome")
          .order("assinatura_sincronizada_em", { ascending: true, nullsFirst: true })
          .limit(LOTE);
        if (error) return Response.json({ erro: error.message }, { status: 500 });

        const agora = new Date().toISOString();
        let atualizados = 0;
        const falhas: { condominio: string; erro: string }[] = [];

        for (const c of condos ?? []) {
          try {
            const r = await fetch(
              `${base.replace(/\/$/, "")}/api/integracao/estado?externo_id=${encodeURIComponent(c.id)}`,
              { headers: { authorization: `Bearer ${chave}` } },
            );
            if (!r.ok) {
              falhas.push({ condominio: c.id, erro: `HTTP ${r.status}` });
              continue;
            }
            const e = (await r.json()) as EstadoRemoto;

            await sb
              .from("condominios")
              .update({
                assinatura_conhecida: e.conhecida,
                assinatura_status: e.status,
                assinatura_externa_id: e.assinatura_id ?? null,
                assinatura_fatura: e.fatura_em_aberto ?? null,
                assinatura_sincronizada_em: agora,
              })
              .eq("id", c.id);
            atualizados++;
          } catch (err) {
            // Uma falha num condomínio não pode parar os outros: a cópia dele
            // fica com a data antiga e expira sozinha.
            falhas.push({
              condominio: c.id,
              erro: err instanceof Error ? err.message : String(err),
            });
          }
        }

        if (falhas.length) console.error("[sincronizar-assinaturas]", JSON.stringify(falhas));
        return Response.json({
          verificados: condos?.length ?? 0,
          atualizados,
          falhas: falhas.length,
        });
      },
    },
  },
});
