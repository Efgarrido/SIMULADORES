
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

/* ===================== Modelo del motor ===================== */
const DEFAULTS = {
  CompressionRatio: 9, RPM: 3000, T_max: 2500, V_max_L: 0.5, dtheta: 2, loops: 3,
  CompressionStart: 256, ExhaustOpen: 104, IntakeOpen: 114, ExhaustEnd: 256,
  P_blowdown: 110, P_exhaust: 100, P_in: 90, T_in: 300, T_cs0: 335,
};

function runModel(p) {
  const A = AIR, R = A.R;
  const D = p.dtheta;
  const N = Math.round(360 / D) + 1;
  const V_max = p.V_max_L * 1e-3;
  const V_min = V_max / p.CompressionRatio;
  const T_max = p.T_max;
  const tab = new Array(N).fill(null);

  // TableValue('2-stroke', fila, col) — fila 1-based, interpolación si no es entera
  const tv = (row, key) => {
    const r0 = Math.floor(row + 1e-9), f = row - r0;
    const a = tab[r0 - 1];
    if (!a) return NaN;
    if (f < 1e-9) return a[key];
    const b = tab[r0];
    return b ? a[key] + f * (b[key] - a[key]) : a[key];
  };

  function otto(angle, Vol, loop) {
    let ang = angle;
    if (ang >= 359.9) ang -= 360;
    let st = 'Power';
    if (ang > p.ExhaustOpen) st = 'Exhaust';
    if (ang > p.IntakeOpen) st = 'Intake';
    if (ang > p.CompressionStart) st = 'Compression';
    let m, T, P, u, v, s, Q_in = 1;
    const rCS = p.CompressionStart / D, rEO = p.ExhaustOpen / D, rIO = p.IntakeOpen / D;

    if (st === 'Power') {
      const T_cs = loop > 1 ? tv(rCS, 'T') : p.T_cs0;
      m = V_max / A.v(T_cs, 101.3);
      s = A.sTv(T_max, V_min / m);
      v = Vol / m;
      T = A.T_sv(s, v);
      P = A.P(T, v);
      u = A.u(T);
      Q_in = m * (A.u(T_max) - A.u(T_cs));
    } else if (st === 'Exhaust') {
      P = p.P_blowdown;
      s = tv(rEO, 's');
      T = A.T_sP(s, P);
      v = A.v(T, P);
      m = Vol / v;
      u = A.u(T);
      s = A.sTP(T, P);
    } else if (st === 'Intake') {
      const T_ex = tv(rIO, 'T');
      const Vol_ex = tv(rIO, 'Vol');
      const m_cg = Vol_ex / tv(rIO, 'v');
      const m_out = m_cg * 0.9 * (ang - p.IntakeOpen) / (p.ExhaustEnd - p.IntakeOpen);
      const V_out = m_out * R * T_ex / p.P_exhaust;
      const m_air = p.P_in * (Vol - Vol_ex + V_out) / (R * p.T_in);
      m = m_air - m_out + m_cg;
      u = (m_air * A.h(p.T_in) - m_out * A.h(T_ex) + m_cg * A.u(T_ex)) / m;
      T = A.T_u(u);
      v = Vol / m;
      P = A.P(T, v);
      s = A.sTP(T, P);
    } else {
      s = A.sTP(tv(rCS, 'T'), tv(rCS, 'P'));
      m = tv(rCS, 'm');
      v = Vol / m;
      T = A.T_sv(s, v);
      P = A.P(T, v);
      u = A.u(T);
    }
    return { m, T, P, u, v, s, Stroke: st, Q_in };
  }

  // function Work(Angle): integra P·dV de la fila 2 a TableRun#
  function work(angle, run) {
    let W = 0;
    if (angle > 355) {
      for (let i = 2; i <= run; i++) {
        const Pm = (tab[i - 1].P + tab[i - 2].P) / 2;
        const dV = tab[i - 1].Vol - tab[i - 2].Vol;
        W += Pm * dV;
      }
    }
    return W;
  }

  for (let loop = 1; loop <= p.loops; loop++) {
    for (let i = 0; i < N; i++) {
      const theta = i * D;
      const Vol = V_min + (V_max - V_min) * Math.abs(Math.sin((theta / 2) * Math.PI / 180));
      const r = otto(theta, Vol, loop);
      const row = { theta, Vol, ...r };
      tab[i] = row;
      row.W = work(theta, i + 1);
      row.Efficiency = row.W / row.Q_in;
    }
  }
  const last = tab[N - 1];
  const k = 1.4;
  return {
    rows: tab, V_min, V_max,
    summary: {
      Q_in: last.Q_in, W: last.W, Power: last.W * p.RPM / 60, Efficiency: last.Efficiency, m: last.m,
      P_max: Math.max(...tab.map(r => r.P)), T_max,
      eta_otto: 1 - Math.pow(p.CompressionRatio, 1 - k),
    },
  };
}





/* ===================== Interfaz ===================== */
