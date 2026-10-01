// Corrección con penalización por error. Función pura.
// La misma lógica está replicada en apps-script/Code.gs: si cambia una, cambia la otra.

/**
 * @param {{id:string, options:{id:string}[], correct:string}[]} questions
 * @param {Record<string,string|null|undefined>} answers  id de pregunta -> id de opción (o null/ausente = en blanco)
 * @param {{allowNegative?: boolean}} [opts]
 * @returns {{aciertos:number, errores:number, blancos:number, puntos:number, nota:number}}
 */
export function gradeExam(questions, answers, opts = {}) {
  const { allowNegative = false } = opts;
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
      penalizacion += 1 / (q.options.length - 1);
    }
  }

  const puntos = aciertos - penalizacion;
  let nota = (puntos / questions.length) * 10;
  if (!allowNegative && nota < 0) nota = 0;
  nota = Math.round((nota + Number.EPSILON * Math.sign(nota)) * 100) / 100;
  if (nota === 0) nota = 0; // evita -0

  return { aciertos, errores, blancos, puntos, nota };
}
