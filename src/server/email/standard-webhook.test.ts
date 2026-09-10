import { describe, expect, it } from "vitest";
import { WebhookError, verificarAssinatura } from "./standard-webhook";

const SEGREDO_BRUTO = "chave-de-teste-com-32-bytes!!!!!";
const SEGREDO = `v1,whsec_${btoa(SEGREDO_BRUTO)}`;
const CORPO = JSON.stringify({ user: { email: "a@b.test" } });
const ID = "msg_abc123";

/** Assina como o Supabase assina, para os testes não dependerem da implementação. */
async function assinar(id: string, timestamp: string, corpo: string, segredo = SEGREDO_BRUTO) {
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = await crypto.subtle.sign(
    "HMAC",
    chave,
    new TextEncoder().encode(`${id}.${timestamp}.${corpo}`),
  );
  return btoa(String.fromCharCode(...new Uint8Array(assinatura)));
}

async function cabecalhos(opcoes?: {
  id?: string;
  timestamp?: string;
  assinatura?: string;
  corpo?: string;
}) {
  const id = opcoes?.id ?? ID;
  const timestamp = opcoes?.timestamp ?? String(Math.floor(Date.now() / 1000));
  const corpo = opcoes?.corpo ?? CORPO;
  const assinatura = opcoes?.assinatura ?? `v1,${await assinar(id, timestamp, corpo)}`;

  return new Headers({
    "webhook-id": id,
    "webhook-timestamp": timestamp,
    "webhook-signature": assinatura,
  });
}

async function codigoDoErro(promessa: Promise<unknown>): Promise<string> {
  try {
    await promessa;
    return "sem-erro";
  } catch (erro) {
    return erro instanceof WebhookError ? erro.code : "erro-inesperado";
  }
}

describe("verificarAssinatura", () => {
  it("aceita um pedido assinado corretamente", async () => {
    await expect(
      verificarAssinatura({ headers: await cabecalhos(), body: CORPO, secret: SEGREDO }),
    ).resolves.toBeUndefined();
  });

  it("aceita o segredo sem os prefixos v1 e whsec_", async () => {
    await expect(
      verificarAssinatura({
        headers: await cabecalhos(),
        body: CORPO,
        secret: btoa(SEGREDO_BRUTO),
      }),
    ).resolves.toBeUndefined();
  });

  it("rejeita uma assinatura produzida com outro segredo", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const assinatura = `v1,${await assinar(ID, timestamp, CORPO, "outro-segredo-qualquer!!!!!!!!!!")}`;

    expect(
      await codigoDoErro(
        verificarAssinatura({
          headers: await cabecalhos({ timestamp, assinatura }),
          body: CORPO,
          secret: SEGREDO,
        }),
      ),
    ).toBe("invalid_signature");
  });

  it("rejeita quando o corpo é alterado após a assinatura", async () => {
    // O caso que a verificação existe para apanhar: um corpo adulterado em
    // trânsito continua a trazer a assinatura original.
    expect(
      await codigoDoErro(
        verificarAssinatura({
          headers: await cabecalhos(),
          body: JSON.stringify({ user: { email: "atacante@b.test" } }),
          secret: SEGREDO,
        }),
      ),
    ).toBe("invalid_signature");
  });

  it("rejeita um carimbo temporal fora da janela de tolerância", async () => {
    const antigo = String(Math.floor(Date.now() / 1000) - 60 * 60);

    expect(
      await codigoDoErro(
        verificarAssinatura({
          headers: await cabecalhos({ timestamp: antigo }),
          body: CORPO,
          secret: SEGREDO,
        }),
      ),
    ).toBe("stale_timestamp");
  });

  it("rejeita um carimbo temporal no futuro distante", async () => {
    const futuro = String(Math.floor(Date.now() / 1000) + 60 * 60);

    expect(
      await codigoDoErro(
        verificarAssinatura({
          headers: await cabecalhos({ timestamp: futuro }),
          body: CORPO,
          secret: SEGREDO,
        }),
      ),
    ).toBe("stale_timestamp");
  });

  it("aceita uma pequena diferença de relógio", async () => {
    const desfasado = String(Math.floor(Date.now() / 1000) - 30);

    await expect(
      verificarAssinatura({
        headers: await cabecalhos({ timestamp: desfasado }),
        body: CORPO,
        secret: SEGREDO,
      }),
    ).resolves.toBeUndefined();
  });

  it("exige os cabeçalhos obrigatórios", async () => {
    const semAssinatura = new Headers({ "webhook-id": ID, "webhook-timestamp": "1" });
    expect(
      await codigoDoErro(
        verificarAssinatura({ headers: semAssinatura, body: CORPO, secret: SEGREDO }),
      ),
    ).toBe("missing_headers");

    const semTimestamp = new Headers({ "webhook-id": ID, "webhook-signature": "v1,x" });
    expect(
      await codigoDoErro(
        verificarAssinatura({ headers: semTimestamp, body: CORPO, secret: SEGREDO }),
      ),
    ).toBe("missing_timestamp");
  });

  it("rejeita um carimbo temporal não numérico", async () => {
    expect(
      await codigoDoErro(
        verificarAssinatura({
          headers: await cabecalhos({ timestamp: "ontem" }),
          body: CORPO,
          secret: SEGREDO,
        }),
      ),
    ).toBe("invalid_timestamp");
  });

  it("aceita quando uma de várias assinaturas corresponde", async () => {
    // É assim que uma rotação de segredo se comporta: o emissor envia as duas.
    const timestamp = String(Math.floor(Date.now() / 1000));
    const valida = await assinar(ID, timestamp, CORPO);

    await expect(
      verificarAssinatura({
        headers: await cabecalhos({ timestamp, assinatura: `v1,assinatura-antiga v1,${valida}` }),
        body: CORPO,
        secret: SEGREDO,
      }),
    ).resolves.toBeUndefined();
  });

  it("sinaliza um segredo mal formado em vez de o tratar como assinatura inválida", async () => {
    expect(
      await codigoDoErro(
        verificarAssinatura({ headers: await cabecalhos(), body: CORPO, secret: "não-é-base64!!" }),
      ),
    ).toBe("invalid_secret");
  });
});
