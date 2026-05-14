CREATE POLICY "Morador vê co-residentes da sua unidade"
ON public.unidade_moradores
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.unidade_moradores um2
    WHERE um2.unidade_id = unidade_moradores.unidade_id
      AND um2.user_id = auth.uid()
  )
);