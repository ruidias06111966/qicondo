import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";

const KEY = "condozap.condominio_ativo";

export type Role =
  | "sindico"
  | "admin"
  | "morador"
  | "contador"
  | "porteiro"
  | "financeiro"
  | "gestor"
  | "vendedor"
  | "comercial"
  | "consulta";

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

  const role = (roles.find((r) => r.condominio_id === condominioId)?.role ?? null) as Role | null;

  // Admin herda síndico (também no backend via is_sindico)
  const isAdmin = role === "admin" || role === "sindico";
  const isSindico = isAdmin; // mantido por compatibilidade nos componentes existentes
  const isContador = role === "contador";
  const isMorador = role === "morador";
  const isPorteiro = role === "porteiro";
  const isFinanceiro = role === "financeiro";
  const isGestor = role === "gestor";
  const isVendedor = role === "vendedor";
  const isComercial = role === "comercial";
  const isConsulta = role === "consulta";

  const podeGerirFinanceiro = isAdmin || isContador || isFinanceiro;
  const podeGerirEmpresa = isAdmin;
  const podeGerirUsuarios = isAdmin;
  const podeConsultarComercial = isAdmin || isVendedor || isComercial || isGestor || isConsulta;

  return {
    condominioId,
    setCondominioId,
    role,
    isAdmin,
    isSindico,
    isContador,
    isMorador,
    isPorteiro,
    isFinanceiro,
    isGestor,
    isVendedor,
    isComercial,
    isConsulta,
    podeGerirFinanceiro,
    podeGerirEmpresa,
    podeGerirUsuarios,
    podeConsultarComercial,
  };
}

// Alias semântico — empresa = condomínio no novo modelo
export const useEmpresaAtiva = useCondominioAtivo;
