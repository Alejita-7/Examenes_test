// Imágenes en los enunciados. Funciones puras (sin DOM): se usan en el panel y en la página del alumno.
//
// En el GIFT, una imagen se escribe  ![descripción](archivo.png)  dentro del enunciado.
// Solo se admite el NOMBRE del archivo (sin carpetas ni direcciones de internet): el profesor lo sube
// desde el panel y se guarda en su hoja de Google.

export const MAX_IMAGES = 12; // por examen
export const MAX_IMAGE_CHARS = 330000; // base64 de una imagen (~240 KB)
export const MAX_TOTAL_IMAGE_CHARS = 2000000; // base64 de todas las imágenes de un examen (~1,5 MB)
export const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// ![alt](nombre): el nombre no lleva espacios ni paréntesis.
const IMAGE_TOKEN = /!\[([^\]\n]*)\]\(([^)\s]+)\)/gu;
const NAME_OK = /^[\p{L}\p{N}_.\-]{1,60}$/u;

/** ¿Es un nombre de archivo válido (sin carpetas, sin http, sin espacios)? */
export function isValidImageName(name) {
  return NAME_OK.test(String(name ?? "")) && !/^https?$/i.test(name);
}

/**
 * Divide un texto en trozos de texto e imágenes, en orden.
 * @returns {({type:"text", text:string}|{type:"img", alt:string, name:string})[]}
 */
export function splitRich(text) {
  const out = [];
  const s = String(text ?? "");
  let last = 0;
  for (const m of s.matchAll(IMAGE_TOKEN)) {
    if (m.index > last) out.push({ type: "text", text: s.slice(last, m.index) });
    out.push({ type: "img", alt: m[1].trim(), name: m[2] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ type: "text", text: s.slice(last) });
  return out;
}

/** Nombres de imagen citados en un texto, sin repetir y en orden de aparición. */
export function imageNames(text) {
  const seen = [];
  for (const part of splitRich(text)) if (part.type === "img" && !seen.includes(part.name)) seen.push(part.name);
  return seen;
}

/**
 * Revisa las imágenes citadas en las preguntas.
 * @returns {{names:string[], invalid:string[]}} names = todas las citadas; invalid = con nombre no válido
 *   (por ejemplo, direcciones de internet o rutas con carpetas).
 */
export function collectImageRefs(questions) {
  const names = [];
  for (const q of questions) for (const n of imageNames(q.text)) if (!names.includes(n)) names.push(n);
  return { names, invalid: names.filter((n) => !isValidImageName(n)) };
}

/** Busca una imagen aportada por nombre de archivo sin distinguir mayúsculas (Foto1.PNG = foto1.png). */
export function matchImage(name, files) {
  const wanted = String(name).toLowerCase();
  return files.find((f) => String(f.name).toLowerCase() === wanted) ?? null;
}

/** Tamaño reducido para que el lado mayor no pase de `max`, sin ampliar. */
export function fitSize(width, height, max) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** "data:image/png;base64,AAAA" -> {mime, data}; null si no es una imagen permitida. */
export function parseDataUrl(url) {
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(url ?? ""));
  return m && ALLOWED_MIME.includes(m[1]) ? { mime: m[1], data: m[2] } : null;
}
