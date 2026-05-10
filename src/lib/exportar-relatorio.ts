import { brl, dateBR, competenciaBR } from "./format";

type Relatorio = {
  condominio: { nome?: string | null; cnpj?: string | null } | null;
  mes: string;
  cobrancas: any[];
  pagamentos: any[];
  despesas: any[];
};

function csvEscape(v: any): string {
  const s = v == null ? "" : String(v);
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCSV(headers: string[], rows: (string | number | null | undefined)[][]) {
  const lines = [headers.join(";")];
  for (const r of rows) lines.push(r.map(csvEscape).join(";"));
  return lines.join("\n");
}

function unidadeLabel(u: any) {
  if (!u) return "—";
  return `${u.bloco ? u.bloco + "-" : ""}${u.numero}`;
}

export function gerarCSV(rel: Relatorio): string {
  const partes: string[] = [];
  partes.push(`Relatório Financeiro;${rel.condominio?.nome ?? ""};${competenciaBR(rel.mes + "-01")}`);
  partes.push("");

  partes.push("== COBRANÇAS ==");
  partes.push(
    rowsToCSV(
      ["Competência", "Vencimento", "Unidade", "Categoria", "Descrição", "Valor", "Pago", "Multa", "Juros", "Desconto", "Status"],
      rel.cobrancas.map((c) => [
        competenciaBR(c.competencia),
        dateBR(c.vencimento),
        unidadeLabel(c.unidades),
        c.categorias_financeiras?.nome ?? "",
        c.descricao ?? "",
        Number(c.valor).toFixed(2),
        Number(c.valor_pago).toFixed(2),
        Number(c.multa).toFixed(2),
        Number(c.juros).toFixed(2),
        Number(c.desconto).toFixed(2),
        c.status,
      ]),
    ),
  );
  partes.push("");

  partes.push("== PAGAMENTOS ==");
  partes.push(
    rowsToCSV(
      ["Data", "Unidade", "Forma", "Valor"],
      rel.pagamentos.map((p) => [
        dateBR(p.pago_em),
        unidadeLabel(p.cobrancas?.unidades),
        p.forma,
        Number(p.valor).toFixed(2),
      ]),
    ),
  );
  partes.push("");

  partes.push("== DESPESAS ==");
  partes.push(
    rowsToCSV(
      ["Data", "Descrição", "Categoria", "Fornecedor", "Forma", "Valor"],
      rel.despesas.map((d) => [
        dateBR(d.data),
        d.descricao,
        d.categorias_financeiras?.nome ?? "",
        d.fornecedor ?? "",
        d.forma ?? "",
        Number(d.valor).toFixed(2),
      ]),
    ),
  );

  return "\uFEFF" + partes.join("\n");
}

export function baixarCSV(rel: Relatorio) {
  const csv = gerarCSV(rel);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio-${rel.condominio?.nome?.replace(/\W+/g, "_") ?? "condominio"}-${rel.mes}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function gerarHTML(rel: Relatorio): string {
  const totalCob = rel.cobrancas.reduce(
    (s, c) => s + Number(c.valor) + Number(c.multa) - Number(c.desconto),
    0,
  );
  const totalPag = rel.pagamentos.reduce((s, p) => s + Number(p.valor), 0);
  const totalDesp = rel.despesas.reduce((s, d) => s + Number(d.valor), 0);

  const styles = `
    *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    body{margin:24px;color:#111;font-size:12px}
    h1{font-size:20px;margin:0 0 4px}
    h2{font-size:14px;margin:24px 0 8px;border-bottom:2px solid #111;padding-bottom:4px}
    .meta{color:#555;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;margin-bottom:8px}
    th,td{padding:6px 8px;text-align:left;border-bottom:1px solid #ddd;font-size:11px}
    th{background:#f5f5f5;text-transform:uppercase;font-size:10px;letter-spacing:.5px}
    .num{text-align:right;font-variant-numeric:tabular-nums}
    .totais{display:flex;gap:16px;margin:12px 0}
    .totais div{flex:1;border:1px solid #ddd;padding:10px;border-radius:6px}
    .totais p{margin:0;font-size:10px;color:#555;text-transform:uppercase}
    .totais strong{font-size:16px}
    @media print{ body{margin:12mm} button{display:none} }
  `;

  const tCobs = rel.cobrancas
    .map(
      (c) => `<tr>
      <td>${competenciaBR(c.competencia)}</td>
      <td>${dateBR(c.vencimento)}</td>
      <td>${unidadeLabel(c.unidades)}</td>
      <td>${c.categorias_financeiras?.nome ?? "—"}</td>
      <td class="num">${brl(c.valor)}</td>
      <td class="num">${brl(c.valor_pago)}</td>
      <td>${c.status}</td>
    </tr>`,
    )
    .join("");

  const tPags = rel.pagamentos
    .map(
      (p) => `<tr>
      <td>${dateBR(p.pago_em)}</td>
      <td>${unidadeLabel(p.cobrancas?.unidades)}</td>
      <td>${p.forma}</td>
      <td class="num">${brl(p.valor)}</td>
    </tr>`,
    )
    .join("");

  const tDesps = rel.despesas
    .map(
      (d) => `<tr>
      <td>${dateBR(d.data)}</td>
      <td>${d.descricao}</td>
      <td>${d.categorias_financeiras?.nome ?? "—"}</td>
      <td>${d.fornecedor ?? "—"}</td>
      <td class="num">${brl(d.valor)}</td>
    </tr>`,
    )
    .join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório ${rel.mes}</title><style>${styles}</style></head>
<body>
  <h1>Relatório Financeiro</h1>
  <div class="meta">
    <strong>${rel.condominio?.nome ?? "Condomínio"}</strong>${rel.condominio?.cnpj ? " · CNPJ " + rel.condominio.cnpj : ""}<br/>
    Competência: <strong>${competenciaBR(rel.mes + "-01")}</strong>
  </div>
  <div class="totais">
    <div><p>Total cobrado</p><strong>${brl(totalCob)}</strong></div>
    <div><p>Recebido</p><strong>${brl(totalPag)}</strong></div>
    <div><p>Despesas</p><strong>${brl(totalDesp)}</strong></div>
    <div><p>Saldo</p><strong>${brl(totalPag - totalDesp)}</strong></div>
  </div>
  <button onclick="window.print()" style="padding:8px 16px;border:1px solid #111;background:#111;color:#fff;border-radius:6px;cursor:pointer;margin-bottom:16px">Imprimir / Salvar PDF</button>

  <h2>Cobranças (${rel.cobrancas.length})</h2>
  <table><thead><tr><th>Competência</th><th>Vencimento</th><th>Unidade</th><th>Categoria</th><th class="num">Valor</th><th class="num">Pago</th><th>Status</th></tr></thead><tbody>${tCobs || '<tr><td colspan="7" style="text-align:center;color:#999;padding:16px">Nenhuma cobrança</td></tr>'}</tbody></table>

  <h2>Pagamentos (${rel.pagamentos.length})</h2>
  <table><thead><tr><th>Data</th><th>Unidade</th><th>Forma</th><th class="num">Valor</th></tr></thead><tbody>${tPags || '<tr><td colspan="4" style="text-align:center;color:#999;padding:16px">Nenhum pagamento</td></tr>'}</tbody></table>

  <h2>Despesas (${rel.despesas.length})</h2>
  <table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Fornecedor</th><th class="num">Valor</th></tr></thead><tbody>${tDesps || '<tr><td colspan="5" style="text-align:center;color:#999;padding:16px">Nenhuma despesa</td></tr>'}</tbody></table>
</body></html>`;
}

export function abrirPDF(rel: Relatorio) {
  const html = gerarHTML(rel);
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
