// Parser de un subconjunto de GIFT: opción múltiple con una única respuesta correcta.
// Función pura: no toca el DOM ni la red. Se usa en el panel del profesor.

const ESCAPABLE = new Set([":", "=", "~", "#", "{", "}", "\\"]);
const LETTERS = "abcdefghijklmnopqrstuvwxyz";

export class GiftError extends Error {
  constructor(errors) {
    super(errors.join("\n"));
    this.name = "GiftError";
    this.errors = errors;
  }
}

// Quita los escapes: "\:" -> ":", "\n" -> salto de línea.
function unescapeGift(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && i + 1 < s.length) {
      const next = s[i + 1];
      if (ESCAPABLE.has(next)) {
        out += next;
        i++;
        continue;
      }
      if (next === "n") {
        out += "\n";
        i++;
        continue;
      }
    }
    out += c;
  }
  return out;
}

// Índice del primer `ch` sin escapar a partir de `from`, o -1.
function indexOfUnescaped(s, ch, from = 0) {
  for (let i = from; i < s.length; i++) {
    if (s[i] === "\\") {
      i++;
      continue;
    }
    if (s[i] === ch) return i;
  }
  return -1;
}

// Divide el cuerpo `{...}` en opciones; cada `=` o `~` sin escapar abre una.
function splitOptions(body) {
  const parts = [];
  let current = null;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "\\") {
      if (current) current.raw += c + (body[i + 1] ?? "");
      i++;
      continue;
    }
    if (c === "=" || c === "~") {
      current = { correct: c === "=", raw: "" };
      parts.push(current);
    } else if (current) {
      current.raw += c;
    }
    // Texto antes de la primera opción: se ignora (se detecta luego).
  }
  return parts;
}

function parseOption(part) {
  let raw = part.raw;
  // Feedback (# ...) sin escapar: se descarta.
  const hash = indexOfUnescaped(raw, "#");
  if (hash !== -1) raw = raw.slice(0, hash);
  // Peso %...% al principio: se ignora.
  raw = raw.trim().replace(/^%-?[\d.,]+%/, "");
  return { text: unescapeGift(raw.trim()), correct: part.correct };
}

function parseBlock(block, n) {
  let rest = block.trim();
  let title = "";

  if (rest.startsWith("::")) {
    // Buscar el cierre "::" (no escapado).
    let close = -1;
    for (let i = 2; i < rest.length; i++) {
      if (rest[i] === "\\") {
        i++;
        continue;
      }
      if (rest[i] === ":" && rest[i + 1] === ":") {
        close = i;
        break;
      }
    }
    if (close === -1) {
      throw new Error(`Pregunta ${n}: el título ::...:: no está cerrado.`);
    }
    title = unescapeGift(rest.slice(2, close).trim());
    rest = rest.slice(close + 2).trim();
  }

  const open = indexOfUnescaped(rest, "{");
  if (open === -1) {
    throw new Error(`Pregunta ${n}: no tiene bloque de respuestas { ... }.`);
  }
  const close = indexOfUnescaped(rest, "}", open + 1);
  if (close === -1) {
    throw new Error(`Pregunta ${n}: falta la llave de cierre }.`);
  }

  const before = rest.slice(0, open).trim();
  const after = rest.slice(close + 1).trim();
  const text = unescapeGift([before, after].filter(Boolean).join(" ").trim());
  if (!text) throw new Error(`Pregunta ${n}: el enunciado está vacío.`);

  const parts = splitOptions(rest.slice(open + 1, close));
  if (parts.length < 2) {
    throw new Error(`Pregunta ${n}: necesita al menos 2 opciones (tiene ${parts.length}).`);
  }
  if (parts.length > LETTERS.length) {
    throw new Error(`Pregunta ${n}: demasiadas opciones (máximo ${LETTERS.length}).`);
  }

  const parsed = parts.map(parseOption);
  const blank = parsed.findIndex((o) => !o.text);
  if (blank !== -1) {
    throw new Error(`Pregunta ${n}: la opción ${blank + 1} está vacía.`);
  }
  const correctCount = parsed.filter((o) => o.correct).length;
  if (correctCount !== 1) {
    throw new Error(
      `Pregunta ${n}: debe tener exactamente una opción correcta (=), tiene ${correctCount}.`
    );
  }

  const options = parsed.map((o, i) => ({ id: LETTERS[i], text: o.text }));
  const correct = options[parsed.findIndex((o) => o.correct)].id;
  return { id: `q${n}`, title, text, options, correct };
}

/**
 * Convierte texto GIFT en preguntas.
 * @param {string} input
 * @returns {{id:string,title:string,text:string,options:{id:string,text:string}[],correct:string}[]}
 * @throws {GiftError} con `.errors` (una entrada por pregunta defectuosa, con su número).
 */
export function parseGift(input) {
  const text = String(input ?? "")
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n");

  // Fuera los comentarios de línea completa.
  const lines = text.split("\n").filter((l) => !l.trim().startsWith("//"));

  // Bloques separados por líneas en blanco.
  const blocks = [];
  let current = [];
  for (const line of lines) {
    if (line.trim() === "") {
      if (current.length) blocks.push(current.join("\n"));
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current.join("\n"));

  if (blocks.length === 0) throw new GiftError(["No se ha encontrado ninguna pregunta."]);

  const questions = [];
  const errors = [];
  blocks.forEach((block, i) => {
    try {
      questions.push(parseBlock(block, i + 1));
    } catch (e) {
      errors.push(e.message);
    }
  });

  if (errors.length) throw new GiftError(errors);
  return questions;
}
