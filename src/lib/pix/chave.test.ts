import { describe, expect, it } from "vitest";
import { erroDaChave, normalizarChave, type TipoChavePix } from "./chave";

describe("normalizarChave", () => {
  it("tira a pontuação do CPF e do CNPJ", () => {
    expect(normalizarChave("cpf", "123.456.789-01")).toBe("12345678901");
    expect(normalizarChave("cnpj", "12.345.678/0001-99")).toBe("12345678000199");
  });

  it("põe o +55 no telefone escrito à brasileira", () => {
    expect(normalizarChave("telefone", "(61) 99999-8888")).toBe("+5561999998888");
    expect(normalizarChave("telefone", "61 3333-4444")).toBe("+556133334444");
  });

  it("não duplica o 55 de um número que já o traz", () => {
    expect(normalizarChave("telefone", "+55 61 99999-8888")).toBe("+5561999998888");
    expect(normalizarChave("telefone", "5561999998888")).toBe("+5561999998888");
  });

  it("deixa em paz um DDD que começa por 55", () => {
    // Campinas é o 19, mas há DDD 55 (Santa Maria, RS). Um número de lá tem
    // onze dígitos com o DDD — cortar o "55" da frente tiraria o próprio DDD.
    expect(normalizarChave("telefone", "(55) 99999-8888")).toBe("+5555999998888");
  });

  it("passa o e-mail e a chave aleatória a minúsculas", () => {
    expect(normalizarChave("email", " Sindico@Condominio.COM.BR ")).toBe(
      "sindico@condominio.com.br",
    );
    expect(normalizarChave("aleatoria", "123E4567-E12B-12D1-A456-426655440000")).toBe(
      "123e4567-e12b-12d1-a456-426655440000",
    );
  });
});

describe("erroDaChave", () => {
  const bons: Array<[TipoChavePix, string]> = [
    ["cpf", "12345678901"],
    ["cnpj", "12345678000199"],
    ["telefone", "+5561999998888"],
    ["telefone", "+556133334444"],
    ["email", "sindico@condominio.com.br"],
    ["aleatoria", "123e4567-e12b-12d1-a456-426655440000"],
  ];
  for (const [tipo, chave] of bons) {
    it(`aceita ${tipo} ${chave}`, () => {
      expect(erroDaChave(tipo, chave)).toBeNull();
    });
  }

  it("conta os dígitos que faltam no CPF", () => {
    expect(erroDaChave("cpf", "123456789")).toMatch(/11 dígitos; este tem 9/);
  });

  it("recusa a chave vazia", () => {
    expect(erroDaChave("cpf", "")).toMatch(/Informe a chave/);
  });

  it("recusa uma chave que não cabe no QR Code", () => {
    expect(erroDaChave("email", `${"x".repeat(70)}@exemplo.com`)).toMatch(/demasiado longa/);
  });

  it("recusa a chave aleatória em maiúsculas, como o banco", () => {
    // Espelha a restrição `condominios_chave_pix_forma`, que só aceita
    // hexadecimal minúsculo. O `normalizarChave` resolve-o antes de chegar
    // aqui; este teste garante que as duas camadas não divergem.
    expect(erroDaChave("aleatoria", "123E4567-E12B-12D1-A456-426655440000")).not.toBeNull();
  });
});
