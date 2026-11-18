/* global d3 */
const state = { data: null, total: 0, cats: new Set(), view: 'combined', range: 'all', onlyFlagged: false, onlyCurrent: false, q: '', hidden: new Set() };
const fmtDate = d3.timeFormat('%d %b %Y');
const $ = (s) => document.querySelector(s);
const tip = $('#tip');
const TOUCH = matchMedia('(hover: none)').matches;
const SMALL = () => innerWidth < 640;

// ---------- range logic ----------
const effRange = (m) => ({ low: m.low, high: m.high });
// Two limits: inside is good. Only a low limit: at/below it is good, above is red.
// Only a high limit: at/above it is good, below is red.
function flagOf(p, r) {
  const { low: L, high: H } = r;
  if (L != null && H != null) {
    if (p.q === '<') return p.v <= L ? 'low' : null;
    if (p.q === '>') return p.v >= H ? 'high' : null;
    return p.v < L ? 'low' : p.v > H ? 'high' : null;
  }
  if (L != null) {
    if (p.q === '<') return null;
    return p.q === '>' ? (p.v >= L ? 'high' : null) : (p.v > L ? 'high' : null);
  }
  if (H != null) {
    if (p.q === '>') return null;
    return p.q === '<' ? (p.v <= H ? 'low' : null) : (p.v < H ? 'low' : null);
  }
  return null;
}
function rangeText(r) {
  if (r.low != null && r.high != null) return `Low ${r.low} – High ${r.high}`;
  if (r.high != null) return `High ${r.high} only (below is red)`;
  if (r.low != null) return `Low ${r.low} only (above is red)`;
  return 'No reference range';
}
// Normalised position: 0 = low limit, 1 = high limit. High-only: 0 = zero. Low-only: 1 = double the limit.
function norm(v, r) {
  if (r.low != null && r.high != null) return (v - r.low) / (r.high - r.low);
  if (r.high != null) return v / r.high;
  if (r.low != null) return (v - r.low) / r.low;
  return null;
}
const hasRange = (r) => r.low != null || r.high != null;
const color = (i) => `hsl(${40 + ((i * 137.508) % 250)} 62% 48%)`; // avoids reds, which mean out-of-range

// Date range filter: 'all', or the last 12 / 6 months counted back from today.
function cutoffMs() {
  if (state.range === 'all') return -Infinity;
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setMonth(d.getMonth() - Number(state.range));
  return d.getTime();
}

function prepare(m, i) {
  const r = effRange(m);
  const cut = cutoffMs();
  const pts = m.points.filter((p) => p.t >= cut).map((p) => ({ ...p, flag: flagOf(p, r), n: norm(p.v, r) }));
  const flagged = pts.filter((p) => p.flag).length;
  const latest = pts.reduce((a, p) => (!a || p.t > a.t ? p : a), null);
  return { m, r, pts, color: color(i), flagged, current: !!(latest && latest.flag) };
}

// ---------- tooltip ----------
function showTip(html, ev) {
  tip.innerHTML = html; tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let x = ev.clientX + 16, y = ev.clientY + 14;
  if (x + w > innerWidth - 8) x = ev.clientX - w - 16;
  if (y + h > innerHeight - 8) y = ev.clientY - h - 14;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}
const hideTip = () => { tip.hidden = true; };

// ---------- chart ----------
// items: prepared markers. mode 'norm' = combined chart; 'raw' = one marker in real units.
function drawChart(el, items, mode, onHover) {
  el.innerHTML = '';
  const W = Math.max(260, el.clientWidth), H = mode === 'norm' ? (SMALL() ? 340 : 430) : 210;
  const M = { t: 10, r: SMALL() ? 56 : 62, b: 26, l: mode === 'norm' ? (SMALL() ? 14 : 44) : 40 };
  const iw = W - M.l - M.r, ih = H - M.t - M.b;
  const yOf = (p) => (mode === 'norm' ? p.n : p.v);
  const limitY = (it) => {
    const lo = it.r.low, hi = it.r.high;
    return mode === 'norm' ? { lo: lo != null ? 0 : null, hi: hi != null ? 1 : null } : { lo, hi };
  };

  let t0, t1, pad;
  if (state.range === 'all') {
    [t0, t1] = d3.extent(state.data.categories.flatMap((c) => c.markers.flatMap((m) => m.points.map((p) => p.t))));
    pad = (t1 - t0) * 0.03 || 864e5;
  } else { // fixed window ending today (or the latest result if that is later)
    t0 = cutoffMs();
    t1 = Math.max(Date.now(), ...state.data.categories.flatMap((c) => c.markers.flatMap((m) => m.points.map((p) => p.t))));
    pad = (t1 - t0) * 0.03;
  }
  const x = d3.scaleTime([t0 - pad, t1 + pad], [0, iw]);

  let vals = items.flatMap((it) => it.pts.map(yOf)).filter((v) => v != null);
  if (mode === 'norm') vals.push(0, 1);
  else items.forEach((it) => { const l = limitY(it); if (l.lo != null) vals.push(l.lo); if (l.hi != null) vals.push(l.hi); });
  let [y0, y1] = d3.extent(vals); const yp = (y1 - y0) * 0.1 || 1;
  y0 -= yp; y1 += yp;
  if (mode === 'raw' && items[0].r.high != null && items[0].r.low == null && y0 > 0 && items[0].pts.every((p) => p.v >= 0)) y0 = Math.max(0, y0);
  const y = d3.scaleLinear([y0, y1], [ih, 0]);

  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
  const g = svg.append('g').attr('transform', `translate(${M.l},${M.t})`);

  const zonesG = g.append('g'); // good/bad zones, only drawn for the hovered marker

  const xa = d3.axisBottom(x).ticks(Math.max(2, Math.floor(iw / 90))).tickSizeOuter(0);
  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`).call(xa);
  const ya = d3.axisLeft(y).tickSizeOuter(0);
  if (mode === 'norm') ya.tickValues([]);
  else ya.ticks(5);
  g.append('g').attr('class', 'axis').call(ya);

  const line = d3.line().defined((p) => yOf(p) != null).x((p) => x(p.t)).y((p) => y(yOf(p)));
  const limitsG = g.append('g'); // limit lines, filled on hover
  const sg = g.append('g');
  const series = sg.selectAll('g.series').data(items).join('g').attr('class', 'series').attr('data-id', (d) => d.m.id);
  series.append('path').attr('class', 'line').attr('stroke', (d) => d.color).attr('d', (d) => line(d.pts));
  series.append('path').attr('class', 'hit').attr('d', (d) => line(d.pts));
  series.selectAll('circle').data((d) => d.pts.map((p) => ({ p, d }))).join('circle')
    .attr('cx', (o) => x(o.p.t)).attr('cy', (o) => y(yOf(o.p))).attr('r', 3.6)
    .attr('fill', (o) => o.d.color).classed('bad', (o) => !!o.p.flag);

  // Invisible touch targets on every point, so single-reading markers can be selected too.
  series.selectAll('circle.hit').data((d) => d.pts.map((p) => ({ p, d }))).join('circle')
    .attr('class', 'hit dot').attr('cx', (o) => x(o.p.t)).attr('cy', (o) => y(yOf(o.p))).attr('r', 16);

  function activate(id) {
    svg.classed('hovering', !!id);
    series.classed('active', (d) => d.m.id === id);
    limitsG.selectAll('*').remove();
    zonesG.selectAll('*').remove();
    if (!id) return;
    const it = items.find((d) => d.m.id === id); if (!it) return;
    const { lo, hi } = limitY(it);
    const real = { lo: it.r.low, hi: it.r.high };
    const zone = (y0p, y1p, cls) => { if (y1p > y0p) zonesG.append('rect').attr('x', 0).attr('width', iw).attr('y', y0p).attr('height', y1p - y0p).attr('fill', cls === 'ok' ? 'var(--ok)' : 'var(--badbg)'); };
    if (lo != null && hi != null) { zone(0, y(hi), 'bad'); zone(y(hi), y(lo), 'ok'); zone(y(lo), ih, 'bad'); }
    else if (lo != null) { zone(0, y(lo), 'bad'); zone(y(lo), ih, 'ok'); }   // low only: above is bad
    else if (hi != null) { zone(0, y(hi), 'ok'); zone(y(hi), ih, 'bad'); }   // high only: below is bad
    const draw = (yy, label) => {
      const l = limitsG.append('g').attr('class', 'limit');
      l.append('line').attr('x1', 0).attr('x2', iw).attr('y1', y(yy)).attr('y2', y(yy));
      l.append('text').attr('x', iw + 6).attr('y', y(yy)).attr('dy', '0.32em').text(label);
    };
    if (hi != null) draw(hi, `High ${real.hi}`);
    if (lo != null) draw(lo, `Low ${real.lo}`);
  }
  el.__activate = activate;

  // Pointer events cover mouse and touch. On touch a tap selects a line and it stays selected
  // until you tap empty chart space.
  svg.on('pointerdown', (ev) => { if (!ev.target.classList.contains('hit')) { activate(null); onHover && onHover(null); hideTip(); } });
  series.selectAll('.hit')
    .on('pointerenter', (ev, o) => { const d = o.m ? o : o.d; activate(d.m.id); onHover && onHover(d.m.id); })
    .on('pointermove pointerdown', (ev, o) => {
      const d = o.m ? o : o.d;
      const [mx] = d3.pointer(ev, g.node());
      const near = d3.least(d.pts, (p) => Math.abs(x(p.t) - mx));
      const status = near.flag === 'high' ? '<span class="bad">▲ above range</span>' : near.flag === 'low' ? '<span class="bad">▼ below range</span>' : hasRange(d.r) ? 'In range' : '';
      // Advice follows the result being pointed at; if that one is fine but the latest is out, use the latest.
      const latest = d.pts.reduce((m, p) => (!m || p.t > m.t ? p : m), null);
      const adv = near.flag ? near : latest && latest.flag ? latest : null;
      const advHtml = adv ? (() => {
        const [why, fix] = ADVICE(d.m.name, adv.flag);
        const lead = adv === near ? '' : `<div class="bad">Latest result (${fmtDate(new Date(adv.t))}) is ${adv.flag === 'high' ? 'above' : 'below'} range</div>`;
        return `<div class="advice">${lead}<p><b>Why this may be</b><br>${why}</p><p><b>What can help</b><br>${fix}</p><small>General information, not a diagnosis. Discuss with your doctor.</small></div>`;
      })() : '';
      tip.classList.toggle('wide', !!adv);
      showTip(`<b>${d.m.name}</b>
        <div class="row"><span>Range</span><span>${rangeText(d.r)}</span></div>
        <div class="row"><span>${fmtDate(new Date(near.t))}</span><span><b>${near.raw}</b></span></div>
        <div>${status}</div>${advHtml}`, ev);
    })
    .on('pointerleave', (ev) => { if (ev.pointerType === 'touch') return; activate(null); onHover && onHover(null); hideTip(); });
}

// ---------- page ----------
function visibleCategories() {
  const q = state.q.trim().toLowerCase();
  return state.data.categories
    .filter((c) => !state.cats.size || state.cats.has(c.name))
    .map((c) => {
      const items = c.markers.map((m, i) => prepare(m, i))
        .filter((it) => it.pts.length)
        .filter((it) => !q || it.m.name.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
        .filter((it) => !state.onlyFlagged || it.flagged > 0)
        .filter((it) => !state.onlyCurrent || it.current);
      return { name: c.name, items };
    })
    .filter((c) => c.items.length);
}

function render() {
  const main = $('#main');
  main.innerHTML = '';
  const cats = visibleCategories();
  if (!state.total) { main.appendChild(emptyState()); return; }
  if (!cats.length) { main.innerHTML = '<p class="empty">No markers match the current filters.</p>'; return; }
  for (const c of cats) {
    const sec = document.createElement('section');
    sec.className = 'cat';
    const redTotal = c.items.reduce((a, it) => a + it.flagged, 0);
    sec.innerHTML = `<h2>${c.name} <span class="muted" style="font-weight:400;font-size:13px">${c.items.length} markers${redTotal ? ` · <span style="color:var(--bad)">${redTotal} out-of-range results</span>` : ''}</span></h2>`;
    main.appendChild(sec);
    if (state.view === 'combined') renderCombined(sec, c);
    else renderIndividual(sec, c);
  }
}

function renderCombined(sec, c) {
  const ranged = c.items.filter((it) => hasRange(it.r));
  const unranged = c.items.filter((it) => !hasRange(it.r));
  const panel = document.createElement('div'); panel.className = 'panel';
  const chartEl = document.createElement('div');
  const legend = document.createElement('div'); legend.className = 'legend';
  panel.append(chartEl, legend); sec.appendChild(panel);

  const shown = () => ranged.filter((it) => !state.hidden.has(it.m.id));
  const paint = () => drawChart(chartEl, shown(), 'norm');
  if (ranged.length) paint(); else chartEl.innerHTML = '<p class="empty">None of these markers has a reference range. See Individual view.</p>';

  for (const it of ranged) {
    const b = document.createElement('button');
    b.className = 'lg' + (state.hidden.has(it.m.id) ? ' off' : '') + (it.flagged ? ' red' : '');
    b.innerHTML = `<i style="background:${it.color}"></i>${it.m.name}`;
    b.title = `${rangeText(it.r)}${it.flagged ? ` · ${it.flagged} red` : ''}`;
    b.onclick = () => {
      if (TOUCH) { const on = chartEl.__sel !== it.m.id; chartEl.__sel = on ? it.m.id : null; chartEl.__activate && chartEl.__activate(chartEl.__sel); return; }
      state.hidden.has(it.m.id) ? state.hidden.delete(it.m.id) : state.hidden.add(it.m.id); render();
    };
    b.onmouseenter = () => !state.hidden.has(it.m.id) && chartEl.__activate && chartEl.__activate(it.m.id);
    b.onmouseleave = () => chartEl.__activate && chartEl.__activate(null);
    legend.appendChild(b);
  }
  const n = document.createElement('p'); n.className = 'note';
  n.innerHTML = 'Each line is scaled to its own reference range. Hover (or tap) a line or legend chip to see that marker\'s limits and its good (green) and out-of-range (red) zones. Red dots are out-of-range results; ' + (TOUCH ? '' : 'click a legend chip to hide a line.')
    + (unranged.length ? ` <br>No reference range, shown in Individual view: ${unranged.map((u) => u.m.name).join(', ')}.` : '');
  sec.appendChild(n);
  if (ranged.length) { const ro = new ResizeObserver(() => { if (chartEl.isConnected) paint(); }); ro.observe(panel); chartEl.__ro = ro; }
}

function renderIndividual(sec, c) {
  const grid = document.createElement('div'); grid.className = 'grid';
  sec.appendChild(grid);
  const cards = c.items.map((it) => {
    const card = document.createElement('div'); card.className = 'card'; card.dataset.id = it.m.id;
    card.innerHTML = `<h3><span>${it.m.name}</span><span>${it.flagged ? `<span class="badge red">${it.flagged} red</span>` : ''}</span></h3><div class="range">${rangeText(it.r)}</div><div class="plot"></div>`;
    grid.appendChild(card);
    return { it, card, plot: card.querySelector('.plot') };
  });
  const dimOthers = (id) => cards.forEach((o) => { o.card.classList.toggle('dim', !!id && o.it.m.id !== id); o.card.classList.toggle('hov', o.it.m.id === id); });
  const paint = () => cards.forEach((o) => drawChart(o.plot, [o.it], 'raw', dimOthers));
  paint();
  const ro = new ResizeObserver(() => { if (grid.isConnected) paint(); }); ro.observe(grid);
}

function renderChips() {
  const box = $('#catChips'); box.innerHTML = '';
  const mk = (label, on, fn, count) => {
    const b = document.createElement('button'); b.className = 'chip' + (on ? ' on' : '');
    b.innerHTML = label + (count != null ? `<small>${count}</small>` : ''); b.onclick = fn; box.appendChild(b);
  };
  mk('All', !state.cats.size, () => { state.cats.clear(); renderChips(); render(); });
  for (const c of state.data.categories) {
    mk(c.name, state.cats.has(c.name), () => { state.cats.has(c.name) ? state.cats.delete(c.name) : state.cats.add(c.name); renderChips(); render(); }, c.markers.filter((m) => m.points.length).length);
  }
}

// ---------- storage (on this device only) ----------
// Uses the native Preferences plugin inside the Android/iOS app, and localStorage in a normal browser.
const STORE_KEY = 'bloodTests.results.v1';
const store = {
  native() { const c = window.Capacitor; return c && c.isNativePlatform && c.isNativePlatform() && c.Plugins && c.Plugins.Preferences; },
  async get(key) {
    const P = this.native();
    if (P) { try { return (await P.get({ key })).value; } catch { /* fall through */ } }
    try { return localStorage.getItem(key); } catch { return null; }
  },
  async set(key, value) {
    const P = this.native();
    if (P) { try { await P.set({ key, value }); return true; } catch { /* fall through */ } }
    try { localStorage.setItem(key, value); return true; } catch { return false; }
  },
};

const dayOf = (t) => Math.floor(t / 864e5);
const dateMs = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const isoOfT = (t) => new Date(t).toISOString().slice(0, 10);
const allMarkers = () => state.data.categories.flatMap((c) => c.markers);

function setPoint(m, iso, v) {
  const t = dateMs(iso), p = m.points.find((x) => dayOf(x.t) === dayOf(t));
  if (p) { p.v = v; p.q = null; p.raw = String(v); } else { m.points.push({ t, v, q: null, raw: String(v) }); m.points.sort((a, b) => a.t - b.t); }
}

async function persist() {
  const points = {};
  for (const m of allMarkers()) if (m.points.length) points[m.name] = m.points.map((p) => [p.t, p.v]);
  return store.set(STORE_KEY, JSON.stringify({ v: 1, points }));
}

async function loadData() {
  const data = JSON.parse(JSON.stringify(window.__CATALOG__));
  let saved = null;
  try { saved = JSON.parse((await store.get(STORE_KEY)) || 'null'); } catch { saved = null; }
  for (const c of data.categories) for (const m of c.markers) {
    m.points = ((saved && saved.points && saved.points[m.name]) || []).map(([t, v]) => ({ t, v, q: null, raw: String(v) })).sort((a, b) => a.t - b.t);
  }
  state.data = data;
  refreshUI();
}

function refreshUI() {
  state.total = state.data.categories.reduce((a, c) => a + c.markers.reduce((b, m) => b + m.points.length, 0), 0);
  const n = datasetDates().length;
  $('#sub').textContent = state.total ? `${state.total} results · ${n} date${n === 1 ? '' : 's'} · stored on this device` : 'No results yet';
  $('#removeBtn').hidden = !state.total;
  renderChips(); render();
}

// ---------- first-run / empty state ----------
function emptyState() {
  const d = document.createElement('div');
  d.className = 'panel firstrun';
  d.innerHTML = `<h2>Welcome</h2>
    <p>This app starts with no data. Add your first lab report to see your results charted against their reference ranges.</p>
    <ol><li>Tap <b>Import PDF…</b> and choose a pathology report saved on this device.</li>
      <li>Review the preview, then confirm.</li>
      <li>Import further reports any time; results are matched by date.</li></ol>
    <p class="muted">Your results stay on this device. Nothing is uploaded.</p>`;
  return d;
}

// ---------- PDF import ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtISO = (iso) => fmtDate(new Date(iso + 'T00:00:00'));
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 7000); }

function importBody(r) {
  const cards = r.dates.map((d) => {
    const n = (k) => d.cells.filter((c) => c.kind === k).length;
    const rows = d.cells.filter((c) => c.kind !== 'same').map((c) =>
      `<tr><td>${esc(c.marker)}</td><td>${c.kind === 'changed' ? `<span class="old">${esc(c.old)}</span> → ` : ''}<span class="new">${esc(c.value)}</span>${c.kind === 'new' ? ' <span class="muted">(new)</span>' : ''}</td></tr>`).join('');
    return `<div class="dcard"><h3>${fmtISO(d.date)} <span class="tag ${d.status === 'add' ? 'add' : 'upd'}">${d.status === 'add' ? 'New date' : 'Existing date updated'}</span></h3>
      <div class="muted">${d.cells.length} result${d.cells.length === 1 ? '' : 's'} · ${n('new')} new · ${n('changed')} changed · ${n('same')} already matched</div>
      ${rows ? `<table class="chg">${rows}</table>` : ''}</div>`;
  }).join('');
  const notes = [];
  if (r.qualified.length) notes.push(`Results reported as “less than” (${r.qualified.map((q) => `${esc(q.marker)} ${esc(q.shown)}`).filter((v, i, a) => a.indexOf(v) === i).join(', ')}) are stored as the number shown.`);
  if (r.unmapped.length) notes.push(`Not tracked in this app, skipped: ${r.unmapped.map(esc).join(', ')}.`);
  notes.push(...r.warnings.map(esc));
  return `<div class="muted" style="margin-top:8px">Report for <b>${esc(r.reportFor)}</b> · ${r.tests.map(esc).join(', ')}</div>${cards}${notes.length ? `<div class="warnbox">${notes.join('<br>')}</div>` : ''}`;
}

async function planLocal(file) {
  if (!window.__lib || !window.__lib.parseLabReport) throw new Error('PDF import is not available.');
  const rep = await window.__lib.parseLabReport(await file.arrayBuffer());
  if (!rep.results.length) throw new Error('No dated results were found in this PDF. Is it a pathology report?');
  const markers = allMarkers(), headers = markers.map((m) => m.name), byName = new Map(markers.map((m) => [m.name, m]));
  const updates = {}, unmapped = new Set(), qualified = [];
  for (const r of rep.results) {
    const h = window.__lib.resolveHeader(r.label, r.unit, headers);
    if (!h) { unmapped.add(r.label); continue; }
    (updates[r.date] ||= {})[h] = r.value;
    if (r.q) qualified.push({ date: r.date, marker: h, shown: `${r.q}${r.value}` });
  }
  if (!Object.keys(updates).length) throw new Error('None of the results in this PDF match a marker tracked by this app.');
  const dates = Object.keys(updates).sort().map((iso) => {
    const known = markers.some((m) => m.points.some((p) => dayOf(p.t) === dayOf(dateMs(iso))));
    const cells = Object.entries(updates[iso]).map(([marker, value]) => {
      const p = byName.get(marker).points.find((x) => dayOf(x.t) === dayOf(dateMs(iso)));
      const old = p ? p.v : null;
      return { marker, old, value, kind: old === null ? 'new' : Math.abs(old - value) < 1e-9 ? 'same' : 'changed' };
    });
    return { date: iso, status: known ? 'update' : 'add', cells };
  });
  return { reportFor: rep.reportFor, tests: rep.tests, dates, unmapped: [...unmapped], qualified, warnings: rep.warnings };
}

async function runImport(file) {
  const dlg = $('#importDlg');
  const shell = (inner, footer) => { dlg.innerHTML = `<div class="dlg"><header><h2>Import results from PDF</h2><div class="muted">${esc(file.name)}</div></header><div class="body">${inner}</div><footer>${footer}</footer></div>`; };
  shell('<p class="muted">Reading PDF…</p>', '<button class="btn" id="dlgClose">Cancel</button>');
  if (!dlg.open) dlg.showModal();
  $('#dlgClose').onclick = () => dlg.close();
  let r;
  try { r = await planLocal(file); } catch (e) { shell(`<p>Could not read this PDF: ${esc(e.message)}</p>`, '<button class="btn" id="dlgClose">Close</button>'); $('#dlgClose').onclick = () => dlg.close(); return; }
  const changes = r.dates.reduce((a, d) => a + d.cells.filter((c) => c.kind !== 'same').length, 0);
  const added = r.dates.filter((d) => d.status === 'add').length, updated = r.dates.length - added;
  shell(importBody(r),
    `<span class="msg">${changes ? `${added} new date${added === 1 ? '' : 's'}, ${updated} existing. Saved on this device only.` : 'This app already has all of these results.'}</span>
     <button class="btn" id="dlgClose">Cancel</button>${changes ? '<button class="btn primary" id="dlgGo">Import</button>' : ''}`);
  $('#dlgClose').onclick = () => dlg.close();
  const go = $('#dlgGo');
  if (go) go.onclick = async () => {
    go.disabled = true; go.textContent = 'Importing…';
    for (const d of r.dates) for (const c of d.cells) if (c.kind !== 'same') setPoint(allMarkers().find((m) => m.name === c.marker), d.date, c.value);
    const saved = await persist();
    dlg.close(); refreshUI();
    toast(`Imported: ${added} new date${added === 1 ? '' : 's'}, ${updated} updated (${changes} change${changes === 1 ? '' : 's'}). ${saved ? 'Saved on this device.' : 'Could not save, so this will be lost when the app closes.'}`);
  };
}

// ---------- remove one set of results by date ----------
function datasetDates() {
  const m = new Map();
  for (const mk of allMarkers()) for (const p of mk.points) { const k = isoOfT(p.t); m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].sort((x, y) => (x[0] < y[0] ? 1 : -1)); // newest first
}

function openRemoveDialog() {
  const dlg = $('#importDlg'), sets = datasetDates();
  if (!sets.length) { toast('There are no results to remove.'); return; }
  const counts = new Map(sets);
  dlg.innerHTML = `<div class="dlg"><header><h2>Remove a set of results</h2><div class="muted">Pick the date of the set to delete. All results recorded on that date are removed.</div></header>
    <div class="body"><div class="datebox"><input type="date" id="rmDate" min="${sets[sets.length - 1][0]}" max="${sets[0][0]}" value="${sets[0][0]}" aria-label="Date to remove"></div>
      <div class="muted" style="font-size:12px">Dates with results:</div>
      <div class="datechips">${sets.map(([d, n]) => `<button type="button" class="chip" data-d="${d}">${esc(fmtISO(d))}<small>${n}</small></button>`).join('')}</div>
      <div class="statusline" id="rmStatus"></div></div>
    <footer><span class="msg">This only changes the data stored on this device.</span>
      <button class="btn" id="dlgClose">Cancel</button><button class="btn danger" id="rmGo" disabled>Remove results</button></footer></div>`;
  if (!dlg.open) dlg.showModal();
  const input = $('#rmDate'), go = $('#rmGo');
  const update = () => {
    const n = counts.get(input.value);
    $('#rmStatus').innerHTML = !input.value ? '' : n ? `<b>${n}</b> result${n === 1 ? '' : 's'} recorded on <b>${esc(fmtISO(input.value))}</b> will be removed.` : `<span class="muted">No results are recorded on this date.</span>`;
    go.disabled = !n;
    dlg.querySelectorAll('.datechips .chip').forEach((b) => b.classList.toggle('on', b.dataset.d === input.value));
  };
  input.oninput = update;
  dlg.querySelectorAll('.datechips .chip').forEach((b) => { b.onclick = () => { input.value = b.dataset.d; update(); }; });
  $('#dlgClose').onclick = () => dlg.close();
  go.onclick = async () => {
    const iso = input.value, n = counts.get(iso);
    go.disabled = true; go.textContent = 'Removing…';
    for (const m of allMarkers()) m.points = m.points.filter((p) => isoOfT(p.t) !== iso);
    const saved = await persist();
    dlg.close(); refreshUI();
    toast(`Removed ${n} result${n === 1 ? '' : 's'} from ${fmtISO(iso)}. ${saved ? '' : 'Could not save, so this change may be lost.'}`);
  };
  update();
}

async function init() {
  try { await loadData(); } catch (e) { $('#main').innerHTML = `<p class="empty">Could not load data: ${e.message}</p>`; return; }
  $('#removeBtn').onclick = openRemoveDialog;
  $('#pdfInput').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) runImport(f); };
  document.querySelectorAll('#viewSeg button').forEach((b) => b.onclick = () => {
    state.view = b.dataset.view;
    document.querySelectorAll('#viewSeg button').forEach((x) => x.classList.toggle('on', x === b));
    render();
  });
  document.querySelectorAll('#rangeSeg button').forEach((b) => b.onclick = () => {
    state.range = b.dataset.range;
    document.querySelectorAll('#rangeSeg button').forEach((x) => x.classList.toggle('on', x === b));
    render();
  });
  $('#search').oninput = (e) => { state.q = e.target.value; render(); };
  $('#onlyFlagged').onchange = (e) => { state.onlyFlagged = e.target.checked; render(); };
  $('#onlyCurrent').onchange = (e) => { state.onlyCurrent = e.target.checked; render(); };
}
init();
