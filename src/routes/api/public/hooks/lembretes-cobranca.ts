import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Cron-friendly: dispara lembretes de cobrança em todos os condomínios com wa_automacao_ativa=true.
// Uso: agendado via pg_cron (POST diário). Sem autenticação de usuário — usa service role.

function renderTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

export const Route = createFileRoute("/api/public/hooks/lembretes-cobranca")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
          ?? request.headers.get("x-cron-secret");
        const expected = process.env.CRON_SECRET;
        if (!expected || !token || token !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !serviceKey) {
          return new Response("Missing service config", { status: 500 });
        }
        const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

        const { data: cfgs } = await sb
          .from("config_pagamento")
          .select(
            "condominio_id, wa_dias_pre_vencimento, wa_dias_pos_vencimento, wa_template_lembrete, wa_template_vencida",
          )
          .eq("wa_automacao_ativa", true);

        let totalEnf = 0;
        let totalCob = 0;
        for (const cfg of cfgs ?? []) {
          const hoje = new Date();
          const isoDia = (d: Date) => d.toISOString().slice(0, 10);
          const datasAlvo: { data: string; tipo: "pre" | "pos" }[] = [];
          for (const d of cfg.wa_dias_pre_vencimento ?? []) {
            const dt = new Date(hoje);
            dt.setDate(dt.getDate() + d);
            datasAlvo.push({ data: isoDia(dt), tipo: "pre" });
          }
          for (const d of cfg.wa_dias_pos_vencimento ?? []) {
            const dt = new Date(hoje);
            dt.setDate(dt.getDate() - d);
            datasAlvo.push({ data: isoDia(dt), tipo: "pos" });
          }
          const datasUnicas = Array.from(new Set(datasAlvo.map((x) => x.data)));
          if (datasUnicas.length === 0) continue;

          const { data: cobs } = await sb
            .from("cobrancas")
            .select("id, vencimento, valor, valor_pago, multa, juros, desconto, condominio_id, unidade_id, unidades(numero, bloco)")
            .eq("condominio_id", cfg.condominio_id)
            .in("vencimento", datasUnicas)
            .in("status", ["pendente", "vencida", "parcial"]);

          for (const cob of cobs ?? []) {
            const tipo = datasAlvo.find((x) => x.data === cob.vencimento)?.tipo ?? "pre";
            const tpl = tipo === "pre" ? cfg.wa_template_lembrete : cfg.wa_template_vencida;
            if (!tpl) continue;

            const { data: mors } = await sb
              .from("unidade_moradores")
              .select("user_id")
              .eq("unidade_id", cob.unidade_id);
            const userIds = (mors ?? []).map((m: any) => m.user_id);
            if (userIds.length === 0) continue;
            const { data: profs } = await sb
              .from("profiles")
              .select("id, nome_completo, telefone")
              .in("id", userIds);

            const restante =
              Number(cob.valor) + Number(cob.multa) + Number(cob.juros) -
              Number(cob.desconto) - Number(cob.valor_pago);
            const u = (cob as any).unidades;
            const unidadeLabel = u ? `${u.bloco ? u.bloco + "-" : ""}${u.numero}` : "sua unidade";
            const venc = new Date(cob.vencimento).toLocaleDateString("pt-BR");
            const valor = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(restante);

            totalCob++;
            const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0);
            const inicioHojeISO = inicioHoje.toISOString();
            for (const p of profs ?? []) {
              const tel = (p.telefone ?? "").replace(/\D/g, "");
              if (tel.length < 10) continue;
              const telFinal = tel.length <= 11 ? "55" + tel : tel;

              const { data: jaExiste } = await sb
                .from("notificacoes_whatsapp")
                .select("id")
                .eq("contexto", "cobranca")
                .eq("contexto_id", cob.id)
                .eq("destinatario_telefone", telFinal)
                .gte("created_at", inicioHojeISO)
                .limit(1)
                .maybeSingle();
              if (jaExiste) continue;

              const msg = renderTemplate(tpl, {
                nome: p.nome_completo ?? "",
                unidade: unidadeLabel,
                vencimento: venc,
                valor,
              });
              const { error: insErr } = await sb.from("notificacoes_whatsapp").insert({
                condominio_id: cob.condominio_id,
                unidade_id: cob.unidade_id,
                destinatario_user_id: p.id,
                destinatario_telefone: telFinal,
                destinatario_nome: p.nome_completo,
                mensagem: msg,
                contexto: "cobranca",
                contexto_id: cob.id,
                status: "pendente",
                link_wa: `https://wa.me/${telFinal}?text=${encodeURIComponent(msg)}`,
              });
              if (!insErr) totalEnf++;
            }
          }
        }

        return Response.json({
          ok: true,
          condominios: cfgs?.length ?? 0,
          cobrancas: totalCob,
          enfileirados: totalEnf,
        });
      },
    },
  },
});
