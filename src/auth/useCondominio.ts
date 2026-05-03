import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";

const KEY = "condozap.condominio_ativo";

export function useCondominioAtivo() {
  const { roles, loading } = useAuth();
  const [condominioId, setCondominioIdState] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    const stored = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    const valid = roles.find((r) => r.condominio_id === stored);
    if (valid) {
      setCondominioIdState(stored);
    } else if (roles.length > 0) {
      setCondominioIdState(roles[0].condominio_id);
      if (typeof window !== "undefined") localStorage.setItem(KEY, roles[0].condominio_id);
    } else {
      setCondominioIdState(null);
    }
  }, [roles, loading]);

  const setCondominioId = (id: string) => {
    setCondominioIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(KEY, id);
  };

  const role = roles.find((r) => r.condominio_id === condominioId)?.role ?? null;
  const isSindico = role === "sindico";
  const isContador = role === "contador";
  const isMorador = role === "morador";
  const isPorteiro = role === "porteiro";
  const podeGerirFinanceiro = isSindico || isContador;

  return { condominioId, setCondominioId, role, isSindico, isContador, isMorador, isPorteiro, podeGerirFinanceiro };
}
