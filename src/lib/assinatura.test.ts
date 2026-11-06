import { describe, expect, it } from "vitest";
import { TOLERANCIA_DIAS, avaliarAssinatura, type AssinaturaEspelhada } from "./assinatura";

const AGORA = new Date("2026-11-06T12:00:00Z");
const haDias = (d: number) => new Date(AGORA.getTime() - d * 86_400_000).toISOString();

const base: AssinaturaEspelhada = {
  assinatura_status: "ativa",
  assinatura_conhecida: true,
  assinatura_sincronizada_em: haDias(0),
  assinatura_fatura: null,
};

describe("o que NÃO bloqueia", () => {
  it("uma assinatura ativa", () => {
    expect(avaliarAssinatura(base, AGORA).bloqueado).toBe(false);
  });

  it("nunca sincronizado — silêncio não é dívida", () => {
    // É o estado de toda a base no dia em que isto entra, e de qualquer
    // instalação cuja variável de ambiente ainda não foi preenchida. Bloquear
    // aqui trancaria todos os clientes de uma vez.
    const v = avaliarAssinatura({ ...base, assinatura_sincronizada_em: null }, AGORA);
    expect(v.bloqueado).toBe(false);
    expect(v.motivo).toBe("nunca_sincronizado");
  });

  it("instalação que o QiGestão não conhece", () => {
    const v = avaliarAssinatura(
      { ...base, assinatura_conhecida: false, assinatura_status: null },
      AGORA,
    );
    expect(v.bloqueado).toBe(false);
    expect(v.motivo).toBe("instalacao_desconhecida");
  });

  it("pausada e teste", () => {
    // `pausada` é parar de cobrar sem tirar o acesso; `teste` é quem está a
    // experimentar. Nenhum dos dois é dívida.
    for (const estado of ["pausada", "teste"]) {
      expect(avaliarAssinatura({ ...base, assinatura_status: estado }, AGORA).bloqueado).toBe(
        false,
      );
    }
  });

  it("um estado que o QiGestão venha a inventar", () => {
    // Perante vocabulário novo, o QiCond não adivinha — e não tranca ninguém
    // por causa de uma palavra que não conhece.
    const v = avaliarAssinatura({ ...base, assinatura_status: "em_negociacao" }, AGORA);
    expect(v.bloqueado).toBe(false);
    expect(v.motivo).toBe("estado_nao_bloqueia");
  });

  it("um bloqueio velho de mais para ser de confiança", () => {
    // O caso que justifica a tolerância: o condomínio pode já ter pago e o
    // QiCond não teve como saber.
    const v = avaliarAssinatura(
      { ...base, assinatura_status: "inadimplente", assinatura_sincronizada_em: haDias(8) },
      AGORA,
    );
    expect(v.bloqueado).toBe(false);
    expect(v.motivo).toBe("bloqueio_expirado");
    expect(v.diasDesdeSincronizacao).toBe(8);
  });

  it("uma data impossível de ler", () => {
    const v = avaliarAssinatura({ ...base, assinatura_sincronizada_em: "nem data é" }, AGORA);
    expect(v.bloqueado).toBe(false);
    expect(v.motivo).toBe("nunca_sincronizado");
  });
});

describe("o que bloqueia", () => {
  it("inadimplente, confirmado hoje", () => {
    const v = avaliarAssinatura({ ...base, assinatura_status: "inadimplente" }, AGORA);
    expect(v.bloqueado).toBe(true);
    expect(v.motivo).toBe("inadimplente");
  });

  it("cancelada, confirmado hoje", () => {
    const v = avaliarAssinatura({ ...base, assinatura_status: "cancelada" }, AGORA);
    expect(v.bloqueado).toBe(true);
    expect(v.motivo).toBe("cancelada");
  });

  it("no último dia da tolerância, mas não no seguinte", () => {
    const comIdade = (d: number) =>
      avaliarAssinatura(
        { ...base, assinatura_status: "inadimplente", assinatura_sincronizada_em: haDias(d) },
        AGORA,
      ).bloqueado;
    expect(comIdade(TOLERANCIA_DIAS)).toBe(true);
    expect(comIdade(TOLERANCIA_DIAS + 1)).toBe(false);
  });
});
