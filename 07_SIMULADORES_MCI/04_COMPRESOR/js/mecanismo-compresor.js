
/* ===================== Interfaz compresor de aire ===================== */
const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const D2R = Math.PI / 180;
const STATE = {
  closed: { es: 'Válvulas cerradas', c: 'var(--c-comp)' },
  intake: { es: 'Admisión', c: 'var(--c-intake)' },
  exhaust: { es: 'Descarga', c: 'var(--c-power)' },
};
const stateOf = r => r.IV ? 'intake' : r.EV ? 'exhaust' : 'closed';
let params = { ...DEFAULTSC_IDEAL };
let model = null;
let theta = 0;

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
const tabNow = () => model.rows;
const rowIndex = () => Math.min(NROWS - 1, Math.round(theta));
const rowNow = () => model ? tabNow()[rowIndex()] : null;

/* ---------- Diagrama ---------- */
const D = {};
const CX = 176;
let GEO = null;
function buildEngine() {
  const g = model.g, p = params, s = $('engine');
  const B = p.Bore, top = g.TopofCylinder;
  const pinOff = 40, pistonH = 72;
  const yc = g.pistonTop(0) + pinOff + g.L_1 + g.L_2;
  const xl = CX - B / 2, xr = CX + B / 2, wall = 24;
  const headTop = top - 44, blockBot = g.pistonTop(180) + pistonH + 4;
  const vbTop = headTop - 96, vbBot = yc + B / 2 + wall + 6;
  GEO = { yc, pinOff, top, headTop };
  s.setAttribute('viewBox', `0 ${vbTop} 352 ${vbBot - vbTop}`);
  s.innerHTML = `
  <defs>
    <pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="4" height="4" fill="var(--metal)"/><line x1="0" y1="0" x2="0" y2="4" stroke="var(--metal-line)" stroke-width="1"/></pattern>
    <linearGradient id="pistonG" x1="0" x2="1"><stop offset="0" stop-color="var(--part-dark)"/><stop offset=".4" stop-color="#e8f5f6"/><stop offset="1" stop-color="var(--part-dark)"/></linearGradient>
    <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--arrow)"/></marker>
    <clipPath id="boreClip"><rect x="${xl}" y="${top}" width="${B}" height="${blockBot - top}"/></clipPath>
  </defs>`;
  const H = 'url(#hatch)';
  const iX = CX - B * 0.29, eX = CX + B * 0.29, vR = B * 0.13, portW = vR * 1.6, py = headTop - 18;
  // bloque
  el('rect', { x: xl - wall, y: headTop, width: B + 2 * wall, height: blockBot - headTop, fill: H, stroke: 'var(--metal-line)' }, s);
  const inPath = `M${iX},${top} L${iX},${py + 18} Q${iX},${py} ${iX - 30},${py} L20,${py}`;
  const exPath = `M${eX},${top} L${eX},${py + 18} Q${eX},${py} ${eX + 30},${py} L332,${py}`;
  for (const d of [inPath, exPath]) el('path', { d, stroke: 'var(--metal-line)', 'stroke-width': portW + 8, fill: 'none' }, s);
  D.inPort = el('path', { d: inPath, stroke: 'var(--case)', 'stroke-width': portW, fill: 'none' }, s);
  D.exPort = el('path', { d: exPath, stroke: 'var(--case)', 'stroke-width': portW, fill: 'none' }, s);
  el('text', { x: 16, y: py + portW / 2 + 18, 'font-size': 11, 'font-weight': 600 }, s).textContent = `${p.P_admision} kPa`;
  el('text', { x: 16, y: py + portW / 2 + 32, 'font-size': 11, 'font-weight': 600 }, s).textContent = `${p.T_admision} K`;
  D.inArrow = el('line', { x1: 22, x2: 58, y1: py, y2: py, stroke: 'var(--arrow)', 'stroke-width': 2.4, 'marker-end': 'url(#ah)' }, s);
  D.exArrow = el('line', { x1: eX + 34, x2: eX + 70, y1: py, y2: py, stroke: 'var(--arrow)', 'stroke-width': 2.4, 'marker-end': 'url(#ah)' }, s);
  // cilindro y cárter
  el('rect', { x: xl, y: top, width: B, height: blockBot - top + 1, fill: 'var(--case)' }, s);
  D.gas = el('rect', { x: xl, y: top, width: B, height: 10, fill: 'var(--gas)', 'clip-path': 'url(#boreClip)' }, s);
  el('path', { d: `M${xl - wall},${blockBot} L${xr + wall},${blockBot} L${xr + wall},${yc} A${B / 2 + wall},${B / 2 + wall} 0 0 1 ${xl - wall},${yc} Z`, fill: H, stroke: 'var(--metal-line)' }, s);
  el('path', { d: `M${xl},${blockBot - 1} L${xr},${blockBot - 1} L${xr},${yc} A${B / 2},${B / 2} 0 0 1 ${xl},${yc} Z`, fill: 'var(--case)' }, s);
  // válvulas de placa (admisión abre hacia el cilindro, descarga hacia el conducto)
  const valve = x => { const v = el('g', {}, s); el('rect', { x: x - vR, y: top - 4, width: 2 * vR, height: 4, rx: 1, fill: 'var(--dark)' }, v); el('rect', { x: x - 1.5, y: top - 14, width: 3, height: 10, fill: 'var(--dark)' }, v); return v; };
  D.inValve = valve(iX); D.exValve = valve(eX);
  // cigüeñal, biela, pistón
  D.crank = el('g', {}, s);
  el('path', { d: `M${CX - 52},${yc} A52,52 0 0 0 ${CX + 52},${yc} Z`, fill: 'var(--part)', stroke: 'var(--part-dark)', 'stroke-width': 1.2 }, D.crank);
  el('rect', { x: CX - 15, y: yc - g.L_1, width: 30, height: g.L_1, fill: 'var(--part)', stroke: 'var(--part-dark)' }, D.crank);
  el('circle', { cx: CX, cy: yc - g.L_1, r: 15, fill: 'var(--part)', stroke: 'var(--part-dark)' }, D.crank);
  el('circle', { cx: CX, cy: yc, r: 11, fill: 'var(--dark)' }, s);
  D.rod = el('polygon', { fill: 'var(--part)', stroke: 'var(--part-dark)', 'stroke-width': 1.2 }, s);
  D.crankPin = el('circle', { r: 7, fill: 'var(--dark)' }, s);
  D.piston = el('g', {}, s);
  el('rect', { x: xl + 1, y: 0, width: B - 2, height: pistonH, rx: 3, fill: 'url(#pistonG)', stroke: 'var(--part-dark)', 'stroke-width': 1.2 }, D.piston);
  for (const y of [7, 12, 17]) el('line', { x1: xl + 1, x2: xr - 1, y1: y, y2: y, stroke: 'var(--dark)', 'stroke-width': y === 7 ? 2 : 1.2 }, D.piston);
  el('circle', { cx: CX, cy: pinOff, r: 10, fill: 'var(--dark)' }, D.piston);
  el('circle', { cx: CX, cy: pinOff, r: 4, fill: '#59626e' }, D.piston);
  // textos
  D.label = el('text', { x: 14, y: vbTop + 22, 'font-size': 17, 'font-weight': 700 }, s);
  D.sub = el('text', { x: 14, y: vbTop + 40, 'font-size': 10, style: 'fill:var(--muted)' }, s);
}

// Escala absoluta común: interpolación RGB lineal, limitada a 300–2500 K.
const THERMAL_COLORS = [
  [300, [173, 216, 230]], [500, [64, 180, 180]],
  [800, [60, 180, 75]], [1200, [255, 220, 0]],
  [1800, [255, 140, 0]], [2500, [230, 40, 30]]
];
function gasColorT(T) {
  const temperature = Math.max(300, Math.min(2500, T));
  const i = THERMAL_COLORS.findIndex(point => point[0] >= temperature);
  const [upperT, upperRGB] = THERMAL_COLORS[i];
  const [lowerT, lowerRGB] = THERMAL_COLORS[Math.max(0, i - 1)];
  const fraction = upperT === lowerT ? 0 : (temperature - lowerT) / (upperT - lowerT);
  return `rgb(${lowerRGB.map((v, k) => Math.round(v + (upperRGB[k] - v) * fraction)).join(',')})`;
}
function buildThermalScale() {
  const position = T => (T - 300) / 2200 * 100;
  $('barra-termica').style.background = `linear-gradient(to right, ${THERMAL_COLORS.map(([T, rgb]) => `rgb(${rgb.join(',')}) ${position(T)}%`).join(', ')})`;
  const labels = $('etiquetas-termicas');
  labels.innerHTML = '';
  THERMAL_COLORS.forEach(([T]) => {
    const label = document.createElement('span');
    label.textContent = T;
    label.style.left = `${position(T)}%`;
    labels.appendChild(label);
  });
}

function drawEngine(th, row) {
  const g = model.g, G = GEO, t = th * D2R;
  const top = g.pistonTop(th), pinY = top + G.pinOff;
  const px = CX + g.L_1 * Math.sin(t), py = G.yc - g.L_1 * Math.cos(t);
  D.piston.setAttribute('transform', `translate(0,${top})`);
  D.crank.setAttribute('transform', `rotate(${th},${CX},${G.yc})`);
  D.crankPin.setAttribute('cx', px); D.crankPin.setAttribute('cy', py);
  const dx = CX - px, dy = pinY - py, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  D.rod.setAttribute('points', [[px + nx * 10, py + ny * 10], [CX + nx * 7, pinY + ny * 7], [CX - nx * 7, pinY - ny * 7], [px - nx * 10, py - ny * 10]].map(q => q.join(',')).join(' '));
  // Las válvulas usan el ángulo continuo, no la fila entera más cercana.
  row = { ...row, IV: th >= model.summary.theta_B && th <= 180,
    EV: th >= model.summary.theta_D && th < 360 };
  const st = stateOf(row), tc = false;
  D.inValve.setAttribute('transform', `translate(0,${row.IV ? Math.min(4, top - G.top - 1) : 0})`);
  D.exValve.setAttribute('transform', `translate(0,${row.EV ? -5 : 0})`);
  D.gas.setAttribute('y', G.top); D.gas.setAttribute('height', Math.max(0, top - G.top + 1));
  D.gas.setAttribute('fill', gasColorT(row.T));
  D.inArrow.style.display = row.IV ? '' : 'none';
  D.exArrow.style.display = row.EV ? '' : 'none';
  D.inPort.setAttribute('stroke', row.IV ? 'var(--fresh)' : 'var(--case)');
  D.exPort.setAttribute('stroke', row.EV ? (tc ? gasColorT(row.T) : 'var(--exh)') : 'var(--case)');
  D.label.textContent = STATE[st].es; D.label.style.fill = STATE[st].c;
  D.sub.textContent = '';
}

