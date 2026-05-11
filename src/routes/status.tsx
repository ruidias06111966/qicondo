import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/status")({
  head: () => ({ meta: [{ title: "Status — WHATSCOND" }, { name: "description", content: "Status em tempo real dos serviços WHATSCOND." }] }),
  component: StatusPage,
});

const services = [
  { name: "Painel web", uptime: "99.99%" },
  { name: "WhatsApp Business API", uptime: "99.97%" },
  { name: "API de pagamentos (PIX)", uptime: "99.98%" },
  { name: "Banco de dados", uptime: "100%" },
  { name: "Storage de documentos", uptime: "100%" },
  { name: "Envio de emails", uptime: "99.95%" },
];

function StatusPage() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-4xl px-4 md:px-8 pt-16 pb-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-success/15 text-success px-4 py-1.5 text-sm font-semibold">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            Todos os sistemas operacionais
          </div>
          <h1 className="mt-5 font-display font-extrabold text-4xl md:text-5xl">Status do sistema</h1>
          <p className="mt-3 text-muted-foreground">Disponibilidade dos últimos 90 dias.</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          {services.map((s, i) => (
            <div key={s.name} className={`flex items-center justify-between p-5 ${i > 0 ? "border-t border-border" : ""}`}>
              <div className="flex items-center gap-3">
                <CheckCircle2 size={18} className="text-success" />
                <span className="font-semibold text-sm">{s.name}</span>
              </div>
              <div className="text-sm text-muted-foreground">Operacional · <span className="text-success font-semibold">{s.uptime}</span></div>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-display font-extrabold text-lg mb-4">Histórico de incidentes</h2>
          <p className="text-sm text-muted-foreground">Nenhum incidente reportado nos últimos 30 dias. ✨</p>
        </div>
      </section>
    </SiteLayout>
  );
}
