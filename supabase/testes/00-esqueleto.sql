-- Esqueleto mínimo do esquema real, só com o que a migração do orçamento toca.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text);

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid;
$$;

CREATE TYPE public.tipo_lancamento AS ENUM ('receita','despesa');
CREATE TYPE public.assembleia_status AS ENUM ('rascunho','convocada','em_curso','encerrada','cancelada');
CREATE TYPE public.assembleia_tipo AS ENUM ('ordinaria','extraordinaria');

CREATE TABLE public.condominios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text NOT NULL);

CREATE TABLE public.unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  bloco text, numero text NOT NULL,
  fracao_ideal numeric(10,6), taxa_mensal numeric(12,2));

CREATE TABLE public.categorias_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  nome text NOT NULL, tipo public.tipo_lancamento NOT NULL,
  ativo boolean NOT NULL DEFAULT true, ordem integer NOT NULL DEFAULT 0);

CREATE TABLE public.despesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  categoria_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  descricao text NOT NULL, valor numeric(12,2) NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE);

CREATE TABLE public.assembleias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  titulo text NOT NULL, tipo public.assembleia_tipo NOT NULL DEFAULT 'ordinaria',
  status public.assembleia_status NOT NULL DEFAULT 'rascunho');

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid, user_id uuid, acao text, entidade text,
  entidade_id uuid, metadata jsonb, created_at timestamptz DEFAULT now());

CREATE TABLE public.user_roles (
  user_id uuid NOT NULL, condominio_id uuid NOT NULL, role text NOT NULL,
  PRIMARY KEY (user_id, condominio_id, role));

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.is_sindico(_uid uuid, _cond uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles r
    WHERE r.user_id = _uid AND r.condominio_id = _cond AND r.role IN ('sindico','admin'));
$$;

CREATE OR REPLACE FUNCTION public.pode_gerir_financeiro(_uid uuid, _cond uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles r
    WHERE r.user_id = _uid AND r.condominio_id = _cond
      AND r.role IN ('sindico','admin','contador','financeiro'));
$$;

CREATE OR REPLACE FUNCTION public.is_member_of(_uid uuid, _cond uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles r
    WHERE r.user_id = _uid AND r.condominio_id = _cond);
$$;
