import { test } from "node:test";
import assert from "node:assert/strict";
import { isReducedWindow, isAway } from "../js/presence.js";

// iPad Air 11" en horizontal: pantalla 1180x820. Safari a pantalla completa deja ~ 1180x700.
const ipad = { screenWidth: 1180, screenHeight: 820, coarse: true };

test("iPad a pantalla completa no se considera reducido", () => {
  assert.equal(isReducedWindow({ ...ipad, innerWidth: 1180, innerHeight: 700 }), false);
  assert.equal(isReducedWindow({ ...ipad, innerWidth: 1180, innerHeight: 640 }), false); // con barra de pestañas y marcadores
});

test("pantalla dividida a la mitad, a un tercio y a dos tercios sí", () => {
  assert.equal(isReducedWindow({ ...ipad, innerWidth: 590, innerHeight: 700 }), true);
  assert.equal(isReducedWindow({ ...ipad, innerWidth: 390, innerHeight: 700 }), true);
  assert.equal(isReducedWindow({ ...ipad, innerWidth: 790, innerHeight: 700 }), true);
});

test("girar el iPad no cuenta como reducido", () => {
  assert.equal(isReducedWindow({ screenWidth: 820, screenHeight: 1180, coarse: true, innerWidth: 820, innerHeight: 1060 }), false);
});

test("no se aplica en ordenadores ni en móviles", () => {
  assert.equal(isReducedWindow({ screenWidth: 1920, screenHeight: 1080, coarse: false, innerWidth: 800, innerHeight: 600 }), false);
  assert.equal(isReducedWindow({ screenWidth: 390, screenHeight: 844, coarse: true, innerWidth: 390, innerHeight: 600 }), false);
});

test("valores raros no provocan falsos positivos", () => {
  assert.equal(isReducedWindow({ ...ipad, innerWidth: 0, innerHeight: 0 }), false);
  assert.equal(isReducedWindow({ screenWidth: NaN, screenHeight: NaN, coarse: true, innerWidth: 500, innerHeight: 500 }), false);
});

test("isAway: cualquier señal basta; la falta de foco necesita 1 s seguido", () => {
  assert.equal(isAway({}), false);
  assert.equal(isAway({ hidden: true }), true);
  assert.equal(isAway({ blurred: true }), true);
  assert.equal(isAway({ reduced: true }), true);
  assert.equal(isAway({ noFocusMs: 400 }), false);
  assert.equal(isAway({ noFocusMs: 1000 }), true);
});
