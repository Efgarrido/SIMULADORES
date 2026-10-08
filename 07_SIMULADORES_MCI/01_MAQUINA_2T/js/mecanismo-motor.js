const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const D2R = Math.PI / 180;
const STROKE = {
  Power: { es: 'Potencia', c: 'var(--c-power)' },
  Exhaust: { es: 'Escape', c: 'var(--c-exhaust)' },
  Intake: { es: 'Admisión', c: 'var(--c-intake)' },
  Compression: { es: 'Compresión', c: 'var(--c-comp)' },
};
let params = { ...DEFAULTS };
let model = null;
let theta = 0;

/* ---------- Geometría (Stroke=115, L_1=Stroke/2, L_2=210) ---------- */
const G = { cx: 220, cy: 440, L1: 57.5, L2: 210, pin: 38, pH: 120, xl: 160, xr: 280, head: 104 };
const pistonTop = th => {
  const t = th * D2R;
  return G.cy - (G.L1 * Math.cos(t) + Math.sqrt(G.L2 ** 2 - (G.L1 * Math.sin(t)) ** 2)) - G.pin;
};
// Lumbreras colocadas para que el pistón las descubra en los ángulos definidos
const EXH_OPEN = 106, EXH_CLOSE = 256, TR_OPEN = 116, TR_CLOSE = 248, REED_OPEN = 220;
const yE = pistonTop(EXH_OPEN), yT = pistonTop(TR_OPEN), yPB = 251;

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

const D = {}; // elementos dinámicos del diagrama
function buildEngine() {
  const s = $('engine');
  s.innerHTML = `
  <defs>
    <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" fill="var(--metal)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--metal-line)" stroke-width="1.6"/>
    </pattern>
    <linearGradient id="pistonG" x1="0" x2="1">
      <stop offset="0" stop-color="var(--piston)"/><stop offset=".45" stop-color="#e8f5f6"/><stop offset="1" stop-color="var(--part-dark)"/>
    </linearGradient>
    <radialGradient id="flameG"><stop offset="0" stop-color="#fff3b0"/><stop offset=".45" stop-color="#ffb000"/><stop offset="1" stop-color="#ff6a00" stop-opacity="0"/></radialGradient>
    <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="var(--arrow)"/></marker>
    <clipPath id="boreClip"><path d="M160,360 L160,128 Q160,104 184,104 L256,104 Q280,104 280,128 L280,360 Z"/></clipPath>
  </defs>`;
  const H = 'url(#hatch)', stroke = { stroke: 'var(--metal-line)', 'stroke-width': 1 };
  // --- bloque metálico ---
  el('path', { d: 'M124,360 L124,122 Q124,78 168,78 L272,78 Q316,78 316,122 L316,360 Z', fill: H, ...stroke }, s);
  el('circle', { cx: G.cx, cy: G.cy, r: 126, fill: H, ...stroke }, s);
  el('rect', { x: 94, y: yT - 16, width: 50, height: 440 - (yT - 16), fill: H }, s);
  el('rect', { x: 20, y: 456, width: 100, height: 14, fill: H }, s);
  el('rect', { x: 20, y: 500, width: 100, height: 14, fill: H }, s);
  el('rect', { x: 316, y: yE - 14, width: 104, height: 14, fill: H }, s);
  el('rect', { x: 316, y: yPB, width: 104, height: 14, fill: H }, s);
  // --- huecos interiores ---
  const gas = 'var(--gas)', cs = 'var(--case)';
  el('circle', { cx: G.cx, cy: G.cy, r: 106, fill: cs }, s);
  el('rect', { x: 160, y: 320, width: 120, height: 60, fill: cs }, s);
  el('rect', { x: 108, y: yT, width: 22, height: 430 - yT, fill: cs }, s);
  el('rect', { x: 128, y: yT, width: 34, height: yPB - yT, fill: cs }, s);
  el('rect', { x: 20, y: 470, width: 110, height: 30, fill: cs }, s);
  el('path', { d: 'M160,360 L160,128 Q160,104 184,104 L256,104 Q280,104 280,128 L280,360 Z', fill: cs }, s);
  D.exhPort = el('rect', { x: 278, y: yE, width: 40, height: yPB - yE, fill: cs }, s);
  D.exhDuct = el('rect', { x: 316, y: yE, width: 104, height: yPB - yE, fill: cs }, s);
  // --- gas en el cilindro (color dinámico) ---
  D.gas = el('rect', { x: 160, y: 104, width: 120, height: 10, fill: gas, 'clip-path': 'url(#boreClip)' }, s);
  D.flame = el('ellipse', { cx: 220, cy: 118, rx: 58, ry: 26, fill: 'url(#flameG)', opacity: 0 }, s);
  // --- bujía ---
  el('rect', { x: 214, y: 30, width: 12, height: 14, rx: 2, fill: 'var(--dark)' }, s);
  el('rect', { x: 208, y: 42, width: 24, height: 34, rx: 4, fill: '#f4f1ea', stroke: '#9a958a' }, s);
  for (let y = 48; y < 74; y += 6) el('line', { x1: 208, x2: 232, y1: y, y2: y, stroke: '#c7c1b3' }, s);
  el('rect', { x: 203, y: 76, width: 34, height: 16, rx: 2, fill: '#6b7480', stroke: 'var(--dark)' }, s);
  el('rect', { x: 210, y: 92, width: 20, height: 12, fill: '#8d96a1', stroke: 'var(--dark)' }, s);
  el('path', { d: 'M220,104 v6 M214,104 v8 h8', stroke: 'var(--dark)', 'stroke-width': 2, fill: 'none' }, s);
  // --- válvula de lengüeta (admisión al cárter) ---
  D.reed = el('line', { x1: 128, y1: 470, x2: 128, y2: 500, stroke: 'var(--dark)', 'stroke-width': 4, 'stroke-linecap': 'round' }, s);
  D.arrow2 = el('line', { x1: 34, y1: 485, x2: 92, y2: 485, stroke: 'var(--arrow)', 'stroke-width': 2.5, 'marker-end': 'url(#ah)' }, s);
  // --- cigüeñal ---
  D.crank = el('g', {}, s);
  el('path', { d: `M${G.cx - 82},${G.cy} A82,82 0 0 0 ${G.cx + 82},${G.cy} Z`, fill: 'var(--part)', stroke: 'var(--part-dark)', 'stroke-width': 1.5 }, D.crank);
  el('rect', { x: G.cx - 22, y: G.cy - G.L1, width: 44, height: G.L1, fill: 'var(--part)', stroke: 'var(--part-dark)' }, D.crank);
  el('circle', { cx: G.cx, cy: G.cy - G.L1, r: 22, fill: 'var(--part)', stroke: 'var(--part-dark)' }, D.crank);
  el('circle', { cx: G.cx, cy: G.cy, r: 38, fill: 'none', stroke: 'var(--part-dark)', 'stroke-width': 1 }, D.crank);
  el('circle', { cx: G.cx, cy: G.cy, r: 16, fill: 'var(--dark)' }, s);
  // --- biela ---
  D.rod = el('polygon', { fill: 'var(--part)', stroke: 'var(--part-dark)', 'stroke-width': 1.5 }, s);
  D.crankPin = el('circle', { r: 9, fill: 'var(--dark)' }, s);
  // --- pistón ---
  D.piston = el('g', {}, s);
  el('rect', { x: 161, y: 0, width: 118, height: G.pH, rx: 5, fill: 'url(#pistonG)', stroke: 'var(--part-dark)', 'stroke-width': 1.5 }, D.piston);
  for (const y of [9, 16, 23]) el('line', { x1: 161, x2: 279, y1: y, y2: y, stroke: 'var(--part-dark)', 'stroke-width': 1.2 }, D.piston);
  el('circle', { cx: 220, cy: G.pin, r: 14, fill: 'var(--dark)' }, D.piston);
  el('circle', { cx: 220, cy: G.pin, r: 5, fill: '#59626e' }, D.piston);
  // --- flechas de flujo ---
  D.exhArrow = el('line', { y1: (yE + yPB) / 2, y2: (yE + yPB) / 2, stroke: 'var(--arrow)', 'stroke-width': 2.5, 'marker-end': 'url(#ah)' }, s);
  D.arrow1 = el('line', { x1: 119, x2: 119, stroke: 'var(--arrow)', 'stroke-width': 2.5, 'marker-end': 'url(#ah)' }, s);
  D.air = [150, 172, 194].map(y => el('line', { y1: y, y2: y, stroke: 'var(--arrow)', 'stroke-width': 2.2, 'marker-end': 'url(#ah)' }, s));
  // --- textos ---
  D.label = el('text', { x: 14, y: 34, 'font-size': 22, 'font-weight': 700 }, s);
  D.sub = el('text', { x: 14, y: 56, 'font-size': 13, style: 'fill:var(--muted);display:none' }, s);
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
  const t = th * D2R;
  const top = pistonTop(th);
  const pinY = top + G.pin;
  const px = G.cx + G.L1 * Math.sin(t), py = G.cy - G.L1 * Math.cos(t);
  D.piston.setAttribute('transform', `translate(0,${top})`);
  D.crank.setAttribute('transform', `rotate(${th},${G.cx},${G.cy})`);
  D.crankPin.setAttribute('cx', px); D.crankPin.setAttribute('cy', py);
  // biela
  const dx = G.cx - px, dy = pinY - py, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  const w1 = 15, w2 = 10;
  D.rod.setAttribute('points', [
    [px + nx * w1, py + ny * w1], [G.cx + nx * w2, pinY + ny * w2],
    [G.cx - nx * w2, pinY - ny * w2], [px - nx * w1, py - ny * w1]].map(p => p.join(',')).join(' '));
  // gas del cilindro — GasColor(Angle): naranja si Angle<16
  const burning = th < 16;
  let gc = burning ? 'rgb(255,128,0)' : 'var(--gas)';
  if (false && row) gc = gasColorT(row.T);
  D.gas.setAttribute('y', 100);
  D.gas.setAttribute('height', Math.max(0, top - 100 + 2));
  D.gas.setAttribute('fill', gasColorT(row.T));
  D.flame.setAttribute('opacity', burning ? (1 - th / 16) * 0.95 : 0);
  // procedure Exhaust
  const exOpen = th > EXH_OPEN && th < EXH_CLOSE;
  const exCol = exOpen ? (false && row ? gasColorT(row.T) : 'var(--exh)') : 'var(--case)';
  D.exhDuct.setAttribute('fill', exCol); D.exhPort.setAttribute('fill', exCol);
  const exL = 322 + 50 * (th - EXH_OPEN) / (EXH_CLOSE - EXH_OPEN);
  D.exhArrow.setAttribute('x1', exL); D.exhArrow.setAttribute('x2', exL + 44);
  D.exhArrow.style.display = exOpen ? '' : 'none';
  // procedure Arrow1 / AirMovement
  const trOpen = th > TR_OPEN && th < TR_CLOSE;
  const f = (th - TR_OPEN) / (TR_CLOSE - TR_OPEN);
  const tip = 410 + ((yT + 6) - 410) * f;
  D.arrow1.setAttribute('y1', tip + 44); D.arrow1.setAttribute('y2', tip);
  D.arrow1.style.display = trOpen ? '' : 'none';
  D.air.forEach(a => {
    const x = 166 + 66 * f;
    a.setAttribute('x1', x); a.setAttribute('x2', x + 36);
    a.style.display = trOpen ? '' : 'none';
  });
  // procedure ValvePosition
  const reedOpen = th > REED_OPEN;
  D.reed.setAttribute('x2', reedOpen ? 146 : 128); D.reed.setAttribute('y2', reedOpen ? 494 : 500);
  D.arrow2.style.display = reedOpen ? '' : 'none';
  // Stroke$
  const st = row ? STROKE[row.Stroke] : null;
  D.label.textContent = st ? st.es : '????';
  D.label.style.fill = st ? st.c : '';
  D.sub.textContent = row ? `Stroke$ = '${row.Stroke}'` : '';
}

/* ---------- Gráficas ---------- */

const rowNow = () => model.rows[Math.min(model.rows.length - 1, Math.round(theta / params.dtheta))];
