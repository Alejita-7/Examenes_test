import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, seededShuffle, formatClock, penaltyFraction, formatNumber } from "../js/util.js";

test("normalize quita tildes, mayúsculas y espacios", () => {
  assert.equal(normalize("  María   LÓPEZ "), "maria lopez");
  assert.equal(normalize(null), "");
});

test("seededShuffle es determinista y es una permutación", () => {
  const base = Array.from({ length: 20 }, (_, i) => i);
  const a = seededShuffle(base, "examen|ana|2a");
  assert.deepEqual(a, seededShuffle(base, "examen|ana|2a"));
  assert.deepEqual([...a].sort((x, y) => x - y), base);
  assert.notDeepEqual(a, seededShuffle(base, "examen|luis|2a"));
  assert.deepEqual(base, Array.from({ length: 20 }, (_, i) => i), "no modifica el original");
});

test("formatClock", () => {
  assert.equal(formatClock(83), "01:23");
  assert.equal(formatClock(0), "00:00");
  assert.equal(formatClock(-5), "00:00");
  assert.equal(formatClock(3725), "1:02:05");
});

test("penaltyFraction", () => {
  assert.equal(penaltyFraction(4), "1/3");
  assert.equal(penaltyFraction(5), "1/4");
  assert.equal(penaltyFraction(2), "1");
});

test("formatNumber usa coma decimal", () => {
  assert.equal(formatNumber(7.5), "7,5");
  assert.equal(formatNumber(10), "10");
});
