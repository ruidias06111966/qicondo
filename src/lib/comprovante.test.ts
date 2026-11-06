import { describe, expect, it } from "vitest";
import {
  COMPROVANTES_POR_COBRANCA,
  MIMES_COMPROVANTE,
  TAMANHO_MAXIMO_COMPROVANTE,
  escolherCobranca,
  nomeDoComprovante,
  validarMidiaComprovante,
  type CobrancaEmAberto,
} from "./comprovante";

const cob = (id: string, competencia: string, total: number): CobrancaEmAberto => ({
  id,
  competencia,
  vencimento: `${competencia}-10`,
  total,
});

describe("validarMidiaComprovante", () => {
  it("aceita os quatro formatos que o condómino consegue mandar", () => {
    for (const mime of MIMES_COMPROVANTE) {
      const r = validarMidiaComprovante({ mimeType: mime, tamanho: 120_000 });
      expect(r.ok, mime).toBe(true);
    }
  });

  it("aceita o mime com parâmetros, que é como a Meta o manda", () => {
    // A Cloud API entrega `image/jpeg` mas também `audio/ogg; codecs=opus`.
    // Comparar a string inteira rejeitava um JPEG legítimo.
    const r = validarMidiaComprovante({ mimeType: "image/jpeg; charset=binary", tamanho: 1000 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mime).toBe("image/jpeg");
  });

  it("não distingue maiúsculas", () => {
    expect(validarMidiaComprovante({ mimeType: "IMAGE/PNG", tamanho: 1000 }).ok).toBe(true);
  });

  it("recusa áudio, vídeo e o que o navegador executa", () => {
    for (const mime of [
      "audio/ogg",
      "video/mp4",
      "text/html",
      "image/svg+xml",
      "application/zip",
    ]) {
      const r = validarMidiaComprovante({ mimeType: mime, tamanho: 1000 });
      expect(r.ok, mime).toBe(false);
      if (!r.ok) expect(r.motivo).toBe("tipo_nao_aceito");
    }
  });

  it("recusa sem tipo nenhum", () => {
    expect(validarMidiaComprovante({ mimeType: null, tamanho: 1000 }).ok).toBe(false);
    expect(validarMidiaComprovante({}).ok).toBe(false);
  });

  it("recusa ficheiro vazio", () => {
    const r = validarMidiaComprovante({ mimeType: "image/jpeg", tamanho: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("vazio");
  });

  it("aceita exactamente no limite e recusa um byte acima", () => {
    expect(
      validarMidiaComprovante({ mimeType: "application/pdf", tamanho: TAMANHO_MAXIMO_COMPROVANTE })
        .ok,
    ).toBe(true);
    const r = validarMidiaComprovante({
      mimeType: "application/pdf",
      tamanho: TAMANHO_MAXIMO_COMPROVANTE + 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("grande_demais");
  });

  it("toda a recusa traz uma frase para o condómino", () => {
    for (const m of [
      { mimeType: "audio/ogg", tamanho: 1000 },
      { mimeType: "image/jpeg", tamanho: 0 },
      { mimeType: "image/jpeg", tamanho: 50 * 1024 * 1024 },
    ]) {
      const r = validarMidiaComprovante(m);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.mensagem.length).toBeGreaterThan(20);
        // Nada de códigos internos na frente do condómino.
        expect(r.mensagem).not.toMatch(/mime|_|null/i);
      }
    }
  });
});

describe("nomeDoComprovante", () => {
  it("usa a competência, não o nome que veio do telefone", () => {
    expect(nomeDoComprovante("2026-03", "jpg")).toBe("comprovante-2026-03.jpg");
    expect(nomeDoComprovante("2026-03-01", "pdf")).toBe("comprovante-2026-03.pdf");
  });

  it("não inventa competência quando não há", () => {
    expect(nomeDoComprovante(null, "png")).toBe("comprovante-sem-competencia.png");
    expect(nomeDoComprovante("lixo", "png")).toBe("comprovante-sem-competencia.png");
  });
});

describe("escolherCobranca", () => {
  const uma = [cob("c1", "2026-03", 450)];
  const varias = [cob("c1", "2026-02", 400), cob("c2", "2026-03", 450), cob("c3", "2026-04", 400)];

  it("com uma cobrança em aberto não pergunta nada", () => {
    const r = escolherCobranca(uma);
    expect(r.tipo).toBe("uma");
    if (r.tipo === "uma") expect(r.cobranca.id).toBe("c1");
  });

  it("com várias pergunta, em vez de adivinhar", () => {
    // Adivinhar aqui é anexar a prova de Fevereiro à cobrança de Abril, e
    // depois dar baixa na errada.
    const r = escolherCobranca(varias);
    expect(r.tipo).toBe("ambigua");
    if (r.tipo === "ambigua") expect(r.cobrancas).toHaveLength(3);
  });

  it("sem cobranças em aberto diz que não há", () => {
    expect(escolherCobranca([]).tipo).toBe("nenhuma");
  });

  it("o número respondido é base 1, como aparece na mensagem", () => {
    const r = escolherCobranca(varias, "2");
    expect(r.tipo).toBe("uma");
    if (r.tipo === "uma") expect(r.cobranca.id).toBe("c2");
  });

  it("aceita o número com espaços, que é como chega do telefone", () => {
    const r = escolherCobranca(varias, " 3 ");
    if (r.tipo === "uma") expect(r.cobranca.id).toBe("c3");
    else expect.fail("devia ter escolhido a terceira");
  });

  it("recusa número fora da lista e o que não é número", () => {
    for (const bruto of ["0", "4", "-1", "x", "1.5x", "um"]) {
      expect(escolherCobranca(varias, bruto).tipo, bruto).toBe("numero_invalido");
    }
  });

  it("um número respondido com uma só cobrança ainda tem de ser válido", () => {
    // Senão um «2» respondido por engano anexava à única cobrança que havia,
    // e o condómino ficava convencido de que escolheu.
    expect(escolherCobranca(uma, "2").tipo).toBe("numero_invalido");
    expect(escolherCobranca(uma, "1").tipo).toBe("uma");
  });
});

describe("os tectos", () => {
  it("são os mesmos da migração", () => {
    // Se divergirem, o bot aceita o que a base recusa e o condómino recebe um
    // erro em vez de uma explicação.
    expect(COMPROVANTES_POR_COBRANCA).toBe(5);
    expect(TAMANHO_MAXIMO_COMPROVANTE).toBe(5 * 1024 * 1024);
  });
});
