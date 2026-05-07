import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Upload, Download, Trash2, Eye, EyeOff, CheckCircle2, Loader2, MessageCircle, Filter, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import {
  enfileirarNotificacaoDocumento,
  reenviarFalhasDocumento,
  historicoNotificacoesDocumento,
} from "@/server/documentos.functions";

export const Route = createFileRoute("/app/documentos")({
  head: () => ({ meta: [{ title: "Documentos — CONDOZAP" }] }),
  component: DocumentosPage,
});

const CATEGORIAS = [
  { v: "convencao", l: "Convenção" },
  { v: "regimento", l: "Regimento Interno" },
  { v: "ata", l: "Ata de Assembleia" },
  { v: "comunicado", l: "Comunicado" },
  { v: "informativo", l: "Informativo" },
  { v: "contrato", l: "Contrato" },
  { v: "financeiro", l: "Financeiro" },
  { v: "outros", l: "Outros" },
] as const;

type Doc = {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: string;
  storage_path: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  visivel_publico: boolean;
  disponivel_whatsapp: boolean;
  aprovado: boolean;
  created_at: string;
};

function fmtBytes(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function DocumentosPage() {
  const { condominioId, isSindico, isContador } = useCondominioAtivo();
  const podeGerir = isSindico || isContador;
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<string>("todos");
  const [notificandoId, setNotificandoId] = useState<string | null>(null);
  const notificarFn = useServerFn(notificarDocumentoWA);

  // form
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<string>("outros");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  const carregar = async () => {
    if (!condominioId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("documentos")
      .select("*")
      .eq("condominio_id", condominioId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setDocs((data as Doc[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, [condominioId]);

  async function enviar() {
    if (!condominioId || !arquivo || !titulo.trim()) {
      toast.error("Informe título e arquivo");
      return;
    }
    if (arquivo.size > 25 * 1024 * 1024) {
      toast.error("Arquivo acima de 25 MB");
      return;
    }
    setEnviando(true);
    const ext = arquivo.name.split(".").pop() || "bin";
    const path = `${condominioId}/${crypto.randomUUID()}/${Date.now()}.${ext}`;

    const up = await supabase.storage.from("documentos-condo").upload(path, arquivo, {
      contentType: arquivo.type || undefined,
      upsert: false,
    });
    if (up.error) {
      setEnviando(false);
      toast.error(up.error.message);
      return;
    }
    const { error } = await supabase.from("documentos").insert({
      condominio_id: condominioId,
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      categoria: categoria as any,
      storage_path: path,
      mime_type: arquivo.type || null,
      tamanho_bytes: arquivo.size,
      enviado_por: (await supabase.auth.getUser()).data.user!.id,
    });
    setEnviando(false);
    if (error) {
      await supabase.storage.from("documentos-condo").remove([path]);
      toast.error(error.message);
      return;
    }
    toast.success("Documento enviado para auditoria");
    setOpen(false);
    setTitulo(""); setDescricao(""); setCategoria("outros"); setArquivo(null);
    carregar();
  }

  async function baixar(d: Doc) {
    const { data, error } = await supabase.storage
      .from("documentos-condo")
      .createSignedUrl(d.storage_path, 60);
    if (error || !data) { toast.error("Não foi possível baixar"); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function aprovar(d: Doc) {
    const { error } = await supabase
      .from("documentos")
      .update({
        aprovado: !d.aprovado,
        aprovado_por: (await supabase.auth.getUser()).data.user!.id,
        aprovado_em: new Date().toISOString(),
      })
      .eq("id", d.id);
    if (error) toast.error(error.message); else { toast.success(d.aprovado ? "Aprovação removida" : "Documento aprovado"); carregar(); }
  }

  async function toggleVisibilidade(d: Doc, campo: "visivel_publico" | "disponivel_whatsapp") {
    const patch = campo === "visivel_publico"
      ? { visivel_publico: !d.visivel_publico }
      : { disponivel_whatsapp: !d.disponivel_whatsapp };
    const { error } = await supabase.from("documentos").update(patch).eq("id", d.id);
    if (error) toast.error(error.message); else carregar();
  }

  async function excluir(d: Doc) {
    if (!confirm(`Excluir "${d.titulo}"?`)) return;
    await supabase.storage.from("documentos-condo").remove([d.storage_path]);
    const { error } = await supabase.from("documentos").delete().eq("id", d.id);
    if (error) toast.error(error.message); else { toast.success("Excluído"); carregar(); }
  }

  async function notificar(d: Doc) {
    if (!d.aprovado || !d.visivel_publico) {
      toast.error("Aprove e marque como público antes de notificar");
      return;
    }
    if (!confirm(`Enviar notificação por WhatsApp a todos os moradores sobre "${d.titulo}"?`)) return;
    setNotificandoId(d.id);
    try {
      const r = await notificarFn({ data: { documento_id: d.id } });
      toast.success(`Enviadas: ${r.enviados} · Falhas: ${r.falhas} (de ${r.total})`);
    } catch (e: any) {
      const msg = e?.message || "Falha ao notificar";
      toast.error(msg === "wa_nao_configurado" ? "Configure o WhatsApp em /app/whatsapp" : msg);
    } finally {
      setNotificandoId(null);
    }
  }

  const filtrados = filtro === "todos" ? docs : docs.filter((d) => d.categoria === filtro);

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <FileText />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Documentos oficiais</h1>
            <p className="text-sm text-muted-foreground">
              Convenções, atas, contratos e comunicados. Marque como público para que moradores acessem.
            </p>
          </div>
        </div>
        {podeGerir && (
          <Button onClick={() => setOpen((v) => !v)}>
            <Upload size={16} className="mr-2" /> Novo documento
          </Button>
        )}
      </header>

      {open && podeGerir && (
        <section className="rounded-xl border border-border bg-background p-5 space-y-4">
          <h2 className="font-semibold">Enviar documento</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Título *</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ata Assembleia 2026-03" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div>
            <Label>Arquivo (PDF, DOCX, imagens — até 25 MB)</Label>
            <Input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={enviar} disabled={enviando}>
              {enviando ? <Loader2 size={16} className="animate-spin mr-2" /> : <Upload size={16} className="mr-2" />}
              Enviar
            </Button>
          </div>
        </section>
      )}

      <div className="flex items-center gap-2">
        <Filter size={16} className="text-muted-foreground" />
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as categorias</SelectItem>
            {CATEGORIAS.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" /> Carregando…</div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          Nenhum documento ainda.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtrados.map((d) => (
            <div key={d.id} className="rounded-xl border border-border bg-background p-4 flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="h-10 w-10 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{d.titulo}</p>
                    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {CATEGORIAS.find((c) => c.v === d.categoria)?.l ?? d.categoria}
                    </span>
                    {d.aprovado ? (
                      <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">Aprovado</span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-500">Em auditoria</span>
                    )}
                    {d.visivel_publico && <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-primary/15 text-primary">Público</span>}
                    {d.disponivel_whatsapp && <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-green-500/15 text-green-700 dark:text-green-400">WhatsApp</span>}
                  </div>
                  {d.descricao && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{d.descricao}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{fmtBytes(d.tamanho_bytes)} · {new Date(d.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => baixar(d)}>
                  <Download size={14} className="mr-1" /> Baixar
                </Button>
                {podeGerir && (
                  <>
                    <label className="flex items-center gap-2 text-xs px-2">
                      <Switch checked={d.visivel_publico} onCheckedChange={() => toggleVisibilidade(d, "visivel_publico")} />
                      {d.visivel_publico ? <Eye size={12} /> : <EyeOff size={12} />} Público
                    </label>
                    <label className="flex items-center gap-2 text-xs px-2">
                      <Switch checked={d.disponivel_whatsapp} onCheckedChange={() => toggleVisibilidade(d, "disponivel_whatsapp")} />
                      <MessageCircle size={12} /> Bot
                    </label>
                    <Button variant={d.aprovado ? "outline" : "default"} size="sm" onClick={() => aprovar(d)}>
                      <CheckCircle2 size={14} className="mr-1" /> {d.aprovado ? "Reprovar" : "Aprovar"}
                    </Button>
                    {isSindico && d.aprovado && d.visivel_publico && (
                      <Button variant="secondary" size="sm" onClick={() => notificar(d)} disabled={notificandoId === d.id}>
                        {notificandoId === d.id ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Send size={14} className="mr-1" />}
                        Notificar WhatsApp
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => excluir(d)}>
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
