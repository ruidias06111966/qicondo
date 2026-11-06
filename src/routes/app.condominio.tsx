import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { safeCall } from "@/lib/safe-call";
import { Building2, Save, Loader2, Copy, AlertCircle, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buscarCEP, formatCEP, formatCNPJ, isValidCNPJ, onlyDigits } from "@/lib/br-validators";
import {
  EXEMPLO_TIPO,
  ROTULO_TIPO,
  TIPOS_CHAVE,
  erroDaChave,
  normalizarChave,
  type TipoChavePix,
} from "@/lib/pix/chave";

export const Route = createFileRoute("/app/condominio")({
  head: () => ({ meta: [{ title: "Empresa — QiCond" }] }),
  component: CondominioPage,
});

type Form = {
  nome: string;
  cnpj: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  whatsapp_numero: string;
  codigo_publico: string;
  chave_pix: string;
  chave_pix_tipo: TipoChavePix | "";
};

const EMPTY: Form = {
  nome: "",
  cnpj: "",
  endereco: "",
  cidade: "",
  estado: "",
  cep: "",
  whatsapp_numero: "",
  codigo_publico: "",
  chave_pix: "",
  chave_pix_tipo: "",
};

function CondominioPage() {
  const { condominioId, isSindico } = useCondominioAtivo();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<Form>(EMPTY);
  const [cnpjErr, setCnpjErr] = useState<string | null>(null);
  const [cepBusy, setCepBusy] = useState(false);

  useEffect(() => {
    if (!condominioId) return;
    setLoading(true);
    (async () => {
      const r = await safeCall(
        supabase.from("condominios").select("*").eq("id", condominioId).maybeSingle(),
      );
      if (r?.error) toast.error(r.error.message);
      const data = r?.data;
      if (data)
        setF({
          nome: data.nome ?? "",
          cnpj: data.cnpj ?? "",
          endereco: data.endereco ?? "",
          cidade: data.cidade ?? "",
          estado: data.estado ?? "",
          cep: data.cep ?? "",
          whatsapp_numero: data.whatsapp_numero ?? "",
          codigo_publico: data.codigo_publico ?? "",
          chave_pix: data.chave_pix ?? "",
          chave_pix_tipo: (data.chave_pix_tipo as TipoChavePix | null) ?? "",
        });
      setLoading(false);
    })();
  }, [condominioId]);

  const upd = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  // A chave vai para o banco na forma em que o DICT a conhece, e não como foi
  // escrita: o síndico digita "(61) 99999-8888" e o que se guarda — e o que
  // entra no QR Code — é "+5561999998888".
  const chavePix =
    f.chave_pix_tipo && f.chave_pix.trim() ? normalizarChave(f.chave_pix_tipo, f.chave_pix) : "";
  const erroChave =
    f.chave_pix_tipo && f.chave_pix.trim() ? erroDaChave(f.chave_pix_tipo, chavePix) : null;

  async function handleCep(v: string) {
    const formatted = formatCEP(v);
    upd("cep", formatted);
    if (onlyDigits(formatted).length === 8) {
      setCepBusy(true);
      const r = await buscarCEP(formatted);
      setCepBusy(false);
      if (r) {
        setF((p) => ({
          ...p,
          endereco: r.logradouro
            ? `${r.logradouro}${r.bairro ? " — " + r.bairro : ""}`
            : p.endereco,
          cidade: r.localidade || p.cidade,
          estado: r.uf || p.estado,
        }));
        toast.success("Endereço preenchido");
      }
    }
  }

  function handleCnpj(v: string) {
    const formatted = formatCNPJ(v);
    upd("cnpj", formatted);
    setCnpjErr(formatted && !isValidCNPJ(formatted) ? "CNPJ inválido" : null);
  }

  async function salvar() {
    if (!condominioId) return;
    if (!f.nome || f.nome.trim().length < 3) {
      toast.error("Nome obrigatório");
      return;
    }
    if (f.cnpj && !isValidCNPJ(f.cnpj)) {
      toast.error("CNPJ inválido");
      return;
    }
    // A chave do Pix é dinheiro: uma chave errada não falha, gera um QR Code
    // que paga a outra pessoa. Vale recusar antes de gravar — e o banco
    // recusa outra vez, se este ecrã algum dia for contornado.
    if (erroChave) {
      toast.error(erroChave);
      return;
    }
    if (chavePix && !f.chave_pix_tipo) {
      toast.error("Escolha o tipo da chave Pix.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("condominios")
      .update({
        nome: f.nome.trim(),
        cnpj: f.cnpj || null,
        endereco: f.endereco || null,
        cidade: f.cidade || null,
        estado: f.estado || null,
        cep: f.cep || null,
        whatsapp_numero: f.whatsapp_numero || null,
        // As duas colunas andam juntas: a restrição
        // `condominios_chave_pix_completa` recusa uma sem a outra.
        chave_pix: chavePix || null,
        chave_pix_tipo: chavePix ? f.chave_pix_tipo || null : null,
      })
      .eq("id", condominioId);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Salvo");
  }

  if (!isSindico) {
    return (
      <div className="p-6 max-w-3xl">
        <div className="rounded-lg border border-border bg-background p-6 flex gap-3">
          <AlertCircle className="text-amber-500 shrink-0" />
          <div>
            <p className="font-semibold">Acesso restrito</p>
            <p className="text-sm text-muted-foreground">
              Apenas administradores podem editar dados da empresa.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading)
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" /> Carregando…
      </div>
    );

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Building2 />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold">Dados da empresa</h1>
          <p className="text-sm text-muted-foreground">
            Edite informações cadastrais e compartilhe o código de acesso.
          </p>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-background p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label>Nome *</Label>
            <Input value={f.nome} onChange={(e) => upd("nome", e.target.value)} />
          </div>
          <div>
            <Label>CNPJ</Label>
            <Input
              value={f.cnpj}
              onChange={(e) => handleCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
            />
            {cnpjErr && <p className="text-xs text-destructive mt-1">{cnpjErr}</p>}
          </div>
          <div>
            <Label>WhatsApp da empresa</Label>
            <Input
              value={f.whatsapp_numero}
              onChange={(e) => upd("whatsapp_numero", e.target.value)}
              placeholder="+55 11 90000-0000"
            />
          </div>
          <div>
            <Label>
              CEP {cepBusy && <Loader2 size={12} className="inline animate-spin ml-1" />}
            </Label>
            <Input
              value={f.cep}
              onChange={(e) => handleCep(e.target.value)}
              placeholder="00000-000"
              maxLength={9}
            />
          </div>
          <div>
            <Label>UF</Label>
            <Input
              value={f.estado}
              onChange={(e) => upd("estado", e.target.value.toUpperCase().slice(0, 2))}
              maxLength={2}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Endereço</Label>
            <Input value={f.endereco} onChange={(e) => upd("endereco", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Cidade</Label>
            <Input value={f.cidade} onChange={(e) => upd("cidade", e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={salvar} disabled={saving}>
            {saving ? (
              <Loader2 size={16} className="mr-2 animate-spin" />
            ) : (
              <Save size={16} className="mr-2" />
            )}{" "}
            Salvar alterações
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-background p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <QrCode size={18} />
          </div>
          <div>
            <h2 className="font-semibold">Chave Pix para receber</h2>
            <p className="text-sm text-muted-foreground mt-1">
              É para esta chave que os condôminos pagam. O dinheiro cai direto na conta do
              condomínio — o QiCond não recebe nem intermedeia nada.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label>Tipo da chave</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              value={f.chave_pix_tipo}
              onChange={(e) => upd("chave_pix_tipo", e.target.value as TipoChavePix | "")}
            >
              <option value="">Sem chave Pix</option>
              {TIPOS_CHAVE.map((t) => (
                <option key={t} value={t}>
                  {ROTULO_TIPO[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Chave</Label>
            <Input
              value={f.chave_pix}
              onChange={(e) => upd("chave_pix", e.target.value)}
              placeholder={
                f.chave_pix_tipo ? EXEMPLO_TIPO[f.chave_pix_tipo] : "Escolha o tipo primeiro"
              }
              disabled={!f.chave_pix_tipo}
            />
            {erroChave ? (
              <p className="text-xs text-destructive mt-1">{erroChave}</p>
            ) : chavePix && chavePix !== f.chave_pix.trim() ? (
              // Mostrar a forma normalizada evita a surpresa de gravar
              // "(61) 99999-8888" e ver "+5561999998888" ao recarregar.
              <p className="text-xs text-muted-foreground mt-1">
                Será gravada como <span className="font-mono">{chavePix}</span>
              </p>
            ) : null}
          </div>
        </div>

        {!f.cidade && f.chave_pix_tipo ? (
          // A cidade é campo obrigatório do BR Code. Sem ela a
          // `pix_da_cobranca` recusa, e é melhor avisar aqui do que no momento
          // em que o síndico tenta cobrar.
          <div className="flex gap-2 text-sm rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
            <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p>
              Preencha também a <strong>cidade</strong> acima: o padrão do Pix exige a cidade do
              recebedor no QR Code.
            </p>
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button onClick={salvar} disabled={saving || !!erroChave}>
            {saving ? (
              <Loader2 size={16} className="mr-2 animate-spin" />
            ) : (
              <Save size={16} className="mr-2" />
            )}{" "}
            Salvar chave Pix
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-background p-5">
        <h2 className="font-semibold">Código público</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Compartilhe este código para que moradores se cadastrem.
        </p>
        <div className="mt-3 flex gap-2 max-w-md">
          <Input readOnly value={f.codigo_publico} className="font-mono uppercase" />
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(f.codigo_publico);
              toast.success("Copiado");
            }}
          >
            <Copy size={14} />
          </Button>
        </div>
      </section>
    </div>
  );
}
