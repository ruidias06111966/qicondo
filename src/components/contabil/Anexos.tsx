/**
 * Anexos de comprovação de um lançamento.
 *
 * O ficheiro vai do browser direito para o Storage e só depois se registra o
 * que ele é — tal como a página dos documentos já fazia. A ordem importa: se o
 * registo falhar, apaga-se o ficheiro; ao contrário ficaria uma linha a
 * apontar para nada.
 *
 * Os campos do documento (número da nota, data, valor) não são decoração: é o
 * que permite ao conselho fiscal conferir que a nota é do valor e da data que
 * o lançamento diz, sem abrir o PDF um a um.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Paperclip, Loader2, Trash2, Download, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Modal, Field, safeCall } from "@/components/financeiro/ui";
import {
  BUCKET_COMPROVANTES,
  ROTULO_ANEXO,
  caminhoDoAnexo,
  type AnexoTipo,
  type EntidadeAnexo,
} from "@/lib/anexo";
import { listarAnexos, registrarAnexo, removerAnexo, type Anexo } from "@/lib/contabil.functions";
import { dataBR } from "@/lib/periodo";

const TAMANHO_MAXIMO = 25 * 1024 * 1024;

const brl = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Tipos oferecidos consoante o lado do lançamento. */
const TIPOS_POR_ENTIDADE: Record<EntidadeAnexo, AnexoTipo[]> = {
  despesa: ["nota_fiscal", "recibo", "comprovante_pagamento", "boleto", "contrato", "outro"],
  pagamento: ["comprovante_pagamento", "recibo", "extrato_bancario", "outro"],
  cobranca: ["boleto", "recibo", "comprovante_pagamento", "outro"],
  infracao: ["outro", "contrato", "recibo"],
};

/**
 * `quantos` vem de fora, de um `resumoAnexos` feito uma vez para a lista toda.
 * Se cada botão contasse os seus, uma tabela de cinquenta linhas fazia
 * cinquenta chamadas ao abrir.
 */
export function BotaoAnexos({
  condominioId,
  entidade,
  entidadeId,
  rotulo,
  quantos,
  podeGerir = true,
  onMudou,
}: {
  condominioId: string;
  entidade: EntidadeAnexo;
  entidadeId: string;
  rotulo: string;
  quantos: number;
  podeGerir?: boolean;
  onMudou?: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const vazio = quantos === 0;

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className={`inline-flex items-center gap-1 rounded p-2 hover:bg-muted ${
          vazio ? "text-muted-foreground" : "text-primary"
        }`}
        title={vazio ? "Sem documentos anexados" : `${quantos} documento(s)`}
      >
        <Paperclip size={16} />
        {!vazio && <span className="text-xs font-semibold">{quantos}</span>}
      </button>

      {aberto && (
        <PainelAnexos
          condominioId={condominioId}
          entidade={entidade}
          entidadeId={entidadeId}
          rotulo={rotulo}
          podeGerir={podeGerir}
          onClose={() => {
            setAberto(false);
            onMudou?.();
          }}
        />
      )}
    </>
  );
}

function PainelAnexos({
  condominioId,
  entidade,
  entidadeId,
  rotulo,
  podeGerir,
  onClose,
}: {
  condominioId: string;
  entidade: EntidadeAnexo;
  entidadeId: string;
  rotulo: string;
  podeGerir: boolean;
  onClose: () => void;
}) {
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [tipo, setTipo] = useState<AnexoTipo>(TIPOS_POR_ENTIDADE[entidade][0]);
  const [numero, setNumero] = useState("");
  const [data, setData] = useState("");
  const [valor, setValor] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const r = await safeCall(
      listarAnexos({ data: { condominio_id: condominioId, entidade, entidade_id: entidadeId } }),
    );
    setAnexos((r ?? []) as Anexo[]);
    setCarregando(false);
  }, [condominioId, entidade, entidadeId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const enviar = async () => {
    if (!ficheiro) {
      toast.error("Escolha o ficheiro");
      return;
    }
    if (ficheiro.size > TAMANHO_MAXIMO) {
      toast.error("Ficheiro acima de 25 MB");
      return;
    }

    setEnviando(true);
    const caminho = caminhoDoAnexo(condominioId, entidade, entidadeId, ficheiro.name);

    const up = await supabase.storage.from(BUCKET_COMPROVANTES).upload(caminho, ficheiro, {
      contentType: ficheiro.type || undefined,
      upsert: false,
    });
    if (up.error) {
      setEnviando(false);
      toast.error(up.error.message);
      return;
    }

    const numerico = Number(valor.replace(/\./g, "").replace(",", "."));
    const r = await safeCall(
      registrarAnexo({
        data: {
          condominio_id: condominioId,
          entidade,
          entidade_id: entidadeId,
          tipo,
          storage_path: caminho,
          nome_arquivo: ficheiro.name.slice(0, 260),
          mime_type: ficheiro.type || undefined,
          tamanho_bytes: ficheiro.size,
          documento_numero: numero.trim() || undefined,
          documento_data: data || undefined,
          valor: valor.trim() && Number.isFinite(numerico) ? numerico : undefined,
        },
      }),
    );
    setEnviando(false);

    // O registo falhou: o ficheiro não pode ficar no bucket sem dono.
    if (!r) {
      await supabase.storage.from(BUCKET_COMPROVANTES).remove([caminho]);
      return;
    }

    toast.success("Documento anexado");
    setFicheiro(null);
    setNumero("");
    setData("");
    setValor("");
    carregar();
  };

  const baixar = async (a: Anexo) => {
    const { data: url, error } = await supabase.storage
      .from(BUCKET_COMPROVANTES)
      .createSignedUrl(a.storage_path, 60);
    if (error || !url) {
      toast.error("Não foi possível abrir o ficheiro");
      return;
    }
    window.open(url.signedUrl, "_blank");
  };

  const remover = async (a: Anexo) => {
    if (!confirm(`Remover "${a.nome_arquivo}"?`)) return;
    const r = await safeCall(removerAnexo({ data: { anexo_id: a.id } }));
    if (!r) return;
    await supabase.storage.from(BUCKET_COMPROVANTES).remove([r.storage_path]);
    toast.success("Removido");
    carregar();
  };

  return (
    <Modal title={`Documentos — ${rotulo}`} onClose={onClose}>
      <div className="space-y-5">
        {carregando ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="animate-spin" size={16} /> A carregar…
          </div>
        ) : anexos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Nenhum documento anexado.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {anexos.map((a) => (
              <li key={a.id} className="flex items-start gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" title={a.nome_arquivo}>
                    {a.nome_arquivo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ROTULO_ANEXO[a.tipo]}
                    {a.documento_numero ? ` · nº ${a.documento_numero}` : ""}
                    {a.documento_data ? ` · ${dataBR(a.documento_data)}` : ""}
                    {a.valor != null ? ` · ${brl(a.valor)}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => baixar(a)}
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                  title="Abrir"
                >
                  <Download size={15} />
                </button>
                {podeGerir && (
                  <button
                    onClick={() => remover(a)}
                    className="p-1.5 rounded hover:bg-muted text-rose-600"
                    title="Remover"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {podeGerir && (
          <div className="space-y-4 border-t border-border pt-5">
            <Field label="Tipo de documento">
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as AnexoTipo)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {TIPOS_POR_ENTIDADE[entidade].map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_ANEXO[t]}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Número">
                <input
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  maxLength={60}
                  placeholder="NF 1234"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Data">
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Valor">
                <input
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  inputMode="decimal"
                  placeholder="1.234,56"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <Field label="Ficheiro (até 25 MB)">
              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setFicheiro(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>

            <button
              onClick={enviar}
              disabled={enviando || !ficheiro}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {enviando ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              Anexar documento
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
