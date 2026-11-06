/**
 * O Pix de uma cobrança: o QR Code, o "copia e cola" e a composição do valor.
 *
 * O payload é montado aqui, no cliente, a partir do que a `pix_da_cobranca`
 * devolve. Poderia ser montado no servidor, mas não há nada a esconder — o BR
 * Code é público por natureza, é o que vai no QR — e montá-lo aqui mantém o
 * gerador num ficheiro só, com a bateria de testes ao lado.
 *
 * O que NÃO está aqui é a decisão de quanto cobrar: isso vem inteiro da
 * função do banco, que soma a multa e os juros devidos à data. Se este
 * componente calculasse o valor, haveria duas contas para o mesmo dinheiro.
 */
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Copy, Check, Loader2, AlertCircle, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { montarBrCode } from "@/lib/pix/brcode";
import { brl } from "@/lib/format";
import { safeErrorMessage } from "@/lib/safe-error";

type DadosPix = {
  chave: string;
  recebedor: string;
  cidade: string;
  centavos: number;
  principal: number;
  multa: number;
  juros: number;
  txid: string;
  descricao: string | null;
};

export function QrPix({
  cobrancaId,
  telefoneMorador,
}: {
  cobrancaId: string;
  /** Para o botão do WhatsApp. Sem ele, o botão não aparece. */
  telefoneMorador?: string | null;
}) {
  const [dados, setDados] = useState<DadosPix | null>(null);
  const [payload, setPayload] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setErro(null);
      const { data, error } = await supabase.rpc("pix_da_cobranca", {
        _cobranca_id: cobrancaId,
      });
      if (!vivo) return;
      if (error) {
        setErro(safeErrorMessage(error));
        return;
      }
      const linha = (Array.isArray(data) ? data[0] : data) as DadosPix | undefined;
      if (!linha) {
        setErro("A cobrança não devolveu dados de Pix.");
        return;
      }
      setDados(linha);

      let montado: string;
      try {
        montado = montarBrCode({
          chave: linha.chave,
          nome: linha.recebedor,
          cidade: linha.cidade,
          centavos: Number(linha.centavos),
          txid: linha.txid,
        });
      } catch (e) {
        // Um payload que o gerador recusa é melhor do que um QR Code que o
        // banco recusa: aqui ainda se consegue dizer qual campo está mal.
        setErro(e instanceof Error ? e.message : "Não foi possível montar o código Pix.");
        return;
      }
      setPayload(montado);

      // Correção de erro em nível médio: o QR fica legível mesmo amassado ou
      // com um dedo em cima, que é como um papel afixado no elevador acaba.
      const desenho = await QRCode.toString(montado, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 1,
        width: 240,
      });
      if (vivo) setSvg(desenho);
    })();
    return () => {
      vivo = false;
    };
  }, [cobrancaId]);

  if (erro) {
    return (
      <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
        <AlertCircle size={18} className="text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Não foi possível gerar o Pix</p>
          <p className="text-muted-foreground mt-1">{erro}</p>
        </div>
      </div>
    );
  }

  if (!dados || !payload) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> A gerar o código Pix…
      </div>
    );
  }

  const total = Number(dados.centavos) / 100;
  const temEncargos = Number(dados.multa) > 0 || Number(dados.juros) > 0;

  async function copiar() {
    await navigator.clipboard.writeText(payload!);
    setCopiado(true);
    toast.success("Código Pix copiado");
    setTimeout(() => setCopiado(false), 2000);
  }

  function enviarPeloWhatsapp() {
    const linhas = [
      `*${dados!.recebedor}*`,
      dados!.descricao ? `Cobrança: ${dados!.descricao}` : null,
      `Valor: *${brl(total)}*`,
      temEncargos
        ? `(${brl(Number(dados!.principal))} + ${brl(Number(dados!.multa))} de multa + ${brl(Number(dados!.juros))} de juros)`
        : null,
      "",
      "Pague pelo Pix copia e cola:",
      payload,
    ]
      .filter(Boolean)
      .join("\n");
    const numero = (telefoneMorador ?? "").replace(/\D/g, "");
    window.open(
      `https://wa.me/${numero.startsWith("55") ? numero : `55${numero}`}?text=${encodeURIComponent(linhas)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
        {svg ? (
          // O SVG vem da biblioteca `qrcode` a partir do payload que nós
          // próprios montámos — não há texto de terceiros aqui.
          <div
            className="shrink-0 rounded-lg border border-border bg-white p-2 [&>svg]:block"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="shrink-0 h-[244px] w-[244px] rounded-lg border border-border flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-3 w-full">
          <div>
            <p className="text-2xl font-bold">{brl(total)}</p>
            {temEncargos ? (
              // Um total que o condómino não sabe decompor é uma discussão na
              // assembleia. A composição vem da mesma função que fez a conta.
              <p className="text-sm text-muted-foreground">
                {brl(Number(dados.principal))} + {brl(Number(dados.multa))} de multa +{" "}
                {brl(Number(dados.juros))} de juros
              </p>
            ) : null}
          </div>

          <div className="text-sm">
            <p className="text-muted-foreground">Recebedor</p>
            <p className="font-medium">{dados.recebedor}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={copiar} className="flex-1 min-w-[12rem]">
              {copiado ? <Check size={16} className="mr-2" /> : <Copy size={16} className="mr-2" />}
              {copiado ? "Copiado" : "Copiar código Pix"}
            </Button>
            {telefoneMorador ? (
              <Button variant="outline" onClick={enviarPeloWhatsapp}>
                <MessageCircle size={16} className="mr-2" /> WhatsApp
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Ver o código em texto
        </summary>
        <p className="mt-2 font-mono break-all rounded-lg bg-muted p-3 leading-relaxed">
          {payload}
        </p>
      </details>

      {/* Sem isto, o síndico espera que a cobrança se liquide sozinha. O Pix
          estático não notifica ninguém: o dinheiro entra na conta e o sistema
          não sabe. É o ponto que mais gera suporte, por isso está escrito. */}
      <p className="text-xs text-muted-foreground border-t border-border pt-3">
        O valor cai direto na conta do condomínio. O pagamento <strong>não</strong> é dado como
        recebido automaticamente — depois de pagar, registe o pagamento e anexe o comprovante.
      </p>
    </div>
  );
}
