-- Terceira camada do esqueleto, para a carta de cobrança, o nada consta e as
-- infrações.
--
-- Vai depois de 00-esqueleto.sql e 01-esqueleto-financeiro.sql, **em vez de**
-- 02-esqueleto-contabil.sql: o 02 cria uma `infracoes` reduzida, e aqui quem
-- a cria é a migração real.

-- O cabeçalho do condomínio que a carta imprime.
ALTER TABLE public.condominios
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS cep text;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  nome_completo text);

-- O `vinculo` decide quem aparece como destinatário da carta: a carta dirige-se
-- ao proprietário, não ao inquilino, porque é do proprietário a dívida.
CREATE TABLE IF NOT EXISTS public.unidade_moradores (
  user_id uuid NOT NULL,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  vinculo text NOT NULL DEFAULT 'proprietario',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, unidade_id));

CREATE OR REPLACE FUNCTION public.is_morador_da_unidade(_uid uuid, _unidade_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.unidade_moradores
                  WHERE user_id = _uid AND unidade_id = _unidade_id);
$$;

-- Acordos, reduzidos ao que o nada consta lê: um acordo activo é dívida
-- parcelada, e é por isso que ele recusa.
CREATE TABLE IF NOT EXISTS public.acordos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  numero integer NOT NULL,
  data_acordo date NOT NULL DEFAULT CURRENT_DATE,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  num_parcelas integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'ativo');

-- `gen_random_bytes` vem do pgcrypto, que no Supabase vive no schema
-- `extensions`. Aqui basta devolver bytes: o sufixo do código da certidão só
-- tem de ser imprevisível, e no teste nem isso.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE OR REPLACE FUNCTION extensions.gen_random_bytes(_n integer)
RETURNS bytea LANGUAGE sql VOLATILE AS $$
  SELECT decode(string_agg(lpad(to_hex((random() * 255)::int), 2, '0'), ''), 'hex')
    FROM generate_series(1, _n);
$$;

-- O gatilho de coerência entre condomínios, em versão simples. O real está em
-- 20261105160000 e tem a sua própria bateria; aqui só precisa de existir para
-- a `certidoes` poder criar o gatilho.
-- Os argumentos vêm aos pares (coluna, tabela) e podem ser vários: a
-- `infracoes` passa três. Tratar só o primeiro par deixava dois por verificar
-- e o teste passava sem testar.
CREATE OR REPLACE FUNCTION public.validar_coerencia_condominio()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  _i int;
  _col text;
  _tab text;
  _ref uuid;
  _cond uuid;
BEGIN
  _i := 0;
  WHILE _i < TG_NARGS LOOP
    _col := TG_ARGV[_i];
    _tab := TG_ARGV[_i + 1];

    EXECUTE format('SELECT ($1).%I', _col) INTO _ref USING NEW;

    IF _ref IS NOT NULL THEN
      EXECUTE format('SELECT condominio_id FROM public.%I WHERE id = $1', _tab)
         INTO _cond USING _ref;

      IF _cond IS NOT NULL AND _cond <> NEW.condominio_id THEN
        RAISE EXCEPTION 'condominio_incoerente'
          USING HINT = format('%s.%s aponta para outro condomínio.', _tab, _col);
      END IF;
    END IF;

    _i := _i + 2;
  END LOOP;

  RETURN NEW;
END;
$$;
