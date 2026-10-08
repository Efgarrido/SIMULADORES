const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const D2R = Math.PI / 180;
const STROKE = {
  Intake: { es: 'Admisión', c: 'var(--c-intake)' },
  Compression: { es: 'Compresión', c: 'var(--c-comp)' },
  'Fuel Input': { es: 'Inyección (P cte)', c: 'var(--c-fuel)' },
  Power: { es: 'Potencia', c: 'var(--c-power)' },
  Exhaust: { es: 'Escape', c: 'var(--c-exhaust)' },
};
let params = { ...DEFAULTSD };
let model = null;
let theta = 0;

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

/* ---------- Válvulas (IntakeV, ExhaustV) ---------- */
const LIFT = 10; // mm
const intakeLift = th => { th %= 720; return th > 0 && th < 180 ? LIFT * Math.sin(Math.PI * th / 180) : 0; };
const exhaustLift = th => { th %= 720; return th > 540 && th < 720 ? LIFT * Math.sin(Math.PI * (th - 540) / 180) : 0; };
const sparkOn = th => th >= 356 && th < 392;

/* ---------- Diagrama (coordenadas en mm) ---------- */
const D = {};
const CX = 176; // eje del cilindro (Piston.Left + Bore/2 con Bore=130)
let GEO = null;

function buildEngine() {
  const g = model.g, p = params;
  const s = $('engine');
  const B = p.Bore, top = g.TopofCylinder;
  const pinOff = 40, pistonH = 72;
  const yc = g.pistonTop(0) + pinOff + g.L_1 + g.L_2; // centro del cigüeñal
  const xl = CX - B / 2, xr = CX + B / 2, wall = 24;
  const headTop = top - 44, blockBot = g.pistonTop(180) + pistonH + 4;
  GEO = { yc, pinOff, pistonH, xl, xr, top };
  const vbTop = headTop - 100, vbBot = yc + B / 2 + wall + 6;
  s.setAttribute('viewBox', `${xl - wall - 40} ${vbTop} ${B + 2 * wall + 80} ${vbBot - vbTop}`);
  s.innerHTML = `
  <defs>
    <pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="4" height="4" fill="var(--metal)"/><line x1="0" y1="0" x2="0" y2="4" stroke="var(--metal-line)" stroke-width="1"/>
    </pattern>
    <linearGradient id="pistonG" x1="0" x2="1">
      <stop offset="0" stop-color="var(--part-dark)"/><stop offset=".4" stop-color="#e8f5f6"/><stop offset="1" stop-color="var(--part-dark)"/>
    </linearGradient>
    <radialGradient id="flameG"><stop offset="0" stop-color="#fff3b0"/><stop offset=".45" stop-color="#ffb000"/><stop offset="1" stop-color="#ff6a00" stop-opacity="0"/></radialGradient>
    <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="var(--arrow)"/></marker>
    <clipPath id="boreClip"><rect x="${xl}" y="${top}" width="${B}" height="${blockBot - top}"/></clipPath>
  </defs>`;
  const H = 'url(#hatch)';
  const iX = CX - B * 0.29, eX = CX + B * 0.29, vR = B * 0.15; // posición y radio de válvulas
  GEO.iX = iX; GEO.eX = eX; GEO.vR = vR;
  // bloque y culata
  el('rect', { x: xl - wall, y: headTop, width: B + 2 * wall, height: blockBot - headTop, fill: H, stroke: 'var(--metal-line)' }, s);
  // conductos de admisión (izq.) y escape (der.)
  const portW = vR * 1.5;
  const portPath = (x, dir) => `M${x},${top} L${x},${headTop + 10} Q${x},${headTop - 18} ${x + dir * 40},${headTop - 18} L${x + dir * (B / 2 + wall + 40)},${headTop - 18}`;
  el('path', { d: portPath(iX, -1), stroke: 'var(--metal-line)', 'stroke-width': portW + 8, fill: 'none' }, s);
  el('path', { d: portPath(eX, 1), stroke: 'var(--metal-line)', 'stroke-width': portW + 8, fill: 'none' }, s);
  D.inPort = el('path', { d: portPath(iX, -1), stroke: 'var(--case)', 'stroke-width': portW, fill: 'none' }, s);
  D.exPort = el('path', { d: portPath(eX, 1), stroke: 'var(--case)', 'stroke-width': portW, fill: 'none' }, s);
  // cilindro
  el('rect', { x: xl, y: top, width: B, height: blockBot - top + 1, fill: 'var(--case)' }, s);
  D.gas = el('rect', { x: xl, y: top, width: B, height: 10, fill: 'var(--gas)', 'clip-path': 'url(#boreClip)' }, s);
  // cárter
  el('path', { d: `M${xl - wall},${blockBot} L${xr + wall},${blockBot} L${xr + wall},${yc} A${B / 2 + wall},${B / 2 + wall} 0 0 1 ${xl - wall},${yc} Z`, fill: H, stroke: 'var(--metal-line)' }, s);
  el('path', { d: `M${xl},${blockBot - 1} L${xr},${blockBot - 1} L${xr},${yc} A${B / 2},${B / 2} 0 0 1 ${xl},${yc} Z`, fill: 'var(--case)' }, s);
  // flechas de flujo
  D.inArrow = el('line', { x1: xl - wall - 34, x2: xl - wall + 2, y1: headTop - 18, y2: headTop - 18, stroke: 'var(--arrow)', 'stroke-width': 2.4, 'marker-end': 'url(#ah)' }, s);
  D.exArrow = el('line', { x1: xr + wall - 2, x2: xr + wall + 34, y1: headTop - 18, y2: headTop - 18, stroke: 'var(--arrow)', 'stroke-width': 2.4, 'marker-end': 'url(#ah)' }, s);
  // válvulas
  const valve = x => {
    const gg = el('g', {}, s);
    el('rect', { x: x - 2.5, y: headTop - 30, width: 5, height: top - headTop + 28, fill: 'var(--dark)' }, gg);
    el('path', { d: `M${x - vR},${top} L${x + vR},${top} L${x + 3},${top - 8} L${x - 3},${top - 8} Z`, fill: 'var(--dark)' }, gg);
    return gg;
  };
  D.inValve = valve(iX); D.exValve = valve(eX);
  // inyector y línea de combustible (Spray.left, FuelArrow)
  const fy = headTop - 52;
  el('path', { d: `M${xl - wall - 40},${fy} L${CX - 14},${fy} Q${CX},${fy} ${CX},${fy + 14} L${CX},${headTop - 30}`, stroke: '#9a7b3c', 'stroke-width': 9, fill: 'none' }, s);
  el('path', { d: `M${xl - wall - 40},${fy} L${CX - 14},${fy} Q${CX},${fy} ${CX},${fy + 14} L${CX},${headTop - 30}`, stroke: '#d9c38f', 'stroke-width': 6, fill: 'none' }, s);
  D.fuelArrow = el('line', { x1: xl - wall - 30, x2: xl - wall + 6, y1: fy, y2: fy, stroke: 'var(--arrow)', 'stroke-width': 2.2, 'marker-end': 'url(#ah)' }, s);
  el('rect', { x: CX - 9, y: headTop - 32, width: 18, height: 14, rx: 2, fill: '#6b7480', stroke: 'var(--dark)' }, s);
  el('rect', { x: CX - 6, y: headTop - 18, width: 12, height: 22, fill: '#c9ced4', stroke: 'var(--dark)' }, s);
  for (let y = headTop - 15; y < headTop + 3; y += 3.5) el('line', { x1: CX - 6, x2: CX + 6, y1: y, y2: y, stroke: '#8d96a1' }, s);
  el('path', { d: `M${CX - 5},${headTop + 4} L${CX + 5},${headTop + 4} L${CX + 2},${top} L${CX - 2},${top} Z`, fill: '#8d96a1', stroke: 'var(--dark)' }, s);
  D.flame = el('ellipse', { cx: CX, cy: top + 4, rx: B * 0.45, ry: 10, fill: 'url(#flameG)', opacity: 0 }, s);
  D.spray = el('path', { stroke: '#c79a2e', 'stroke-width': 1.3, fill: 'none', 'stroke-dasharray': '2 1.5' }, s);
  // cigüeñal
  D.crank = el('g', {}, s);
  el('path', { d: `M${CX - 52},${yc} A52,52 0 0 0 ${CX + 52},${yc} Z`, fill: 'var(--part)', stroke: 'var(--part-dark)', 'stroke-width': 1.2 }, D.crank);
  el('rect', { x: CX - 15, y: yc - g.L_1, width: 30, height: g.L_1, fill: 'var(--part)', stroke: 'var(--part-dark)' }, D.crank);
  el('circle', { cx: CX, cy: yc - g.L_1, r: 15, fill: 'var(--part)', stroke: 'var(--part-dark)' }, D.crank);
  el('circle', { cx: CX, cy: yc, r: 11, fill: 'var(--dark)' }, s);
  // biela
  D.rod = el('polygon', { fill: 'var(--part)', stroke: 'var(--part-dark)', 'stroke-width': 1.2 }, s);
  D.crankPin = el('circle', { r: 7, fill: 'var(--dark)' }, s);
  // pistón
  D.piston = el('g', {}, s);
  el('rect', { x: xl + 1, y: 0, width: B - 2, height: pistonH, rx: 3, fill: 'url(#pistonG)', stroke: 'var(--part-dark)', 'stroke-width': 1.2 }, D.piston);
  for (const y of [7, 12, 17]) el('line', { x1: xl + 1, x2: xr - 1, y1: y, y2: y, stroke: 'var(--dark)', 'stroke-width': y === 7 ? 2 : 1.2 }, D.piston);
  el('circle', { cx: CX, cy: pinOff, r: 10, fill: 'var(--dark)' }, D.piston);
  el('circle', { cx: CX, cy: pinOff, r: 4, fill: '#59626e' }, D.piston);
  // textos
  D.label = el('text', { x: xl - wall - 36, y: vbTop + 16, 'font-size': 15, 'font-weight': 700 }, s);
  D.sub = el('text', { x: xl - wall - 36, y: vbTop + 28, 'font-size': 9, style: 'fill:var(--muted);display:none' }, s);
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
  const g = model.g, G = GEO;
  const t = th * D2R;
  const top = g.pistonTop(th);
  const pinY = top + G.pinOff;
  const px = CX + g.L_1 * Math.sin(t), py = G.yc - g.L_1 * Math.cos(t);
  D.piston.setAttribute('transform', `translate(0,${top})`);
  D.crank.setAttribute('transform', `rotate(${th % 360},${CX},${G.yc})`);
  D.crankPin.setAttribute('cx', px); D.crankPin.setAttribute('cy', py);
  const dx = CX - px, dy = pinY - py, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  D.rod.setAttribute('points', [[px + nx * 10, py + ny * 10], [CX + nx * 7, pinY + ny * 7], [CX - nx * 7, pinY - ny * 7], [px - nx * 10, py - ny * 10]].map(p => p.join(',')).join(' '));
  // válvulas
  D.inValve.setAttribute('transform', `translate(0,${intakeLift(th)})`);
  D.exValve.setAttribute('transform', `translate(0,${exhaustLift(th)})`);
  // gas
  const tc = false && row;
  const burn = !!row && row.Stroke === 'Fuel Input';
  let gc = tc ? gasColorT(row.T) : burn ? 'rgb(255,150,40)' : 'var(--gas)';
  D.gas.setAttribute('y', G.top); D.gas.setAttribute('height', Math.max(0, top - G.top + 1)); D.gas.setAttribute('fill', gasColorT(row.T));
  D.flame.setAttribute('opacity', burn ? 0.85 : 0);
  D.fuelArrow.style.display = burn ? '' : 'none';
  if (burn) {
    const Ls = Math.max(0, top - G.top - 0.4);
    D.spray.setAttribute('d', [-70, -45, -20, 20, 45, 70].map(a => { const r = Math.tan(a * D2R); return `M${CX},${G.top} L${CX + r * Ls},${G.top + Ls}`; }).join(' '));
    D.spray.style.display = '';
  } else D.spray.style.display = 'none';
  // flechas (IntakeArrow.Color / ExhaustArrow.Color)
  const st = row ? row.Stroke : null;
  D.inArrow.style.display = st === 'Intake' ? '' : 'none';
  D.exArrow.style.display = st === 'Exhaust' ? '' : 'none';
  D.inPort.setAttribute('stroke', st === 'Intake' ? 'var(--fresh)' : 'var(--case)');
  D.exPort.setAttribute('stroke', st === 'Exhaust' ? (tc ? gasColorT(row.T) : 'var(--exh)') : 'var(--case)');
  const S = st ? STROKE[st] : null;
  D.label.textContent = S ? S.es : '????';
  D.label.style.fill = S ? S.c : '';
  D.sub.textContent = st ? `Stroke$ = '${st}'` : '';
}

/* ---------- Gráficas ---------- */

const rowNow = () => model.rows[Math.min(model.rows.length - 1, Math.round(theta / DTHETA))];
