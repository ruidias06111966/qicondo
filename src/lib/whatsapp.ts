import { supabase } from "@/integrations/supabase/client";

/** Limpa um telefone para o formato internacional sem caracteres especiais.
 *  Aceita "(11) 98765-4321", "+55 11 98765-4321", "5511987654321", etc. */
export function normalizarTelefone(input: string | null | undefined): string | null {
  if (!input) return null;
  let n = input.replace(/\D/g, "");
  if (!n) return null;
  // Se tiver DDD brasileiro mas faltar o 55, adiciona
  if (n.length === 10 || n.length === 11) n = "55" + n;
  return n;
}

/** Gera link wa.me com mensagem pré-preenchida. */
export function linkWhatsApp(telefone: string, mensagem: string): string | null {
  const tel = normalizarTelefone(telefone);
  if (!tel) return null;
  return `https://wa.me/${tel}?text=${encodeURIComponent(mensagem)}`;
}

/** Registra uma notificação no banco como pendente. O envio real
 *  pode ser disparado por uma edge function quando um provedor for plugado. */
export async function registrarNotificacaoWA(params: {
  condominioId: string;
  unidadeId?: string | null;
  destinatarioUserId?: string | null;
  destinatarioTelefone: string;
  destinatarioNome?: string | null;
  mensagem: string;
  contexto: "encomenda" | "visitante" | "reserva" | "cobranca";
  contextoId: string;
}) {
  const tel = normalizarTelefone(params.destinatarioTelefone);
  if (!tel) return null;
  const link = linkWhatsApp(tel, params.mensagem);
  const { data, error } = await supabase.from("notificacoes_whatsapp").insert({
    condominio_id: params.condominioId,
    unidade_id: params.unidadeId ?? null,
    destinatario_user_id: params.destinatarioUserId ?? null,
    destinatario_telefone: tel,
    destinatario_nome: params.destinatarioNome ?? null,
    mensagem: params.mensagem,
    contexto: params.contexto,
    contexto_id: params.contextoId,
    status: "pendente",
    link_wa: link,
  }).select("id").single();
  if (error) {
    console.error("Erro ao registrar notificação WA", error);
    return null;
  }
  return { id: data.id, link };
}

/** Busca os moradores de uma unidade com seus telefones. */
export async function moradoresDaUnidade(unidadeId: string) {
  const { data } = await supabase
    .from("unidade_moradores")
    .select("user_id, profiles:profiles!unidade_moradores_user_id_fkey(nome_completo, telefone)")
    .eq("unidade_id", unidadeId);

  // Como não há FK declarada, fazemos a busca em duas etapas
  if (!data || data.length === 0) {
    return [] as Array<{ user_id: string; nome: string | null; telefone: string | null }>;
  }
  const userIds = data.map((d: any) => d.user_id);
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, nome_completo, telefone")
    .in("id", userIds);
  return (profs ?? []).map((p: any) => ({
    user_id: p.id,
    nome: p.nome_completo,
    telefone: p.telefone,
  }));
}
