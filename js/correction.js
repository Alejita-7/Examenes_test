// Pantalla de corrección de preguntas abiertas y exportación de las notas (panel del profesor).
import { apiPost, NetworkError } from "./api.js";
import { h } from "./dom.js";
import { richNodes } from "./rich.js";
import { formatNumber } from "./util.js";

/* ------------------------------ exportación ------------------------------ */

const num = (v) => (v === "" || v === null || v === undefined ? "" : String(v).replace(".", ","));

// Una celda de CSV: comillas dobles si hace falta y sin fórmulas (= + - @ al principio se neutralizan).
export function csvCell(value) {
  let t = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(t) && !/^-?\d+([.,]\d+)?$/.test(t)) t = `'${t}`;
  return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** Tabla de notas lista para Excel en español: separador «;», decimales con coma, orden por apellidos. */
export function buildCsv(rows, hasOpen) {
  const head = ["Apellidos", "Nombre", "Grupo", "Nota", ...(hasOpen ? ["Preguntas sin corregir"] : []), "Aciertos", "Errores", "En blanco", "Salidas", "Segundos fuera", "Intentos de pegar"];
  const lines = [head, ...rows.map((r) => [r.apellidos, r.nombre, r.grupo, num(r.nota), ...(hasOpen ? [r.pendientes] : []), r.aciertos, r.errores, r.blancos, r.salidas, num(r.segundos_fuera), r.pegados])];
  return "﻿" + lines.map((l) => l.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = h("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const safeName = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50) || "examen";

async function fetchResults(token, examId) {
  const res = await apiPost({ action: "results", token, examId });
  return res;
}

/** Descarga la tabla de notas de un examen (CSV). Devuelve un texto de error o null. */
export async function exportNotes(token, ex) {
  const res = await fetchResults(token, ex.id);
  if (res.error === "bad_request") return "El script de Google no está actualizado: actualiza Code.gs (Nueva versión) para poder exportar.";
  if (!res.ok) return res.message || "No se han podido leer los resultados.";
  if (!res.rows.length) return "Todavía no hay envíos que exportar.";
  const hasOpen = res.exam.preguntas.some((q) => q.tipo === "abierta");
  download(`notas_${safeName(ex.titulo)}.csv`, buildCsv(res.rows, hasOpen));
  return null;
}

/* ------------------------------- corrección ------------------------------ */

const fmt = (n) => formatNumber(n);

export async function showCorrection(app, { token, ex, onBack, onUnauthorized }) {
  app.replaceChildren(h("div", { class: "card" }, h("p", { class: "muted" }, "Cargando respuestas…")));
  let res;
  try {
    res = await fetchResults(token, ex.id);
  } catch (e) {
    app.replaceChildren(h("div", { class: "card" }, h("div", { class: "notice error" }, h("p", {}, e instanceof NetworkError ? "No hay conexión con el servidor." : "Ha ocurrido un error inesperado.")), h("button", { class: "btn secondary", type: "button", onclick: onBack }, "Volver")));
    return;
  }
  if (res.error === "unauthorized") return onUnauthorized();
  if (!res.ok) {
    const msg = res.error === "bad_request" ? "El script de Google no está actualizado: actualiza Code.gs (Nueva versión) para poder corregir aquí." : res.message;
    app.replaceChildren(h("div", { class: "card" }, h("div", { class: "notice error" }, h("p", {}, msg)), h("button", { class: "btn secondary", type: "button", onclick: onBack }, "Volver")));
    return;
  }

  const opens = res.exam.preguntas.filter((q) => q.tipo === "abierta");
  const rows = res.rows;
  let current = opens[0];
  let onlyPending = false;
  const body = h("div");
  const tabs = h("div", { class: "q-tabs", role: "tablist" });
  const progress = h("div", { class: "progress-wrap" });

  const done = (q) => rows.filter((r) => r.abiertas[q.id]?.puntos !== null && r.abiertas[q.id]?.puntos !== undefined).length;

  function renderTabs() {
    tabs.replaceChildren(
      ...opens.map((q) => {
        const d = done(q);
        return h(
          "button",
          { type: "button", role: "tab", class: `q-tab${q === current ? " active" : ""}${d === rows.length && rows.length ? " complete" : ""}`, onclick: () => { current = q; renderAll(); } },
          h("strong", {}, `Pregunta ${q.n}`),
          h("small", {}, `${d}/${rows.length} · ${fmt(q.valor)} pt`)
        );
      })
    );
  }

  function renderProgress() {
    const d = done(current);
    const pct = rows.length ? Math.round((d / rows.length) * 100) : 0;
    progress.replaceChildren(
      h("div", { class: "progress" }, h("div", { class: "progress-bar", style: `width:${pct}%` })),
      h("p", { class: "muted small" }, `${d} de ${rows.length} corregidas en esta pregunta`)
    );
  }

  function renderBody() {
    const inputs = [];
    const visible = rows.filter((r) => !onlyPending || r.abiertas[current.id].puntos === null);
    const only = h("label", { class: "check" }, h("input", { type: "checkbox", checked: onlyPending, onchange: (e) => { onlyPending = e.target.checked; renderBody(); } }), "Mostrar solo las sin corregir");
    body.replaceChildren(
      h("div", { class: "card q-head" }, h("div", { class: "q-text" }, h("strong", {}, `${current.n}. `), ...richNodes(current.text, res.exam.imagenes ?? {})), h("p", { class: "muted small" }, `Vale ${fmt(current.valor)} ${current.valor === 1 ? "punto" : "puntos"}.`), progress, only),
      visible.length ? h("span") : h("div", { class: "notice ok" }, h("p", {}, rows.length ? "No queda ninguna sin corregir en esta pregunta. 🎉" : "Todavía no hay envíos.")),
      ...visible.map((r, idx) => answerCard(r, idx, inputs))
    );
  }

  function answerCard(r, idx, inputs) {
    const a = r.abiertas[current.id];
    const max = current.valor;
    const status = h("span", { class: "save-state small" });
    const input = h("input", { type: "text", inputmode: "decimal", autocomplete: "off", "aria-label": `Puntos de ${r.nombre} ${r.apellidos}`, value: a.puntos === null ? "" : String(a.puntos).replace(".", ",") });
    inputs.push(input);
    const card = h("div", { class: `answer-card${a.puntos === null ? " pending" : " graded"}` });

    let sent; // último valor enviado: evita guardar dos veces (Enter + change)
    async function save(value) {
      sent = value;
      status.textContent = "Guardando…";
      status.className = "save-state small";
      try {
        const out = await apiPost({ action: "grade", token, examId: ex.id, envioId: r.envio_id, qid: current.id, puntos: value });
        if (out.error === "unauthorized") return onUnauthorized();
        if (!out.ok) {
          status.textContent = out.message || "No se ha podido guardar.";
          status.className = "save-state small bad";
          return;
        }
        a.puntos = out.puntos;
        r.pendientes = out.pendientes;
        r.nota = out.nota;
        input.value = out.puntos === null ? "" : String(out.puntos).replace(".", ",");
        card.className = `answer-card${out.puntos === null ? " pending" : " graded"}`;
        status.textContent = out.puntos === null ? "Sin corregir" : `Guardado ✓ · nota del alumno: ${fmt(out.nota)}`;
        status.className = "save-state small ok";
        renderTabs();
        renderProgress();
      } catch {
        status.textContent = "Sin conexión: no se ha guardado.";
        status.className = "save-state small bad";
      }
    }
    const commit = () => {
      const t = String(input.value).trim().replace(",", ".");
      const last = sent === undefined ? a.puntos : sent;
      if (t === "") return last === null ? undefined : save(null);
      const v = Number(t);
      if (!Number.isFinite(v) || v < 0 || v > max) {
        status.textContent = `Pon un número entre 0 y ${fmt(max)}.`;
        status.className = "save-state small bad";
        return;
      }
      if (v !== last) save(v);
    };
    input.addEventListener("change", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      commit();
      inputs[idx + 1]?.focus();
      inputs[idx + 1]?.select();
    });
    const quick = (label, value) => h("button", { type: "button", class: "btn secondary small", onclick: () => { input.value = value; commit(); } }, label);

    card.append(
      h("div", { class: "answer-head" }, h("strong", {}, `${r.apellidos}, ${r.nombre}`), h("span", { class: "badge off-soft" }, r.grupo), r.pegados ? h("span", { class: "badge warn-badge", title: "Intentos de pegar texto en la respuesta" }, `${r.pegados} intento${r.pegados === 1 ? "" : "s"} de pegar`) : null),
      a.texto.trim() ? h("div", { class: "answer-text" }, a.texto) : h("div", { class: "answer-text empty" }, "(En blanco)"),
      h("div", { class: "grade-row" }, h("label", {}, h("span", { class: "small muted" }, "Puntos"), input, h("span", { class: "muted" }, ` / ${fmt(max)}`)), quick("0", 0), quick("½", Math.round((max / 2) * 10000) / 10000), quick("Máximo", max), status)
    );
    return card;
  }

  function renderAll() {
    renderTabs();
    renderProgress();
    renderBody();
  }

  const exportBtn = h("button", { class: "btn secondary small", type: "button" }, "Exportar notas (CSV)");
  exportBtn.addEventListener("click", async () => {
    exportBtn.disabled = true;
    const err = await exportNotes(token, ex).catch(() => "No se ha podido exportar.");
    exportBtn.disabled = false;
    if (err) alert(err);
  });

  app.replaceChildren(
    h("div", { class: "top-bar" }, h("div", {}, h("p", { class: "muted small", style: "margin:0" }, "Corregir preguntas abiertas"), h("h1", {}, ex.titulo)), h("div", { class: "actions" }, exportBtn, h("button", { class: "btn secondary small", type: "button", onclick: onBack }, "← Volver al panel"))),
    opens.length ? tabs : h("div", { class: "notice info" }, h("p", {}, "Este examen no tiene preguntas abiertas.")),
    body
  );
  if (opens.length) renderAll();
}
