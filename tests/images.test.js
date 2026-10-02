import { test } from "node:test";
import assert from "node:assert/strict";
import { splitRich, imageNames, collectImageRefs, isValidImageName, matchImage, fitSize, parseDataUrl } from "../js/images.js";

test("splitRich separa texto e imágenes en orden", () => {
  assert.deepEqual(splitRich("Observa ![gráfica v-t](grafica1.png) y responde"), [
    { type: "text", text: "Observa " },
    { type: "img", alt: "gráfica v-t", name: "grafica1.png" },
    { type: "text", text: " y responde" },
  ]);
});

test("splitRich: sin imágenes devuelve el texto tal cual; varias imágenes; alt vacío", () => {
  assert.deepEqual(splitRich("Solo texto (con paréntesis) y [corchetes]"), [{ type: "text", text: "Solo texto (con paréntesis) y [corchetes]" }]);
  assert.deepEqual(splitRich("![](a.png)![](b.png)").map((p) => p.name), ["a.png", "b.png"]);
  assert.equal(splitRich("![](a.png)")[0].alt, "");
  assert.deepEqual(splitRich(""), []);
  assert.deepEqual(splitRich(null), []);
});

test("imageNames sin repetir y en orden", () => {
  assert.deepEqual(imageNames("![x](b.png) y ![x](a.png) y ![x](b.png)"), ["b.png", "a.png"]);
});

test("nombres válidos: solo el archivo, sin carpetas ni direcciones", () => {
  for (const ok of ["grafica1.png", "Circuito_A-2.PNG", "figura.1.png", "gráfica.png"]) assert.equal(isValidImageName(ok), true, ok);
  for (const bad of ["https://web.com/a.png", "http", "carpeta/a.png", "..\\a.png", "a b.png", "", "x".repeat(61)]) assert.equal(isValidImageName(bad), false, bad);
});

test("collectImageRefs detecta citas no válidas (direcciones o rutas)", () => {
  const qs = [
    { text: "![a](ok.png)" },
    { text: "![b](https://malo.com/x.png)" },
    { text: "![c](ruta/x.png)" },
    { text: "sin imagen" },
  ];
  const r = collectImageRefs(qs);
  assert.deepEqual(r.names, ["ok.png", "https://malo.com/x.png", "ruta/x.png"]);
  assert.deepEqual(r.invalid, ["https://malo.com/x.png", "ruta/x.png"]);
});

test("matchImage ignora mayúsculas", () => {
  const files = [{ name: "Foto1.PNG" }, { name: "b.png" }];
  assert.equal(matchImage("foto1.png", files), files[0]);
  assert.equal(matchImage("c.png", files), null);
});

test("fitSize reduce sin ampliar y conserva la proporción", () => {
  assert.deepEqual(fitSize(2000, 1000, 1000), { width: 1000, height: 500 });
  assert.deepEqual(fitSize(500, 800, 1000), { width: 500, height: 800 });
  assert.deepEqual(fitSize(800, 2400, 1200), { width: 400, height: 1200 });
});

test("parseDataUrl solo admite imágenes permitidas en base64", () => {
  assert.deepEqual(parseDataUrl("data:image/png;base64,AAAA"), { mime: "image/png", data: "AAAA" });
  assert.equal(parseDataUrl("data:text/html;base64,AAAA"), null);
  assert.equal(parseDataUrl("data:image/svg+xml;base64,AAAA"), null);
  assert.equal(parseDataUrl("javascript:alert(1)"), null);
  assert.equal(parseDataUrl(""), null);
});
