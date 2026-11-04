import { describe, expect, it } from "vitest";
import { diasAtraso, hojeSP } from "./atraso";

describe("hojeSP", () => {
  it("usa o dia civil de São Paulo, não o de UTC", () => {
    // 02:00 UTC do dia 5 ainda é o dia 4 em Brasília (UTC-3).
    expect(hojeSP(new Date("2026-10-05T02:00:00Z"))).toBe("2026-10-04");
    // 12:00 UTC já é o mesmo dia nos dois fusos.
    expect(hojeSP(new Date("2026-10-05T12:00:00Z"))).toBe("2026-10-05");
  });
});

describe("diasAtraso", () => {
  it("dá zero no dia do vencimento", () => {
    expect(diasAtraso("2026-10-05", new Date("2026-10-05T12:00:00Z"))).toBe(0);
  });

  it("não conta o dia que ainda não virou em Brasília", () => {
    // 01:00 UTC do dia 6 são as 22h do dia 5 em Brasília: zero dias, não um.
    expect(diasAtraso("2026-10-05", new Date("2026-10-06T01:00:00Z"))).toBe(0);
  });

  it("conta dias corridos", () => {
    expect(diasAtraso("2026-10-05", new Date("2026-11-04T12:00:00Z"))).toBe(30);
  });

  it("é negativo antes do vencimento", () => {
    expect(diasAtraso("2026-12-10", new Date("2026-11-04T12:00:00Z"))).toBe(-36);
  });

  it("atravessa o horário de verão do hemisfério norte sem perder um dia", () => {
    // O Brasil não tem horário de verão desde 2019; o cálculo não deve ser
    // afectado pela mudança de relógio noutros fusos.
    expect(diasAtraso("2026-03-01", new Date("2026-03-31T12:00:00Z"))).toBe(30);
    expect(diasAtraso("2026-10-15", new Date("2026-11-15T12:00:00Z"))).toBe(31);
  });
});
