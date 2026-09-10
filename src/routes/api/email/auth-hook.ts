/**
 * Send Email Hook do Supabase Auth.
 *
 * O Supabase chama esta rota sempre que precisaria de enviar um e-mail de
 * autenticação (confirmação, recuperação, convite, magic link, troca de e-mail
 * ou reautenticação). Aqui o conteúdo é renderizado a partir dos templates React
 * Email e colocado na fila `auth_emails`; quem entrega é
 * `/api/email/queue-process`.
 *
 * Configuração no painel: Authentication → Emails → Send Email Hook, apontando
 * para `https://<dominio>/api/email/auth-hook`, com o segredo gerado guardado em
 * SEND_EMAIL_HOOK_SECRET.
 */
import * as React from "react";
import { render } from "@react-email/render";
import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { SignupEmail } from "@/lib/email-templates/signup";
import { InviteEmail } from "@/lib/email-templates/invite";
import { MagicLinkEmail } from "@/lib/email-templates/magic-link";
import { RecoveryEmail } from "@/lib/email-templates/recovery";
import { EmailChangeEmail } from "@/lib/email-templates/email-change";
import { ReauthenticationEmail } from "@/lib/email-templates/reauthentication";
import { WebhookError, verificarAssinatura } from "@/server/email/standard-webhook";

const ASSUNTOS: Record<string, string> = {
  signup: "Confirme o seu e-mail",
  invite: "Você recebeu um convite",
  magiclink: "O seu link de acesso",
  recovery: "Redefinição de senha",
  email_change: "Confirme o seu novo e-mail",
  reauthentication: "O seu código de verificação",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
};

const NOME_SITE = "QiCond";
const DOMINIO_REMETENTE = "notify.qicondominios.qidominios.tech";
const URL_SITE = "https://qicondominios.qidominios.tech";

/** Estrutura enviada pelo Supabase Auth no Send Email Hook. */
type PayloadHook = {
  user?: { email?: string; new_email?: string };
  email_data?: {
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    email_action_type?: string;
    site_url?: string;
  };
};

/** Nunca registamos endereços completos nos logs. */
function ocultarEmail(email: string | null | undefined): string {
  if (!email) return "***";
  const [local, dominio] = email.split("@");
  if (!local || !dominio) return "***";
  return `${local[0]}***@${dominio}`;
}

/**
 * Monta o link de verificação. É o endpoint `/auth/v1/verify` do Supabase que
 * consome o `token_hash` e só depois redireciona para a aplicação.
 */
function montarUrlConfirmacao(supabaseUrl: string, dados: NonNullable<PayloadHook["email_data"]>) {
  const url = new URL("/auth/v1/verify", supabaseUrl);
  url.searchParams.set("token", dados.token_hash ?? "");
  url.searchParams.set("type", dados.email_action_type ?? "");
  url.searchParams.set("redirect_to", dados.redirect_to || URL_SITE);
  return url.toString();
}

export const Route = createFileRoute("/api/email/auth-hook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const segredo = process.env.SEND_EMAIL_HOOK_SECRET;
        const supabaseUrl = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!segredo || !supabaseUrl || !serviceKey) {
          console.error("Send Email Hook sem configuração completa");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        // O corpo tem de ser lido como texto: reserializar o JSON alteraria os
        // bytes e invalidaria a assinatura.
        const corpo = await request.text();

        try {
          await verificarAssinatura({ headers: request.headers, body: corpo, secret: segredo });
        } catch (erro) {
          if (erro instanceof WebhookError) {
            const naoAutorizado = erro.code !== "invalid_secret";
            console.error("Verificação do webhook falhou", { code: erro.code });
            return Response.json(
              { error: naoAutorizado ? "Invalid signature" : "Server configuration error" },
              { status: naoAutorizado ? 401 : 500 },
            );
          }
          console.error("Verificação do webhook falhou", { erro });
          return Response.json({ error: "Invalid signature" }, { status: 401 });
        }

        let payload: PayloadHook;
        try {
          payload = JSON.parse(corpo) as PayloadHook;
        } catch {
          return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
        }

        const dados = payload.email_data;
        const destinatario = payload.user?.email;
        const tipo = dados?.email_action_type;

        if (!dados || !destinatario || !tipo) {
          console.error("Payload do hook incompleto", { tipo });
          return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
        }

        const Template = TEMPLATES[tipo];
        if (!Template) {
          console.error("Tipo de e-mail desconhecido", { tipo });
          return Response.json({ error: `Unknown email type: ${tipo}` }, { status: 400 });
        }

        const elemento = React.createElement(Template, {
          siteName: NOME_SITE,
          siteUrl: URL_SITE,
          recipient: destinatario,
          confirmationUrl: montarUrlConfirmacao(supabaseUrl, dados),
          token: dados.token,
          email: destinatario,
          oldEmail: destinatario,
          newEmail: payload.user?.new_email,
        });
        const html = await render(elemento);
        const text = await render(elemento, { plainText: true });

        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false },
        });
        const messageId = crypto.randomUUID();

        // Regista como pendente antes de enfileirar, para que uma falha no
        // enfileiramento deixe rasto.
        await supabase.from("email_send_log").insert({
          message_id: messageId,
          template_name: tipo,
          recipient_email: destinatario,
          status: "pending",
        });

        const { error: erroFila } = await supabase.rpc("enqueue_email", {
          queue_name: "auth_emails",
          payload: {
            message_id: messageId,
            to: destinatario,
            from: `${NOME_SITE} <noreply@${DOMINIO_REMETENTE}>`,
            subject: ASSUNTOS[tipo] ?? "Notificação",
            html,
            text,
            label: tipo,
            queued_at: new Date().toISOString(),
          },
        });

        if (erroFila) {
          console.error("Falha ao enfileirar e-mail de autenticação", { erro: erroFila, tipo });
          await supabase.from("email_send_log").insert({
            message_id: messageId,
            template_name: tipo,
            recipient_email: destinatario,
            status: "failed",
            error_message: "Failed to enqueue email",
          });
          return Response.json({ error: "Failed to enqueue email" }, { status: 500 });
        }

        console.log("E-mail de autenticação enfileirado", {
          tipo,
          destinatario: ocultarEmail(destinatario),
        });

        return Response.json({ success: true, queued: true });
      },
    },
  },
});
