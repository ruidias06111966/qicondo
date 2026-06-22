import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { buildWaUrl } from "@/lib/wa-link";
import {
  CheckCircle2,
  Circle,
  MessageCircle,
  Copy,
  Check,
  Sparkles,
  ClipboardList,
  Rocket,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/proximos-passos")({
  head: () => ({
    meta: [
      { title: "Próximos passos — QiCond | Onboarding do condomínio" },
      {
        name: "description",
        content:
          "Checklist para preparar a implantação do QiCond no seu condomínio e mensagens prontas para iniciar a conversa no WhatsApp.",
      },
    ],
  }),
  component: ProximosPassosPage,
});

type ChecklistItem = { id: string; label: string; hint: string };

const CHECKLIST: ChecklistItem[] = [
  {
    id: "dados-condo",
    label: "Dados do condomínio",
    hint: "Nome oficial, CNPJ, endereço completo e número de unidades.",
  },
  {
    id: "unidades",
    label: "Lista de unidades e moradores",
    hint: "Planilha com bloco/torre, número, nome do titular, email e telefone.",
  },
  {
    id: "financeiro",
    label: "Plano de contas e taxas",
    hint: "Valor da taxa condominial, fundo de reserva, vencimento e categorias de despesa.",
  },
  {
    id: "documentos",
    label: "Documentos essenciais",
    hint: "Convenção, regimento interno, últimas atas e balancetes (PDF).",
  },
  {
    id: "areas",
    label: "Áreas comuns e regras de reserva",
    hint: "Salão, churrasqueira, quadra: horários, taxas e antecedência mínima.",
  },
  {
    id: "comunicacao",
    label: "Canais de comunicação",
    hint: "Número de WhatsApp oficial do condomínio e email do síndico.",
  },
  {
    id: "responsaveis",
    label: "Responsáveis e acessos",
    hint: "Síndico, subsíndico, conselho e portaria — quem terá acesso ao painel.",
  },
];

type MensagemSugerida = { titulo: string; descricao: string; texto: string };

const MENSAGENS: MensagemSugerida[] = [
  {
    titulo: "Agendar demonstração",
    descricao: "Marque uma call de 30 min para conhecer o sistema ao vivo.",
    texto:
      "Olá! Acabei de preencher o formulário no site do QiCond e gostaria de agendar uma demonstração de 30 minutos esta semana. Qual o melhor horário?",
  },
  {
    titulo: "Pedir proposta comercial",
    descricao: "Receba valores e condições adequadas ao tamanho do condomínio.",
    texto:
      "Olá! Gostaria de receber uma proposta comercial do QiCond. Posso enviar os dados do meu condomínio (nome, nº de unidades e cidade) por aqui?",
  },
  {
    titulo: "Tirar dúvidas técnicas",
    descricao: "Pergunte sobre integrações, segurança, LGPD e migração.",
    texto:
      "Olá! Tenho algumas dúvidas técnicas sobre o QiCond: integrações com banco, segurança dos dados (LGPD) e como funciona a migração de outro sistema. Pode me ajudar?",
  },
  {
    titulo: "Solicitar período de teste",
    descricao: "Peça acesso de avaliação antes de fechar o contrato.",
    texto:
      "Olá! Gostaria de testar o QiCond no meu condomínio antes de contratar. Vocês oferecem um período de avaliação? Quais os próximos passos?",
  },
];

const STORAGE_KEY = "qicond-onboarding-checklist";

function ProximosPassosPage() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDone(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(done));
    } catch {
      // ignore
    }
  }, [done]);

  const total = CHECKLIST.length;
  const concluidos = useMemo(
    () => CHECKLIST.filter((c) => done[c.id]).length,
    [done],
  );
  const progresso = Math.round((concluidos / total) * 100);

  function toggle(id: string) {
    setDone((d) => ({ ...d, [id]: !d[id] }));
  }

  async function copyTexto(m: MensagemSugerida) {
    try {
      await navigator.clipboard.writeText(m.texto);
      setCopiedId(m.titulo);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore
    }
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-4 md:px-8 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary mb-3">
          <Rocket size={14} /> Próximos passos
        </div>
        <h1 className="font-display font-extrabold text-4xl md:text-5xl tracking-tight">
          Pronto para <span className="text-gradient-brand">decolar</span> com o QiCond
        </h1>
        <p className="mt-5 text-muted-foreground max-w-2xl mx-auto">
          Recebemos o seu contato. Enquanto a nossa equipe responde, prepare o seu
          condomínio com este checklist e use uma das mensagens prontas para iniciar a
          conversa no WhatsApp.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-4 md:px-8 pb-20 grid md:grid-cols-5 gap-8">
        {/* Checklist */}
        <div className="md:col-span-3 rounded-2xl border border-border bg-surface p-6 md:p-8">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList size={18} className="text-primary" />
            <h2 className="font-display font-extrabold text-2xl">Checklist do condomínio</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            Marque cada item à medida que reúne as informações. O progresso fica salvo neste
            navegador.
          </p>

          <div className="mb-5">
            <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
              <span className="text-muted-foreground">
                {concluidos} de {total} concluídos
              </span>
              <span className="text-primary">{progresso}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-brand transition-all"
                style={{ width: `${progresso}%` }}
              />
            </div>
          </div>

          <ul className="space-y-2">
            {CHECKLIST.map((item) => {
              const ok = !!done[item.id];
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    aria-pressed={ok}
                    className={`w-full text-left rounded-xl border p-4 flex items-start gap-3 transition-colors ${
                      ok
                        ? "border-success/40 bg-success/5"
                        : "border-border bg-background hover:border-primary"
                    }`}
                  >
                    {ok ? (
                      <CheckCircle2 size={20} className="text-success shrink-0 mt-0.5" />
                    ) : (
                      <Circle size={20} className="text-muted-foreground shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div
                        className={`text-sm font-bold ${ok ? "line-through text-muted-foreground" : ""}`}
                      >
                        {item.label}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{item.hint}</div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {progresso === 100 && (
            <div className="mt-5 rounded-xl bg-gradient-brand text-white p-4 flex items-start gap-3">
              <Sparkles size={18} className="shrink-0 mt-0.5" />
              <div className="text-sm">
                <strong>Checklist completo!</strong> Envie agora uma mensagem no WhatsApp para
                acelerar a sua implantação.
              </div>
            </div>
          )}
        </div>

        {/* Mensagens sugeridas */}
        <aside className="md:col-span-2 space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2 mb-1">
              <MessageCircle size={18} className="text-primary" />
              <h3 className="font-display font-extrabold text-lg">Mensagens prontas</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Toque em <strong>Abrir WhatsApp</strong> para enviar com a mensagem já preenchida,
              ou copie o texto para usar onde preferir.
            </p>
          </div>

          {MENSAGENS.map((m) => {
            const copied = copiedId === m.titulo;
            return (
              <div key={m.titulo} className="rounded-2xl border border-border bg-surface p-5">
                <div className="text-sm font-bold">{m.titulo}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{m.descricao}</div>
                <p className="mt-3 text-xs text-foreground/80 bg-background border border-border rounded-lg p-3 whitespace-pre-line">
                  {m.texto}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={buildWaUrl(m.texto)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] text-white px-3 py-2 text-xs font-bold hover:opacity-95 transition-opacity"
                  >
                    <MessageCircle size={13} /> Abrir WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={() => copyTexto(m)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:border-primary transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check size={13} className="text-success" /> Copiado
                      </>
                    ) : (
                      <>
                        <Copy size={13} /> Copiar texto
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          <Link
            to="/precos"
            className="block rounded-2xl border border-border bg-surface p-5 hover:border-primary transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  Enquanto isso
                </div>
                <div className="text-sm font-bold mt-0.5">Reveja os planos do QiCond</div>
              </div>
              <ArrowRight size={18} className="text-primary" />
            </div>
          </Link>
        </aside>
      </section>
    </SiteLayout>
  );
}
