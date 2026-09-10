/**
 * Transporte de e-mail transacional (Resend).
 *
 * A fila (PGMQ), o DLQ, o controlo de retentativas e o TTL vivem em
 * `src/routes/email/queue/process.ts` e nas migrações `email_infra`. Este
 * módulo é apenas o degrau final: pega numa mensagem já desenfileirada e
 * entrega-a ao fornecedor.
 *
 * Mantém-se deliberadamente sem SDK — a Resend expõe uma API REST simples e
 * `fetch` é o que corre nativamente nos Cloudflare Workers.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Mensagem pronta a enviar. É o mesmo formato que entra na fila, para que uma
 * mensagem enfileirada antes de um deploy continue a ser entregue depois dele.
 */
export type EmailPayload = {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  /** Nome do template, usado apenas para observabilidade. */
  label?: string;
  /** UUID gerado no enfileiramento; serve de chave de idempotência. */
  message_id?: string;
  /** Sobrepõe `message_id` como chave de idempotência, quando fornecida. */
  idempotency_key?: string;
  /** Presente em e-mails de marketing; gera o cabeçalho List-Unsubscribe. */
  unsubscribe_token?: string;
  reply_to?: string;
};

/**
 * Falha na entrega. `status` e `retryAfterSeconds` são lidos pelo processador
 * da fila para distinguir rate limit (429, espera), configuração inválida
 * (403, vai direto para o DLQ) e erros transitórios (retenta).
 */
export class EmailTransportError extends Error {
  readonly status: number;
  readonly retryAfterSeconds: number | null;

  constructor(message: string, status: number, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "EmailTransportError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Lê `Retry-After` (segundos ou data HTTP) ou o `ratelimit-reset` da Resend. */
function parseRetryAfter(headers: Headers): number | null {
  const retryAfter = headers.get("retry-after");
  if (retryAfter) {
    const segundos = Number(retryAfter);
    if (Number.isFinite(segundos)) return Math.max(0, Math.ceil(segundos));

    const data = Date.parse(retryAfter);
    if (Number.isFinite(data)) {
      return Math.max(0, Math.ceil((data - Date.now()) / 1000));
    }
  }

  const reset = Number(headers.get("ratelimit-reset"));
  return Number.isFinite(reset) ? Math.max(0, Math.ceil(reset)) : null;
}

/** Extrai a mensagem de erro do corpo da resposta, que nem sempre é JSON. */
async function lerErro(resposta: Response): Promise<string> {
  const corpo = await resposta.text().catch(() => "");
  if (!corpo) return `HTTP ${resposta.status}`;

  try {
    const json = JSON.parse(corpo) as { message?: string; error?: string; name?: string };
    return json.message ?? json.error ?? json.name ?? corpo.slice(0, 500);
  } catch {
    return corpo.slice(0, 500);
  }
}

export type OpcoesEnvio = {
  apiKey: string;
  /** Sobrepõe o endpoint — usado nos testes. */
  endpoint?: string;
  /** URL base pública, para montar o link de cancelamento de subscrição. */
  siteUrl?: string;
};

/**
 * Entrega uma mensagem. Devolve o id atribuído pelo fornecedor.
 *
 * Lança `EmailTransportError` em qualquer resposta não-2xx: cabe a quem chama
 * decidir entre retentar, esperar ou descartar.
 */
export async function enviarEmail(payload: EmailPayload, opcoes: OpcoesEnvio): Promise<string> {
  if (!opcoes.apiKey) {
    throw new EmailTransportError("RESEND_API_KEY não configurada", 500);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${opcoes.apiKey}`,
    "Content-Type": "application/json",
  };

  // A Resend deduplica por esta chave durante 24h, o que protege contra o envio
  // repetido quando o visibility timeout da fila expira a meio de um envio.
  const chaveIdempotencia = payload.idempotency_key ?? payload.message_id;
  if (chaveIdempotencia) {
    headers["Idempotency-Key"] = chaveIdempotencia;
  }

  const cabecalhosMensagem: Record<string, string> = {};
  if (payload.unsubscribe_token && opcoes.siteUrl) {
    const url = `${opcoes.siteUrl.replace(/\/$/, "")}/api/public/unsubscribe?token=${encodeURIComponent(payload.unsubscribe_token)}`;
    cabecalhosMensagem["List-Unsubscribe"] = `<${url}>`;
    cabecalhosMensagem["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  let resposta: Response;
  try {
    resposta = await fetch(opcoes.endpoint ?? RESEND_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: payload.from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        ...(payload.text ? { text: payload.text } : {}),
        ...(payload.reply_to ? { reply_to: payload.reply_to } : {}),
        ...(Object.keys(cabecalhosMensagem).length ? { headers: cabecalhosMensagem } : {}),
      }),
    });
  } catch (erro) {
    // Falha de rede: transitória, logo merece retentativa (status 0 não é 403 nem 429).
    const detalhe = erro instanceof Error ? erro.message : String(erro);
    throw new EmailTransportError(`Falha de rede ao contactar a Resend: ${detalhe}`, 0);
  }

  if (!resposta.ok) {
    throw new EmailTransportError(
      await lerErro(resposta),
      resposta.status,
      parseRetryAfter(resposta.headers),
    );
  }

  const corpo = (await resposta.json().catch(() => ({}))) as { id?: string };
  return corpo.id ?? "";
}
