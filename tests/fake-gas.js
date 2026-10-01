// Entorno simulado de Google Apps Script: carga apps-script/Code.gs en un sandbox
// con una hoja de cálculo en memoria. Lo usan los tests y las pruebas de navegador.
import { readFileSync } from "node:fs";
import vm from "node:vm";

class FakeSheet {
  constructor(name, id) { this.name = name; this.id = id; this.rows = []; }
  appendRow(r) { this.rows.push([...r]); }
  getDataRange() { return { getValues: () => this.rows.map((r) => [...r]) }; }
  getRange(row, col) {
    return {
      setValue: (v) => { this.rows[row - 1][col - 1] = v; },
      setNumberFormat: () => {},
    };
  }
  getLastRow() { return this.rows.length; }
  getMaxRows() { return 1000; }
  getSheetId() { return this.id; }
  setFrozenRows() {}
}

export function makeEnv(token = "secreto") {
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
    Utilities: { getUuid: () => `0000000${++uuid}-aaaa-bbbb-cccc-dddddddddddd` },
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

