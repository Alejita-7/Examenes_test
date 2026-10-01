/**
 * Backend de Exámenes tipo test (Google Apps Script, Web App).
 *
 * Se copia a mano al editor de Apps Script de la hoja de cálculo
 * (Extensiones → Apps Script). Ver apps-script/INSTRUCCIONES.md.
 *
 * - La corrección se hace AQUÍ, nunca en el navegador del alumno.
 * - El token de administración vive en Propiedades del script (ADMIN_TOKEN).
 * - gradeExam_ replica exactamente js/grading.js (hay un test que lo comprueba).
 */

const SHEET_EXAMS = 'Examenes';
const EXAM_HEADERS = [
  'id', 'titulo', 'grupo_destino', 'activo', 'codigo_acceso', 'tiempo_min',
  'barajar_preguntas', 'barajar_opciones', 'mostrar_nota', 'permitir_negativa',
  'preguntas_json', 'creado'
];
const RESULT_HEADERS = [
  'fecha', 'nombre', 'grupo', 'aciertos', 'errores', 'blancos', 'nota',
  'duracion_min', 'posible_duplicado', 'respuestas_json'
];
const MAX_TEXT = 60;          // nombre y grupo
const WARN_CHARS = 45000;     // aviso: cerca del límite de celda
const MAX_CHARS = 49000;      // límite duro (la celda admite 50 000)
const MAX_QUESTIONS = 200;
const MAX_OPTIONS = 26;

/* ------------------------------------------------------------------ */
/* Puntos de entrada                                                   */
/* ------------------------------------------------------------------ */

function doGet(e) {
  return respond_(safely_(function () { return handleGet_((e && e.parameter) || {}); }));
}

function doPost(e) {
  return respond_(safely_(function () {
    var body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (err) {
      return fail_('bad_request', 'El cuerpo de la petición no es JSON válido.');
    }
    return handlePost_(body || {});
  }));
}

function handleGet_(params) {
  switch (params.action) {
    case 'exam': return getExam_(params);
    case 'list': return listExams_(params);
    default: return fail_('bad_request', 'Acción no reconocida.');
  }
}

function handlePost_(body) {
  switch (body.action) {
    case 'submit': return submit_(body);
    case 'createExam': return createExam_(body);
    case 'setActive': return setActive_(body);
    default: return fail_('bad_request', 'Acción no reconocida.');
  }
}

function safely_(fn) {
  try {
    return fn();
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return fail_('server_error', 'Error interno del servidor.');
  }
}

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function fail_(code, message) {
  return { ok: false, error: code, message: message };
}

/* ------------------------------------------------------------------ */
/* Acciones                                                            */
/* ------------------------------------------------------------------ */

function getExam_(params) {
  var exam = findExam_(params.id);
  if (!exam) return fail_('not_found', 'Este examen no existe.');
  if (!exam.activo) return fail_('closed', 'Este examen está cerrado.');

  var questions = JSON.parse(exam.preguntas_json);
  var info = {
    titulo: exam.titulo,
    n_preguntas: questions.length,
    tiempo_min: exam.tiempo_min,
    requiere_codigo: exam.codigo_acceso !== ''
  };

  var codeCheck = checkCode_(exam, params.code);
  if (codeCheck) {
    var res = fail_(codeCheck, codeCheck === 'code_required'
      ? 'Este examen necesita un código de acceso.'
      : 'El código de acceso no es correcto.');
    res.info = info;
    return res;
  }

  return {
    ok: true,
    exam: {
      id: exam.id,
      titulo: exam.titulo,
      grupo_destino: exam.grupo_destino,
      tiempo_min: exam.tiempo_min,
      barajar_preguntas: exam.barajar_preguntas,
      barajar_opciones: exam.barajar_opciones,
      mostrar_nota: exam.mostrar_nota,
      questions: questions.map(function (q) {
        return {
          id: q.id,
          title: q.title,
          text: q.text,
          options: q.options.map(function (o) { return { id: o.id, text: o.text }; })
        };
      })
    }
  };
}

function submit_(p) {
  var nombre = cleanText_(p.nombre);
  var grupo = cleanText_(p.grupo);
  if (!nombre || nombre.length > MAX_TEXT) {
    return fail_('invalid_name', 'El nombre es obligatorio (máximo ' + MAX_TEXT + ' caracteres).');
  }
  if (!grupo || grupo.length > MAX_TEXT) {
    return fail_('invalid_group', 'El grupo es obligatorio (máximo ' + MAX_TEXT + ' caracteres).');
  }

  var exam = findExam_(p.examId);
  if (!exam) return fail_('not_found', 'Este examen no existe.');
  if (!exam.activo) return fail_('closed', 'Este examen está cerrado.');
  var codeCheck = checkCode_(exam, p.code);
  if (codeCheck) return fail_(codeCheck, 'El código de acceso no es correcto.');

  var questions = JSON.parse(exam.preguntas_json);
  var answers = p.respuestas;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return fail_('invalid_answers', 'Las respuestas no tienen el formato esperado.');
  }
  var known = {};
  questions.forEach(function (q) { known[q.id] = true; });
  for (var key in answers) {
    if (!Object.prototype.hasOwnProperty.call(answers, key)) continue;
    var v = answers[key];
    if (!known[key] || !(v === null || typeof v === 'string')) {
      return fail_('invalid_answers', 'Las respuestas no corresponden a este examen.');
    }
  }

  var result;
  try {
    result = gradeExam_(questions, answers, { allowNegative: exam.permitir_negativa });
  } catch (err) {
    return fail_('invalid_answers', 'Las respuestas no corresponden a este examen.');
  }

  var dur = Number(p.duracion_min);
  var duracion = isFinite(dur) && dur >= 0 ? Math.round(dur * 100) / 100 : '';

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return fail_('busy', 'El servidor está ocupado. Inténtalo de nuevo en unos segundos.');
  }
  try {
    var sheet = getResultsSheet_(exam.id);
    var rows = sheet.getDataRange().getValues();
    var n = normalize_(nombre);
    var g = normalize_(grupo);
    var duplicado = false;
    for (var i = 1; i < rows.length; i++) {
      if (normalize_(rows[i][1]) === n && normalize_(rows[i][2]) === g) {
        duplicado = true;
        break;
      }
    }
    sheet.appendRow([
      new Date(), nombre, grupo, result.aciertos, result.errores, result.blancos,
      result.nota, duracion, duplicado, JSON.stringify(answers)
    ]);
  } finally {
    lock.releaseLock();
  }

  var out = { ok: true };
  if (exam.mostrar_nota) {
    out.nota = result.nota;
    out.aciertos = result.aciertos;
    out.errores = result.errores;
    out.blancos = result.blancos;
  }
  return out;
}

function createExam_(p) {
  var auth = checkToken_(p.token);
  if (auth) return auth;

  var titulo = cleanText_(p.titulo);
  if (!titulo || titulo.length > 120) {
    return fail_('invalid_exam', 'El título es obligatorio (máximo 120 caracteres).');
  }
  var questions;
  try {
    questions = validateQuestions_(p.preguntas);
  } catch (err) {
    return fail_('invalid_exam', err.message);
  }
  var json = JSON.stringify(questions);
  if (json.length > MAX_CHARS) {
    return fail_('too_large', 'El examen es demasiado grande para una celda de Google Sheets (' +
      json.length + ' caracteres; máximo ' + MAX_CHARS + '). Divídelo en dos exámenes.');
  }

  var tiempo = Math.floor(Number(p.tiempo_min));
  if (!isFinite(tiempo) || tiempo < 0) tiempo = 0;

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return fail_('busy', 'El servidor está ocupado. Inténtalo de nuevo en unos segundos.');
  }
  var id;
  try {
    id = newExamId_();
    getExamsSheet_().appendRow([
      id,
      titulo,
      cleanText_(p.grupo_destino).slice(0, MAX_TEXT),
      true,
      cleanText_(p.codigo_acceso).slice(0, 40),
      tiempo,
      toBool_(p.barajar_preguntas),
      toBool_(p.barajar_opciones),
      toBool_(p.mostrar_nota),
      toBool_(p.permitir_negativa),
      json,
      new Date()
    ]);
    getResultsSheet_(id);
  } finally {
    lock.releaseLock();
  }

  var out = { ok: true, id: id, n_preguntas: questions.length, caracteres: json.length };
  if (json.length > WARN_CHARS) {
    out.warning = 'El examen ocupa ' + json.length + ' de 50 000 caracteres: está cerca del límite de la celda.';
  }
  return out;
}

function setActive_(p) {
  var auth = checkToken_(p.token);
  if (auth) return auth;
  var sheet = getExamsSheet_();
  var rows = sheet.getDataRange().getValues();
  var col = EXAM_HEADERS.indexOf('activo');
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(p.id)) {
      sheet.getRange(i + 1, col + 1).setValue(toBool_(p.activo));
      return { ok: true, id: String(p.id), activo: toBool_(p.activo) };
    }
  }
  return fail_('not_found', 'Este examen no existe.');
}

function listExams_(params) {
  var auth = checkToken_(params.token);
  if (auth) return auth;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var exams = readExams_().map(function (ex) {
    var sh = ss.getSheetByName('R_' + ex.id);
    return {
      id: ex.id,
      titulo: ex.titulo,
      grupo_destino: ex.grupo_destino,
      activo: ex.activo,
      codigo_acceso: ex.codigo_acceso,
      tiempo_min: ex.tiempo_min,
      n_preguntas: JSON.parse(ex.preguntas_json).length,
      envios: sh ? Math.max(0, sh.getLastRow() - 1) : 0,
      creado: ex.creado,
      results_url: sh ? ss.getUrl() + '#gid=' + sh.getSheetId() : ss.getUrl()
    };
  });
  return { ok: true, exams: exams };
}

/* ------------------------------------------------------------------ */
/* Corrección (réplica exacta de js/grading.js)                        */
/* ------------------------------------------------------------------ */

function gradeExam_(questions, answers, opts) {
  var allowNegative = !!(opts && opts.allowNegative);
  if (!questions.length) throw new Error('El examen no tiene preguntas.');

  var aciertos = 0, errores = 0, blancos = 0, penalizacion = 0;

  questions.forEach(function (q) {
    var given = answers ? answers[q.id] : undefined;
    if (given === undefined || given === null || given === '') {
      blancos++;
      return;
    }
    if (!q.options.some(function (o) { return o.id === given; })) {
      throw new Error('Respuesta no válida en ' + q.id + ': ' + given);
    }
    if (given === q.correct) {
      aciertos++;
    } else {
      errores++;
      penalizacion += 1 / (q.options.length - 1);
    }
  });

  var puntos = aciertos - penalizacion;
  var nota = (puntos / questions.length) * 10;
  if (!allowNegative && nota < 0) nota = 0;
  nota = Math.round((nota + Number.EPSILON * Math.sign(nota)) * 100) / 100;
  if (nota === 0) nota = 0; // evita -0

  return { aciertos: aciertos, errores: errores, blancos: blancos, puntos: puntos, nota: nota };
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

function checkToken_(token) {
  var expected = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN');
  if (!expected) {
    return fail_('token_not_configured', 'Falta la propiedad ADMIN_TOKEN en el script.');
  }
  if (typeof token !== 'string' || token !== expected) {
    return fail_('unauthorized', 'Token de administración incorrecto.');
  }
  return null;
}

// Devuelve null si el código es válido, o el motivo del rechazo.
function checkCode_(exam, code) {
  if (exam.codigo_acceso === '') return null;
  var given = String(code === undefined || code === null ? '' : code).trim();
  if (given === '') return 'code_required';
  return given.toLowerCase() === exam.codigo_acceso.toLowerCase() ? null : 'bad_code';
}

function cleanText_(s) {
  return String(s === undefined || s === null ? '' : s).replace(/\s+/g, ' ').trim();
}

function normalize_(s) {
  return String(s === undefined || s === null ? '' : s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toBool_(v) {
  return v === true || String(v).toUpperCase() === 'TRUE';
}

function newExamId_() {
  var existing = {};
  readExams_().forEach(function (e) { existing[e.id] = true; });
  var id;
  do {
    id = Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  } while (existing[id]);
  return id;
}

// Valida y limpia las preguntas recibidas del panel (el servidor no se fía del cliente).
function validateQuestions_(qs) {
  if (!Array.isArray(qs) || qs.length === 0) throw new Error('El examen no tiene preguntas.');
  if (qs.length > MAX_QUESTIONS) throw new Error('Demasiadas preguntas (máximo ' + MAX_QUESTIONS + ').');
  var seen = {};
  return qs.map(function (q, i) {
    var n = i + 1;
    if (!q || typeof q.id !== 'string' || !q.id || seen[q.id]) {
      throw new Error('Pregunta ' + n + ': identificador no válido o repetido.');
    }
    seen[q.id] = true;
    var text = typeof q.text === 'string' ? q.text.trim() : '';
    if (!text) throw new Error('Pregunta ' + n + ': enunciado vacío.');
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > MAX_OPTIONS) {
      throw new Error('Pregunta ' + n + ': debe tener entre 2 y ' + MAX_OPTIONS + ' opciones.');
    }
    var ids = {};
    var options = q.options.map(function (o) {
      if (!o || typeof o.id !== 'string' || !o.id || ids[o.id] ||
          typeof o.text !== 'string' || !o.text.trim()) {
        throw new Error('Pregunta ' + n + ': opciones no válidas.');
      }
      ids[o.id] = true;
      return { id: o.id, text: o.text.trim() };
    });
    if (!ids[q.correct]) throw new Error('Pregunta ' + n + ': la respuesta correcta no es una de las opciones.');
    return {
      id: q.id,
      title: typeof q.title === 'string' ? q.title.trim() : '',
      text: text,
      options: options,
      correct: q.correct
    };
  });
}

/* ------------------------------------------------------------------ */
/* Acceso a las hojas                                                  */
/* ------------------------------------------------------------------ */

// Columnas que deben ser texto plano (evita que "1-2" se convierta en fecha, etc.)
function setTextColumns_(sheet, cols) {
  cols.forEach(function (c) {
    sheet.getRange(1, c, sheet.getMaxRows(), 1).setNumberFormat('@');
  });
}

function getExamsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_EXAMS);
  if (!sh) {
    sh = ss.insertSheet(SHEET_EXAMS);
    sh.appendRow(EXAM_HEADERS);
    sh.setFrozenRows(1);
    setTextColumns_(sh, [1, 3, 5]);
  }
  return sh;
}

function getResultsSheet_(examId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = 'R_' + examId;
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(RESULT_HEADERS);
    sh.setFrozenRows(1);
    setTextColumns_(sh, [2, 3]);
  }
  return sh;
}

function readExams_() {
  var rows = getExamsSheet_().getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (r[0] === '' || r[0] === undefined) continue;
    out.push({
      id: String(r[0]),
      titulo: String(r[1]),
      grupo_destino: String(r[2]),
      activo: toBool_(r[3]),
      codigo_acceso: String(r[4]).trim(),
      tiempo_min: Number(r[5]) || 0,
      barajar_preguntas: toBool_(r[6]),
      barajar_opciones: toBool_(r[7]),
      mostrar_nota: toBool_(r[8]),
      permitir_negativa: toBool_(r[9]),
      preguntas_json: String(r[10]),
      creado: r[11]
    });
  }
  return out;
}

function findExam_(id) {
  if (id === undefined || id === null || id === '') return null;
  var all = readExams_();
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === String(id)) return all[i];
  }
  return null;
}

/**
 * Opcional: ejecútala una vez a mano desde el editor para crear la hoja
 * "Examenes" y comprobar que los permisos están concedidos.
 */
function setup() {
  getExamsSheet_();
}
