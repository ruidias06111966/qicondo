// Helper de tracking de conversões — envia eventos para dataLayer (GTM/GA4)
// e também dispara CustomEvent no window para integrações futuras.
declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export type TrackEvent =
  | "wa_click_floating"
  | "wa_click_hero"
  | "wa_click_lead_form"
  | "wa_click_reabrir"
  | "lead_form_submit"
  | "lead_form_success"
  | "pricing_view"
  | "demo_schedule_click"
  | "plan_cta_click";

export function track(event: TrackEvent, params: Record<string, unknown> = {}) {
  try {
    const payload = { event, ...params, ts: Date.now() };
    if (typeof window !== "undefined") {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(payload);
      window.dispatchEvent(new CustomEvent("qd:track", { detail: payload }));
    }
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug("[track]", event, params);
    }
  } catch {
    /* noop */
  }
}
