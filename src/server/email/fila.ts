/**
 * Enfileiramento de e-mails transacionais.
 *
 * Nada é enviado aqui: a mensagem é renderizada, registada em `email_send_log`
 * e colocada na fila `transactional_emails`. A entrega fica a cargo de
 * `/api/email/queue-process`, que corre periodicamente e é quem trata de
 * retentativas, rate limit e DLQ.
 *
 * Enfileirar em vez de enviar em linha mantém a resposta ao utilizador rápida e
 * garante que uma indisponibilidade do fornecedor não faz falhar a operação de
 * negócio que originou o e-mail.
 */
import * as React from "react";
import { render } from "@react-email/render";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const NOME_SITE = "QiCond";
const DOMINIO_REMETENTE = "notify.qicondominios.qidominios.tech";

export type EmailTransacional = {
  para: string;
  assunto: string;
  /** Elemento React Email já com as props preenchidas. */
  elemento: React.ReactElement;
  /** Nome do template, para consulta em `email_send_log`. */
  label: string;
};

/**
 * Coloca um e-mail na fila. Devolve o `message_id` atribuído, ou `null` se o
 * enfileiramento falhar.
 *
 * Não lança: quem chama está normalmente a meio de uma operação já concluída
 * (um convite gravado, por exemplo) e não deve vê-la falhar por causa do
 * e-mail. A falha fica registada em `email_send_log` e no log do servidor.
 */
export async function enfileirarEmail(email: EmailTransacional): Promise<string | null> {
  const messageId = crypto.randomUUID();

  try {
    const html = await render(email.elemento);
    const text = await render(email.elemento, { plainText: true });

    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: email.label,
      recipient_email: email.para,
      status: "pending",
    });

    const { error } = await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: email.para,
        from: `${NOME_SITE} <noreply@${DOMINIO_REMETENTE}>`,
        subject: email.assunto,
        html,
        text,
        label: email.label,
        queued_at: new Date().toISOString(),
      },
    });

    if (error) {
      console.error("Falha ao enfileirar e-mail transacional", {
        label: email.label,
        erro: error.message,
      });
      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: email.label,
        recipient_email: email.para,
        status: "failed",
        error_message: "Failed to enqueue email",
      });
      return null;
    }

    return messageId;
  } catch (erro) {
    console.error("Erro inesperado ao preparar e-mail transacional", {
      label: email.label,
      erro: erro instanceof Error ? erro.message : String(erro),
    });
    return null;
  }
}
