import { describe, expect, it } from "vitest";
import {
  brCodeValido,
  crc16,
  formatarValor,
  montarBrCode,
  normalizarTexto,
  normalizarTxid,
  tlv,
} from "./brcode";

/**
 * As duas primeiras baterias são o que dá confiança ao resto: ancoram o
 * algoritmo em valores que não saíram daqui. O valor `0x29B1` é o de
 * verificação da variante CRC-16/CCITT-FALSE, e os dois payloads são os
 * exemplos do «Manual de Padrões para Iniciação do Pix» v2.10.0, secções
 * 2.6.3 e 2.7.3.
 *
 * Reconstruí estes exemplos de memória à primeira tentativa e o CRC não
 * fechou — a caixa do GUI estava errada, o UUID estava trocado e tinha
 * inventado um campo de valor que o exemplo não tem. Foram extraídos do PDF
 * do BACEN. Ficam aqui literais para que a próxima pessoa não repita a
 * adivinha.
 */
describe("crc16", () => {
  it("dá o valor de verificação da norma para CRC-16/CCITT-FALSE", () => {
    expect(crc16("123456789")).toBe("29B1");
  });

  it("não reflecte nem aplica XOR final (uma cadeia vazia fica no valor inicial)", () => {
    expect(crc16("")).toBe("FFFF");
  });
});

describe("exemplos oficiais do manual do BACEN", () => {
  const ESTATICO =
    "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D";
  const DINAMICO =
    "00020101021226700014br.gov.bcb.pix2548pix.example.com/8b3da2f39a4140d1a91abd93113bd4415204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***630464E4";

  it("reproduz o CRC do exemplo de QR estático", () => {
    expect(crc16(ESTATICO.slice(0, -4))).toBe("1D3D");
  });

  it("reproduz o CRC do exemplo de QR dinâmico", () => {
    expect(crc16(DINAMICO.slice(0, -4))).toBe("64E4");
  });

  it("aceita os dois como válidos", () => {
    expect(brCodeValido(ESTATICO)).toBe(true);
    expect(brCodeValido(DINAMICO)).toBe(true);
  });

  it("recusa-os com um carácter trocado", () => {
    // Um dígito a menos no valor da chave: é o erro que um copiar-e-colar
    // truncado produz, e é o que o CRC existe para apanhar.
    expect(brCodeValido(ESTATICO.replace("0136123e4567", "0136123e4568"))).toBe(false);
  });

  it("monta de novo o exemplo estático, carácter por carácter", () => {
    // Este é o teste mais forte da bateria: parte dos campos e chega ao
    // payload oficial inteiro, CRC incluído. Foi ele que apanhou as
    // maiúsculas que eu tinha posto no normalizador por minha conta — com
    // elas, o CRC dava F012 em vez de 1D3D.
    expect(
      montarBrCode({
        chave: "123e4567-e12b-12d1-a456-426655440000",
        nome: "Fulano de Tal",
        cidade: "BRASILIA",
      }),
    ).toBe(ESTATICO);
  });
});

describe("tlv", () => {
  it("escreve o tamanho em dois dígitos", () => {
    expect(tlv("00", "01")).toBe("000201");
    expect(tlv("59", "ANA")).toBe("5903ANA");
  });

  it("conta caracteres e não bytes", () => {
    // Serve de rede: se algum acento escapar ao normalizador, o tamanho
    // declarado continua a ser o número de caracteres.
    expect(tlv("60", "SAO")).toBe("6003SAO");
  });

  it("recusa um valor acima de 99 caracteres", () => {
    expect(() => tlv("26", "x".repeat(100))).toThrow(/máximo é 99/);
  });
});

describe("normalizarTexto", () => {
  it("tira acentos e preserva a caixa", () => {
    expect(normalizarTexto("Residencial São José", 25)).toBe("Residencial Sao Jose");
  });

  it("corta no limite do campo", () => {
    // 25 caracteres exactos. A conta é do código, não minha: tinha escrito
    // "Residencial Jardim das" à mão e faltavam-lhe três caracteres.
    expect(normalizarTexto("Residencial Jardim das Acacias", 25)).toBe(
      "Residencial Jardim das Ac",
    );
  });

  it("não deixa espaço pendurado quando o corte cai num espaço", () => {
    expect(normalizarTexto("Residencial Jardim das Acacias", 23)).toBe("Residencial Jardim das");
  });

  it("descarta o que não é ASCII imprimível", () => {
    // O travessão é tirado, e o espaço duplo que sobra é colapsado.
    expect(normalizarTexto("Condomínio — Bloco B", 25)).toBe("Condominio Bloco B");
  });

  it("colapsa espaços repetidos", () => {
    expect(normalizarTexto("  Edificio   Central  ", 25)).toBe("Edificio Central");
  });
});

describe("formatarValor", () => {
  it("escreve duas casas decimais com ponto", () => {
    expect(formatarValor(2575)).toBe("25.75");
    expect(formatarValor(45000)).toBe("450.00");
    expect(formatarValor(5)).toBe("0.05");
  });

  it("não usa separador de milhares", () => {
    expect(formatarValor(123456789)).toBe("1234567.89");
  });

  it("recusa centavos fraccionários", () => {
    // É aqui que se apanha um `valor * 100` que deu 45000.000000000007.
    expect(() => formatarValor(45000.0000001)).toThrow(/centavos inteiros/);
  });

  it("recusa zero e valores negativos", () => {
    expect(() => formatarValor(0)).toThrow(/positivo/);
    expect(() => formatarValor(-100)).toThrow(/positivo/);
  });
});

describe("normalizarTxid", () => {
  it("mantém letras e dígitos", () => {
    expect(normalizarTxid("COB2026110001")).toBe("COB2026110001");
  });

  it("retira o que a norma não permite", () => {
    // Um uuid de cobrança tem hífenes, e hífenes não são permitidos no
    // campo 62-05 (secção 2.6.2 do manual).
    // 32 caracteres sem os hífenes, cortados nos 25 que a norma permite.
    expect(normalizarTxid("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(
      "a1b2c3d4e5f67890abcdef123",
    );
  });

  it("corta em 25 caracteres", () => {
    expect(normalizarTxid("x".repeat(40))).toHaveLength(25);
  });

  it("escreve *** quando não há identificador", () => {
    expect(normalizarTxid("")).toBe("***");
    expect(normalizarTxid("---")).toBe("***");
  });
});

describe("montarBrCode", () => {
  const base = {
    chave: "12345678901",
    nome: "Residencial Modelo",
    cidade: "Brasilia",
  };

  it("gera um payload que valida pelo próprio CRC", () => {
    expect(brCodeValido(montarBrCode({ ...base, centavos: 45000 }))).toBe(true);
  });

  it("inclui o valor quando ele é dado", () => {
    expect(montarBrCode({ ...base, centavos: 45000 })).toContain("5406450.00");
  });

  it("omite o campo do valor quando ele não é dado", () => {
    const payload = montarBrCode(base);
    // Depois da moeda (5303986) segue logo o país (5802BR).
    expect(payload).toContain("53039865802BR");
  });

  it("escreve o GUI em minúsculas, como o manual", () => {
    expect(montarBrCode(base)).toContain("0014br.gov.bcb.pix");
  });

  it("leva o txid para conciliação futura", () => {
    expect(montarBrCode({ ...base, txid: "COB123" })).toContain("62100506COB123");
  });

  it("recusa uma chave vazia", () => {
    expect(() => montarBrCode({ ...base, chave: "   " })).toThrow(/chave Pix é obrigatória/);
  });

  it("recusa um nome que desaparece na normalização", () => {
    // Um nome só com emoji não sobrevive ao filtro de ASCII, e um campo 59
    // vazio produz um QR que o banco recusa.
    expect(() => montarBrCode({ ...base, nome: "🏢" })).toThrow(/nome do recebedor/);
  });

  it("recusa informação adicional que estoure o template da conta", () => {
    expect(() =>
      montarBrCode({
        ...base,
        chave: "chave-aleatoria-com-36-caracteres-ab",
        infoAdicional: "x".repeat(72),
      }),
    ).toThrow(/conta do recebedor ocupa/);
  });

  it("aceita uma chave aleatória de 36 caracteres com o resto nos limites", () => {
    const payload = montarBrCode({
      chave: "123e4567-e12b-12d1-a456-426655440000",
      nome: "Residencial Jardim das Acacias",
      cidade: "Sao Jose dos Campos",
      centavos: 123456,
      txid: "COB20261106000001",
    });
    expect(brCodeValido(payload)).toBe(true);
    expect(payload).toContain("5925Residencial Jardim das Ac");
    expect(payload).toContain("6015Sao Jose dos Ca");
  });
});

describe("brCodeValido", () => {
  it("recusa uma cadeia curta", () => {
    expect(brCodeValido("")).toBe(false);
    expect(brCodeValido("6304")).toBe(false);
  });

  it("recusa um payload sem o identificador do CRC no lugar certo", () => {
    expect(brCodeValido("0002011D3D")).toBe(false);
  });

  it("aceita o CRC em minúsculas", () => {
    const payload = montarBrCode({ chave: "12345678901", nome: "Teste", cidade: "Brasilia" });
    expect(brCodeValido(payload.slice(0, -4) + payload.slice(-4).toLowerCase())).toBe(true);
  });
});
