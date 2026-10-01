// Carga apps-script/Code.gs en un sandbox con una hoja de cálculo simulada.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnv } from "./fake-gas.js";
import { gradeExam } from "../js/grading.js";
import { parseGift } from "../js/gift.js";

const GIFT = `::P1::Uno{=a~b~c~d}\n\n::P2::Dos{~a=b~c~d}\n\n::P3::Tres{~a~b=c~d}`;
const settings = { titulo: "Test", grupo_destino: "2A", tiempo_min: 20, mostrar_nota: true };

function publish(env, extra = {}) {
  const r = env.post({ action: "createExam", token: "secreto", ...settings, preguntas: parseGift(GIFT), ...extra });
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.id;
}

test("gradeExam_ de Code.gs coincide con js/grading.js en 2000 casos aleatorios", () => {
  const env = makeEnv();
  const gradeServer = env.fn("gradeExam_");
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let t = 0; t < 2000; t++) {
    const nq = 1 + Math.floor(rnd() * 25);
    const qs = Array.from({ length: nq }, (_, i) => {
      const k = 2 + Math.floor(rnd() * 5);
      const ids = "abcdef".slice(0, k).split("");
      return { id: `q${i + 1}`, options: ids.map((id) => ({ id })), correct: ids[Math.floor(rnd() * k)] };
    });
    const ans = {};
    for (const q of qs) {
      const r = rnd();
      if (r < 0.25) continue;
      ans[q.id] = r < 0.6 ? q.correct : q.options[Math.floor(rnd() * q.options.length)].id;
    }
    const allowNegative = rnd() < 0.5;
    assert.deepEqual(
      JSON.parse(JSON.stringify(gradeServer(qs, ans, { allowNegative }))),
      gradeExam(qs, ans, { allowNegative })
    );
  }
});

test("flujo completo: crear, consultar sin soluciones, enviar, listar, cerrar", () => {
  const env = makeEnv();
  const id = publish(env);

  const got = env.get({ action: "exam", id });
  assert.equal(got.ok, true);
  assert.equal(got.exam.questions.length, 3);
  assert.ok(!JSON.stringify(got).includes("correct"), "no debe filtrar las soluciones");

  const sub = env.post({
    action: "submit", examId: id, nombre: "  Ana  López ", grupo: "2º A",
    respuestas: { q1: "a", q2: "a", q3: null }, duracion_min: 7.5,
  });
  assert.deepEqual({ ...sub }, { ok: true, nota: 2.22, aciertos: 1, errores: 1, blancos: 1 }); // (1-1/3)/3*10

  const row = env.sheets.get(`R_${id}`).rows[1];
  assert.equal(row[1], "Ana López");
  assert.equal(row[8], false);

  // mismo alumno con tildes/mayúsculas distintas -> duplicado, pero no se bloquea
  const again = env.post({ action: "submit", examId: id, nombre: "ANA LOPEZ", grupo: "2º  a", respuestas: {} });
  assert.equal(again.ok, true);
  assert.equal(env.sheets.get(`R_${id}`).rows[2][8], true);

  const list = env.get({ action: "list", token: "secreto" });
  assert.equal(list.exams[0].envios, 2);
  assert.match(list.exams[0].results_url, /#gid=\d+$/);

  assert.equal(env.post({ action: "setActive", token: "secreto", id, activo: false }).ok, true);
  assert.equal(env.get({ action: "exam", id }).error, "closed");
  assert.equal(env.post({ action: "submit", examId: id, nombre: "B", grupo: "C", respuestas: {} }).error, "closed");
});

test("no devuelve la nota si mostrar_nota es falso", () => {
  const env = makeEnv();
  const id = publish(env, { mostrar_nota: false });
  const r = env.post({ action: "submit", examId: id, nombre: "A", grupo: "B", respuestas: { q1: "a" } });
  assert.deepEqual({ ...r }, { ok: true });
});

test("código de acceso", () => {
  const env = makeEnv();
  const id = publish(env, { codigo_acceso: "Luz42" });
  const noCode = env.get({ action: "exam", id });
  assert.equal(noCode.error, "code_required");
  assert.equal(noCode.info.requiere_codigo, true);
  assert.ok(!("exam" in noCode));
  assert.equal(env.get({ action: "exam", id, code: "mal" }).error, "bad_code");
  assert.equal(env.get({ action: "exam", id, code: " luz42 " }).ok, true);
  assert.equal(env.post({ action: "submit", examId: id, nombre: "A", grupo: "B", respuestas: {} }).error, "code_required");
  assert.equal(env.post({ action: "submit", examId: id, code: "Luz42", nombre: "A", grupo: "B", respuestas: {} }).ok, true);
});

test("validaciones de submit", () => {
  const env = makeEnv();
  const id = publish(env);
  const base = { action: "submit", examId: id, nombre: "A", grupo: "B", respuestas: {} };
  assert.equal(env.post({ ...base, nombre: "" }).error, "invalid_name");
  assert.equal(env.post({ ...base, nombre: "x".repeat(61) }).error, "invalid_name");
  assert.equal(env.post({ ...base, grupo: "x".repeat(61) }).error, "invalid_group");
  assert.equal(env.post({ ...base, respuestas: { q1: "z" } }).error, "invalid_answers");
  assert.equal(env.post({ ...base, respuestas: { q99: "a" } }).error, "invalid_answers");
  assert.equal(env.post({ ...base, respuestas: [] }).error, "invalid_answers");
  assert.equal(env.post({ ...base, examId: "nope" }).error, "not_found");
  assert.equal(env.sheets.get(`R_${id}`).rows.length, 1, "no se guarda nada si falla");
});

test("acciones de administrador exigen token", () => {
  const env = makeEnv();
  const body = { action: "createExam", ...settings, preguntas: parseGift(GIFT) };
  assert.equal(env.post({ ...body, token: "otro" }).error, "unauthorized");
  assert.equal(env.post(body).error, "unauthorized");
  assert.equal(env.get({ action: "list" }).error, "unauthorized");
  assert.equal(env.post({ action: "setActive", id: "x", activo: false }).error, "unauthorized");
  assert.equal(makeEnv(null).get({ action: "list", token: "x" }).error, "token_not_configured");
});

test("createExam valida preguntas y tamaño", () => {
  const env = makeEnv();
  const base = { action: "createExam", token: "secreto", ...settings };
  assert.equal(env.post({ ...base, preguntas: [] }).error, "invalid_exam");
  assert.equal(env.post({ ...base, titulo: "", preguntas: parseGift(GIFT) }).error, "invalid_exam");
  const bad = parseGift(GIFT);
  bad[0].correct = "z";
  assert.equal(env.post({ ...base, preguntas: bad }).error, "invalid_exam");
  const big = parseGift(GIFT);
  big[0].text = "x".repeat(50000);
  assert.equal(env.post({ ...base, preguntas: big }).error, "too_large");
  const warn = parseGift(GIFT);
  warn[0].text = "x".repeat(46000);
  assert.match(env.post({ ...base, preguntas: warn }).warning, /límite/);
});

test("permitir_negativa se respeta en el servidor", () => {
  const env = makeEnv();
  const id = publish(env, { permitir_negativa: true });
  const r = env.post({ action: "submit", examId: id, nombre: "A", grupo: "B", respuestas: { q1: "b", q2: "a", q3: "a" } });
  assert.equal(r.nota, -3.33);
});
