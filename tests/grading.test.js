import { test } from "node:test";
import assert from "node:assert/strict";
import { gradeExam } from "../js/grading.js";

const opts = (k) => Array.from({ length: k }, (_, i) => ({ id: "abcde"[i] }));
// n preguntas de k opciones, correcta siempre "a"
const make = (n, k) =>
  Array.from({ length: n }, (_, i) => ({ id: `q${i + 1}`, options: opts(k), correct: "a" }));
const answersAll = (qs, v) => Object.fromEntries(qs.map((q) => [q.id, v]));

test("todo bien = 10", () => {
  const qs = make(10, 4);
  const r = gradeExam(qs, answersAll(qs, "a"));
  assert.deepEqual(r, { aciertos: 10, errores: 0, blancos: 0, puntos: 10, nota: 10 });
});

test("todo mal con 4 opciones: recorta a 0", () => {
  const qs = make(10, 4);
  const r = gradeExam(qs, answersAll(qs, "b"));
  assert.equal(r.errores, 10);
  assert.equal(r.nota, 0);
});

test("todo mal con permitir_negativa: -3.33", () => {
  const qs = make(10, 4);
  const r = gradeExam(qs, answersAll(qs, "b"), { allowNegative: true });
  assert.equal(r.nota, -3.33);
});

test("todo en blanco = 0 (sin penalización)", () => {
  const qs = make(10, 4);
  const r = gradeExam(qs, {});
  assert.deepEqual(r, { aciertos: 0, errores: 0, blancos: 10, puntos: 0, nota: 0 });
  assert.equal(gradeExam(qs, answersAll(qs, null)).blancos, 10);
});

test("mezcla: 6 bien, 3 mal, 1 blanco con 4 opciones", () => {
  const qs = make(10, 4);
  const ans = {};
  qs.forEach((q, i) => (ans[q.id] = i < 6 ? "a" : i < 9 ? "b" : null));
  const r = gradeExam(qs, ans);
  assert.equal(r.aciertos, 6);
  assert.equal(r.errores, 3);
  assert.equal(r.blancos, 1);
  assert.equal(r.nota, 5); // (6 - 3/3) / 10 * 10
});

test("3 opciones: el error resta 1/2", () => {
  const qs = make(4, 3);
  const r = gradeExam(qs, { q1: "a", q2: "a", q3: "b", q4: null });
  assert.equal(r.nota, 3.75); // (2 - 0.5) / 4 * 10
});

test("5 opciones: el error resta 1/4", () => {
  const qs = make(4, 5);
  const r = gradeExam(qs, { q1: "a", q2: "a", q3: "a", q4: "e" });
  assert.equal(r.nota, 6.88); // (3 - 0.25) / 4 * 10 = 6.875
});

test("preguntas con distinto nº de opciones", () => {
  const qs = [
    { id: "q1", options: opts(3), correct: "a" },
    { id: "q2", options: opts(5), correct: "a" },
  ];
  const r = gradeExam(qs, { q1: "b", q2: "b" }, { allowNegative: true });
  assert.equal(r.puntos, -0.75);
  assert.equal(r.nota, -3.75);
});

test("respuesta con id inexistente lanza error", () => {
  const qs = make(2, 4);
  assert.throws(() => gradeExam(qs, { q1: "z" }), /no válida/);
});

test("examen sin preguntas lanza error", () => {
  assert.throws(() => gradeExam([], {}), /sin preguntas|no tiene preguntas/);
});

test("nunca devuelve -0", () => {
  const qs = make(3, 4);
  assert.ok(Object.is(gradeExam(qs, {}).nota, 0));
});
