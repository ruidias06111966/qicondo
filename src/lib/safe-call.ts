import { toast } from "sonner";

/**
 * Wrapper que captura erros de Server Function (que vêm como `Response`)
 * ou de chamadas Supabase. Retorna `null` em caso de falha e mostra um toast.
 *
 * Anexa um handler imediato (`p.catch`) para impedir que rejeições virem
 * `unhandledrejection` (o overlay do preview captura isso como blank screen).
 */
export async function safeCall<T>(p: PromiseLike<T>): Promise<T | null> {
  Promise.resolve(p).catch(() => {});
  try {
    return await p;
  } catch (e: any) {
    let msg = e?.message;
    if (e instanceof Response) {
      try {
        msg = await e.text();
      } catch {
        msg = `HTTP ${e.status}`;
      }
    } else if (typeof e === "object" && e && "status" in e) {
      msg = `Erro ${(e as any).status}`;
    }
    console.error("[safeCall] erro:", msg, e);
    toast.error(msg || "Erro ao carregar");
    return null;
  }
}

/**
 * Dispara um evento global no `window` para sincronizar telas abertas.
 * Use em conjunto com `useChangedEvent` para escutar.
 */
export function emitChanged(name: string, detail?: unknown) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}
