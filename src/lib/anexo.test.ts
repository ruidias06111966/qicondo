import { describe, expect, it } from "vitest";
import { caminhoDoAnexo, extensaoSegura } from "./anexo";

const COND = "aaaaaaaa-0000-0000-0000-000000000001";
const DESP = "eeeeeeee-0000-0000-0000-00000000000a";
const fixo = () => "11111111-2222-3333-4444-555555555555";

describe("extensaoSegura", () => {
  it("devolve a última extensão em minúsculas", () => {
    expect(extensaoSegura("Nota Fiscal.PDF")).toBe("pdf");
    expect(extensaoSegura("recibo.tar.gz")).toBe("gz");
  });

  it("limpa o que não é letra nem dígito", () => {
    // Sem isto, um `../` ou um `?` vindos do nome do ficheiro iam para o
    // caminho do Storage.
    expect(extensaoSegura("nota.p df")).toBe("pdf");
    expect(extensaoSegura("nota.jpg?x=1")).toBe("jpgx1");
  });

  it("cai em bin quando não há extensão utilizável", () => {
    expect(extensaoSegura("semextensao")).toBe("bin");
    expect(extensaoSegura("ficheiro.")).toBe("bin");
    expect(extensaoSegura("ficheiro.___")).toBe("bin");
    expect(extensaoSegura("")).toBe("bin");
  });

  it("corta extensões absurdamente longas", () => {
    expect(extensaoSegura(`a.${"x".repeat(40)}`)).toHaveLength(8);
  });
});

describe("caminhoDoAnexo", () => {
  it("começa sempre pelo id do condomínio", () => {
    // É o primeiro segmento que as políticas do bucket leem. Se mudar, o
    // upload passa a ser recusado para todos os condomínios.
    const caminho = caminhoDoAnexo(COND, "despesa", DESP, "nf.pdf", fixo);
    expect(caminho.split("/")[0]).toBe(COND);
  });

  it("segue o layout condomínio/entidade/lançamento/ficheiro", () => {
    expect(caminhoDoAnexo(COND, "despesa", DESP, "nf.pdf", fixo)).toBe(
      `${COND}/despesa/${DESP}/11111111-2222-3333-4444-555555555555.pdf`,
    );
  });

  it("não deixa o nome do ficheiro entrar no caminho", () => {
    // Um nome com acentos, espaços ou travessias de directório não pode
    // chegar ao Storage — e dois ficheiros com o mesmo nome não colidem.
    const caminho = caminhoDoAnexo(COND, "despesa", DESP, "../Nota de Água (2ª via).pdf", fixo);
    expect(caminho).not.toContain("..");
    expect(caminho).not.toContain(" ");
    expect(caminho).toBe(`${COND}/despesa/${DESP}/11111111-2222-3333-4444-555555555555.pdf`);
  });

  it("dá caminhos diferentes para o mesmo ficheiro", () => {
    const a = caminhoDoAnexo(COND, "despesa", DESP, "nf.pdf");
    const b = caminhoDoAnexo(COND, "despesa", DESP, "nf.pdf");
    expect(a).not.toBe(b);
  });
});
