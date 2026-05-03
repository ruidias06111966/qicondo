import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/app/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — CONDOZAP" }] }),
  component: () => <Soon title="Financeiro" desc="Cobranças, PIX, boletos e prestação de contas." />,
});

function Soon({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-6 lg:p-10 max-w-3xl">
      <h1 className="font-display text-3xl font-extrabold">{title}</h1>
      <p className="text-muted-foreground mt-2">{desc}</p>
      <div className="mt-6 p-6 rounded-2xl border border-dashed border-border flex items-center gap-4 bg-muted/30">
        <Construction className="text-primary" />
        <div>
          <p className="font-semibold">Em construção — Fase 3</p>
          <p className="text-sm text-muted-foreground">Este módulo será liberado em seguida.</p>
        </div>
      </div>
    </div>
  );
}
