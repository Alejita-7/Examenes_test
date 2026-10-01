// Llamadas al Apps Script. Los POST usan text/plain para evitar el preflight de CORS,
// que Apps Script no admite. fetch sigue las redirecciones por defecto.
import { APPS_SCRIPT_URL } from "./config.js";

const TIMEOUT_MS = 30000;

export class NetworkError extends Error {
  constructor(message) {
    super(message);
    this.name = "NetworkError";
  }
}

export class ConfigError extends Error {
  constructor() {
    super("Falta configurar APPS_SCRIPT_URL en js/config.js.");
    this.name = "ConfigError";
  }
}

async function request(url, init) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
    try {
      return await res.json();
    } catch {
      throw new NetworkError("Respuesta no válida del servidor.");
    }
  } catch (e) {
    if (e instanceof NetworkError) throw e;
    throw new NetworkError(e?.name === "AbortError" ? "Tiempo de espera agotado." : "Sin conexión.");
  } finally {
    clearTimeout(timer);
  }
}

function baseUrl() {
  if (!APPS_SCRIPT_URL) throw new ConfigError();
  return APPS_SCRIPT_URL;
}

/** GET con parámetros de consulta. Devuelve el JSON del servidor ({ok, ...}). */
export function apiGet(params) {
  const url = new URL(baseUrl());
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }
  return request(url.toString(), { method: "GET" });
}

/** POST con el JSON en el cuerpo como text/plain. */
export function apiPost(body) {
  return request(baseUrl(), {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
}

export const fetchExam = (id, code = "") => apiGet({ action: "exam", id, code });
export const submitExam = (payload) => apiPost({ action: "submit", ...payload });
