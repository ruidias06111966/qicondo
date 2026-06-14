
-- 1) Substituir política de UPDATE do síndico para bloquear colunas de billing/suspensão
DROP POLICY IF EXISTS "Síndico atualiza condomínio" ON public.condominios;

CREATE POLICY "Síndico atualiza condomínio (não-billing)"
ON public.condominios
FOR UPDATE
TO authenticated
USING (public.is_sindico(auth.uid(), id))
WITH CHECK (
  public.is_sindico(auth.uid(), id)
  AND plano IS NOT DISTINCT FROM (SELECT plano FROM public.condominios c2 WHERE c2.id = condominios.id)
  AND suspenso IS NOT DISTINCT FROM (SELECT suspenso FROM public.condominios c2 WHERE c2.id = condominios.id)
  AND motivo_suspensao IS NOT DISTINCT FROM (SELECT motivo_suspensao FROM public.condominios c2 WHERE c2.id = condominios.id)
  AND valor_mensal IS NOT DISTINCT FROM (SELECT valor_mensal FROM public.condominios c2 WHERE c2.id = condominios.id)
  AND assinatura_inicio IS NOT DISTINCT FROM (SELECT assinatura_inicio FROM public.condominios c2 WHERE c2.id = condominios.id)
  AND assinatura_fim IS NOT DISTINCT FROM (SELECT assinatura_fim FROM public.condominios c2 WHERE c2.id = condominios.id)
);

-- 2) Bloquear RPC público de fila de notificações WhatsApp
REVOKE EXECUTE ON FUNCTION public.enqueue_documento_comunicado(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_documento_comunicado(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_documento_comunicado(uuid) TO service_role;

-- Adiciona verificação de caller dentro da função (defesa em profundidade)
CREATE OR REPLACE FUNCTION public.enqueue_documento_comunicado(_documento_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _doc RECORD;
  _cond_nome TEXT;
  _template TEXT;
  _msg TEXT;
  _count INT := 0;
  _uid uuid := auth.uid();
BEGIN
  SELECT d.* INTO _doc FROM public.documentos d WHERE d.id = _documento_id;
  IF _doc IS NULL THEN RETURN 0; END IF;

  -- Apenas síndico/admin do condomínio (ou execução server-side sem auth.uid()) pode disparar
  IF _uid IS NOT NULL AND NOT public.is_sindico(_uid, _doc.condominio_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT _doc.aprovado OR NOT _doc.visivel_publico THEN RETURN 0; END IF;
  IF _doc.categoria NOT IN ('comunicado','informativo') THEN RETURN 0; END IF;

  SELECT nome INTO _cond_nome FROM public.condominios WHERE id = _doc.condominio_id;
  SELECT COALESCE(template_comunicado,
    '📢 *{{condominio}}*\n\nNovo {{categoria}}: *{{titulo}}*\n\n{{link}}')
    INTO _template
    FROM public.wa_config WHERE condominio_id = _doc.condominio_id;

  _msg := replace(replace(replace(replace(_template,
    '{{condominio}}', COALESCE(_cond_nome, 'Condomínio')),
    '{{categoria}}', _doc.categoria::text),
    '{{titulo}}', _doc.titulo),
    '{{link}}', '__SIGNED_LINK__');

  INSERT INTO public.wa_notif_jobs (
    condominio_id, documento_id, destinatario_user_id,
    destinatario_telefone, destinatario_nome, contexto, mensagem
  )
  SELECT
    _doc.condominio_id, _doc.id, p.id,
    p.telefone, p.nome_completo, 'comunicado', _msg
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.condominio_id = _doc.condominio_id
  LEFT JOIN public.wa_preferencias pref
    ON pref.user_id = p.id AND pref.condominio_id = _doc.condominio_id
  WHERE p.telefone IS NOT NULL
    AND length(regexp_replace(p.telefone, '\D', '', 'g')) >= 10
    AND COALESCE(pref.receber_comunicados, true) = true
  GROUP BY _doc.condominio_id, _doc.id, p.id, p.telefone, p.nome_completo;

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$function$;
