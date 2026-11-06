-- Os dados que o QiCond envia ao QiGestão ao anunciar um condomínio.
--
-- PORQUE É QUE ISTO É UMA FUNÇÃO E NÃO UMA CONSULTA NA ROTA
--
-- O e-mail do síndico está em `auth.users`, que o PostgREST não expõe. Sem
-- isto, a rota teria de ir buscar os condomínios numa consulta e os e-mails
-- noutra, com uma chamada por condomínio. Uma função resolve tudo de uma vez e
-- deixa a regra de "quem é o contacto" num sítio só.
--
-- QUEM É O CONTACTO
--
-- O síndico mais antigo do condomínio. Pode haver mais do que um, e a escolha
-- tem de ser estável: se mudasse a cada execução, o QiGestão receberia um
-- contacto diferente de cada vez e acabaria com o cadastro a oscilar.

CREATE OR REPLACE FUNCTION public.condominios_para_sincronizar(_limite integer DEFAULT 200)
RETURNS TABLE (
  id uuid,
  nome text,
  documento text,
  cidade text,
  uf text,
  telefone text,
  email text,
  conhecida boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.nome,
    -- O QiGestão guarda o documento só com dígitos, e é por ele que decide se
    -- duas instalações são do mesmo cliente. Mandar "12.345.678/0001-90" numa
    -- e "12345678000190" noutra criaria dois cadastros para a mesma empresa.
    NULLIF(regexp_replace(COALESCE(c.cnpj, ''), '\D', '', 'g'), ''),
    c.cidade,
    c.estado,
    c.whatsapp_numero,
    (SELECT u.email
       FROM public.user_roles ur
       JOIN auth.users u ON u.id = ur.user_id
      WHERE ur.condominio_id = c.id AND ur.role = 'sindico'
      ORDER BY ur.created_at, ur.id
      LIMIT 1),
    c.assinatura_conhecida
  FROM public.condominios c
  -- Os mais desactualizados primeiro, para que uma falha a meio não deixe
  -- sempre os mesmos condomínios por sincronizar.
  ORDER BY c.assinatura_sincronizada_em NULLS FIRST, c.id
  LIMIT GREATEST(_limite, 1);
$$;

-- Devolve o e-mail de uma pessoa: só a service role, que é quem corre o cron.
-- Nem `authenticated` — um síndico não tem que ver o contacto do síndico de
-- outro condomínio, e esta função não filtra por condomínio.
REVOKE ALL ON FUNCTION public.condominios_para_sincronizar(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.condominios_para_sincronizar(integer) TO service_role;
