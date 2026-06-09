
-- Limite por plano
CREATE OR REPLACE FUNCTION public.limite_usuarios_plano(_condominio_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE plano::text
    WHEN 'basico' THEN 3
    WHEN 'profissional' THEN 10
    WHEN 'enterprise' THEN NULL  -- ilimitado
    ELSE 3
  END
  FROM public.condominios
  WHERE id = _condominio_id
$$;

-- Conta utilizadores únicos da empresa + convites pendentes não expirados
CREATE OR REPLACE FUNCTION public.contar_usuarios_empresa(_condominio_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(DISTINCT user_id)::int FROM public.user_roles WHERE condominio_id = _condominio_id)
  + (SELECT COUNT(DISTINCT lower(email))::int FROM public.convites
       WHERE condominio_id = _condominio_id
         AND status = 'pendente'
         AND expira_em > now()
         AND lower(email) NOT IN (
           SELECT lower(au.email) FROM auth.users au
           JOIN public.user_roles ur ON ur.user_id = au.id
           WHERE ur.condominio_id = _condominio_id
         )
    )
$$;

-- Trigger: bloqueia novos user_roles quando o limite do plano foi atingido
CREATE OR REPLACE FUNCTION public.tg_check_limite_usuarios()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _limite integer;
  _atual integer;
BEGIN
  _limite := public.limite_usuarios_plano(NEW.condominio_id);
  IF _limite IS NULL THEN
    RETURN NEW; -- enterprise, ilimitado
  END IF;

  -- Se o user já tem outro role na mesma empresa, não conta como novo utilizador
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE condominio_id = NEW.condominio_id AND user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(DISTINCT user_id)::int INTO _atual
  FROM public.user_roles
  WHERE condominio_id = NEW.condominio_id;

  IF _atual >= _limite THEN
    RAISE EXCEPTION 'limite_plano_atingido' USING HINT = 'O plano atual permite até ' || _limite || ' utilizadores.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_limite_usuarios ON public.user_roles;
CREATE TRIGGER check_limite_usuarios
BEFORE INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.tg_check_limite_usuarios();

-- Trigger: bloqueia novos convites quando o teto foi atingido
CREATE OR REPLACE FUNCTION public.tg_check_limite_convites()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _limite integer;
  _atual integer;
BEGIN
  _limite := public.limite_usuarios_plano(NEW.condominio_id);
  IF _limite IS NULL THEN
    RETURN NEW;
  END IF;

  -- Se o e-mail já é membro da empresa, é só re-convite
  IF EXISTS (
    SELECT 1
    FROM auth.users au
    JOIN public.user_roles ur ON ur.user_id = au.id
    WHERE ur.condominio_id = NEW.condominio_id
      AND lower(au.email) = lower(NEW.email)
  ) THEN
    RETURN NEW;
  END IF;

  _atual := public.contar_usuarios_empresa(NEW.condominio_id);

  IF _atual >= _limite THEN
    RAISE EXCEPTION 'limite_plano_atingido' USING HINT = 'O plano atual permite até ' || _limite || ' utilizadores (incluindo convites pendentes).';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_limite_convites ON public.convites;
CREATE TRIGGER check_limite_convites
BEFORE INSERT ON public.convites
FOR EACH ROW EXECUTE FUNCTION public.tg_check_limite_convites();
