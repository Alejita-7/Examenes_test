// Panel del profesor (admin.html). El token se guarda solo en el localStorage de este navegador.
import { apiGet, apiPost, NetworkError, ConfigError } from "./api.js";
import { parseGift, GiftError } from "./gift.js";
import { h } from "./dom.js";
import { studentLink, randomCode } from "./util.js";

const TOKEN_KEY = "admin_token";
const WARN_CHARS = 45000;
const MAX_CHARS = 49000;

const app = document.getElementById("app");
let token = readToken();

/* ------------------------------- token ---------------------------------- */

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}
function saveToken(value) {
  token = value;
  try {
    value ? localStorage.setItem(TOKEN_KEY, value) : localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* sin almacenamiento: el token vive solo hasta cerrar la página */
  }
}

/* ------------------------------ utilidades ------------------------------ */

function errorText(e) {
  if (e instanceof ConfigError) return "Falta configurar APPS_SCRIPT_URL en js/config.js.";
  if (e instanceof NetworkError) return "No hay conexión con el servidor. Inténtalo de nuevo.";
  return "Ha ocurrido un error inesperado.";
}

const notice = (kind, text) => h("div", { class: `notice ${kind}`, role: kind === "error" ? "alert" : null }, h("p", {}, text));

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = h("textarea", { style: "position:fixed;opacity:0" });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  const old = button.textContent;
  button.textContent = "¡Copiado!";
  setTimeout(() => (button.textContent = old), 1500);
}

function qrImage(url) {
  if (typeof qrcode === "undefined") return null; // la librería no cargó: se omite el QR
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  return h("div", { class: "qr" }, h("img", { src: qr.createDataURL(8, 4), alt: "Código QR del enlace del examen" }));
}

/* ------------------------------- inicio --------------------------------- */

function showLogin(message) {
  const input = h("input", { type: "password", name: "token", autocomplete: "current-password", required: true });
  const msg = h("div");
  if (message) msg.append(notice("error", message));
  const button = h("button", { class: "btn block", type: "submit" }, "Entrar");
  const form = h(
    "form",
    {},
    h("label", { class: "field" }, h("span", {}, "Token de administración"), input, h("small", { class: "hint" }, "Es el valor de ADMIN_TOKEN que pusiste en el script. Se guarda solo en este navegador.")),
    msg,
    button
  );
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    button.disabled = true;
    msg.replaceChildren();
    try {
      const res = await apiGet({ action: "list", token: input.value.trim() });
      if (res.ok) {
        saveToken(input.value.trim());
        showPanel(res.exams);
      } else {
        msg.append(notice("error", res.message || "No se ha podido entrar."));
      }
    } catch (e) {
      msg.append(notice("error", errorText(e)));
    } finally {
      button.disabled = false;
    }
  });
  app.replaceChildren(h("div", { class: "card" }, h("h1", {}, "Panel del profesor"), form));
}

async function main() {
  if (!token) return showLogin();
  try {
    const res = await apiGet({ action: "list", token });
    if (res.ok) return showPanel(res.exams);
    if (res.error === "unauthorized") saveToken("");
    showLogin(res.message);
  } catch (e) {
    showLogin(errorText(e));
  }
}

/* -------------------------------- panel --------------------------------- */

function showPanel(initialExams) {
  const listBox = h("div");
  const createBox = h("div");

  const logout = h(
    "button",
    {
      class: "btn secondary small",
      type: "button",
      onclick: () => {
        saveToken("");
        showLogin();
      },
    },
    "Cerrar sesión"
  );

  app.replaceChildren(
    h("div", { class: "top-bar" }, h("h1", {}, "Panel del profesor"), logout),
    createBox,
    h("div", { class: "card" }, h("h2", {}, "Mis exámenes"), listBox)
  );

  const onUnauthorized = () => {
    saveToken("");
    showLogin("El token ya no es válido. Vuelve a escribirlo.");
  };

  async function refreshList() {
    try {
      const res = await apiGet({ action: "list", token });
      if (res.ok) renderList(res.exams);
      else if (res.error === "unauthorized") onUnauthorized();
      else listBox.replaceChildren(notice("error", res.message));
    } catch (e) {
      listBox.replaceChildren(notice("error", errorText(e)));
    }
  }

  function renderList(exams) {
    if (!exams.length) {
      listBox.replaceChildren(h("p", { class: "muted" }, "Todavía no has publicado ningún examen."));
      return;
    }
    const sorted = [...exams].sort((a, b) => String(b.creado).localeCompare(String(a.creado)));
    listBox.replaceChildren(
      ...sorted.map((ex) => {
        const link = studentLink(location.href, ex.id);
        const toggle = h("button", { class: "btn secondary small", type: "button" }, ex.activo ? "Cerrar examen" : "Abrir examen");
        toggle.addEventListener("click", async () => {
          toggle.disabled = true;
          try {
            const res = await apiPost({ action: "setActive", token, id: ex.id, activo: !ex.activo });
            if (res.error === "unauthorized") return onUnauthorized();
            if (!res.ok) alert(res.message);
          } catch (e) {
            alert(errorText(e));
          }
          refreshList();
        });
        const copy = h("button", { class: "btn secondary small", type: "button" }, "Copiar enlace");
        copy.addEventListener("click", () => copyText(link, copy));
        return h(
          "div",
          { class: "exam-item" },
          h("h3", {}, ex.titulo, " ", h("span", { class: `badge ${ex.activo ? "on" : "off"}` }, ex.activo ? "Abierto" : "Cerrado"), ex.control_salidas ? " " : null, ex.control_salidas ? h("span", { class: "badge on" }, `Vigilado · ${ex.salidas_permitidas ?? 3} salidas`) : null),
          h(
            "p",
            { class: "muted small meta" },
            [
              ex.grupo_destino ? `Grupo: ${ex.grupo_destino}` : null,
              `${ex.n_preguntas} preguntas`,
              ex.tiempo_min ? `${ex.tiempo_min} min` : "sin límite de tiempo",
              `${ex.envios} envío${ex.envios === 1 ? "" : "s"}`,
              ex.codigo_acceso ? `Código: ${ex.codigo_acceso}` : null,
            ]
              .filter(Boolean)
              .join(" · ")
          ),
          h("div", { class: "actions" }, toggle, copy, h("a", { class: "btn secondary small", href: ex.results_url, target: "_blank", rel: "noopener" }, "Ver resultados"))
        );
      })
    );
  }

  renderCreate(createBox, { onPublished: refreshList, onUnauthorized });
  renderList(initialExams);
}

/* ----------------------------- crear examen ----------------------------- */

function renderCreate(box, { onPublished, onUnauthorized }) {
  let questions = null;

  const file = h("input", { type: "file", accept: ".txt,.gift,text/plain" });
  const gift = h("textarea", { name: "gift", spellcheck: "false", placeholder: "::P01::Pregunta{\n=Correcta\n~Incorrecta\n~Incorrecta\n}" });
  const preview = h("div");

  const titulo = h("input", { name: "titulo", maxlength: 120, required: true });
  const grupo = h("input", { name: "grupo", maxlength: 60 });
  const tiempo = h("input", { name: "tiempo", type: "number", min: 0, step: 1, value: 0, inputmode: "numeric" });
  const codigo = h("input", { name: "codigo", maxlength: 40, autocomplete: "off" });
  const genCode = h("button", { class: "btn secondary small", type: "button", onclick: () => (codigo.value = randomCode()) }, "Generar código");
  const check = (label, checked) => {
    const input = h("input", { type: "checkbox", checked });
    return { input, node: h("label", { class: "check" }, input, label) };
  };
  const barPreg = check("Barajar el orden de las preguntas", true);
  const barOpc = check("Barajar el orden de las opciones", true);
  const mostrar = check("Mostrar la nota al alumno al terminar", true);
  const negativa = check("Permitir nota negativa (si no, la mínima es 0)", false);
  const vigilar = check("Vigilar salidas: registrar cuántas veces y cuánto tiempo sale el alumno (pestaña, ventana o app)", true);
  const salidasInput = h("input", { name: "salidas", type: "number", min: 0, max: 20, step: 1, value: 3, inputmode: "numeric" });
  const salidasField = h(
    "label",
    { class: "field" },
    h("span", {}, "Salidas permitidas"),
    salidasInput,
    h("small", { class: "hint" }, "Al superarlas, el examen se envía solo. Con 3, a la cuarta salida se envía. Con 0, se envía en la primera.")
  );
  vigilar.input.addEventListener("change", () => (salidasInput.disabled = !vigilar.input.checked));

  const msg = h("div");
  const publish = h("button", { class: "btn block", type: "submit", disabled: true }, "Publicar examen");

  function update() {
    questions = null;
    preview.replaceChildren();
    publish.disabled = true;
    const text = gift.value.trim();
    if (!text) return;
    try {
      questions = parseGift(text);
    } catch (e) {
      if (!(e instanceof GiftError)) throw e;
      preview.append(
        h("div", { class: "notice error", role: "alert" }, h("p", {}, h("strong", {}, "Hay errores en el archivo; corrígelos para poder publicar:")), e.errors.map((m) => h("p", {}, m)))
      );
      return;
    }
    const size = JSON.stringify(questions).length;
    const tooBig = size > MAX_CHARS;
    preview.append(
      h("p", {}, h("strong", {}, `${questions.length} preguntas`), ` · ${size.toLocaleString("es-ES")} de 50 000 caracteres`),
      tooBig ? notice("error", "El examen es demasiado grande para una celda de Google Sheets. Divídelo en dos exámenes.") : size > WARN_CHARS ? notice("warn", "El examen está cerca del límite de tamaño de una celda de Google Sheets.") : null,
      h(
        "div",
        { class: "card" },
        questions.map((q, i) =>
          h(
            "div",
            { class: "q-preview" },
            h("strong", {}, `${i + 1}. `, q.title ? `[${q.title}] ` : "", q.text),
            h("ol", {}, q.options.map((o) => h("li", { class: o.id === q.correct ? "correct" : null }, o.text, o.id === q.correct ? " ✓" : "")))
          )
        )
      )
    );
    publish.disabled = tooBig;
  }

  gift.addEventListener("input", update);
  file.addEventListener("change", async () => {
    const f = file.files[0];
    if (!f) return;
    gift.value = await f.text();
    if (!titulo.value) {
      titulo.value = f.name.replace(/\.(gift|txt)/gi, "").replace(/[_-]+/g, " ").trim();
    }
    update();
  });

  const form = h(
    "form",
    {},
    h("h2", {}, "Crear examen"),
    h("label", { class: "field" }, h("span", {}, "Archivo GIFT"), file, h("small", { class: "hint" }, "El archivo no se guarda en ningún sitio: solo se envían las preguntas a tu hoja de Google.")),
    h("label", { class: "field" }, h("span", {}, "…o pega el texto GIFT"), gift),
    preview,
    h("h2", {}, "Ajustes"),
    h("label", { class: "field" }, h("span", {}, "Título"), titulo),
    h("div", { class: "row2" }, h("label", { class: "field" }, h("span", {}, "Grupo (opcional)"), grupo), h("label", { class: "field" }, h("span", {}, "Tiempo en minutos (0 = sin límite)"), tiempo)),
    h("label", { class: "field" }, h("span", {}, "Código de acceso (opcional)"), codigo, h("div", { style: "margin-top:6px" }, genCode)),
    barPreg.node,
    barOpc.node,
    mostrar.node,
    negativa.node,
    vigilar.node,
    salidasField,
    msg,
    publish
  );

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    msg.replaceChildren();
    if (!questions) return msg.append(notice("error", "Primero carga un examen GIFT válido."));
    if (!titulo.value.trim()) return msg.append(notice("error", "Escribe un título."));
    publish.disabled = true;
    publish.textContent = "Publicando…";
    try {
      const res = await apiPost({
        action: "createExam",
        token,
        titulo: titulo.value.trim(),
        grupo_destino: grupo.value.trim(),
        tiempo_min: Number(tiempo.value) || 0,
        codigo_acceso: codigo.value.trim(),
        barajar_preguntas: barPreg.input.checked,
        barajar_opciones: barOpc.input.checked,
        mostrar_nota: mostrar.input.checked,
        permitir_negativa: negativa.input.checked,
        control_salidas: vigilar.input.checked,
        salidas_permitidas: salidasInput.value === "" ? 3 : Math.max(0, Math.min(20, Math.floor(Number(salidasInput.value)) || 0)),
        preguntas: questions,
      });
      if (res.error === "unauthorized") return onUnauthorized();
      if (!res.ok) {
        msg.append(notice("error", res.message || "No se ha podido publicar."));
        publish.disabled = false;
        return;
      }
      showPublished(box, res, titulo.value.trim(), codigo.value.trim(), () => renderCreate(box, { onPublished, onUnauthorized }));
      onPublished();
    } catch (e) {
      msg.append(notice("error", errorText(e)));
      publish.disabled = false;
    } finally {
      publish.textContent = "Publicar examen";
    }
  });

  box.replaceChildren(h("div", { class: "card" }, form));
}

function showPublished(box, res, title, code, again) {
  const link = studentLink(location.href, res.id);
  const copy = h("button", { class: "btn", type: "button" }, "Copiar enlace");
  copy.addEventListener("click", () => copyText(link, copy));
  box.replaceChildren(
    h(
      "div",
      { class: "card" },
      h("h2", {}, "Examen publicado"),
      notice("ok", `«${title}» (${res.n_preguntas} preguntas) ya está abierto para los alumnos.`),
      res.warning ? notice("warn", res.warning) : null,
      code ? h("p", {}, "Código de acceso: ", h("strong", {}, code)) : null,
      h("div", { class: "link-row" }, h("input", { readonly: true, value: link, "aria-label": "Enlace del examen", onfocus: (e) => e.target.select() }), copy),
      h("p", {}),
      qrImage(link),
      h("p", { class: "muted small" }, "Cuando quieras que nadie más pueda entrar, ciérralo desde «Mis exámenes»."),
      h("div", { class: "actions" }, h("a", { class: "btn secondary", href: link, target: "_blank", rel: "noopener" }, "Abrir como alumno"), h("button", { class: "btn secondary", type: "button", onclick: again }, "Crear otro examen"))
    )
  );
}

main();
