/**
 * Carta de cobrança e nada consta em folha imprimível.
 *
 * Mesmo padrão do balancete: HTML numa janela nova, que o browser imprime ou
 * guarda em PDF. Não se traz uma dependência de geração de PDF só por isto.
 *
 * Os dois documentos saem para fora do condomínio — a carta vai para o
 * condómino e a certidão vai para o tabelião ou para quem compra a fração —
 * por isso dizem no rodapé em que data foram apurados. Uma dívida muda todos
 * os dias: sem a data, o papel não se sabe ler.
 */
import type { CartaCobranca, Certidao, Divida } from "@/lib/certidao.functions";
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

const unidadeTexto = (u: { bloco: string | null; numero: string }) =>
  u.bloco ? `Bloco ${u.bloco}, unidade ${u.numero}` : `Unidade ${u.numero}`;

const enderecoTexto = (c: {
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
}) =>
  [c.endereco, [c.cidade, c.estado].filter(Boolean).join("/"), c.cep].filter(Boolean).join(" — ");

const STYLES = `
  *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  body{margin:24px;color:#111;font-size:12px;line-height:1.6}
  h1{font-size:18px;margin:0 0 4px}
  h2{font-size:13px;margin:22px 0 8px;border-bottom:2px solid #111;padding-bottom:4px}
  .cab{border-bottom:1px solid #ccc;padding-bottom:10px;margin-bottom:18px}
  .cab strong{font-size:14px}
  .meta{color:#555}
  table{width:100%;border-collapse:collapse;margin-bottom:8px}
  th,td{padding:6px 8px;text-align:left;border-bottom:1px solid #ddd;font-size:11px}
  th{background:#f5f5f5;text-transform:uppercase;font-size:10px;letter-spacing:.5px}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  .total td{border-top:2px solid #111;font-weight:800;font-size:13px}
  .nota{color:#555;font-size:10px;margin:10px 0 0;line-height:1.5}
  .selo{border:2px solid #111;padding:12px 16px;margin:18px 0;text-align:center}
  .selo .codigo{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
    font-size:18px;font-weight:800;letter-spacing:1px}
  .assin{margin-top:48px;border-top:1px solid #111;width:280px;padding-top:6px;
    font-size:11px;color:#555}
  @media print{ body{margin:12mm} }
`;

const cabecalho = (c: {
  nome: string;
  cnpj: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
}) =>
  `<div class="cab"><strong>${esc(c.nome)}</strong>` +
  `${c.cnpj ? `<br>CNPJ ${esc(c.cnpj)}` : ""}` +
  `${enderecoTexto(c) ? `<br><span class="meta">${esc(enderecoTexto(c))}</span>` : ""}</div>`;

const linhasDivida = (d: Divida) =>
  d.itens
    .map(
      (i) =>
        `<tr><td>${esc(i.descricao ?? "Cobrança")}` +
        `${i.de_acordo ? ` <span class="meta">(parcela ${esc(i.parcela_num ?? "")} de acordo)</span>` : ""}</td>` +
        `<td>${esc(dataBR(i.vencimento))}</td>` +
        `<td class="num">${esc(i.dias_atraso)}</td>` +
        `<td class="num">${esc(brl(i.principal))}</td>` +
        `<td class="num">${esc(brl(i.multa))}</td>` +
        `<td class="num">${esc(brl(i.juros))}</td>` +
        `<td class="num">${esc(brl(i.principal + i.multa + i.juros))}</td></tr>`,
    )
    .join("");

export function gerarHTMLCarta(c: CartaCobranca): string {
  const destinatarios =
    c.proprietarios.length > 0 ? c.proprietarios.join(", ") : "Ao proprietário da unidade";

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Carta de cobrança — ${esc(unidadeTexto(c.unidade))}</title>
<style>${STYLES}</style></head><body>
${cabecalho(c.condominio)}

<h1>Notificação de débito</h1>
<p class="meta">${esc(unidadeTexto(c.unidade))} &middot; emitida em ${esc(dataBR(c.emitida_em))}</p>

<p>A${esc(c.proprietarios.length > 1 ? "os" : "o")}: <strong>${esc(destinatarios)}</strong></p>

<p>Constam em aberto, em nome da ${esc(unidadeTexto(c.unidade).toLowerCase())}, os valores
abaixo, apurados em ${esc(dataBR(c.divida.referencia))}. A contribuição para as despesas do
condomínio é dever do condómino (art. 1.336, I, do Código Civil), e o atraso sujeita-o aos
encargos previstos na convenção.</p>

<h2>Valores em aberto</h2>
<table>
  <thead><tr><th>Descrição</th><th>Vencimento</th><th class="num">Dias</th>
  <th class="num">Principal</th><th class="num">Multa</th><th class="num">Juros</th>
  <th class="num">Total</th></tr></thead>
  <tbody>${linhasDivida(c.divida)}</tbody>
  <tfoot><tr class="total"><td colspan="3">Total devido</td>
    <td class="num">${esc(brl(c.divida.principal))}</td>
    <td class="num">${esc(brl(c.divida.multa))}</td>
    <td class="num">${esc(brl(c.divida.juros))}</td>
    <td class="num">${esc(brl(c.divida.total))}</td></tr></tfoot>
</table>

<p>Fica V. S.ª notificad${esc(c.proprietarios.length > 1 ? "os" : "o")} a liquidar o débito no
prazo de <strong>${esc(c.prazo_dias)} dias</strong>, até
<strong>${esc(dataBR(c.vence_em))}</strong>. Decorrido o prazo sem pagamento nem acordo, o
condomínio poderá cobrar judicialmente o crédito, acrescido de custas e honorários.</p>

<p>Se o débito já foi pago, desconsidere esta carta e procure a administração com o
comprovativo. Se pretende parcelar, procure a administração: um acordo de parcelamento
suspende a cobrança enquanto for cumprido.</p>

<p class="nota">
  Valores apurados em ${esc(dataBR(c.divida.referencia))}; multa e juros correm por dia de
  atraso, pelo que o total aumenta após esta data. Confirme o valor actualizado antes de pagar.
  ${
    c.divida.acordos_ativos.length > 0
      ? `Há ${esc(c.divida.acordos_ativos.length)} acordo(s) de parcelamento em curso para esta unidade; as parcelas vencidas constam acima.`
      : ""
  }
</p>

<div class="assin">Administração do condomínio</div>
</body></html>`;
}

export function gerarHTMLNadaConsta(c: Certidao): string {
  const d = c.dados;
  const donos = d.proprietarios.length > 0 ? d.proprietarios.join(", ") : "—";

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Nada consta ${esc(c.codigo)} — ${esc(unidadeTexto(d.unidade))}</title>
<style>${STYLES}</style></head><body>
${cabecalho(d.condominio)}

<h1>Certidão negativa de débitos condominiais</h1>
<p class="meta">Certidão n.º ${esc(c.numero)} &middot; emitida em ${esc(dataBR(d.emitida_em))}</p>

<p>Certificamos que, em consulta aos registos do condomínio na data de
<strong>${esc(dataBR(d.referencia))}</strong>, <strong>nada consta</strong> em aberto em nome da
${esc(unidadeTexto(d.unidade).toLowerCase())}, não havendo contribuições ordinárias ou
extraordinárias, multas, juros ou acordos de parcelamento pendentes de pagamento.</p>

<table>
  <tr><th>Unidade</th><td>${esc(unidadeTexto(d.unidade))}</td></tr>
  <tr><th>Proprietário(s)</th><td>${esc(donos)}</td></tr>
  <tr><th>Situação apurada em</th><td>${esc(dataBR(d.referencia))}</td></tr>
  <tr><th>Válida até</th><td>${esc(dataBR(d.valida_ate))}</td></tr>
</table>

<div class="selo">
  <div class="meta">Código de conferência</div>
  <div class="codigo">${esc(c.codigo)}</div>
</div>

<p class="nota">
  Esta certidão retrata a situação na data em que foi apurada e vale até
  ${esc(dataBR(d.valida_ate))}. As obrigações condominiais acompanham a fração: quem a adquire
  responde pelos débitos anteriores (art. 1.345 do Código Civil), e por isso a data de apuração
  é parte do que se certifica. O código acima permite conferir a autenticidade com a
  administração.
</p>

<div class="assin">Administração do condomínio</div>
</body></html>`;
}

function abrir(html: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export const abrirCartaPDF = (c: CartaCobranca) => abrir(gerarHTMLCarta(c));
export const abrirNadaConstaPDF = (c: Certidao) => abrir(gerarHTMLNadaConsta(c));
