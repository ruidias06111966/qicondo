import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { drenarFila } from "@/server/documentos.server";

export const Route = createFileRoute("/api/public/wa-drain")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
          ?? request.headers.get("x-cron-secret");
        const expected = process.env.CRON_SECRET;
        if (!expected || !token || token !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { data: conds } = await supabaseAdmin
          .from("wa_config")
          .select("condominio_id")
          .eq("ativo", true);
        let total = { enviados: 0, falhas: 0, pulados: 0 };
        for (const c of conds ?? []) {
          const r = await drenarFila(c.condominio_id, 50);
          total.enviados += r.enviados;
          total.falhas += r.falhas;
          total.pulados += r.pulados;
        }
        return Response.json({ ok: true, ...total });
      },
    },
  },
});
