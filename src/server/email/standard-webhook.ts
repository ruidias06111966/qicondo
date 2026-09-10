/**
 * Verificação de webhooks no formato Standard Webhooks.
 *
 * É o formato que o Supabase Auth usa no "Send Email Hook": assina
 * `id.timestamp.body` com HMAC-SHA256 e envia o resultado em base64 nos
 * cabeçalhos `webhook-id`, `webhook-timestamp` e `webhook-signature`.
 *
 * Implementado sobre Web Crypto para correr nos Cloudflare Workers sem
 * dependências externas.
 */

/** Tolerância na diferença entre o relógio do emissor e o nosso. */
const TOLERANCIA_SEGUNDOS = 5 * 60;

export type CodigoErroWebhook =
  | "missing_headers"
  | "invalid_secret"
  | "missing_timestamp"
  | "invalid_timestamp"
  | "stale_timestamp"
  | "invalid_signature";

export class WebhookError extends Error {
  readonly code: CodigoErroWebhook;

  constructor(code: CodigoErroWebhook, message: string) {
    super(message);
    this.name = "WebhookError";
    this.code = code;
  }
}

/**
 * Aceita o segredo tal como o painel do Supabase o apresenta
 * (`v1,whsec_<base64>`), bem como as formas reduzidas `whsec_<base64>` e
 * `<base64>`.
 */
function decodificarSegredo(secret: string): Uint8Array {
  let base64 = secret.trim();
  if (base64.startsWith("v1,")) base64 = base64.slice(3);
  if (base64.startsWith("whsec_")) base64 = base64.slice(6);

  try {
    const binario = atob(base64);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return bytes;
  } catch {
    throw new WebhookError("invalid_secret", "Segredo do webhook não está em base64 válido");
  }
}

function paraBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario);
}

/**
 * Comparação em tempo constante. Uma comparação normal com `===` termina no
 * primeiro byte diferente e deixa o tempo de resposta revelar quanto do
 * prefixo estava certo.
 */
function iguaisEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) {
    diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diferenca === 0;
}

/**
 * Confirma que o corpo recebido foi assinado com `secret` e que o carimbo
 * temporal está dentro da tolerância. Lança `WebhookError` caso contrário.
 *
 * O corpo tem de ser o texto exatamente como chegou: se for reserializado a
 * partir de JSON, a assinatura deixa de bater.
 */
export async function verificarAssinatura(opcoes: {
  headers: Headers;
  body: string;
  secret: string;
  /** Injetável para testes. */
  agora?: Date;
}): Promise<void> {
  const { headers, body, secret } = opcoes;

  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const assinaturas = headers.get("webhook-signature");

  if (!id || !assinaturas) {
    throw new WebhookError(
      "missing_headers",
      "Cabeçalhos webhook-id ou webhook-signature em falta",
    );
  }
  if (!timestamp) {
    throw new WebhookError("missing_timestamp", "Cabeçalho webhook-timestamp em falta");
  }

  const segundos = Number(timestamp);
  if (!Number.isFinite(segundos)) {
    throw new WebhookError("invalid_timestamp", "Cabeçalho webhook-timestamp não é numérico");
  }

  const agora = (opcoes.agora ?? new Date()).getTime() / 1000;
  if (Math.abs(agora - segundos) > TOLERANCIA_SEGUNDOS) {
    throw new WebhookError("stale_timestamp", "Carimbo temporal fora da janela aceite");
  }

  const chave = await crypto.subtle.importKey(
    "raw",
    decodificarSegredo(secret) as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = paraBase64(
    await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(`${id}.${timestamp}.${body}`)),
  );

  // O cabeçalho pode trazer várias assinaturas separadas por espaço durante uma
  // rotação de segredo; basta uma corresponder.
  const candidatas = assinaturas
    .split(" ")
    .map((parte) => (parte.startsWith("v1,") ? parte.slice(3) : parte))
    .filter(Boolean);

  if (!candidatas.some((candidata) => iguaisEmTempoConstante(candidata, assinatura))) {
    throw new WebhookError("invalid_signature", "Assinatura do webhook não corresponde");
  }
}
