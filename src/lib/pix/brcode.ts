/**
 * Gerador do BR Code do Pix — a string do "copia e cola", que é também o que
 * o QR Code desenha.
 *
 * Não há API nem credencial nenhuma aqui. O BR Code é um formato de dados
 * especificado pelo Banco Central no «Manual de Padrões para Iniciação do
 * Pix» (v2.10.0), em cima da norma EMV® QRCPS-MPM: campos TLV (identificador
 * de 2 dígitos, tamanho de 2 dígitos, valor) e um CRC16 no fim. Quem paga lê
 * a chave do condomínio e o dinheiro vai directo para a conta dele — a
 * plataforma não toca no pagamento, que é exactamente o que a página de
 * preços promete.
 *
 * Em troca, o Pix estático não avisa ninguém quando é pago. A baixa da
 * cobrança continua a ser um acto de alguém, com o comprovante anexado. Ver
 * `txid` mais abaixo para o que isto deixa preparado.
 *
 * Tudo o que este ficheiro afirma sobre o formato foi verificado contra o
 * manual do BACEN, e os dois exemplos oficiais dele estão na bateria de
 * testes. Não é zelo a mais: um erro de um carácter — a caixa do GUI, um
 * tamanho mal contado, o CRC sobre o intervalo errado — produz um QR Code que
 * o banco recusa sem dizer porquê, e o síndico não tem como descobrir se o
 * problema é o sistema ou o telemóvel do condómino.
 */

/** Campos nativos do BR Code que usamos. Os nomes são os da norma EMV. */
const ID = {
  formato: "00", // Payload Format Indicator
  iniciacao: "01", // Point of Initiation Method
  contaRecebedor: "26", // Merchant Account Information (template do Pix)
  categoria: "52", // Merchant Category Code
  moeda: "53", // Transaction Currency
  valor: "54", // Transaction Amount
  pais: "58", // Country Code
  nome: "59", // Merchant Name
  cidade: "60", // Merchant City
  dadosAdicionais: "62", // Additional Data Field Template
  crc: "63", // CRC16
} as const;

/** Campos dentro do template 26 (conta do recebedor), secção 2.6 do manual. */
const ID_PIX = {
  gui: "00",
  chave: "01",
  infoAdicional: "02",
} as const;

/** Campo dentro do template 62. O manual chama-lhe `txid`. */
const ID_TXID = "05";

/**
 * O GUI do arranjo Pix. O manual diz, em nota de pé de página, que é
 * insensível à caixa, mas os exemplos oficiais trazem-no em minúsculas e é
 * nessa forma que o CRC dos vectores de teste fecha. Escreve-se como lá está.
 */
const GUI_PIX = "br.gov.bcb.pix";

/** `986` é o real brasileiro na ISO 4217. */
const MOEDA_BRL = "986";

/** Sem categoria de comerciante — é o preenchimento neutro da norma. */
const CATEGORIA_NEUTRA = "0000";

/**
 * «If present, the content of the data object value for IDs "01" to "08"
 * shall be either "***" or a value defined by the merchant» — EMV QRCPS-MPM
 * 4.8.1.2, citado na nota 25 do manual. `***` significa "não há
 * identificador".
 */
const SEM_TXID = "***";

/**
 * Limites do Merchant Name e do Merchant City. O manual do BACEN não os
 * repete: remete para o manual do BR Code (a norma EMV), onde o nome tem 25
 * caracteres e a cidade 15. Os exemplos oficiais cabem folgadamente nos dois.
 */
const MAX_NOME = 25;
const MAX_CIDADE = 15;

/** Secção 2.6.2: o txid tem no máximo 25 caracteres. */
const MAX_TXID = 25;

/**
 * CRC-16/CCITT-FALSE: polinómio 0x1021, valor inicial 0xFFFF, sem reflexão e
 * sem XOR final.
 *
 * A implementação está verificada de duas maneiras independentes: dá o valor
 * de verificação da norma para esta variante (`0x29B1` sobre a cadeia
 * "123456789") e reproduz o CRC dos dois exemplos do manual do BACEN. A
 * primeira prova que o algoritmo é o certo; a segunda, que o intervalo sobre
 * o qual o aplicamos também.
 */
export function crc16(dados: string): string {
  let crc = 0xffff;
  for (let i = 0; i < dados.length; i++) {
    crc ^= dados.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Um campo TLV: identificador, tamanho em dois dígitos, valor.
 *
 * O tamanho conta caracteres, não bytes. É por isso que o `normalizarTexto`
 * tira os acentos antes de chegar aqui: "São José" tem 8 caracteres mas 9
 * bytes em UTF-8, e um leitor que conte bytes desalinha-se no campo seguinte
 * e lê o resto do payload como lixo.
 */
export function tlv(id: string, valor: string): string {
  if (valor.length > 99) {
    throw new Error(`Campo ${id} tem ${valor.length} caracteres; o máximo é 99.`);
  }
  return `${id}${String(valor.length).padStart(2, "0")}${valor}`;
}

/**
 * Tira acentos, descarta o que não é ASCII imprimível e corta no limite do
 * campo. A caixa fica como veio.
 *
 * Comecei por passar tudo a maiúsculas, por achar que era convenção: o
 * exemplo oficial escreve a cidade `BRASILIA`. Mas escreve o nome do
 * recebedor `Fulano de Tal`, em caixa mista — e foi o teste que reproduz o
 * exemplo do manual carácter por carácter que mostrou que as maiúsculas eram
 * invenção minha. Preservar a caixa é o que a norma faz, dá um nome de
 * condomínio legível no telemóvel de quem paga, e deixa a bateria ancorada no
 * vector oficial em vez de num payload parecido.
 *
 * Cortar é preferível a recusar: um condomínio chamado "Residencial Jardim
 * das Acácias Bloco B" não pode ficar sem cobrança por o nome não caber em 25
 * caracteres, e quem paga reconhece-o truncado.
 */
export function normalizarTexto(texto: string, maximo: number): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marcas de acento, já separadas pelo NFD
    .replace(/[^\x20-\x7e]/g, "") // fora do ASCII imprimível
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximo)
    .trim(); // o corte pode deixar um espaço no fim
}

/**
 * O valor, com ponto decimal e duas casas, sem separador de milhares.
 *
 * Recebe centavos em inteiro em vez de reais em `number` de propósito: a
 * cobrança guarda `numeric` no Postgres e passar por vírgula flutuante aqui
 * seria a maneira mais fácil de gerar um QR de 1 cêntimo a menos do que a
 * dívida — e um pagamento a menos não quita a cobrança.
 */
export function formatarValor(centavos: number): string {
  if (!Number.isInteger(centavos)) {
    throw new Error(`O valor tem de vir em centavos inteiros; recebi ${centavos}.`);
  }
  if (centavos <= 0) {
    throw new Error(`O valor tem de ser positivo; recebi ${centavos} centavos.`);
  }
  const reais = Math.trunc(centavos / 100);
  const resto = centavos % 100;
  return `${reais}.${String(resto).padStart(2, "0")}`;
}

/**
 * O txid tal como a secção 2.6.2 o define: letras sem acento e dígitos, no
 * máximo 25 caracteres. Qualquer outro carácter é retirado.
 *
 * Vale a pena pôr aqui o identificador da cobrança mesmo sem conseguirmos,
 * hoje, lê-lo de volta. O manual diz que o txid «deve ser retransmitido
 * intacto pelo PSP do pagador» e que a API Pix devolve as transações com o
 * txid em questão (secção 5.3.2). Ou seja: o dia em que um condomínio ligar a
 * API do banco dele, a conciliação automática encontra todos os pagamentos
 * antigos já identificados. Não pôr o txid agora custaria regenerar e reenviar
 * os QR mais tarde.
 */
export function normalizarTxid(txid: string): string {
  const limpo = txid.replace(/[^a-zA-Z0-9]/g, "").slice(0, MAX_TXID);
  return limpo.length > 0 ? limpo : SEM_TXID;
}

export type BrCodeParams = {
  /** A chave Pix do recebedor, já na forma em que o DICT a conhece. */
  chave: string;
  /** Nome do recebedor. É truncado e normalizado, não validado. */
  nome: string;
  /** Cidade do recebedor. Idem. */
  cidade: string;
  /**
   * Valor em centavos. Omitir deixa o campo 54 fora, e então é o pagador que
   * digita quanto paga — útil para uma chave de recebimento genérica, mas não
   * para uma cobrança, onde queremos o valor fixo.
   */
  centavos?: number;
  /** Identificador para conciliação. Omitir escreve `***`. */
  txid?: string;
  /** Texto livre mostrado a quem paga (campo 26-02, `infoAdicional`). */
  infoAdicional?: string;
};

/**
 * Monta o payload completo, com o CRC no fim.
 *
 * A ordem dos campos é crescente por identificador, como nos exemplos do
 * manual. O campo 01 (Point of Initiation Method) fica de fora: é opcional e
 * o exemplo oficial do QR estático não o traz — a sua ausência significa "QR
 * reutilizável", que é o que uma cobrança de condomínio quer (o condómino
 * pode abrir o mesmo QR duas vezes antes de pagar).
 */
export function montarBrCode(params: BrCodeParams): string {
  const chave = params.chave.trim();
  if (!chave) {
    throw new Error("A chave Pix é obrigatória para gerar o BR Code.");
  }

  const nome = normalizarTexto(params.nome, MAX_NOME);
  const cidade = normalizarTexto(params.cidade, MAX_CIDADE);
  if (!nome) {
    throw new Error("O nome do recebedor ficou vazio depois de normalizado.");
  }
  if (!cidade) {
    throw new Error("A cidade do recebedor ficou vazia depois de normalizada.");
  }

  let conta = tlv(ID_PIX.gui, GUI_PIX) + tlv(ID_PIX.chave, chave);
  if (params.infoAdicional) {
    const info = normalizarTexto(params.infoAdicional, 72);
    if (info) conta += tlv(ID_PIX.infoAdicional, info);
  }
  // O template 26 inteiro cabe em 99 caracteres (secção 2.6.1). Com o GUI a
  // ocupar 18 e uma chave aleatória a ocupar 40, sobra pouco para o texto
  // livre — e é melhor falhar aqui, com o nome do campo, do que gerar um TLV
  // que o `tlv` recusa mais acima sem dizer de onde veio.
  if (conta.length > 99) {
    throw new Error(
      `A conta do recebedor ocupa ${conta.length} caracteres; o máximo é 99. ` +
        "Encurte a informação adicional.",
    );
  }

  let payload =
    tlv(ID.formato, "01") +
    tlv(ID.contaRecebedor, conta) +
    tlv(ID.categoria, CATEGORIA_NEUTRA) +
    tlv(ID.moeda, MOEDA_BRL);

  if (params.centavos !== undefined) {
    payload += tlv(ID.valor, formatarValor(params.centavos));
  }

  payload +=
    tlv(ID.pais, "BR") +
    tlv(ID.nome, nome) +
    tlv(ID.cidade, cidade) +
    tlv(ID.dadosAdicionais, tlv(ID_TXID, normalizarTxid(params.txid ?? "")));

  // O CRC entra sobre o payload já com o `6304` colado — o manual diz-no por
  // palavras: «0x1D3D – incluindo "6304" (ID 63 e tamanho 04)».
  const comIdDoCrc = `${payload}${ID.crc}04`;
  return `${comIdDoCrc}${crc16(comIdDoCrc)}`;
}

/**
 * Confere o CRC de um BR Code recebido de fora.
 *
 * Serve para os testes e para validar o que um utilizador cole à mão no ecrã
 * de configuração — é mais útil dizer-lhe "esta chave está truncada" do que
 * deixá-lo descobrir pelo condómino que o QR não funciona.
 */
export function brCodeValido(payload: string): boolean {
  if (payload.length < 8) return false;
  const corpo = payload.slice(0, -4);
  const crcDeclarado = payload.slice(-4).toUpperCase();
  if (!corpo.endsWith(`${ID.crc}04`)) return false;
  return crc16(corpo) === crcDeclarado;
}
