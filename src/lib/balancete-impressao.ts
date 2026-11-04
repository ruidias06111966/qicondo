/**
 * Balancete em folha imprimível.
 *
 * A prestação de contas não vive só no ecrã: vai afixada no mural, anexa à ata
 * da assembleia e, em muitos condomínios, entregue em papel a quem pede. Segue
 * o mesmo padrão de `exportar-relatorio.ts` — HTML numa janela nova, que o
 * browser imprime ou guarda em PDF — para não trazer uma dependência de
 * geração de PDF só por isto.
 */
import type { Balancete, CategoriaBalancete } from "@/lib/balancete.functions";
import { dataBR } from "@/lib/periodo";

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const brl = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const linhasCategoria = (cats: CategoriaBalancete[]) =>
  cats
    .map(
      (c) =>
        `<tr><td>${esc(c.categoria)}${c.fundo_reserva ? ' <span class="tag">fundo de reserva</span>' : ""}</td>` +
        `<td class="num">${esc(brl(Number(c.valor)))}</td></tr>`,
    )
    .join("");

export function gerarHTMLBalancete(b: Balancete, condominio: string): string {
  const d = b.dados;
  const periodo = `${dataBR(b.periodo_inicio)} a ${dataBR(b.periodo_fim)}`;

  const receitas = linhasCategoria(d.receitas.por_categoria);
  const despesas = linhasCategoria(d.despesas.por_categoria);

  const lancReceitas = d.lancamentos.receitas
    .map(
      (l) =>
        `<tr><td>${esc(dataBR(l.data))}</td><td>${esc(l.unidade ?? "—")}</td>` +
        `<td>${esc(l.descricao)}</td><td>${esc(l.categoria)}</td>` +
        `<td class="num">${esc(brl(Number(l.valor)))}</td></tr>`,
    )
    .join("");

  const lancDespesas = d.lancamentos.despesas
    .map(
      (l) =>
        `<tr><td>${esc(dataBR(l.data))}</td><td>${esc(l.descricao)}</td>` +
        `<td>${esc(l.fornecedor ?? "—")}</td><td>${esc(l.categoria)}</td>` +
        `<td class="num">${esc(brl(Number(l.valor)))}</td></tr>`,
    )
    .join("");

  const vazio = (cols: number, texto: string) =>
    `<tr><td colspan="${cols}" class="vazio">${esc(texto)}</td></tr>`;

  const styles = `
    *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    body{margin:24px;color:#111;font-size:12px}
    h1{font-size:20px;margin:0 0 4px}
    h2{font-size:14px;margin:22px 0 8px;border-bottom:2px solid #111;padding-bottom:4px}
    .meta{color:#555;margin-bottom:16px}
    .rascunho{border:2px solid #b45309;background:#fffbeb;color:#92400e;
      padding:8px 12px;border-radius:6px;margin-bottom:16px;font-weight:700}
    table{width:100%;border-collapse:collapse;margin-bottom:8px}
    th,td{padding:6px 8px;text-align:left;border-bottom:1px solid #ddd;font-size:11px}
    th{background:#f5f5f5;text-transform:uppercase;font-size:10px;letter-spacing:.5px}
    .num{text-align:right;font-variant-numeric:tabular-nums}
    .vazio{text-align:center;color:#999;padding:16px}
    .tag{background:#e0f2fe;color:#075985;font-size:9px;padding:1px 5px;
      border-radius:3px;text-transform:uppercase;letter-spacing:.3px}
    .resumo{width:100%;border-collapse:collapse;margin:8px 0 4px}
    .resumo td{padding:7px 8px;border-bottom:1px solid #ddd;font-size:12px}
    .resumo tr:last-child td{border-top:2px solid #111;border-bottom:none;
      font-weight:800;font-size:14px}
    .nota{color:#555;font-size:10px;margin:4px 0 0;line-height:1.5}
    @media print{ body{margin:12mm} }
  `;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Balancete ${esc(periodo)} — ${esc(condominio)}</title>
<style>${styles}</style></head><body>
<h1>Prestação de contas</h1>
<p class="meta"><strong>${esc(condominio)}</strong><br>Período de ${esc(periodo)}
${b.publicado_em ? `<br>Publicado em ${esc(dataBR(b.publicado_em))}` : ""}</p>

${b.status === "rascunho" ? '<p class="rascunho">RASCUNHO — ainda não publicado aos condóminos</p>' : ""}

<h2>Resumo</h2>
<table class="resumo">
  <tr><td>Saldo anterior</td><td class="num">${esc(brl(Number(b.saldo_anterior)))}</td></tr>
  <tr><td>(+) Receitas recebidas no período</td><td class="num">${esc(brl(Number(b.total_receitas)))}</td></tr>
  <tr><td>(&minus;) Despesas pagas no período</td><td class="num">${esc(brl(Number(b.total_despesas)))}</td></tr>
  <tr><td>Saldo final</td><td class="num">${esc(brl(Number(b.saldo_final)))}</td></tr>
</table>
<p class="nota">
  Apurado em regime de caixa: entram os valores efectivamente recebidos e pagos
  no período, pela data do movimento.
  ${
    Number(d.receitas.fundo_reserva) > 0
      ? `Das receitas, ${esc(brl(Number(d.receitas.fundo_reserva)))} são fundo de reserva,
         de destino próprio, e ${esc(brl(Number(d.receitas.operacional)))} são receita corrente.`
      : ""
  }
  ${
    Number(b.inadimplencia) > 0
      ? `À data de fecho havia ${esc(brl(Number(b.inadimplencia)))} em atraso
         (${esc(d.inadimplencia.cobrancas)} cobrança(s) de ${esc(d.inadimplencia.unidades)} unidade(s)),
         que não entram neste saldo por não terem sido recebidos.`
      : "À data de fecho não havia valores em atraso."
  }
</p>

<h2>Receitas por categoria</h2>
<table><thead><tr><th>Categoria</th><th class="num">Valor</th></tr></thead>
<tbody>${receitas || vazio(2, "Nenhuma receita no período")}</tbody></table>

<h2>Despesas por categoria</h2>
<table><thead><tr><th>Categoria</th><th class="num">Valor</th></tr></thead>
<tbody>${despesas || vazio(2, "Nenhuma despesa no período")}</tbody></table>

<h2>Receitas — movimento</h2>
<table><thead><tr><th>Data</th><th>Unidade</th><th>Descrição</th><th>Categoria</th><th class="num">Valor</th></tr></thead>
<tbody>${lancReceitas || vazio(5, "Nenhum recebimento no período")}</tbody></table>

<h2>Despesas — movimento</h2>
<table><thead><tr><th>Data</th><th>Descrição</th><th>Fornecedor</th><th>Categoria</th><th class="num">Valor</th></tr></thead>
<tbody>${lancDespesas || vazio(5, "Nenhuma despesa no período")}</tbody></table>

${b.observacoes ? `<h2>Observações</h2><p>${esc(b.observacoes)}</p>` : ""}
</body></html>`;
}

export function abrirBalancetePDF(b: Balancete, condominio: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(gerarHTMLBalancete(b, condominio));
  w.document.close();
}
