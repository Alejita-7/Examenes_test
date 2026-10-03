// Preguntas abiertas y valores por pregunta: servidor (Code.gs simulado).
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./fake-gas.js";
import { parseGift } from "../js/gift.js";

const GIFT = `::T1::[valor=2] Uno{=a~b~c~d}

::T2::Dos{~a=b~c~d}

::A1::[valor=3] Explica la fotosíntesis{}`;
const settings = { titulo: "Mixto", grupo_destino: "2A", tiempo_min: 20, mostrar_nota: true };
const plain = (x) => JSON.parse(JSON.stringify(x));
const col = (rows, name) => rows[0].indexOf(name);
const cell = (rows, i, name) => rows[i][col(rows, name)];

function publish(env, extra = {}) {
  const r = env.post({ action: "createExam", token: "secreto", ...settings, preguntas: parseGift(GIFT), ...extra });
  assert.equal(r.ok, true, JSON.stringify(r));
  return r;
}
const base = (id, extra = {}) => ({ action: "submit", examId: id, nombre: "Ana", apellidos: "López", grupo: "B", ...extra });

test("se crea con tipo y valor; el alumno recibe tipo y valor pero nunca la solución", () => {
  const env = makeEnv();
  const r = publish(env);
  assert.equal(r.abiertas, 1);
  const got = env.get({ action: "exam", id: r.id });
  assert.deepEqual(plain(got.exam.questions.map((q) => [q.tipo, q.valor, q.options.length])), [["test", 2, 4], ["test", 1, 4], ["abierta", 3, 0]]);
  assert.ok(!JSON.stringify(got).includes("correct"));
});

test("envío con abierta: texto en la hoja, fórmulas de nota final y el alumno solo ve el test", () => {
  const env = makeEnv();
  const { id } = publish(env);
  const r = env.post(base(id, { respuestas: { q1: "a", q2: "a" }, abiertas: { q3: "Las plantas\r\nusan luz" }, pegados: 2 }));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.nota, undefined, "con abiertas no hay nota definitiva");
  // q1 acierta (+2), q2 falla (−1/3 con 4 opciones): 2 − 1/3 = 1.67 de 3
  assert.deepEqual([r.abiertas, r.puntos_test, r.puntos_test_max], [1, 1.67, 3]);
  const rows = env.sheets.get(`R_${id}`).rows;
  const hdr = rows[0];
  const resp = hdr.find((h) => h.endsWith("respuesta"));
  const pts = hdr.find((h) => h.includes("puntos (máx 3)"));
  assert.ok(resp && pts, hdr.join("|"));
  assert.equal(cell(rows, 1, resp), "Las plantas\nusan luz");
  assert.equal(cell(rows, 1, "pegados"), 2);
  assert.equal(cell(rows, 1, "puntos_total"), 6);
  const P = col(rows, pts) + 1;
  assert.equal(cell(rows, 1, "pendientes"), "=1-COUNT(RC" + P + ")");
  assert.ok(cell(rows, 1, "nota_final").startsWith("=ROUND(MAX(0,(RC"), cell(rows, 1, "nota_final"));
});

test("con permitir_negativa la nota final no se recorta a 0", () => {
  const env = makeEnv();
  const { id } = publish(env, { permitir_negativa: true });
  env.post(base(id, { respuestas: { q1: "b" }, abiertas: {} }));
  assert.ok(!cell(env.sheets.get(`R_${id}`).rows, 1, "nota_final").includes("MAX(0"));
});

test("validación: id de abierta desconocido, test dentro de abiertas, demasiado largo", () => {
  const env = makeEnv();
  const { id } = publish(env);
  assert.equal(env.post(base(id, { respuestas: {}, abiertas: { zz: "x" } })).error, "invalid_answers");
  assert.equal(env.post(base(id, { respuestas: {}, abiertas: { q1: "x" } })).error, "invalid_answers");
  assert.equal(env.post(base(id, { respuestas: { q3: "a" } })).error, "invalid_answers");
  assert.equal(env.post(base(id, { respuestas: {}, abiertas: { q3: "x".repeat(4001) } })).error, "invalid_answers");
  assert.equal(env.post(base(id, { respuestas: {}, abiertas: [] })).error, "invalid_answers");
});

test("un examen solo de test y sin valores se comporta como siempre (nota sobre 10)", () => {
  const env = makeEnv();
  const r = env.post({ action: "createExam", token: "secreto", ...settings, preguntas: [
    { id: "q1", title: "", text: "A", options: [{ id: "a", text: "x" }, { id: "b", text: "y" }], correct: "a" }
  ] });
  assert.equal(r.ok, true, JSON.stringify(r));
  const s = env.post(base(r.id, { respuestas: { q1: "a" } }));
  assert.equal(s.nota, 10);
  const rows = env.sheets.get(`R_${r.id}`).rows;
  assert.ok(!rows[0].includes("nota_final"));
});

test("validación de preguntas: valor y tipo", () => {
  const env = makeEnv();
  const q = (extra) => [{ id: "q1", title: "", text: "A", options: [{ id: "a", text: "x" }, { id: "b", text: "y" }], correct: "a", ...extra }];
  const create = (preguntas) => env.post({ action: "createExam", token: "secreto", ...settings, preguntas });
  assert.equal(create(q({ valor: 0 })).ok, false);
  assert.equal(create(q({ valor: 101 })).ok, false);
  assert.equal(create(q({ tipo: "otra" })).ok, false);
  assert.equal(create([{ id: "q1", text: "A", tipo: "abierta", options: [{ id: "a", text: "x" }] }]).ok, false);
  assert.equal(create([{ id: "q1", text: "A", tipo: "abierta", valor: 2.5 }]).ok, true);
});

test("varias abiertas y orden por apellidos con columnas extra", () => {
  const env = makeEnv();
  const { id } = env.post({ action: "createExam", token: "secreto", ...settings, preguntas: parseGift("::A::[valor=1] Uno{}\n\n::B::[valor=2] Dos{}\n\n::C::Tres{=a~b}") });
  for (const [n, a] of [["Marta", "Zapata"], ["Pedro", "Álvarez"]]) {
    assert.equal(env.post(base(id, { nombre: n, apellidos: a, respuestas: { q3: "a" }, abiertas: { q1: n + "1", q2: n + "2" } })).ok, true);
  }
  const rows = env.sheets.get(`R_${id}`).rows;
  assert.deepEqual([cell(rows, 1, "apellidos"), cell(rows, 2, "apellidos")], ["Álvarez", "Zapata"]);
  assert.equal(cell(rows, 1, rows[0].find((h) => h.startsWith("Q1") && h.endsWith("respuesta"))), "Pedro1");
  assert.ok(cell(rows, 1, "pendientes").startsWith("=2-COUNT("));
});
