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

  // Acordos de parcelamento
  acordo_nao_encontrado: "Acordo não encontrado.",
  acordo_nao_ativo: "O acordo não está em cumprimento.",
  sem_cobrancas: "Escolha ao menos uma cobrança.",
  cobranca_invalida: "Cobrança inválida para esta operação.",
  desconto_excede_encargos: "O desconto não pode passar da multa e dos juros.",
  entrada_excede_total: "A entrada não pode passar do total.",
  num_parcelas_invalido: "Número de parcelas inválido.",

  // Carta de cobrança e nada consta
  sem_divida: "Esta unidade não tem valores em aberto.",
  unidade_com_debito: "A unidade tem valores em aberto.",
  unidade_com_acordo: "A unidade tem um acordo de parcelamento em cumprimento.",
  prazo_invalido: "Prazo inválido.",
  validade_invalida: "Validade inválida.",

  // Advertências e multas
  infracao_nao_encontrada: "Infração não encontrada.",
  infracao_ja_cancelada: "A infração já está cancelada.",
  taxa_mensal_em_falta: "Falta a contribuição mensal da unidade.",
  multa_acima_do_tecto: "A multa passa do tecto legal.",
  multa_ja_paga: "A cobrança desta multa já recebeu pagamento.",
  motivo_obrigatorio: "Informe o motivo.",
  data_invalida: "Data inválida.",
  vencimento_invalido: "Vencimento inválido.",
  valor_invalido: "Valor inválido.",
  valor_negativo: "O valor não pode ser negativo.",
  total_invalido: "Total inválido.",

  // Assembleias
  assembleia_nao_encontrada: "Assembleia não encontrada.",
  assembleia_ja_convocada: "A assembleia já foi convocada.",
  assembleia_ja_encerrada: "A assembleia já está encerrada.",
  assembleia_encerrada_imutavel: "A assembleia está encerrada e não pode ser alterada.",
  assembleia_nao_aberta: "A assembleia não está aberta.",
  assembleia_nao_em_curso: "A assembleia não está em curso.",
  sem_ordem_do_dia: "A assembleia não tem ordem do dia.",
  pauta_nao_encontrada: "Pauta não encontrada.",
  pauta_apurada_imutavel: "A pauta já foi apurada e não pode ser alterada.",
  pauta_ja_apurada: "A pauta já foi apurada.",
  votacao_nao_aberta: "A votação não está aberta.",
  votacao_ja_encerrada: "A votação já está encerrada.",
  votacao_encerrada: "A votação está encerrada.",
  voto_apurado_imutavel: "O voto já foi apurado e não pode ser alterado.",
  inadimplente_nao_vota: "Unidade inadimplente não vota (art. 1.335, III).",
  nao_e_proprietario_da_unidade: "Só o proprietário da unidade pode fazer isto.",
  nao_e_proprietario: "Só o proprietário pode fazer isto.",
  nao_e_representante: "Só o representante da unidade vota por ela.",
  sem_peso_de_voto: "A unidade não tem peso de voto.",
  fracao_ideal_em_falta: "Falta a fração ideal da unidade.",
  inicio_no_passado: "O início não pode ser no passado.",
  janela_invalida: "Janela de votação inválida.",
  modo_invalido: "Modo inválido.",

  // Balancetes
  balancete_nao_encontrado: "Balancete não encontrado.",
  balancete_publicado_imutavel: "O balancete está publicado e não pode ser alterado.",
  balancete_publicado: "O balancete já está publicado.",
  balancete_nasce_rascunho: "Um balancete nasce como rascunho.",

  // Coerência entre condomínios — o gatilho diz a coluna e a tabela no HINT,
  // que não sai daqui: ao cliente basta saber que a referência é de outro
  // condomínio.
  condominio_incoerente: "O registo aponta para dados de outro condomínio.",
  condominio_sem_unidades: "O condomínio não tem unidades.",
  condominio_ou_cobranca_obrigatorio: "Informe o condomínio ou a cobrança.",
  unidade_de_outro_condominio: "A unidade é de outro condomínio.",
  unidade_nao_encontrada: "Unidade não encontrada.",

  // Plano de contas. O HINT destas diz qual dos casos é — pai analítico, pai
  // de outro tipo, ciclo — e é essa frase que resolve o problema a quem está
  // a montar o plano.
  conta_nao_encontrada: "Conta não encontrada.",
  conta_pai_invalida: "A conta superior não serve.",
  conta_sintetica_nao_aceita_lancamento: "Esta conta agrupa outras e não aceita lançamentos.",
  conta_em_uso: "A conta já tem lançamentos.",
  conta_com_filhas: "A conta tem outras abaixo dela.",
  conta_invalida: "Conta inválida.",
  nome_obrigatorio: "Informe o nome.",
  categoria_codigo_formato: "O código da conta só aceita números e pontos, como 2.2.01.",
  categorias_codigo_unico: "Já existe uma conta com esse código.",
  categorias_nome_unico: "Já existe uma conta com esse nome.",

  // Anexos de comprovação.
  anexo_nao_encontrado: "Anexo não encontrado.",
  anexo_sem_caminho: "O anexo não tem ficheiro associado.",
  anexo_caminho_invalido: "O caminho do ficheiro não corresponde a este condomínio.",
  anexo_caminho_unico: "Este ficheiro já está anexado.",
  anexo_lancamento_nao_encontrado: "O lançamento a que o anexo se refere não existe.",
  anexo_de_outro_condominio: "O lançamento é de outro condomínio.",
  anexo_entidade_desconhecida: "Tipo de lançamento não suportado para anexos.",
};

/**
 * Regras cujo HINT do Postgres é melhor do que a mensagem fixa — porque diz o
 * número concreto: qual é o tecto da multa e como foi calculado, quanto a
 * unidade tem em aberto, qual o acordo que impede o nada consta.
 *
 * Só estas. O HINT é texto que nós escrevemos nas migrações, mas não todos
 * são para o cliente: o de `condominio_incoerente`, por exemplo, nomeia a
 * coluna e a tabela.
 */
const COM_DETALHE = new Set([
  "multa_acima_do_tecto",
  "taxa_mensal_em_falta",
  "multa_ja_paga",
  "unidade_com_debito",
  "unidade_com_acordo",
  "sem_divida",
  "desconto_excede_encargos",
  "entrada_excede_total",
  "data_invalida",
  "vencimento_invalido",
  "motivo_obrigatorio",
  "prazo_invalido",
  "validade_invalida",
  "inadimplente_nao_vota",
  "nao_e_representante",
  "fracao_ideal_em_falta",
  "conta_pai_invalida",
  "conta_sintetica_nao_aceita_lancamento",
  "conta_em_uso",
  "conta_com_filhas",
  "conta_invalida",
  "anexo_caminho_invalido",
  "anexo_lancamento_nao_encontrado",
]);

/** Devolve a mensagem segura para o cliente. */
export function safeErrorMessage(
  err: unknown,
  fallback = "Operação falhou. Tente novamente.",
): string {
  const raw = String((err as any)?.message ?? err ?? "").trim();
  if (!raw) return fallback;

  const hint = String((err as any)?.hint ?? "").trim();

  // Match por palavra-chave de regra de negócio (lançada via RAISE EXCEPTION)
  for (const key of Object.keys(BUSINESS_RULES)) {
    if (raw === key || raw.includes(key)) {
      if (hint && COM_DETALHE.has(key)) return `${BUSINESS_RULES[key]} ${hint}`;
      return BUSINESS_RULES[key];
    }
  }

  // Erros HTTP/postgres conhecidos -> mensagem amigável
  if (/duplicate key|unique constraint/i.test(raw)) return "Já existe um registo com estes dados.";
  if (/foreign key/i.test(raw)) return "Operação inválida: existem dados associados.";
  if (/permission denied|row-level security|RLS/i.test(raw))
    return "Não tem permissão para esta ação.";
  if (/not.?null|null value/i.test(raw)) return "Faltam campos obrigatórios.";

  // Caso geral — não expor detalhes do Postgres
  return fallback;
}

/**
 * Lança um Error com mensagem segura, mantendo o original no log do servidor.
 */
export function throwSafe(err: unknown, fallback?: string): never {
  console.error("[server-error]", err);
  throw new Error(safeErrorMessage(err, fallback));
}
