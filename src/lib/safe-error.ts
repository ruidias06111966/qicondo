/**
 * Sanitiza erros do Supabase/Postgres antes de chegarem ao cliente,
 * evitando vazar nomes de tabelas, colunas, constraints e detalhes do schema.
 *
 * - Mensagens conhecidas (regras de negócio que lançamos explicitamente
 *   nas RPCs / funções) são mantidas e traduzidas quando útil.
 * - Tudo o resto vira uma mensagem genérica.
 *
 * Use SEMPRE no servidor, antes de re-lançar erros vindos do supabase-js.
 */

const BUSINESS_RULES: Record<string, string> = {
  not_authenticated: "Precisa de iniciar sessão.",
  forbidden: "Não tem permissão para esta ação.",
  limite_plano_atingido: "Limite de utilizadores do plano atingido.",
  convite_invalido: "Convite inválido ou expirado.",
  codigo_nao_encontrado: "Código não encontrado.",
  nome_invalido: "Nome inválido.",
  codigo_invalido: "Código inválido.",
  cobranca_nao_encontrada: "Cobrança não encontrada.",
  ocorrencia_nao_encontrada: "Ocorrência não encontrada.",
  reserva_nao_encontrada: "Reserva não encontrada.",
  visitante_nao_encontrado: "Visitante não encontrado.",
  encomenda_nao_encontrada: "Encomenda não encontrada.",
  documento_nao_encontrado: "Documento não encontrado.",
  documento_nao_publicavel: "Documento ainda não está aprovado/publicado.",
  unidade_invalida: "Unidade inválida.",
  area_indisponivel: "Área indisponível.",
  periodo_invalido: "Período inválido.",
  status_invalido: "Estado inválido para esta operação.",
  horario_indisponivel: "Horário indisponível.",
  periodo_bloqueado: "Período bloqueado.",
  limite_mensal_atingido: "Limite mensal de reservas atingido.",
  capacidade_excedida: "Capacidade excedida.",
  dia_nao_permitido: "Dia não permitido para reserva.",
  fora_horario_funcionamento: "Fora do horário de funcionamento.",
  duracao_abaixo_minimo: "Duração abaixo do mínimo.",
  duracao_acima_maximo: "Duração acima do máximo.",
  antecedencia_minima_nao_atendida: "Antecedência mínima não atendida.",
  antecedencia_maxima_excedida: "Antecedência máxima excedida.",
  cnab_nao_configurado: "CNAB não configurado.",
  quantidade_invalida: "Quantidade inválida.",
  nota_invalida: "Nota inválida.",
};

/** Devolve a mensagem segura para o cliente. */
export function safeErrorMessage(err: unknown, fallback = "Operação falhou. Tente novamente."): string {
  const raw = String((err as any)?.message ?? err ?? "").trim();
  if (!raw) return fallback;

  // Match por palavra-chave de regra de negócio (lançada via RAISE EXCEPTION)
  for (const key of Object.keys(BUSINESS_RULES)) {
    if (raw === key || raw.includes(key)) return BUSINESS_RULES[key];
  }

  // Erros HTTP/postgres conhecidos -> mensagem amigável
  if (/duplicate key|unique constraint/i.test(raw)) return "Já existe um registo com estes dados.";
  if (/foreign key/i.test(raw)) return "Operação inválida: existem dados associados.";
  if (/permission denied|row-level security|RLS/i.test(raw)) return "Não tem permissão para esta ação.";
  if (/not.?null|null value/i.test(raw)) return "Faltam campos obrigatórios.";

  // Caso geral — não expor detalhes do Postgres
  return fallback;
}

/**
 * Lança um Error com mensagem segura, mantendo o original no log do servidor.
 */
export function throwSafe(err: unknown, fallback?: string): never {
  // eslint-disable-next-line no-console
  console.error("[server-error]", err);
  throw new Error(safeErrorMessage(err, fallback));
}
