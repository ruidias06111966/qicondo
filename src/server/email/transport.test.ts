import { afterEach, describe, expect, it, vi } from "vitest";
import { EmailTransportError, enviarEmail } from "./transport";

const PAYLOAD = {
  to: "morador@example.test",
  from: "QiCond <noreply@example.test>",
  subject: "Assunto",
  html: "<p>corpo</p>",
  text: "corpo",
  message_id: "11111111-2222-3333-4444-555555555555",
};

const OPCOES = { apiKey: "re_teste", endpoint: "https://api.exemplo.test/emails" };

function respostaFalsa(corpo: unknown, init?: ResponseInit) {
  return new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), init);
}

/** Devolve o mock instalado em globalThis.fetch. */
function mockarFetch(resposta: Response | Error) {
  const mock = vi.fn((_url: string, _init: RequestInit) =>
    resposta instanceof Error ? Promise.reject(resposta) : Promise.resolve(resposta),
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

/** Lê os argumentos da chamada a fetch, falhando o teste se não tiver ocorrido. */
function chamada(mock: ReturnType<typeof mockarFetch>) {
  const args = mock.mock.calls[0];
  if (!args) throw new Error("fetch não foi chamado");
  return { url: args[0], init: args[1] };
}

async function capturarErro(promessa: Promise<unknown>): Promise<EmailTransportError> {
  try {
    await promessa;
    throw new Error("esperava-se um erro");
  } catch (erro) {
    if (!(erro instanceof EmailTransportError)) throw erro;
    return erro;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("enviarEmail", () => {
  it("devolve o id atribuído pelo fornecedor", async () => {
    mockarFetch(respostaFalsa({ id: "email_123" }, { status: 200 }));

    await expect(enviarEmail(PAYLOAD, OPCOES)).resolves.toBe("email_123");
  });

  it("envia a chave de idempotência a partir do message_id", async () => {
    // Sem esta chave, um visibility timeout que expire a meio de um envio faz o
    // destinatário receber a mesma mensagem duas vezes.
    const fetchMock = mockarFetch(respostaFalsa({ id: "email_123" }, { status: 200 }));

    await enviarEmail(PAYLOAD, OPCOES);

    const cabecalhos = chamada(fetchMock).init.headers as Record<string, string>;
    expect(cabecalhos["Idempotency-Key"]).toBe(PAYLOAD.message_id);
  });

  it("dá precedência a idempotency_key sobre message_id", async () => {
    const fetchMock = mockarFetch(respostaFalsa({ id: "email_123" }, { status: 200 }));

    await enviarEmail({ ...PAYLOAD, idempotency_key: "chave-propria" }, OPCOES);

    const cabecalhos = chamada(fetchMock).init.headers as Record<string, string>;
    expect(cabecalhos["Idempotency-Key"]).toBe("chave-propria");
  });

  it("classifica um 429 e lê o Retry-After em segundos", async () => {
    // O processador da fila lê estes dois campos para decidir quanto tempo espera.
    mockarFetch(
      respostaFalsa(
        { message: "Too many requests" },
        { status: 429, headers: { "retry-after": "42" } },
      ),
    );

    const erro = await capturarErro(enviarEmail(PAYLOAD, OPCOES));
    expect(erro.status).toBe(429);
    expect(erro.retryAfterSeconds).toBe(42);
  });

  it("recorre ao ratelimit-reset quando não há Retry-After", async () => {
    mockarFetch(
      respostaFalsa(
        { message: "slow down" },
        {
          status: 429,
          headers: { "ratelimit-reset": "7" },
        },
      ),
    );

    expect((await capturarErro(enviarEmail(PAYLOAD, OPCOES))).retryAfterSeconds).toBe(7);
  });

  it("classifica um 403 para que a mensagem siga para o DLQ", async () => {
    mockarFetch(respostaFalsa({ message: "domain not verified" }, { status: 403 }));

    const erro = await capturarErro(enviarEmail(PAYLOAD, OPCOES));
    expect(erro.status).toBe(403);
    expect(erro.message).toBe("domain not verified");
  });

  it("trata uma falha de rede como transitória", async () => {
    // Status 0 não é 403 nem 429, logo o processador retenta em vez de descartar.
    mockarFetch(new TypeError("connection reset"));

    expect((await capturarErro(enviarEmail(PAYLOAD, OPCOES))).status).toBe(0);
  });

  it("lida com um corpo de erro que não é JSON", async () => {
    mockarFetch(respostaFalsa("<html>502 Bad Gateway</html>", { status: 502 }));

    const erro = await capturarErro(enviarEmail(PAYLOAD, OPCOES));
    expect(erro.status).toBe(502);
    expect(erro.message).toContain("502 Bad Gateway");
  });

  it("falha de imediato sem chave de API", async () => {
    const fetchMock = mockarFetch(respostaFalsa({ id: "x" }, { status: 200 }));

    const erro = await capturarErro(enviarEmail(PAYLOAD, { apiKey: "" }));
    expect(erro.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("acrescenta os cabeçalhos de cancelamento de subscrição quando há token", async () => {
    const fetchMock = mockarFetch(respostaFalsa({ id: "email_123" }, { status: 200 }));

    await enviarEmail(
      { ...PAYLOAD, unsubscribe_token: "tok_123" },
      { ...OPCOES, siteUrl: "https://app.example.test/" },
    );

    const corpo = JSON.parse(chamada(fetchMock).init.body as string);
    expect(corpo.headers["List-Unsubscribe"]).toBe(
      "<https://app.example.test/api/public/unsubscribe?token=tok_123>",
    );
    expect(corpo.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("omite os cabeçalhos de cancelamento quando não há token", async () => {
    const fetchMock = mockarFetch(respostaFalsa({ id: "email_123" }, { status: 200 }));

    await enviarEmail(PAYLOAD, OPCOES);

    expect(JSON.parse(chamada(fetchMock).init.body as string).headers).toBeUndefined();
  });
});
