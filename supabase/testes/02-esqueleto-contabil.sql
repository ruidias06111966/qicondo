-- Extensão do esqueleto: o que o plano de contas e os anexos tocam.
-- Vai depois de 00-esqueleto.sql e 01-esqueleto-financeiro.sql.

-- No esquema real a categoria tem estas colunas; o esqueleto do orçamento já
-- trouxe `cor` e `fundo_reserva`, faltam as datas.
ALTER TABLE public.categorias_financeiras
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- É esta restrição que força o caminho do sufixo no `semear_plano_contas`.
-- Sem ela, o teste da colisão de nomes não testa nada.
ALTER TABLE public.categorias_financeiras
  ADD CONSTRAINT categorias_nome_unico UNIQUE (condominio_id, nome);

-- Quem mora na unidade: é o que a RLS dos anexos usa.
CREATE TABLE public.unidade_moradores (
  user_id uuid NOT NULL,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, unidade_id));

CREATE OR REPLACE FUNCTION public.is_morador_da_unidade(_uid uuid, _unidade_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.unidade_moradores
                  WHERE user_id = _uid AND unidade_id = _unidade_id);
$$;

-- Infrações, reduzidas ao que o anexo precisa.
CREATE TABLE public.infracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  descricao text);

-- Rubricas do orçamento: o gatilho da conta sintética apanha-as também.
CREATE TABLE public.orcamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  exercicio integer NOT NULL);

CREATE TABLE public.orcamento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES public.categorias_financeiras(id) ON DELETE CASCADE,
  valor_previsto numeric(14,2) NOT NULL DEFAULT 0);

-- ------------------------------------------------------------
-- Storage.
--
-- Stub: as políticas da migração são criadas sobre `storage.objects`, por isso
-- a tabela tem de existir. `foldername` devolve os segmentos do caminho sem o
-- nome do ficheiro, como a real.
-- ------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE storage.buckets (
  id text PRIMARY KEY, name text, public boolean NOT NULL DEFAULT false);

CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text NOT NULL);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION storage.foldername(name text)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1];
$$;
