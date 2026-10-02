// Entorno simulado de Google Apps Script: carga apps-script/Code.gs en un sandbox
// con una hoja de cálculo en memoria. Lo usan los tests y las pruebas de navegador.
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Imita la conversión automática de Sheets: "545297e4" -> 5452970000, "1-2" -> fecha.
const coerce = (v) => {
  if (typeof v !== "string") return v;
  if (/^\d+(\.\d+)?(e\d+)?$/i.test(v)) return Number(v);
  if (/^\d{1,2}[-/]\d{1,2}$/.test(v)) return new Date(2000, 0, 1);
  return v;
};

class FakeSheet {
  constructor(name, id) { this.name = name; this.id = id; this.rows = []; this.textCells = new Set(); }
  appendRow(r) { this.rows.push(r.map(coerce)); }
  getDataRange() { return { getValues: () => this.rows.map((r) => [...r]) }; }
  getRange(row, col, nRows = 1, nCols = 1) {
    return {
      setValue: (v) => { this.rows[row - 1][col - 1] = this.textCells.has(`${row},${col}`) ? v : coerce(v); },
      setValues: (vals) => {
        vals.forEach((r, i) => {
          this.rows[row - 1 + i] = this.rows[row - 1 + i] || [];
          r.forEach((v, j) => {
            const text = this.textCells.has(`${row + i},${col + j}`);
            this.rows[row - 1 + i][col - 1 + j] = text ? v : coerce(v);
          });
        });
      },
      setNumberFormat: (fmt) => {
        for (let i = 0; i < nRows; i++) for (let j = 0; j < nCols; j++) {
          if (fmt === "@") this.textCells.add(`${row + i},${col + j}`);
        }
      },
    };
  }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows.reduce((m, r) => Math.max(m, r.length), 0); }
  getMaxRows() { return 1000; }
  getSheetId() { return this.id; }
  setFrozenRows() {}
}

export function makeEnv(token = "secreto", { uuid: uuidFn } = {}) {
  const sheets = new Map();
  let n = 0;
  const ss = {
    getSheetByName: (name) => sheets.get(name) ?? null,
    insertSheet: (name) => { const s = new FakeSheet(name, ++n); sheets.set(name, s); return s; },
    getUrl: () => "https://docs.google.com/spreadsheets/d/X/edit",
  };
  const props = token ? { ADMIN_TOKEN: token } : {};
  let uuid = 0;
  const ctx = vm.createContext({
    console,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { getUuid: uuidFn ?? (() => `${String(++uuid).padStart(8, "0")}-aaaa-bbbb-cccc-dddddddddddd`) },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (s) => ({ s, setMimeType() { return this; } }),
    },
  });
  vm.runInContext(readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8"), ctx);
  const run = (code) => vm.runInContext(code, ctx);
  return {
    sheets,
    get: (params) => run(`handleGet_`)(params),
    post: (body) => run(`handlePost_`)(body),
    fn: (name) => run(name),
  };
}

