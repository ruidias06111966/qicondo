-- Trigger: cria cobrança automaticamente quando reserva é confirmada com taxa > 0
CREATE OR REPLACE FUNCTION public.tg_reserva_gerar_cobranca()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cob_id uuid;
  _venc date;
  _area_nome text;
BEGIN
  -- Só gera quando passou para confirmada, tem taxa e ainda não tem cobrança vinculada
  IF NEW.status = 'confirmada'
     AND COALESCE(NEW.taxa, 0) > 0
     AND NEW.cobranca_id IS NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
  THEN
    SELECT nome INTO _area_nome FROM public.areas_comuns WHERE id = NEW.area_id;
    -- Vencimento: 1 dia antes da reserva, ou hoje+3 se reserva é em <3 dias
    _venc := GREATEST(CURRENT_DATE + 3, (NEW.inicio AT TIME ZONE 'America/Sao_Paulo')::date - 1);

    INSERT INTO public.cobrancas (
      condominio_id, unidade_id, competencia, vencimento, valor,
      descricao, status, criado_por
    ) VALUES (
      NEW.condominio_id, NEW.unidade_id,
      date_trunc('month', NEW.inicio)::date,
      _venc, NEW.taxa,
      'Taxa de uso — ' || COALESCE(_area_nome, 'área comum'),
      'pendente', COALESCE(NEW.aprovado_por, NEW.solicitante_id)
    ) RETURNING id INTO _cob_id;

    NEW.cobranca_id := _cob_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reserva_gerar_cobranca ON public.reservas;
CREATE TRIGGER trg_reserva_gerar_cobranca
BEFORE INSERT OR UPDATE OF status ON public.reservas
FOR EACH ROW
EXECUTE FUNCTION public.tg_reserva_gerar_cobranca();