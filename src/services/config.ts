declare global {
  interface Window { TLM_CONFIG?: { apiBase?: string }; }
}

export function apiBase(): string {
  if (typeof window === "undefined") return "";
  return window.TLM_CONFIG?.apiBase?.replace(/\/$/, "") ?? "";
}
