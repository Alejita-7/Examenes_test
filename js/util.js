// Utilidades puras (sin DOM) compartidas por las páginas.

/** Minúsculas, sin tildes y sin espacios sobrantes. */
export function normalize(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Hash FNV-1a de 32 bits.
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Generador pseudoaleatorio determinista (mulberry32).
function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Baraja una copia del array; la misma semilla da siempre el mismo orden. */
export function seededShuffle(items, seed) {
  const rnd = mulberry32(hashString(String(seed)));
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 83 -> "01:23"; 3725 -> "1:02:05". */
export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Penalización por error con k opciones, como texto: 4 -> "1/3", 2 -> "1". */
export function penaltyFraction(k) {
  return k <= 2 ? "1" : `1/${k - 1}`;
}

/** Número con coma decimal y como mucho 2 decimales: 7.5 -> "7,5". */
export function formatNumber(n) {
  return Number(n).toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

/** Enlace del alumno para un examen, a partir de la URL de cualquier página del sitio. */
export function studentLink(pageUrl, examId) {
  const url = new URL("index.html", pageUrl);
  url.search = "";
  url.hash = "";
  url.searchParams.set("e", examId);
  return url.toString();
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin I, O, 0, 1

/** Código de acceso legible de 6 caracteres. `random` devuelve un entero 0..max-1. */
export function randomCode(length = 6, random = defaultRandom) {
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[random(CODE_ALPHABET.length)];
  return out;
}

function defaultRandom(max) {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] % max;
}
