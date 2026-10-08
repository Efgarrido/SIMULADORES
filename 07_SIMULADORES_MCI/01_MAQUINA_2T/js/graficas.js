const PLOTS = [
  { id: 'ts', name: 'T–s', x: r => r.s, y: r => r.T, xl: 's [kJ/(kg·K)]', yl: 'T  [K]' },
  { id: 'pv', name: 'P–V', x: r => r.Vol, y: r => r.P, xl: 'V [m³]', yl: 'P  [kPa]' },
  { id: 'tth', name: 'T–θ', x: r => r.theta, y: r => r.T, xl: 'θ  [deg]', yl: 'T  [K]', th: true },
  { id: 'pth', name: 'P–θ', x: r => r.theta, y: r => r.P, xl: 'θ  [deg]', yl: 'P  [kPa]', th: true },
];
let curPlot = 'ts', PS = null;

function niceStep(span, n) {
  const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / p;
  return (r < 1.5 ? 1 : r < 2.25 ? 2 : r < 3.5 ? 2.5 : r < 7.5 ? 5 : 10) * p;
}
function ticks(min, max, n) {
  const st = niceStep(max - min || 1, n), out = [];
  for (let v = Math.ceil(min / st - 1e-9) * st; v <= max + 1e-9 * st; v += st) out.push(+v.toPrecision(12));
  return { list: out, step: st };
}
const fmt = (v, st) => { const d = Math.max(0, -Math.floor(Math.log10(st) + 1e-9)); return v.toFixed(Math.min(d, 4)); };

function renderPlot() {
  const svg = $('plot');
  const def = PLOTS.find(p => p.id === curPlot);
  const isTbl = curPlot === 'tbl';
  svg.style.display = isTbl ? 'none' : '';
  svg.innerHTML = '';
  if (!model) return;
  const rows = model.rows;
  const xs = rows.map(def.x), ys = rows.map(def.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (def.th) { x0 = 0; x1 = 360; }
  const padX = (x1 - x0) * 0.04 || 1, padY = (y1 - y0) * 0.06 || 1;
  const tx = ticks(x0 - (def.th ? 0 : padX), x1 + (def.th ? 0 : padX), 7), ty = ticks(y0 - padY, y1 + padY, 6);
  const X0 = def.th ? 0 : Math.min(tx.list[0], x0 - padX), X1 = def.th ? 360 : Math.max(tx.list.at(-1), x1 + padX);
  const Y0 = Math.min(ty.list[0], y0 - padY), Y1 = Math.max(ty.list.at(-1), y1 + padY);
  const m = { l: 96, r: 32, t: 16, b: 66 }, W = 937, H = 649;
  const sx = v => m.l + (v - X0) / (X1 - X0) * (W - m.l - m.r);
  const sy = v => H - m.b - (v - Y0) / (Y1 - Y0) * (H - m.t - m.b);
  PS = { sx, sy, def, xs, ys };
  const g = el('g', {}, svg);
  // bandas de carrera en gráficas vs θ
  if (def.th) {
    let start = 0;
    for (let i = 1; i <= rows.length; i++) {
      if (i === rows.length || rows[i].Stroke !== rows[start].Stroke) {
        const a = rows[start].theta, b = i < rows.length ? rows[i].theta : 360;
        el('rect', { x: sx(a), y: m.t, width: sx(b) - sx(a), height: H - m.t - m.b, fill: STROKE[rows[start].Stroke].c, opacity: 0.07 }, g);
        start = i;
      }
    }
  }
  for (const v of tx.list) {
    el('line', { x1: sx(v), x2: sx(v), y1: m.t, y2: H - m.b, stroke: 'var(--grid)' }, g);
    el('text', { x: sx(v), y: H - m.b + 24, 'text-anchor': 'middle', 'font-size': 16.8 }, g).textContent = fmt(v, tx.step);
  }
  for (const v of ty.list) {
    el('line', { x1: m.l, x2: W - m.r, y1: sy(v), y2: sy(v), stroke: 'var(--grid)' }, g);
    el('text', { x: m.l - 8, y: sy(v) + 6, 'text-anchor': 'end', 'font-size': 16.8 }, g).textContent = fmt(v, ty.step);
  }
  el('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'none', stroke: 'var(--muted)' }, g);
  el('text', { x: (m.l + W - m.r) / 2, y: H - 10, 'text-anchor': 'middle', 'font-size': 18.2, 'font-weight': 600 }, g).textContent = def.xl;
  el('text', { x: 20, y: (m.t + H - m.b) / 2, 'text-anchor': 'middle', 'font-size': 18.2, 'font-weight': 600, transform: `rotate(-90,20,${(m.t + H - m.b) / 2})` }, g).textContent = def.yl;
  // curva (segmentos coloreados por carrera, en el orden de la tabla)
  let seg = [[sx(xs[0]), sy(ys[0])]], st = rows[0].Stroke;
  const flush = () => { if (seg.length > 1) el('polyline', { points: seg.map(p => p.join(',')).join(' '), fill: 'none', stroke: STROKE[st].c, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g); };
  for (let i = 1; i < rows.length; i++) {
    const p = [sx(xs[i]), sy(ys[i])];
    if (rows[i].Stroke !== st) { seg.push(p); flush(); seg = [p]; st = rows[i].Stroke; }
    else seg.push(p);
  }
  flush();
  PS.guideX = el('line', { stroke: 'var(--muted)', 'stroke-dasharray': '3 3' }, g);
  PS.guideY = el('line', { stroke: 'var(--muted)', 'stroke-dasharray': '3 3' }, g);
  PS.dot = el('circle', { r: 6, fill: 'var(--panel)', stroke: 'var(--ink)', 'stroke-width': 2.5 }, g);
  PS.m = m; PS.W = W; PS.H = H;
  updateMarker();
}

function updateMarker() {
  if (!PS || curPlot === 'tbl' || !model) return;
  const i = rowIndex();
  const x = PS.sx(PS.xs[i]), y = PS.sy(PS.ys[i]);
  PS.dot.setAttribute('cx', x); PS.dot.setAttribute('cy', y);
  PS.guideX.setAttribute('x1', x); PS.guideX.setAttribute('x2', x); PS.guideX.setAttribute('y1', y); PS.guideX.setAttribute('y2', PS.H - PS.m.b);
  PS.guideY.setAttribute('x1', PS.m.l); PS.guideY.setAttribute('x2', x); PS.guideY.setAttribute('y1', y); PS.guideY.setAttribute('y2', y);
}


const rowIndex = () => Math.min(model.rows.length - 1, Math.round(theta / params.dtheta));
const COLS = [
  ['theta', 'θ [deg]', 1], ['Stroke', 'Stroke$'], ['Vol', 'Vol [m³]', 'e'], ['T', 'T [K]', 1], ['P', 'P [kPa]', 1],
  ['s', 's [kJ/kg-K]', 4], ['v', 'v [m³/kg]', 4], ['m', 'm [kg]', 'e'], ['u', 'u [kJ/kg]', 1],
  ['Q_in', 'Q_in [kJ]', 4], ['W', 'W [kJ]', 4], ['Efficiency', 'Efficiency', 4],
];
function exportCSV() {
  const options = {
    ts: ['Entropía [kJ/(kg·K)]', 'Temperatura [K]', 's', 'T', 'TS'],
    pv: ['Volumen [m³]', 'Presión [kPa]', 'Vol', 'P', 'PV'],
    tth: ['Ángulo [°]', 'Temperatura [K]', 'theta', 'T', 'T_Angulo'],
    pth: ['Ángulo [°]', 'Presión [kPa]', 'theta', 'P', 'P_Angulo'],
  };
  const [xTitle, yTitle, xKey, yKey, suffix] = options[curPlot];
  const processKey = 'Stroke';
  const hasProcess = model.rows.every(row => row[processKey] !== undefined);
  const csvCell = value => {
    const text = String(value);
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  };
  const lines = [[xTitle, yTitle, ...(hasProcess ? ['Proceso'] : [])].map(csvCell).join(',')];
  model.rows.forEach(row => lines.push([
    row[xKey], row[yKey], ...(hasProcess ? [row[processKey]] : []),
  ].map(csvCell).join(',')));
  const a = document.createElement('a');
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
  a.href = url;
  a.download = 'Motor_2T' + '_' + suffix + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
