
-- =========================================
-- 1) Tabela de documentos oficiais
-- =========================================
CREATE TYPE public.documento_categoria AS ENUM (
  'convencao', 'regimento', 'ata', 'comunicado', 'informativo', 'contrato', 'financeiro', 'outros'
);

CREATE TABLE public.documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  condominio_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  categoria public.documento_categoria NOT NULL DEFAULT 'outros',
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  visivel_publico BOOLEAN NOT NULL DEFAULT false,
  disponivel_whatsapp BOOLEAN NOT NULL DEFAULT false,
  aprovado BOOLEAN NOT NULL DEFAULT false,
  aprovado_por UUID,
  aprovado_em TIMESTAMPTZ,
  enviado_por UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documentos_condominio ON public.documentos(condominio_id);
CREATE INDEX idx_documentos_categoria ON public.documentos(condominio_id, categoria);

ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Síndico/Contador gerenciam documentos"
ON public.documentos FOR ALL TO authenticated
USING (public.is_sindico(auth.uid(), condominio_id) OR public.is_contador(auth.uid(), condominio_id))
WITH CHECK (public.is_sindico(auth.uid(), condominio_id) OR public.is_contador(auth.uid(), condominio_id));

CREATE POLICY "Membros veem documentos públicos aprovados"
ON public.documentos FOR SELECT TO authenticated
USING (
  public.is_member_of(auth.uid(), condominio_id)
  AND aprovado = true
  AND visivel_publico = true
);

CREATE TRIGGER trg_documentos_updated_at
BEFORE UPDATE ON public.documentos
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================
-- 2) Storage bucket para documentos
-- =========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-condo', 'documentos-condo', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (path layout: {condominio_id}/{documento_id}/arquivo)
CREATE POLICY "Membros baixam documentos públicos do condomínio"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documentos-condo'
  AND EXISTS (
    SELECT 1 FROM public.documentos d
    WHERE d.storage_path = storage.objects.name
      AND public.is_member_of(auth.uid(), d.condominio_id)
      AND (
        d.aprovado AND d.visivel_publico
        OR public.is_sindico(auth.uid(), d.condominio_id)
        OR public.is_contador(auth.uid(), d.condominio_id)
      )
  )
);

CREATE POLICY "Síndico/Contador enviam documentos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentos-condo'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (
    public.is_sindico(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR public.is_contador(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "Síndico/Contador atualizam arquivos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documentos-condo'
  AND (
    public.is_sindico(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR public.is_contador(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "Síndico/Contador deletam arquivos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documentos-condo'
  AND (
    public.is_sindico(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR public.is_contador(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

-- =========================================
-- 3) Revogar EXECUTE em RPCs para anon
-- =========================================
REVOKE EXECUTE ON FUNCTION public.criar_condominio(text,text,text,text,text,text,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.join_condominio_by_code(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.aceitar_convite(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.solicitar_reserva(uuid,uuid,timestamptz,timestamptz,integer,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.aprovar_reserva(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.recusar_reserva(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancelar_reserva(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.registrar_visitante(uuid,text,text,visitante_tipo,text,text,text,timestamptz,text,boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.autorizar_visitante(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.recusar_visitante(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.registrar_entrada_visitante(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.registrar_saida_visitante(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.registrar_encomenda(uuid,text,text,text,text,text,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.marcar_encomenda_retirada(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.abrir_ocorrencia(uuid,uuid,text,text,ocorrencia_categoria,ocorrencia_prioridade,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.atualizar_status_ocorrencia(uuid,ocorrencia_status,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.atribuir_ocorrencia(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.comentar_ocorrencia(uuid,text,boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.avaliar_ocorrencia(uuid,smallint,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.registrar_pagamento_manual(uuid,numeric,forma_pagamento,timestamptz,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.gerar_cobrancas_lote(uuid,uuid,date,date,text,boolean,numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cnab_proximo_sequencial(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cnab_alocar_nosso_numero(uuid,integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cnab_baixar_cobranca(uuid,numeric,date,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid,uuid,app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_member_of(uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_sindico(uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_contador(uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_morador_da_unidade(uuid,uuid) FROM anon;
