
/* ===================== Propiedades del aire (gas ideal, cp variable) =====================
   Se usan polinomios NASA de 7 coeficientes
   para N2, O2 y Ar (78.12 / 20.96 / 0.92 % molar). Las referencias de h y s se
   ajustan a los siguientes valores de referencia: h(298.15 K)=298.4 kJ/kg,
   s(298.15 K, 101.325 kPa)=5.695 kJ/kg-K. */
const AIR = (() => {
  const Ru = 8.314, M = 28.97, R = Ru / M, P0 = 101.325;
  const SP = [
    { x: 0.7812, lo: [3.298677, 1.4082404e-3, -3.963222e-6, 5.641515e-9, -2.444854e-12, -1020.8999, 3.950372],
                 hi: [2.92664, 1.4879768e-3, -5.68476e-7, 1.0097038e-10, -6.753351e-15, -922.7977, 5.980528] },
    { x: 0.2096, lo: [3.78245636, -2.99673416e-3, 9.84730201e-6, -9.68129509e-9, 3.24372837e-12, -1063.94356, 3.65767573],
                 hi: [3.28253784, 1.48308754e-3, -7.57966669e-7, 2.09470555e-10, -2.16717794e-14, -1088.45772, 5.45323129] },
    { x: 0.0092, lo: [2.5, 0, 0, 0, 0, -745.375, 4.366], hi: [2.5, 0, 0, 0, 0, -745.375, 4.366] },
  ];
  const co = (s, T) => (T < 1000 ? s.lo : s.hi);
  const cpR = T => SP.reduce((a, s) => { const c = co(s, T); return a + s.x * (c[0] + T * (c[1] + T * (c[2] + T * (c[3] + T * c[4])))); }, 0);
  const hR = T => SP.reduce((a, s) => { const c = co(s, T); return a + s.x * (T * (c[0] + T * (c[1] / 2 + T * (c[2] / 3 + T * (c[3] / 4 + T * c[4] / 5)))) + c[5]); }, 0);
  const sR = T => SP.reduce((a, s) => { const c = co(s, T); return a + s.x * (c[0] * Math.log(T) + T * (c[1] + T * (c[2] / 2 + T * (c[3] / 3 + T * c[4] / 4))) + c[6]); }, 0);
  const k = Ru / M;
  const H_OFF = 298.4 - k * hR(298.15);
  const S_OFF = 5.695 - k * sR(298.15);
  const cp = T => k * cpR(T);
  const cv = T => cp(T) - R;
  const h = T => k * hR(T) + H_OFF;
  const u = T => h(T) - R * T;
  const s0 = T => k * sR(T) + S_OFF;
  const sTP = (T, P) => s0(T) - R * Math.log(P / P0);
  const sTv = (T, v) => sTP(T, R * T / v);
  const newton = (f, df, T = 800) => {
    for (let i = 0; i < 80; i++) {
      const d = f(T) / df(T);
      T = Math.min(6000, Math.max(100, T - d));
      if (Math.abs(d) < 1e-9 * T) return T;
    }
    return T;
  };
  return {
    R, M, cp, cv, h, u, sTP, sTv,
    v: (T, P) => R * T / P,
    P: (T, v) => R * T / v,
    T_sv: (s, v) => newton(T => sTv(T, v) - s, T => cv(T) / T),
    T_sP: (s, P) => newton(T => sTP(T, P) - s, T => cp(T) / T),
    T_u: uu => newton(T => u(T) - uu, cv),
  };
})();

/* ===================== Modelo 4 tiempos ===================== */
const DEFAULTS4 = {
  CompressionRatio: 9, RPM: 3000, Bore: 130, T_max: 2500, loops: 2,
  Stroke: 75, L_2: 110, P_intake: 95, T_in: 300, T_exh0: 900, P_exhaust: 105,
};
const DTHETA = 2; // la tabla 'Otto' va de 0 a 720° en pasos de 2° (361 corridas)

function geometry4(p) {
  const L_1 = p.Stroke / 2, L_2 = p.L_2;
  const H_min = p.Stroke / (p.CompressionRatio - 1);       // de CompressionRatio = H_max/H_min
  const TopofCylinder = 70 + L_2 - L_1 - H_min;
  const A = Math.PI * p.Bore ** 2 / 4;                       // mm²
  const pistonTop = th => {                                  // posición del pistón (mm)
    const t = th * Math.PI / 180;
    const ca = -Math.asin(L_1 / L_2 * Math.sin(t));
    return 70 + L_2 * Math.cos(-ca) - L_1 * Math.cos(t) + L_1 * Math.sin(Math.abs(ca)) * Math.abs(Math.sin(t));
  };
  return {
    L_1, L_2, H_min, H_max: H_min + p.Stroke, TopofCylinder, A, pistonTop,
    Vol: th => A * (pistonTop(th) - TopofCylinder) * 1e-9,
    ClearanceVol: A * H_min * 1e-9,
    Displacement: A * p.Stroke * 1e-6,                        // litros
  };
}

// Integra las cuatro carreras sin alterar los registros termodinámicos.
function integrateCycleWork4(rows, p) {
  const m_power = rows[179].m;
  const s_power = AIR.sTv(p.T_max, rows[179].v);
  const v_start = rows[180].Vol / m_power;
  const P_power_start = AIR.P(AIR.T_sv(s_power, v_start), v_start);
  const work = { W_admission: 0, W_compression: 0, W_power: 0, W_exhaust: 0 };

  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    let Pa = a.P, Pb = b.P;
    // Los saltos de presión son verticales (dV = 0): no aportan trabajo.
    // La expansión comienza en el estado posterior al calor isócoro.
    if (a.theta === 360) Pa = P_power_start;
    // El escape comienza después de la caída isócora de presión.
    if (a.theta === 540) Pa = p.P_exhaust;
    // El escape termina antes de cambiar a la presión de admisión.
    if (b.theta === 720) Pb = p.P_exhaust;
    const key = b.theta <= 180 ? 'W_admission' : b.theta <= 360 ? 'W_compression' : b.theta <= 540 ? 'W_power' : 'W_exhaust';
    work[key] += (Pa + Pb) / 2 * (b.Vol - a.Vol);
  }
  work.W_gross = work.W_compression + work.W_power;
  work.W_pumping = work.W_admission + work.W_exhaust;
  work.W_net = work.W_gross + work.W_pumping;
  return work;
}

function runModel4(p) {
  const Ai = AIR, g = geometry4(p);
  const N = 720 / DTHETA + 1;
  const tab = new Array(N).fill(null);
  const tv = (row, key) => tab[row - 1] ? tab[row - 1][key] : NaN;

  function otto(theta, Vol, loop) {
    let th = theta;
    if (th >= 720) th -= 720;
    let st = 'Intake';
    if (th > 180) st = 'Compression';
    if (th > 360) st = 'Power';
    if (th > 540) st = 'Exhaust';
    let m, T, P, u, v, s;
    if (st === 'Intake') {
      P = p.P_intake;
      const T_exhaust = loop > 1 ? tv(360, 'T') : p.T_exh0;
      const m_clearance = g.ClearanceVol / Ai.v(T_exhaust, P);
      const m_in = (Vol - g.ClearanceVol) / Ai.v(p.T_in, P);
      m = m_clearance + m_in;
      T = P * (Vol / m) / Ai.R;          // Temperature(Air,P=P,v=Vol/m)
      u = Ai.u(T); v = Ai.v(T, P); s = Ai.sTP(T, P);
    } else if (st === 'Compression') {
      s = Ai.sTP(tv(91, 'T'), tv(91, 'P'));
      m = tv(91, 'm'); v = Vol / m;
      T = Ai.T_sv(s, v); P = Ai.P(T, v); u = Ai.u(T);
    } else if (st === 'Power') {
      s = Ai.sTv(p.T_max, tv(180, 'v'));
      m = tv(180, 'm'); v = Vol / m;
      T = Ai.T_sv(s, v); P = Ai.P(T, v); u = Ai.u(T);
    } else {
      P = p.P_exhaust;
      s = tv(270, 's');
      T = Ai.T_sP(s, P); v = Ai.v(T, P); m = Vol / v; u = Ai.u(T); s = Ai.sTP(T, P);
    }
    return { m, T, P, u, v, s, Stroke: st };
  }

  // procedure CycleAnalysis(TableRun#)
  function cycle(R, loop) {
    let Wc = 0, Wp = 0, eff = 0, m = 1;
    if (R > 91 || loop > 1) m = tv(91, 'm');
    if (R > 180 || loop > 1) Wc = m * (tv(91, 'u') - tv(180, 'u'));
    if (R > 270 || loop > 1) Wp = m * (tv(182, 'u') - tv(270, 'u'));
    if (R > 270 || loop > 1) eff = (Wp + Wc) / (m * (tv(182, 'u') - tv(181, 'u')));
    return { W_compression: Wc, W_power: Wp, Efficiency: eff };
  }

  for (let loop = 1; loop <= p.loops; loop++) {
    for (let i = 0; i < N; i++) {
      const theta = i * DTHETA;
      const Vol = g.Vol(theta);
      const row = { theta, Vol, ...otto(theta, Vol, loop) };
      tab[i] = row;
      Object.assign(row, cycle(i + 1, loop));
      row.Power = (row.W_compression + row.W_power) * p.RPM / 2 / 60;
    }
  }
  const last = tab[N - 1];
  const m = tv(91, 'm');
  const work = integrateCycleWork4(tab, p);
  const Q_in = m * (tv(182, 'u') - tv(181, 'u'));
  return {
    rows: tab, g,
    summary: {
      Efficiency: work.W_net / Q_in, Power: work.W_net * p.RPM / 2 / 60, Displacement: g.Displacement,
      ...work,
      Q_in, m,
      P_max: Math.max(...tab.map(r => r.P)),
      eta_otto: 1 - Math.pow(p.CompressionRatio, -0.4),
    },
  };
}



/* ===================== Interfaz 4 tiempos ===================== */
