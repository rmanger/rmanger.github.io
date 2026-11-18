(function(){var module={exports:{}};var exports=module.exports;
// Maps the names a lab prints to the column headings used in the workbook.
// Extend `ALIASES` if a different lab words a test differently (keys are lower-case, letters/digits only).
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

const ALIASES = {
  tsh: 'TFT (TSH)', thyroidstimulatinghormone: 'TFT (TSH)',
  crp: 'C Reactive Protein (hsCRP)', hscrp: 'C Reactive Protein (hsCRP)', creactiveprotein: 'C Reactive Protein (hsCRP)',
  pth: 'Parathyroid Hormone (PTH)', parathyroidhormone: 'Parathyroid Hormone (PTH)',
  b12: 'Vitamin B12', serumb12: 'Vitamin B12',
  activeb12: 'Active B12', holotranscobalamin: 'Active B12',
  serumfolate: 'Folate',
  psa: 'Prostate Specific AG', prostatespecificantigen: 'Prostate Specific AG',
  vitd: 'Vitamin D', '25hydroxyvitamind': 'Vitamin D', '25ohvitamind': 'Vitamin D',
  totalchol: 'Total', totalcholesterol: 'Total', cholesterol: 'Total',
  hdlchol: 'HDL', hdlcholesterol: 'HDL',
  ldlchol: 'LDL', ldlcholesterol: 'LDL',
  nonhdlchol: 'Non-HDL', nonhdlcholesterol: 'Non-HDL',
  triglycerides: 'Triglyceride', trigs: 'Triglyceride',
  hgb: 'Haemoglobin', hemoglobin: 'Haemoglobin',
  rbc: 'RBC', redcellcount: 'RBC', hct: 'HCT', haematocrit: 'HCT', pcv: 'HCT',
  wcc: 'WCC', wbc: 'WCC', neutrophil: 'Neutrophils',
  platelets: 'PLATELETS', plt: 'PLATELETS',
  totalprotein: 'T.Protein',
  adjca: 'Cor.Calcium', adjustedcalcium: 'Cor.Calcium', correctedcalcium: 'Cor.Calcium', corca: 'Cor.Calcium',
  uricacid: 'Urate',
  transferrinsaturation: 'Saturation', transferrinsat: 'Saturation', ironsaturation: 'Saturation',
  egfr: 'eGFR',
};

// HbA1c appears twice in the workbook (mmol/mol and %), so the unit decides.
function resolveHeader(label, unit, headers) {
  const key = norm(label);
  if (key === 'hba1c' || key === 'glycatedhaemoglobin') {
    return /%/.test(unit || '') ? 'HbA1c (%)' : 'HbA1c (mmol/mol)';
  }
  const byNorm = new Map(headers.map((h) => [norm(h), h]));
  if (byNorm.has(key)) return byNorm.get(key);
  const alias = ALIASES[key];
  return alias && headers.includes(alias) ? alias : null;
}

module.exports = { resolveHeader, norm };

window.__lib=Object.assign(window.__lib||{},module.exports);})();
(function(){var module={exports:{}};var exports=module.exports;
// Parses an Australian-style pathology PDF (e.g. ACL) into dated results.
// Supports two layouts seen in these reports:
//   1. Matrix:   "Date: 10/11/26 08/09/26 18/06/25" then "NAME v1 v2 v3 (range) unit"
//      Values are right-aligned under their date, so each value is assigned to the nearest date column by x-position
//      (a marker with fewer results than dates is therefore placed correctly).
//   2. One row per date: "Date Time Lab No. <analyte>" then "10/11/26 10:40 47599038 97 (50 - 200) nmol/L".
const DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/;
const VALUE_RE = /^([<>])?(\d+(?:\.\d+)?)$/;

function toISO(t) {
  const m = t.match(DATE_RE);
  if (!m) return null;
  let [, d, mo, y] = m; d = +d; mo = +mo; y = +y;
  if (y < 100) y += 2000;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

async function extractLines(buf) {
  const pdfjs = await (globalThis.__loadPdfjs ? globalThis.__loadPdfjs() : import('pdfjs-dist/legacy/build/pdf.mjs'));
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false, verbosity: 0 }).promise;
  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    const words = [];
    for (const it of content.items) {
      if (!it.str || !it.str.trim()) continue;
      const len = it.str.length, x = it.transform[4], y = it.transform[5];
      for (const m of it.str.matchAll(/\S+/g)) {
        words.push({ t: m[0], x0: x + (it.width * m.index) / len, x1: x + (it.width * (m.index + m[0].length)) / len, y });
      }
    }
    words.sort((a, b) => b.y - a.y || a.x0 - b.x0);
    let cur = null;
    for (const w of words) {
      if (!cur || Math.abs(cur.y - w.y) > 2.5) { cur = { page: p, y: w.y, tokens: [] }; lines.push(cur); }
      cur.tokens.push(w);
    }
  }
  for (const l of lines) { l.tokens.sort((a, b) => a.x0 - b.x0); l.text = l.tokens.map((t) => t.t).join(' '); }
  return lines;
}

const isEnd = (text) =>
  /^#?\d{6,}\b/.test(text) || /^[A-Z]\d{2}-[A-Z]\b/.test(text) || /^This request has/.test(text) || /^All tests on this request/.test(text) || /^RANGES\b/.test(text);

function parseMatrixRow(tokens, cols, ctx) {
  let i = 0;
  const label = [];
  while (i < tokens.length && !(/^\*+$/.test(tokens[i].t) || /^[<>]/.test(tokens[i].t) || VALUE_RE.test(tokens[i].t))) label.push(tokens[i++].t);
  if (!label.length || !/^[A-Za-z]/.test(label[0]) || label.length > 5) return;
  const vals = [];
  let q = null;
  for (; i < tokens.length; i++) {
    const t = tokens[i].t;
    if (/^\*+$/.test(t)) continue;                     // lab flag (* ** ***) – ignored
    if (t === '<' || t === '>') { q = t; continue; }
    const m = t.match(VALUE_RE);
    if (!m) break;
    vals.push({ v: parseFloat(m[2]), q: m[1] || q, x1: tokens[i].x1 });
    q = null;
  }
  if (!vals.length) return;
  const rest = tokens.slice(i).map((t) => t.t).join(' ');
  const unit = (rest.includes(')') ? rest.slice(rest.lastIndexOf(')') + 1) : rest).trim();
  const used = new Set();
  for (const v of vals) {
    let best = null;
    for (const c of cols) if (!best || Math.abs(c.x1 - v.x1) < Math.abs(best.x1 - v.x1)) best = c;
    if (!best || Math.abs(best.x1 - v.x1) > 30) { ctx.warnings.push(`Could not place ${label.join(' ')} value ${v.v} under a date`); continue; }
    if (used.has(best.date)) { ctx.warnings.push(`${label.join(' ')} has two values for ${best.date}; kept the later one`); }
    used.add(best.date);
    ctx.results.push({ date: best.date, label: label.join(' '), value: v.v, q: v.q, unit, test: ctx.testName });
  }
}

function parseRowDate(tokens, ctx) {
  const date = toISO(tokens[0].t);
  if (!date) return;
  const text = tokens.slice(1).map((t) => t.t).join(' ').replace(/\([^)]*\)/g, ' ');
  const toks = text.split(/\s+/).filter(Boolean);
  let q = null, found = null, unit = '';
  for (let i = 0; i < toks.length; i++) {
    if (toks[i] === '<' || toks[i] === '>') { q = toks[i]; continue; }
    const m = toks[i].match(VALUE_RE);
    if (m && !/^\d{6,}$/.test(toks[i])) { found = { v: parseFloat(m[2]), q: m[1] || q }; unit = toks.slice(i + 1).join(' '); q = null; } else if (!m) q = null;
  }
  if (!found) return;
  ctx.results.push({ date, label: ctx.testName, value: found.v, q: found.q, unit, test: ctx.testName, singleAnalyte: true });
}

async function parseLabReport(buf) {
  const lines = await extractLines(buf);
  const ctx = { results: [], warnings: [], testName: '' };
  const tests = [];
  let mode = null, cols = [];
  const reportFor = lines[0] ? lines[0].text : '';
  for (const line of lines) {
    const { text, tokens } = line;
    if (/^Name of Test:/.test(text)) { ctx.testName = text.replace(/^Name of Test:\s*/, '').trim(); tests.push(ctx.testName); mode = null; continue; }
    if (tokens[0] && tokens[0].t === 'Date:') {
      cols = tokens.filter((t) => DATE_RE.test(t.t)).map((t) => ({ date: toISO(t.t), x1: t.x1 })).filter((c) => c.date);
      mode = cols.length ? 'matrixHeader' : null; continue;
    }
    if (mode === 'matrixHeader' && /^-{5,}$/.test(text)) { mode = 'matrix'; continue; }
    if (tokens[0] && tokens[0].t === 'Date' && tokens[1] && tokens[1].t === 'Time') { mode = 'rowdate'; continue; }
    if (mode && isEnd(text)) { mode = null; continue; }
    if (mode === 'matrix') parseMatrixRow(tokens, cols, ctx);
    else if (mode === 'rowdate' && DATE_RE.test(tokens[0].t)) parseRowDate(tokens, ctx);
  }
  return { reportFor, tests, results: ctx.results, warnings: ctx.warnings };
}

module.exports = { parseLabReport, toISO };

window.__lib=Object.assign(window.__lib||{},module.exports);})();