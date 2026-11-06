/**
 * Lê a cópia da assinatura que o cron guardou em `condominios`.
 *
 * Não pergunta ao QiGestão: a interface nunca fala com o sistema de cobrança.
 * Se falasse, cada carregamento de página dependeria de um serviço externo
 * estar de pé — e o ecrã ficaria em branco sempre que ele não estivesse.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCondominioAtivo } from "@/auth/useCondominio";
import type { AssinaturaEspelhada, FaturaEmAberto } from "@/lib/assinatura";

export function useAssinaturaDoCondominio(): AssinaturaEspelhada | null {
  const { condominioId } = useCondominioAtivo();
  const [dados, setDados] = useState<AssinaturaEspelhada | null>(null);

  useEffect(() => {
    if (!condominioId) {
      setDados(null);
      return;
    }
    let vivo = true;
    (async () => {
      const { data } = await supabase
        .from("condominios")
        .select(
          "assinatura_status, assinatura_conhecida, assinatura_sincronizada_em, assinatura_fatura",
        )
        .eq("id", condominioId)
        .maybeSingle();
      if (!vivo) return;
      // Em caso de erro fica `null`, e `null` não bloqueia ninguém: a falha de
      // leitura não pode ter o mesmo efeito que uma dívida confirmada.
      setDados(
        data
          ? {
              assinatura_status: data.assinatura_status,
              assinatura_conhecida: data.assinatura_conhecida,
              assinatura_sincronizada_em: data.assinatura_sincronizada_em,
              assinatura_fatura: (data.assinatura_fatura as FaturaEmAberto | null) ?? null,
            }
          : null,
      );
    })();
    return () => {
      vivo = false;
    };
  }, [condominioId]);

  return dados;
}
