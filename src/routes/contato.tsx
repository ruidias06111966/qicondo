import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { SiteLayout } from "@/components/site/SiteLayout";
import {
  Mail,
  MessageCircle,
  MapPin,
  Send,
  CheckCircle2,
  Copy,
  Check,
  Clock,
  Shield,
  Sparkles,
} from "lucide-react";

const WHATSAPP_NUMBER = "5561982750884";
const CONTACT_EMAIL = "qidomino@gmail.com";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato — QiCond | Fale com a equipe de pré-vendas" },
      {
        name: "description",
        content:
          "Solicite uma demonstração do QiCond. Resposta em até 1 dia útil por email (qidomino@gmail.com) ou WhatsApp +55 61 98275-0884.",
      },
    ],
  }),
  component: ContatoPage,
});

const PERFIS = [
  "Síndico(a) profissional",
  "Síndico(a) morador",
  "Administradora",
  "Construtora / Incorporadora",
  "Outro",
] as const;

const UNIDADES = ["Até 30", "31 a 100", "101 a 300", "Mais de 300"] as const;
const PRAZOS = ["Imediato", "Próximos 30 dias", "Próximos 90 dias", "Apenas pesquisando"] as const;

const DDD_VALIDOS = new Set([
  "11","12","13","14","15","16","17","18","19",
  "21","22","24","27","28","31","32","33","34","35","37","38",
  "41","42","43","44","45","46","47","48","49",
  "51","53","54","55","61","62","63","64","65","66","67","68","69",
  "71","73","74","75","77","79",
  "81","82","83","84","85","86","87","88","89",
  "91","92","93","94","95","96","97","98","99",
]);

function limparDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

function formatarTelefone(v: string): string {
  const digits = limparDigitos(v).slice(0, 11);
  if (digits.length <= 2) {
    return digits.length ? `(${digits}` : "";
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function validarTelefone(v: string): boolean {
  const digits = limparDigitos(v);
  if (digits.length < 10 || digits.length > 11) return false;
  const ddd = digits.slice(0, 2);
  if (!DDD_VALIDOS.has(ddd)) return false;
  if (digits.length === 11) {
    const nono = digits[2];
    if (nono !== "9") return false;
    const primeiro = digits[3];
    if (primeiro === "0" || primeiro === "1") return false;
  }
  if (digits.length === 10) {
    const primeiro = digits[2];
    if (primeiro === "0" || primeiro === "1") return false;
  }
  return true;
}

const schema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome completo").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  telefone: z
    .string()
    .trim()
    .min(1, "Informe o telefone")
    .refine((v) => limparDigitos(v).length >= 10, "Telefone incompleto")
    .refine((v) => limparDigitos(v).length <= 11, "Telefone muito longo")
    .refine(validarTelefone, "Telefone inválido. Use formato (XX) XXXXX-XXXX"),
  perfil: z.enum(PERFIS, { message: "Selecione um perfil" }),
  condominio: z.string().trim().min(2, "Informe o nome do condomínio").max(120),
  unidades: z.enum(UNIDADES, { message: "Selecione a faixa" }),
  prazo: z.enum(PRAZOS, { message: "Selecione um prazo" }),
  mensagem: z.string().trim().min(10, "Conte um pouco mais (mín. 10 caracteres)").max(1000),
  consentimento: z.literal("on", { message: "É necessário concordar para continuar" }),
});

type FormErrors = Partial<Record<keyof z.infer<typeof schema>, string>>;

function ContatoPage() {
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const data = Object.fromEntries(fd);
    const result = schema.safeParse(data);
    if (!result.success) {
      const errs: FormErrors = {};
      result.error.issues.forEach((i) => {
        errs[i.path[0] as keyof FormErrors] = i.message;
      });
      setErrors(errs);
      // foca primeiro campo com erro
      const firstKey = Object.keys(errs)[0];
      if (firstKey) {
        const el = form.querySelector<HTMLElement>(`[name="${firstKey}"]`);
        el?.focus();
      }
      return;
    }
    setErrors({});
    setSubmitting(true);

    // Encaminha para WhatsApp com mensagem pré-preenchida
    const d = result.data;
    const msg = [
      `Olá! Gostaria de uma proposta do QiCond.`,
      ``,
      `Nome: ${d.nome}`,
      `Email: ${d.email}`,
      `Telefone: ${d.telefone}`,
      `Perfil: ${d.perfil}`,
      `Condomínio: ${d.condominio}`,
      `Unidades: ${d.unidades}`,
      `Prazo: ${d.prazo}`,
      ``,
      d.mensagem,
    ].join("\n");
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
    // Abre WhatsApp em nova aba e mostra confirmação
    window.open(url, "_blank", "noopener,noreferrer");
    setSent(true);
    setSubmitting(false);
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // noop
    }
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-4 md:px-8 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary mb-3">
          <Sparkles size={14} /> Pré-vendas
        </div>
        <h1 className="font-display font-extrabold text-4xl md:text-6xl tracking-tight">
          Fale com a <span className="text-gradient-brand">nossa equipe</span>
        </h1>
        <p className="mt-5 text-muted-foreground max-w-2xl mx-auto">
          Conte sobre o seu condomínio e enviaremos uma proposta personalizada. Resposta em até{" "}
          <strong className="text-foreground">1 dia útil</strong>.
        </p>

        {/* Destaque do email */}
        <div className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-3 shadow-sm">
          <div className="h-9 w-9 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
            <Mail size={16} />
          </div>
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Email de contato
            </div>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-sm md:text-base font-bold text-primary hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
          <button
            type="button"
            onClick={copyEmail}
            aria-label="Copiar email"
            className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold hover:border-primary transition-colors"
          >
            {copied ? (
              <>
                <Check size={13} className="text-success" /> Copiado
              </>
            ) : (
              <>
                <Copy size={13} /> Copiar
              </>
            )}
          </button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 md:px-8 pb-20 grid md:grid-cols-5 gap-8">
        <aside className="md:col-span-2 space-y-4">
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
              "Olá! Gostaria de saber mais sobre o QiCond.",
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl bg-[#25D366] text-white p-5 hover:opacity-95 transition-opacity"
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-white/20 flex items-center justify-center">
                <MessageCircle size={18} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-white/80">
                  WhatsApp · resposta rápida
                </div>
                <div className="text-base font-bold mt-0.5">+55 61 98275-0884</div>
                <div className="text-xs text-white/85 mt-1">Toque para abrir uma conversa</div>
              </div>
            </div>
          </a>

          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Interesse%20no%20QiCond`}
            className="block rounded-2xl border border-border bg-surface p-5 hover:border-primary transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                <Mail size={18} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  Email
                </div>
                <div className="text-sm font-semibold mt-0.5">{CONTACT_EMAIL}</div>
                <div className="text-xs text-muted-foreground mt-1">Para propostas e dúvidas comerciais</div>
              </div>
            </div>
          </a>

          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                <MapPin size={18} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                  Onde estamos
                </div>
                <div className="text-sm font-semibold mt-0.5">100% remoto · time no Brasil</div>
                <div className="text-xs text-muted-foreground mt-1">Atendimento seg. a sex., 9h–18h</div>
              </div>
            </div>
          </div>

          <ul className="rounded-2xl bg-gradient-brand text-white p-5 space-y-2.5 text-sm">
            <li className="flex items-center gap-2">
              <Clock size={15} className="opacity-90" /> Resposta em até 1 dia útil
            </li>
            <li className="flex items-center gap-2">
              <Shield size={15} className="opacity-90" /> Seus dados são tratados conforme a LGPD
            </li>
            <li className="flex items-center gap-2">
              <Sparkles size={15} className="opacity-90" /> Demonstração ao vivo e sem compromisso
            </li>
          </ul>
        </aside>

        <form
          onSubmit={onSubmit}
          noValidate
          className="md:col-span-3 rounded-2xl border border-border bg-surface p-6 md:p-8"
        >
          {sent ? (
            <div className="text-center py-12">
              <div className="mx-auto h-14 w-14 rounded-full bg-success/15 text-success flex items-center justify-center mb-4">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="font-display font-extrabold text-2xl mb-2">Pedido recebido!</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Abrimos uma conversa no WhatsApp com os seus dados. Se preferir, escreva também para{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary font-semibold hover:underline">
                  {CONTACT_EMAIL}
                </a>
                . Respondemos em até 1 dia útil.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="mt-6 inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold hover:border-primary transition-colors"
              >
                Enviar nova mensagem
              </button>
            </div>
          ) : (
            <>
              <h2 className="font-display font-extrabold text-2xl mb-1">Solicite uma proposta</h2>
              <p className="text-sm text-muted-foreground mb-6">
                É grátis e sem compromisso. Levamos cerca de 2 minutos.
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field name="nome" label="Nome completo" placeholder="João Silva" error={errors.nome} required />
                <Field
                  name="email"
                  label="Email"
                  type="email"
                  placeholder="voce@email.com"
                  error={errors.email}
                  required
                />
                <Field
                  name="telefone"
                  label="Telefone / WhatsApp"
                  placeholder="(61) 90000-0000"
                  error={errors.telefone}
                  required
                  onInput={(e) => {
                    const target = e.currentTarget;
                    target.value = formatarTelefone(target.value);
                  }}
                />
                <SelectField
                  name="perfil"
                  label="Você é"
                  options={PERFIS as unknown as string[]}
                  error={errors.perfil}
                  required
                />
                <Field
                  name="condominio"
                  label="Nome do condomínio"
                  placeholder="Ed. Recanto Verde"
                  error={errors.condominio}
                  required
                />
                <SelectField
                  name="unidades"
                  label="Nº de unidades"
                  options={UNIDADES as unknown as string[]}
                  error={errors.unidades}
                  required
                />
                <div className="sm:col-span-2">
                  <SelectField
                    name="prazo"
                    label="Quando pretende contratar?"
                    options={PRAZOS as unknown as string[]}
                    error={errors.prazo}
                    required
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-semibold mb-1.5">
                  Mensagem <span className="text-destructive">*</span>
                </label>
                <textarea
                  name="mensagem"
                  rows={4}
                  maxLength={1000}
                  placeholder="O que você precisa resolver? (cobrança, comunicação, reservas, etc.)"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  aria-invalid={!!errors.mensagem}
                />
                {errors.mensagem && <p className="mt-1 text-xs text-destructive">{errors.mensagem}</p>}
              </div>

              <label className="mt-4 flex items-start gap-2.5 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  name="consentimento"
                  className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-primary/20"
                />
                <span>
                  Concordo em ser contactado por email ou WhatsApp e li a{" "}
                  <a href="/privacidade" className="text-primary hover:underline">
                    política de privacidade
                  </a>
                  .
                </span>
              </label>
              {errors.consentimento && (
                <p className="mt-1 text-xs text-destructive">{errors.consentimento}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground hover:bg-[var(--color-primary-deep)] transition-colors disabled:opacity-60"
              >
                <Send size={15} /> {submitting ? "A enviar..." : "Enviar e abrir WhatsApp"}
              </button>
              <p className="mt-3 text-xs text-muted-foreground text-center">
                Prefere email?{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=Interesse%20no%20QiCond`}
                  className="text-primary font-semibold hover:underline"
                >
                  {CONTACT_EMAIL}
                </a>
              </p>
            </>
          )}
        </form>
      </section>
    </SiteLayout>
  );
}

function Field({
  name,
  label,
  type = "text",
  placeholder,
  error,
  required,
  onInput,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  error?: string;
  required?: boolean;
  onInput?: (e: React.FormEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        maxLength={255}
        aria-invalid={!!error}
        onInput={onInput}
        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SelectField({
  name,
  label,
  options,
  error,
  required,
}: {
  name: string;
  label: string;
  options: string[];
  error?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <select
        name={name}
        defaultValue=""
        aria-invalid={!!error}
        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <option value="" disabled>
          Selecione…
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
