/**
 * Troca de condomínio.
 *
 * Existia `setCondominioId` em `useCondominioAtivo` desde sempre, e nunca
 * ninguém o chamava: não havia nada no ecrã que trocasse de condomínio. Quem
 * administrava dois ficava preso no primeiro que a consulta de papéis
 * devolvesse, sem saber porquê e sem forma de sair.
 *
 * POR QUE RECARREGA A PÁGINA
 *
 * `useCondominioAtivo` é um hook com estado local: cada componente que o chama
 * tem a sua própria cópia de `condominioId`, lida do `localStorage` à
 * montagem. Mudar aqui não avisa os outros — o ecrã do financeiro continuaria
 * a mostrar o condomínio anterior até ser remontado.
 *
 * A correcção certa é passar isto a contexto partilhado. A correcção honesta,
 * hoje, é gravar e recarregar: é uma linha, não mente sobre o que mostra, e
 * não se arrisca a deixar metade do ecrã com dados de um condomínio e metade
 * com os de outro — que é o que um estado mal propagado faz.
 */
import { useEffect, useState } from "react";
import { Building2, ChevronDown } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useCondominioAtivo } from "@/auth/useCondominio";
import { supabase } from "@/integrations/supabase/client";

export function SeletorCondominio({ onTrocar }: { onTrocar?: () => void }) {
  const { roles } = useAuth();
  const { condominioId, setCondominioId } = useCondominioAtivo();
  const [nomes, setNomes] = useState<Record<string, string>>({});

  useEffect(() => {
    const ids = Array.from(new Set(roles.map((r) => r.condominio_id))).filter(Boolean);
    if (ids.length === 0) return;
    let activo = true;
    supabase
      .from("condominios")
      .select("id, nome")
      .in("id", ids)
      .then(({ data }) => {
        if (!activo || !data) return;
        setNomes(Object.fromEntries(data.map((c) => [String(c.id), String(c.nome)])));
      });
    return () => {
      activo = false;
    };
  }, [roles]);

  const ids = Array.from(new Set(roles.map((r) => r.condominio_id))).filter(Boolean);
  if (ids.length === 0) return null;

  const nomeActual = condominioId ? (nomes[condominioId] ?? "A carregar…") : "—";

  // Um só condomínio: dizer qual, sem oferecer uma troca que não existe.
  if (ids.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Building2 size={16} className="shrink-0" />
        <span className="truncate font-medium text-foreground">{nomeActual}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <Building2
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
      />
      <select
        aria-label="Condomínio activo"
        value={condominioId ?? ""}
        onChange={(e) => {
          setCondominioId(e.target.value);
          onTrocar?.();
          // Ver o cabeçalho: o estado é local a cada componente, por isso
          // remonta-se tudo.
          window.location.reload();
        }}
        className="w-full appearance-none pl-9 pr-8 py-2 rounded-lg border border-border bg-background text-sm font-medium truncate"
      >
        {ids.map((id) => (
          <option key={id} value={id}>
            {nomes[id] ?? "A carregar…"}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
      />
    </div>
  );
}
