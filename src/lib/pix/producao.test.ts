import { describe, expect, it } from "vitest";
import { brCodeValido, montarBrCode } from "./brcode";

// Linhas que a `pix_da_cobranca` devolveu em produção, copiadas tal e qual.
const REAIS = [
  { recebedor: "Residencial Modelo", cidade: "Brasília", centavos: 46739, txid: "8e13a4dd1e044fb4b08ccaf99", chave: "12345678000199" },
  { recebedor: "Residencial Modelo", cidade: "Brasília", centavos: 53490, txid: "e8dc986eae5a4922a9400eef8", chave: "12345678000199" },
  { recebedor: "Residencial Modelo", cidade: "Brasília", centavos: 88588, txid: "58d7678275ec4924999d73c57", chave: "12345678000199" },
];

describe("cadeia completa com dados de produção", () => {
  for (const r of REAIS) {
    it(`gera um BR Code válido para ${(r.centavos / 100).toFixed(2)}`, () => {
      const payload = montarBrCode({
        chave: r.chave,
        nome: r.recebedor,
        cidade: r.cidade,
        centavos: r.centavos,
        txid: r.txid,
      });
      expect(brCodeValido(payload)).toBe(true);
      // O acento de "Brasília" tem de sair, senão o campo 60 declara 8
      // caracteres e entrega 9 bytes.
      expect(payload).toContain("6008Brasilia");
      expect(payload).toContain(`5406${(r.centavos / 100).toFixed(2)}`);
      expect(payload).toContain(`0525${r.txid}`);
      console.log(`  ${(r.centavos / 100).toFixed(2)} -> ${payload}`);
    });
  }
});
