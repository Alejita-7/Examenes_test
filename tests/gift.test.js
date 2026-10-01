import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGift, GiftError } from "../js/gift.js";

const SAMPLE = `// comentario
::P01::¿Qué nos convierte en científicos?{
=El modo en que buscamos respuestas
~%-33.33333%Trabajar en un laboratorio
~Usar fórmulas matemáticas
~Tener un título universitario
}

// otro comentario
::P02::2 + 2 = ?{
~3
=4
~5
}
`;

test("parsea el ejemplo del enunciado", () => {
  const qs = parseGift(SAMPLE);
  assert.equal(qs.length, 2);
  assert.deepEqual(qs[0], {
    id: "q1",
    title: "P01",
    text: "¿Qué nos convierte en científicos?",
    options: [
      { id: "a", text: "El modo en que buscamos respuestas" },
      { id: "b", text: "Trabajar en un laboratorio" },
      { id: "c", text: "Usar fórmulas matemáticas" },
      { id: "d", text: "Tener un título universitario" },
    ],
    correct: "a",
  });
  assert.equal(qs[1].correct, "b");
  assert.equal(qs[1].options.length, 3);
});

test("el título es opcional", () => {
  const [q] = parseGift("Capital de Francia{=París ~Roma}");
  assert.equal(q.title, "");
  assert.equal(q.text, "Capital de Francia");
  assert.equal(q.correct, "a");
});

test("ignora los pesos %...%", () => {
  const [q] = parseGift("P{=%100%Sí ~%-50%No ~%-50%Quizá}");
  assert.deepEqual(q.options.map((o) => o.text), ["Sí", "No", "Quizá"]);
});

test("procesa los escapes", () => {
  const [q] = parseGift("::T\\:1::¿Es \\{x\\} \\= 1\\~2?{=Sí \\# claro ~No\\:}");
  assert.equal(q.title, "T:1");
  assert.equal(q.text, "¿Es {x} = 1~2?");
  assert.equal(q.options[0].text, "Sí # claro");
  assert.equal(q.options[1].text, "No:");
});

test("descarta el feedback #...", () => {
  const [q] = parseGift("P{=Sí#Muy bien ~No#Mal}");
  assert.deepEqual(q.options.map((o) => o.text), ["Sí", "No"]);
});

test("acepta CRLF y BOM", () => {
  const qs = parseGift("﻿::A::Uno{=x~y}\r\n\r\n::B::Dos{~x=y}\r\n");
  assert.equal(qs.length, 2);
  assert.equal(qs[1].correct, "b");
});

test("enunciado multilínea", () => {
  const [q] = parseGift("::A::Línea uno\nlínea dos{\n=x\n~y\n}");
  assert.equal(q.text, "Línea uno\nlínea dos");
});

test("error si no hay respuesta correcta, con número de pregunta", () => {
  const src = "A{=x~y}\n\nB{~x~y}";
  assert.throws(
    () => parseGift(src),
    (e) => e instanceof GiftError && /Pregunta 2.*exactamente una/.test(e.message)
  );
});

test("error si hay más de una correcta", () => {
  assert.throws(() => parseGift("A{=x=y~z}"), /Pregunta 1.*tiene 2/);
});

test("error si hay menos de 2 opciones", () => {
  assert.throws(() => parseGift("A{=x}"), /Pregunta 1.*al menos 2/);
});

test("error si falta el bloque de respuestas o el cierre", () => {
  assert.throws(() => parseGift("Solo texto"), /Pregunta 1.*bloque de respuestas/);
  assert.throws(() => parseGift("A{=x~y"), /Pregunta 1.*cierre/);
});

test("recoge todos los errores a la vez", () => {
  try {
    parseGift("A{=x}\n\nB{=x~y}\n\nC{~x~y}");
    assert.fail("debía fallar");
  } catch (e) {
    assert.equal(e.errors.length, 2);
    assert.match(e.errors[0], /Pregunta 1/);
    assert.match(e.errors[1], /Pregunta 3/);
  }
});

test("error si no hay preguntas", () => {
  assert.throws(() => parseGift("// solo comentarios\n"), GiftError);
  assert.throws(() => parseGift(""), GiftError);
});
