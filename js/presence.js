// Señales para saber si el alumno sigue en la pantalla del examen. Funciones puras (sin DOM).

/** Una ventana es "reducida" si ocupa mucho menos que la pantalla: pantalla dividida, Slide Over, Stage Manager. */
export const REDUCED_RATIO = 0.75;

/**
 * Solo se aplica en tabletas (puntero táctil y lado corto de pantalla >= 600 px), porque en
 * ordenadores las ventanas no maximizadas son normales y en móviles las barras del navegador
 * recortan mucho la altura.
 * Un iPad a pantalla completa ocupa ~85-95 % de la pantalla; la mitad o dos tercios, ~45-62 %.
 */
export function isReducedWindow({ innerWidth, innerHeight, screenWidth, screenHeight, coarse }) {
  if (!coarse) return false;
  if (!(Math.min(screenWidth, screenHeight) >= 600)) return false;
  if (!(innerWidth > 0 && innerHeight > 0 && screenWidth > 0 && screenHeight > 0)) return false;
  return (innerWidth * innerHeight) / (screenWidth * screenHeight) < REDUCED_RATIO;
}

/**
 * Combina las señales en "¿está fuera?".
 * - hidden: la página no es visible (otra pestaña, otra app, pantalla bloqueada).
 * - blurred: la ventana perdió el foco (evento blur).
 * - reduced: la ventana se redujo (pantalla dividida).
 * - fullscreenLost: el alumno entró en pantalla completa y salió de ella.
 * - noFocusMs: tiempo seguido que document.hasFocus() lleva en false (0 si no aplica).
 * - pointerOutMs: tiempo seguido que el ratón lleva fuera de la página (solo ordenadores).
 * Las pérdidas de foco y los paseos del ratón más cortos que su margen no cuentan (evita parpadeos).
 */
export const FOCUS_GRACE_MS = 1000;
export const POINTER_GRACE_MS = 2000;

export function isAway({ hidden, blurred, reduced, fullscreenLost, noFocusMs = 0, pointerOutMs = 0 }) {
  return Boolean(
    hidden || blurred || reduced || fullscreenLost || noFocusMs >= FOCUS_GRACE_MS || pointerOutMs >= POINTER_GRACE_MS
  );
}
