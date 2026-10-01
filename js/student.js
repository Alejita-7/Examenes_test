// Página del alumno (index.html?e=ID). Todo el contenido del examen se pinta con
// textContent: nunca se inserta HTML procedente del servidor.
import { fetchExam, submitExam, beaconSubmit, NetworkError, ConfigError } from "./api.js";
import { h } from "./dom.js";
import { isReducedWindow, isAway } from "./presence.js";
import { normalize, seededShuffle, formatClock, penaltyFraction, formatNumber, newSendId } from "./util.js";

const MAX_TEXT = 60;
const RETRY_DELAYS = [2000, 4000, 8000];

const app = document.getElementById("app");
const examId = new URLSearchParams(location.search).get("e");

/* ---------------------------- utilidades DOM ---------------------------- */

const render = (...nodes) => {
  app.replaceChildren(...nodes);
  window.scrollTo(0, 0);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------------- almacenamiento (con respaldo) ------------------- */

const memory = new Map();
const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      memory.set(key, value);
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      memory.delete(key);
    }
  },
};

const progressKey = (nombre, grupo) => `examen:${examId}:${normalize(nombre)}|${normalize(grupo)}`;
const lastKey = () => `examen:${examId}:ultimo`;

function loadJson(key) {
  try {
    return JSON.parse(store.get(key));
  } catch {
    return null;
  }
}

/* ------------------------------ pantallas ------------------------------- */

function showMessage(title, text, kind = "info") {
  render(h("div", { class: "card" }, h("h1", {}, title), h("div", { class: `notice ${kind}` }, h("p", {}, text))));
}

// Norma de salidas para el alumno. No menciona cuántas salidas se toleran.
const EXIT_RULE =
  "No puedes salir de la pantalla del examen: no cambies de pestaña, de ventana ni de aplicación, ni uses otra web al mismo tiempo. El examen solo se muestra a pantalla completa: si la ventana se reduce o sales, se oculta hasta que vuelvas. Cada salida queda registrada con el tiempo que estés fuera y, si continúas saliendo, el examen se enviará automáticamente tal como esté.";

function scoringText(questions) {
  const ks = new Set((questions ?? []).map((q) => q.options.length));
  const penalty =
    ks.size === 1
      ? `${penaltyFraction([...ks][0])} de punto`
      : "una fracción de punto (1/3 si la pregunta tiene 4 opciones)";
  return [
    "Cada respuesta correcta suma 1 punto.",
    `Cada respuesta incorrecta resta ${penalty}.`,
    "Las preguntas en blanco ni suman ni restan.",
    "Si no estás seguro, puedes dejarla en blanco.",
  ];
}

// `info` = {titulo, n_preguntas, tiempo_min, requiere_codigo}; `exam` solo si ya está cargado.
function showStart(info, exam) {
  const last = loadJson(lastKey());
  const needsCode = info.requiere_codigo;
  const form = h("form", { novalidate: true });
  const errBox = h("div", { class: "notice error", hidden: true, role: "alert" }, h("p"));
  const nombre = h("input", { name: "nombre", maxlength: MAX_TEXT, autocomplete: "name", required: true });
  const grupo = h("input", { name: "grupo", maxlength: MAX_TEXT, required: true });
  const code = h("input", { name: "code", autocomplete: "off", autocapitalize: "off" });
  if (last) {
    nombre.value = last.nombre ?? "";
    grupo.value = last.grupo ?? "";
    code.value = last.code ?? "";
  }
  const button = h("button", { class: "btn block", type: "submit" }, "Empezar el examen");

  const refreshButton = () => {
    const has = nombre.value.trim() && grupo.value.trim() && store.get(progressKey(nombre.value, grupo.value));
    button.textContent = has ? "Continuar el examen" : "Empezar el examen";
  };
  nombre.addEventListener("input", refreshButton);
  grupo.addEventListener("input", refreshButton);

  form.append(
    ...[
    h("label", { class: "field" }, h("span", {}, "Nombre y apellidos"), nombre),
    h("label", { class: "field" }, h("span", {}, "Grupo"), grupo, h("small", { class: "hint" }, "Por ejemplo: 2º A")),
    needsCode
      ? h("label", { class: "field" }, h("span", {}, "Código de acceso"), code, h("small", { class: "hint" }, "Te lo da tu profesor."))
      : null,
    errBox,
    button
    ].filter(Boolean)
  );

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const n = nombre.value.replace(/\s+/g, " ").trim();
    const g = grupo.value.replace(/\s+/g, " ").trim();
    const c = code.value.trim();
    const fail = (msg) => {
      errBox.hidden = false;
      errBox.firstChild.textContent = msg;
    };
    errBox.hidden = true;
    if (!n || !g) return fail("Escribe tu nombre y tu grupo.");
    if (n.length > MAX_TEXT || g.length > MAX_TEXT) return fail(`El nombre y el grupo no pueden superar ${MAX_TEXT} caracteres.`);
    if (needsCode && !c) return fail("Escribe el código de acceso.");

    button.disabled = true;
    try {
      let loaded = exam;
      if (!loaded || needsCode) {
        const res = await fetchExam(examId, c);
        if (!res.ok) return fail(res.message || "No se ha podido abrir el examen.");
        loaded = res.exam;
      }
      startExam(loaded, { nombre: n, grupo: g, code: c });
    } catch (e) {
      fail(errorText(e));
    } finally {
      button.disabled = false;
    }
  });

  const minutes = Number(info.tiempo_min) || 0;
  render(
    h(
      "div",
      { class: "card" },
      h("h1", {}, info.titulo),
      h(
        "p",
        { class: "muted" },
        `${info.n_preguntas} preguntas · `,
        minutes > 0 ? `${minutes} minutos` : "sin límite de tiempo"
      ),
      h(
        "div",
        { class: "notice info" },
        h("p", {}, h("strong", {}, "Cómo se puntúa")),
        scoringText(exam?.questions).map((t) => h("p", {}, t))
      ),
      info.control_salidas
        ? h(
            "div",
            { class: "notice warn" },
            h("p", {}, h("strong", {}, "Examen vigilado")),
            h("p", {}, EXIT_RULE),
            h("p", {}, "Copiar y pegar está desactivado durante el examen.")
          )
        : null,
      form
    )
  );
  refreshButton();
}

function errorText(e) {
  if (e instanceof ConfigError) return "La aplicación no está configurada todavía. Avisa a tu profesor.";
  if (e instanceof NetworkError) return "No hay conexión con el servidor. Comprueba tu conexión e inténtalo de nuevo.";
  return "Ha ocurrido un error inesperado.";
}

/* ------------------------------- examen --------------------------------- */

function startExam(exam, who) {
  const key = progressKey(who.nombre, who.grupo);
  let progress = loadJson(key);
  if (!progress || typeof progress.answers !== "object" || !progress.startedAt) {
    progress = { nombre: who.nombre, grupo: who.grupo, startedAt: Date.now(), answers: {} };
  }
  // Datos de envío y de vigilancia (también para progresos guardados por versiones anteriores).
  progress.envioId = progress.envioId || newSendId();
  progress.salidas = Number(progress.salidas) || 0;
  progress.segundosFuera = Number(progress.segundosFuera) || 0;
  progress.leftAt = progress.leftAt || null;
  store.set(key, JSON.stringify(progress));
  store.set(lastKey(), JSON.stringify(who));

  // Orden fijo por alumno: la semilla depende del examen, el nombre y el grupo.
  const seed = `${examId}|${normalize(who.nombre)}|${normalize(who.grupo)}`;
  let questions = exam.questions.map((q) => ({ ...q }));
  if (exam.barajar_preguntas) questions = seededShuffle(questions, `${seed}|q`);
  if (exam.barajar_opciones) {
    questions = questions.map((q) => ({ ...q, options: seededShuffle(q.options, `${seed}|o|${q.id}`) }));
  }
  // Descarta respuestas guardadas que ya no correspondan a este examen.
  for (const q of questions) {
    const given = progress.answers[q.id];
    if (given && !q.options.some((o) => o.id === given)) delete progress.answers[q.id];
  }

  renderExam({ exam, questions, who, key, progress });
}

function renderExam(session) {
  const { exam, questions, who, key, progress } = session;
  const total = questions.length;
  const limitSeconds = (Number(exam.tiempo_min) || 0) * 60;
  const watched = Boolean(exam.control_salidas);
  const allowed = Number.isFinite(Number(exam.salidas_permitidas)) ? Number(exam.salidas_permitidas) : 3;
  const overLimit = () => progress.salidas > allowed;
  let timerId = null;
  let sending = false;
  let finished = false;

  const counter = h("span");
  const timer = h("span", { class: "timer", role: "timer" });
  const status = h("div", { class: "status", hidden: true, role: "status" });
  const fieldset = h("fieldset", { class: "question" });
  const answered = () => questions.filter((q) => progress.answers[q.id]).length;
  const updateCounter = () => (counter.textContent = `Contestadas: ${answered()} de ${total}`);
  const save = () => store.set(key, JSON.stringify(progress));

  questions.forEach((q, i) => {
    const group = h("fieldset", { class: "question card question-card", id: `p${i + 1}` });
    group.append(h("legend", {}, h("span", { class: "qnum" }, `${i + 1}.`), q.text));
    const name = `q-${q.id}`;
    const radios = q.options.map((o, j) => {
      const input = h("input", { type: "radio", name, value: o.id, checked: progress.answers[q.id] === o.id });
      input.addEventListener("change", () => {
        progress.answers[q.id] = o.id;
        save();
        updateCounter();
        blank.disabled = false;
      });
      group.append(
        h("label", { class: "option" }, input, h("span", {}, h("span", { class: "letter" }, "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[j]), o.text))
      );
      return input;
    });
    const blank = h(
      "button",
      {
        type: "button",
        class: "btn secondary small blank-btn",
        disabled: !progress.answers[q.id],
        onclick: () => {
          radios.forEach((r) => (r.checked = false));
          delete progress.answers[q.id];
          save();
          updateCounter();
          blank.disabled = true;
        },
      },
      "Dejar en blanco"
    );
    group.append(blank);
    fieldset.append(group);
  });

  const reviewBtn = h("button", { type: "button", class: "btn block", onclick: () => confirmSend() }, "Revisar y enviar");

  const lock = () => {
    fieldset.disabled = true;
    reviewBtn.disabled = true;
  };

  function confirmSend() {
    const blanks = questions.map((q, i) => (progress.answers[q.id] ? null : i + 1)).filter(Boolean);
    const dialog = h("dialog");
    const close = () => {
      dialog.close();
      dialog.remove();
    };
    dialog.append(
      h("h2", {}, "Antes de enviar"),
      h("p", {}, `Has contestado ${total - blanks.length} de ${total} preguntas.`),
      blanks.length
        ? h(
            "p",
            { class: "blank-list" },
            `En blanco (${blanks.length}): `,
            blanks.flatMap((n, idx) => [
              idx ? ", " : "",
              h("a", { href: `#p${n}`, onclick: () => close() }, String(n)),
            ])
          )
        : null,
      h("p", { class: "muted small" }, "Una vez enviado no podrás cambiar tus respuestas."),
      h(
        "div",
        { class: "actions" },
        h("button", { type: "button", class: "btn secondary", onclick: close }, "Volver al examen"),
        h(
          "button",
          {
            type: "button",
            class: "btn",
            onclick: () => {
              close();
              send();
            },
          },
          "Enviar definitivamente"
        )
      )
    );
    document.body.append(dialog);
    dialog.addEventListener("cancel", () => dialog.remove());
    dialog.showModal();
  }

  // Tiempo total fuera: salidas ya cerradas + la que esté en curso.
  const awaySeconds = () => progress.segundosFuera + (progress.leftAt ? (Date.now() - progress.leftAt) / 1000 : 0);

  function buildPayload(motivo) {
    const respuestas = {};
    for (const q of exam.questions) respuestas[q.id] = progress.answers[q.id] ?? null;
    return {
      examId,
      nombre: who.nombre,
      grupo: who.grupo,
      code: who.code,
      respuestas,
      duracion_min: Math.round(((Date.now() - progress.startedAt) / 60000) * 100) / 100,
      salidas: progress.salidas,
      // Incluye el tiempo de una salida que todavía no ha terminado (el alumno envía sin haber vuelto).
      segundos_fuera: Math.round(awaySeconds() * 10) / 10,
      envio: motivo,
      envioId: progress.envioId,
    };
  }

  // motivo: "manual" (botón), "tiempo" (se acabó) o "salida" (cambió de pestaña, ventana o app).
  async function send(motivo = "manual") {
    if (sending) return;
    sending = true;
    clearInterval(timerId);
    cover.hidden = true;
    lock();
    const payload = buildPayload(motivo);

    const showStatus = (kind, text, retry) => {
      status.hidden = false;
      status.replaceChildren(
        h("div", { class: `notice ${kind}`, style: "margin:0" }, h("p", {}, text), retry ? h("div", { class: "actions", style: "margin-top:10px" }, retry) : null)
      );
    };
    const retryBtn = () => h("button", { class: "btn", type: "button", onclick: () => { sending = false; send(motivo); } }, "Reintentar el envío");

    showStatus(
      "info",
      motivo === "tiempo"
        ? "Se ha acabado el tiempo. Enviando tus respuestas…"
        : motivo === "salida"
          ? "Has salido de la pantalla del examen: se envía automáticamente con tus respuestas actuales…"
          : "Enviando tus respuestas…"
    );

    let res = null;
    for (let attempt = 0; ; attempt++) {
      try {
        res = await submitExam(payload);
        break;
      } catch (e) {
        if (e instanceof NetworkError && attempt < RETRY_DELAYS.length) {
          showStatus("warn", `Sin conexión. Reintentando… (${attempt + 1}/${RETRY_DELAYS.length})`);
          await sleep(RETRY_DELAYS[attempt]);
          continue;
        }
        showStatus("error", `${errorText(e)} Tus respuestas están guardadas en este dispositivo: no las pierdes.`, retryBtn());
        return;
      }
    }

    if (!res.ok) {
      const closed = res.error === "closed" || res.error === "not_found";
      showStatus(
        "error",
        `${res.message || "No se ha podido enviar el examen."} Tus respuestas siguen guardadas en este dispositivo.`,
        closed ? null : retryBtn()
      );
      return;
    }

    finished = true;
    clearInterval(watchTimer);
    store.remove(key);
    store.remove(lastKey());
    showDone(res, motivo);
  }

  /* --- vigilancia: cada salida se cuenta y se mide; al superar el límite se envía solo --- */

  function warnReturn() {
    const dialog = h("dialog", { class: "warning" });
    const close = () => {
      dialog.close();
      dialog.remove();
    };
    dialog.append(
      h("h2", {}, "⚠ AVISO: has salido del examen"),
      h("p", {}, h("strong", {}, "Está prohibido salir de la pantalla del examen.")),
      h("p", {}, "Esta salida ha quedado registrada, junto con el tiempo que has estado fuera, y tu profesor la verá."),
      h("p", {}, h("strong", {}, "Si continúas saliendo, el examen se enviará automáticamente tal como esté.")),
      h("div", { class: "actions" }, h("button", { type: "button", class: "btn danger", onclick: close }, "Entendido, volver al examen"))
    );
    document.body.append(dialog);
    dialog.addEventListener("cancel", () => dialog.remove());
    dialog.showModal();
  }

  // Mientras el alumno está fuera de la pantalla completa, el examen no se puede ver ni contestar.
  const cover = h(
    "div",
    { class: "away-cover", hidden: true, role: "alert" },
    h("h2", {}, "⚠ Examen oculto"),
    h("p", {}, h("strong", {}, "Vuelve a la pantalla completa del examen para continuar.")),
    h("p", {}, "Mientras estés fuera, el examen no se muestra y el tiempo que pasas fuera queda registrado.")
  );
  function showCover(on) {
    cover.hidden = !on;
    if (!sending) fieldset.disabled = on;
  }

  function onLeave() {
    if (!watched || sending || finished || progress.leftAt) return;
    showCover(true);
    progress.salidas += 1;
    progress.leftAt = Date.now();
    save();
    // Solo al superar el límite se avisa al servidor. La página puede congelarse al cambiar
    // de app, así que se usa sendBeacon; al volver se reenvía con el mismo envioId.
    if (overLimit()) beaconSubmit(buildPayload("salida"));
  }

  function onReturn() {
    if (!watched || sending || finished || !progress.leftAt) return;
    progress.segundosFuera += (Date.now() - progress.leftAt) / 1000;
    progress.leftAt = null;
    save();
    showCover(false);
    if (overLimit()) send("salida");
    else warnReturn();
  }

  /*
   * ¿Sigue el alumno en la pantalla del examen? Se combinan varias señales, porque ninguna basta:
   * - página oculta (otra pestaña/app, pantalla bloqueada),
   * - evento blur (otra ventana activa),
   * - document.hasFocus() en false durante 1 s (el iPad no siempre emite blur en pantalla dividida),
   * - ventana reducida (pantalla dividida, Slide Over, Stage Manager en tabletas).
   */
  const signals = { hidden: false, blurred: false, reduced: false };
  let noFocusSince = 0;
  let focusSeen = false; // hasFocus() solo cuenta si alguna vez ha sido true en este examen
  let watchTimer = null;

  // Actualiza las señales y dice si el alumno está ahora fuera de la pantalla completa del examen.
  function computeAway() {
    signals.hidden = document.hidden;
    signals.reduced = isReducedWindow({
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      screenWidth: window.screen?.width,
      screenHeight: window.screen?.height,
      coarse: window.matchMedia?.("(pointer: coarse)").matches ?? false,
    });
    if (document.hasFocus()) {
      focusSeen = true;
      noFocusSince = 0;
    } else if (focusSeen && !noFocusSince) {
      noFocusSince = Date.now();
    }
    return isAway({ ...signals, noFocusMs: noFocusSince ? Date.now() - noFocusSince : 0 });
  }

  function evaluateAway() {
    if (!watched || sending || finished) return;
    const away = computeAway();
    if (away && !progress.leftAt) onLeave();
    else if (!away && progress.leftAt) onReturn();
  }

  if (watched) {
    document.addEventListener("visibilitychange", evaluateAway);
    window.addEventListener("blur", () => { signals.blurred = true; evaluateAway(); });
    window.addEventListener("focus", () => { signals.blurred = false; evaluateAway(); });
    window.addEventListener("pagehide", () => { signals.hidden = true; onLeave(); });
    window.addEventListener("pageshow", evaluateAway);
    window.addEventListener("resize", evaluateAway);
    window.addEventListener("orientationchange", evaluateAway);
    watchTimer = setInterval(evaluateAway, 500);
  }

  const bar = h("div", { class: "exam-bar" }, counter, limitSeconds ? timer : null);
  const screen = h(
    "div",
    { class: watched ? "exam-screen no-copy" : "exam-screen" },
    h("h1", {}, exam.titulo),
    h("p", { class: "muted" }, `${who.nombre} · ${who.grupo}`),
    watched ? h("p", { class: "muted small" }, "Examen vigilado: no salgas de esta pantalla. Las salidas quedan registradas y, si continúas, el examen se envía automáticamente.") : null,
    bar,
    fieldset,
    reviewBtn,
    h("p", { class: "muted small" }, "Tus respuestas se guardan automáticamente en este dispositivo."),
    status,
    watched ? cover : null
  );
  if (watched) {
    // Frena copiar, cortar, pegar, el menú contextual y seleccionar texto (disuasorio).
    for (const type of ["copy", "cut", "paste", "contextmenu", "selectstart", "dragstart"]) {
      screen.addEventListener(type, (e) => e.preventDefault());
    }
  }
  render(screen);
  updateCounter();
  window.scrollTo(0, 0);

  if (limitSeconds) {
    const tick = () => {
      const remaining = limitSeconds - (Date.now() - progress.startedAt) / 1000;
      timer.textContent = `⏱ ${formatClock(remaining)}`;
      timer.classList.toggle("low", remaining <= 60);
      if (remaining <= 0) send("tiempo");
    };
    tick();
    if (!sending) timerId = setInterval(tick, 1000);
  }

  // Si el alumno salió y la página se recargó o se cerró, se suma el tiempo que estuvo fuera.
  // Si ya superó las salidas permitidas, el examen se envía al volver.
  if (watched && progress.leftAt) {
    if (computeAway() && !overLimit()) {
      showCover(true); // sigue fuera (por ejemplo, recargó la página en pantalla dividida): no cuenta otra salida
    } else {
      progress.segundosFuera += (Date.now() - progress.leftAt) / 1000;
      progress.leftAt = null;
      save();
      if (!overLimit()) warnReturn();
    }
  }
  if (watched && overLimit() && !sending) send("salida");
}

function showDone(res, motivo = "manual") {
  const hasScore = typeof res.nota === "number";
  render(
    h(
      "div",
      { class: "card" },
      h("h1", {}, "Examen enviado correctamente"),
      h("div", { class: "notice ok" }, h("p", {}, "Ya puedes cerrar esta página.")),
      motivo === "salida"
        ? h("div", { class: "notice warn" }, h("p", {}, "El examen se ha enviado automáticamente porque has salido de la pantalla del examen. Tu profesor lo verá registrado."))
        : null,
      hasScore
        ? [
            h("p", { class: "muted" }, "Tu nota"),
            h("div", { class: "big-result" }, `${formatNumber(res.nota)} / 10`),
            h("p", {}, `Aciertos: ${res.aciertos} · Errores: ${res.errores} · En blanco: ${res.blancos}`),
          ]
        : h("p", { class: "muted" }, "Tu profesor te comunicará la nota.")
    )
  );
}

/* -------------------------------- inicio -------------------------------- */

async function main() {
  if (!examId) {
    return showMessage("Falta el examen", "Este enlace no es correcto. Pide a tu profesor el enlace del examen.", "warn");
  }
  try {
    const res = await fetchExam(examId);
    if (res.ok) {
      document.title = res.exam.titulo;
      return showStart(
        {
          titulo: res.exam.titulo,
          n_preguntas: res.exam.questions.length,
          tiempo_min: res.exam.tiempo_min,
          requiere_codigo: false,
          control_salidas: res.exam.control_salidas,
          salidas_permitidas: res.exam.salidas_permitidas,
        },
        res.exam
      );
    }
    if (res.info && (res.error === "code_required" || res.error === "bad_code")) {
      document.title = res.info.titulo;
      return showStart(res.info, null);
    }
    const title = res.error === "closed" ? "Examen cerrado" : "Examen no disponible";
    showMessage(title, res.message || "No se ha podido abrir el examen.", "warn");
  } catch (e) {
    showMessage("No se puede abrir el examen", errorText(e), "error");
  }
}

main();
