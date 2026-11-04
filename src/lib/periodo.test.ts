import { describe, expect, it } from "vitest";
import { dataBR, limitesDoMes, mesAnterior, paraInputLocal, rotuloPeriodo } from "./periodo";

describe("dataBR", () => {
  it("não desliza um dia em fusos negativos", () => {
    // `new Date("2026-03-01").getDate()` daria 28 de Fevereiro em Brasília.
    expect(dataBR("2026-03-01")).toBe("01/03/2026");
  });

  it("aceita um timestamp e usa só a data", () => {
    expect(dataBR("2026-03-01T23:30:00Z")).toBe("01/03/2026");
  });
});

describe("mesAnterior", () => {
  it("devolve o mês anterior", () => {
    expect(mesAnterior(new Date("2026-11-04T12:00:00Z"))).toBe("2026-10");
  });

  it("atravessa a viragem do ano", () => {
    expect(mesAnterior(new Date("2026-01-15T12:00:00Z"))).toBe("2025-12");
  });

  it("funciona no primeiro dia do mês", () => {
    expect(mesAnterior(new Date("2026-03-01T01:00:00Z"))).toBe("2026-02");
  });
});

describe("limitesDoMes", () => {
  it("meses de 31 dias", () => {
    expect(limitesDoMes("2026-01")).toEqual({ inicio: "2026-01-01", fim: "2026-01-31" });
  });

  it("meses de 30 dias", () => {
    expect(limitesDoMes("2026-04")).toEqual({ inicio: "2026-04-01", fim: "2026-04-30" });
  });

  it("Fevereiro em ano comum", () => {
    expect(limitesDoMes("2026-02")).toEqual({ inicio: "2026-02-01", fim: "2026-02-28" });
  });

  it("Fevereiro em ano bissexto", () => {
    expect(limitesDoMes("2028-02")).toEqual({ inicio: "2028-02-01", fim: "2028-02-29" });
  });

  it("Dezembro", () => {
    expect(limitesDoMes("2026-12")).toEqual({ inicio: "2026-12-01", fim: "2026-12-31" });
  });
});

describe("rotuloPeriodo", () => {
  it("um mês civil completo diz-se pelo nome", () => {
    expect(rotuloPeriodo("2026-03-01", "2026-03-31")).toBe("março de 2026");
    expect(rotuloPeriodo("2028-02-01", "2028-02-29")).toBe("fevereiro de 2028");
  });

  it("um mês a que falta um dia mostra as datas", () => {
    expect(rotuloPeriodo("2026-03-01", "2026-03-30")).toBe("01/03/2026 a 30/03/2026");
  });

  it("um intervalo que atravessa meses mostra as datas", () => {
    expect(rotuloPeriodo("2026-01-01", "2026-12-31")).toBe("01/01/2026 a 31/12/2026");
  });

  it("não confunde Fevereiro de ano comum com bissexto", () => {
    // 28 de Fevereiro de 2028 não é o fim do mês.
    expect(rotuloPeriodo("2028-02-01", "2028-02-28")).toBe("01/02/2028 a 28/02/2028");
  });
});

describe("paraInputLocal", () => {
  it("mantém a hora local, não a de UTC", () => {
    // Testado por ida e volta para valer em qualquer fuso: o que o input
    // mostra tem de ser a mesma hora local da data de origem.
    const d = new Date(2026, 10, 4, 19, 30);
    const texto = paraInputLocal(d);
    const volta = new Date(texto);
    expect(volta.getHours()).toBe(19);
    expect(volta.getMinutes()).toBe(30);
    expect(volta.getDate()).toBe(4);
  });

  it("preenche com zeros à esquerda", () => {
    expect(paraInputLocal(new Date(2026, 0, 5, 9, 7))).toBe("2026-01-05T09:07");
  });

  it("não desliza o dia à meia-noite", () => {
    expect(paraInputLocal(new Date(2026, 2, 1, 0, 0))).toBe("2026-03-01T00:00");
  });
});
