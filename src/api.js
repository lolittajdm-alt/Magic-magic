// Public service address only. Credentials remain in Cloudflare Secrets.
export const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  (__STATIC_SITE__
    ? "https://magic-magic-orders.blockfolio-native-web.workers.dev"
    : "")
).replace(/\/$/, "");
export const API_AVAILABLE = Boolean(API_BASE) || !__STATIC_SITE__;
let configPending;
let sessionToken;
const storageKey = "magic-shop-session-v1";
function token() {
  if (sessionToken) return sessionToken;
  try {
    sessionToken = sessionStorage.getItem(storageKey);
  } catch {
    /* Private browser storage may be unavailable. */
  }
  return sessionToken;
}
export function loadShopConfig() {
  if (!configPending)
    configPending = (async () => {
      const current = token();
      const response = await fetch(API_BASE + "/api/payments/config", {
        credentials: API_BASE ? "omit" : "same-origin",
        headers:
          API_BASE && current ? { Authorization: "Bearer " + current } : {},
      });
      if (response.status === 401 && API_BASE) {
        sessionToken = undefined;
        try {
          sessionStorage.removeItem(storageKey);
        } catch {
          /* Optional persistence. */
        }
        throw new Error("Сесію завершено. Оновіть сторінку магазину.");
      }
      const config = await response.json();
      if (!response.ok)
        throw new Error(config.error || "Магазин тимчасово недоступний.");
      if (API_BASE) {
        if (!config.sessionToken)
          throw new Error("Не вдалося створити сесію магазину.");
        sessionToken = config.sessionToken;
        try {
          sessionStorage.setItem(storageKey, sessionToken);
        } catch {
          /* Current tab can still place COD orders. */
        }
      }
      return config;
    })().catch((error) => {
      configPending = undefined;
      throw error;
    });
  return configPending;
}
export async function apiFetch(path, options = {}) {
  if (!path.startsWith("/api/")) throw new Error("Invalid API path");
  if (API_BASE) await loadShopConfig();
  const headers = new Headers(options.headers);
  if (API_BASE) headers.set("Authorization", "Bearer " + token());
  return fetch(API_BASE + path, {
    ...options,
    headers,
    credentials: API_BASE ? "omit" : "same-origin",
  });
}
