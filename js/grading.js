// Corrección con penalización por error. Función pura.
// La misma lógica está replicada en apps-script/Code.gs: si cambia una, cambia la otra.

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));

/**
 * Penalización por error como fracción de punto. Acepta "1/3", " 1 / 4 ", "0" o "1".
 * Devuelve {num, den} reducida, o null si no se indica (penalización automática: 1/(opciones-1)).
 * Lanza un error si no es una fracción válida entre 0 y 1.
 */
export function parsePenalty(input) {
  if (input === undefined || input === null) return null;
  const text = String(input).trim();
  if (text === "") return null;
  const m = /^(\d{1,3})\s*(?:\/\s*(\d{1,3}))?$/.exec(text);
  if (!m) throw new Error("La penalización debe ser una fracción, por ejemplo 1/3.");
  const num = Number(m[1]);
  const den = m[2] === undefined ? 1 : Number(m[2]);
  if (den < 1) throw new Error("El denominador de la penalización debe ser al menos 1.");
  if (num > den) throw new Error("La penalización no puede ser mayor que 1 punto (el numerador no puede superar al denominador).");
  const g = gcd(num, den) || 1;
  return { num: num / g, den: den / g };
}

/** {num:1, den:3} -> "1/3"; {num:0, den:1} -> "0"; {num:1, den:1} -> "1". */
export function formatPenalty(p) {
  if (!p) return "";
  return p.den === 1 ? String(p.num) : `${p.num}/${p.den}`;
}

/**
 * @param {{id:string, options:{id:string}[], correct:string}[]} questions
 * @param {Record<string,string|null|undefined>} answers  id de pregunta -> id de opción (o null/ausente = en blanco)
 * @param {{allowNegative?: boolean, penalty?: {num:number, den:number}|null}} [opts]
 *   penalty: fracción de punto que resta cada error; null/ausente = 1/(opciones-1) en cada pregunta
 * @returns {{aciertos:number, errores:number, blancos:number, puntos:number, nota:number}}
 */
export function gradeExam(questions, answers, opts = {}) {
  const { allowNegative = false, penalty = null } = opts;
  if (!questions.length) throw new Error("El examen no tiene preguntas.");

  let aciertos = 0;
  let errores = 0;
  let blancos = 0;
  let penalizacion = 0;

  for (const q of questions) {
    const given = answers?.[q.id];
    if (given === undefined || given === null || given === "") {
      blancos++;
      continue;
    }
    if (!q.options.some((o) => o.id === given)) {
      throw new Error(`Respuesta no válida en ${q.id}: ${given}`);
    }
    if (given === q.correct) {
      aciertos++;
    } else {
      errores++;
      if (!penalty) penalizacion += 1 / (q.options.length - 1);
    }
  }

  // Con penalización propia se calcula con enteros: (aciertos·den − errores·num) / den.
  const puntos = penalty ? (aciertos * penalty.den - errores * penalty.num) / penalty.den : aciertos - penalizacion;
  let nota = (puntos / questions.length) * 10;
  if (!allowNegative && nota < 0) nota = 0;
  nota = Math.round((nota + Number.EPSILON * Math.sign(nota)) * 100) / 100;
  if (nota === 0) nota = 0; // evita -0

  return { aciertos, errores, blancos, puntos, nota };
}
