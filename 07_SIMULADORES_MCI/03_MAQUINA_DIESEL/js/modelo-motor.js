
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

/* ===================== Modelo Diesel ===================== */
const DEFAULTSD = {
  CompressionRatio: 18, RPM: 3000, CutoffRatio: 2, loops: 2,
  Stroke: 75, Bore: 130, L_2: 110, P_intake: 95, T_in: 300, T_exh0: 710, P_exhaust: 105,
};
const DTHETA = 2; // tabla 'Diesel': θ = 0..720° en pasos de 2° (361 corridas)

function geometryD(p) {
  const L_1 = p.Stroke / 2, L_2 = p.L_2;
  const H_min = p.Stroke / (p.CompressionRatio - 1);
  const TopofCylinder = 34 + L_2 - L_1 - H_min;
  const A = Math.PI * p.Bore ** 2 / 4;
  const pistonTop = th => {
    const t = th * Math.PI / 180;
    const ca = -Math.asin(L_1 / L_2 * Math.sin(t));
    return 34 + L_2 * Math.cos(-ca) - L_1 * Math.cos(t) + L_1 * Math.sin(-ca) * Math.sin(t);
  };
  const H = th => pistonTop(th) - TopofCylinder;
  // CutoffRatio = HH/H_min → se despeja CutOffTheta en la carrera de potencia (360..540°)
  const target = p.CutoffRatio * H_min;
  let a = 360, b = 540;
  if (!(target > H(360) && target <= H(540))) throw new Error('CutoffRatio fuera de rango para esta relación de compresión.');
  for (let i = 0; i < 80; i++) { const c = (a + b) / 2; (H(c) < target ? (a = c) : (b = c)); }
  return {
    L_1, L_2, H_min, TopofCylinder, A, pistonTop,
    Vol: th => A * H(th) * 1e-9,
    ClearanceVol: A * H_min * 1e-9,
    Displacement: A * p.Stroke * 1e-6,
    CutOffTheta: (a + b) / 2,
  };
}

function integrateCycleWorkD(rows, g, cutoffState, p) {
  const work = { W_admision: 0, W_compresion: 0,
    W_aporte: cutoffState.P * (cutoffState.Vol - g.Vol(360)),
    W_expansion: 0, W_escape: 0 };
  const trapezoid = (a, b) => (a.P + b.P) / 2 * (b.Vol - a.Vol);
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    if (b.theta <= 180) work.W_admision += trapezoid(a, b);
    else if (b.theta <= 360) work.W_compresion += trapezoid(a, b);
    else if (b.theta <= 540) {
      // El aporte ya se integró exactamente; la expansión parte del corte.
      if (b.theta > cutoffState.theta) {
        work.W_expansion += trapezoid(a.theta <= cutoffState.theta ? cutoffState : a, b);
      }
    } else {
      // Los cambios verticales de presión en 540° y 720° tienen dV = 0.
      const start = a.theta === 540 ? { P: p.P_exhaust, Vol: a.Vol } : a;
      const end = b.theta === 720 ? { P: p.P_exhaust, Vol: b.Vol } : b;
      work.W_escape += trapezoid(start, end);
    }
  }
  work.W_expansion_total = work.W_aporte + work.W_expansion;
  work.W_bruto = work.W_compresion + work.W_expansion_total;
  work.W_bombeo = work.W_admision + work.W_escape;
  work.W_neto = work.W_bruto + work.W_bombeo;
  return work;
}

function runModelD(p) {
  const Ai = AIR, g = geometryD(p);
  const CT = g.CutOffTheta;
  const CutoffFuel = Math.trunc(CT / 2 + 1);
  const N = 720 / DTHETA + 1;
  const tab = new Array(N).fill(null);
  let cutoffState = null;
  // TableValue: se usa la parte entera de la fila cuando no es entera
  const tv = (row, key) => { const a = tab[Math.floor(row + 1e-9) - 1]; return a ? a[key] : NaN; };

  function exactCutoffState(m, P) {
    const Vol = g.Vol(CT), v = Vol / m;
    const T = P * v / Ai.R;
    return { theta: CT, Vol, m, P, T, v, u: Ai.u(T), s: Ai.sTv(T, v) };
  }

  function diesel(theta, Vol, loop) {
    let th = theta;
    if (th >= 720) th -= 720;
    let st = 'Intake';
    if (th > 180) st = 'Compression';
    if (th > 360) st = 'Power';
    if (th > 540) st = 'Exhaust';
    const T_exhaust = loop > 1 ? tv(360, 'T') : p.T_exh0;
    let m, T, P, u, v, s;
    if (st === 'Intake') {
      P = p.P_intake;
      const m_clearance = g.ClearanceVol / Ai.v(T_exhaust, P);
      const m_in = (Vol - g.ClearanceVol) / Ai.v(p.T_in, P);
      m = m_clearance + m_in;
      T = P * (Vol / m) / Ai.R;
      u = Ai.u(T); v = Ai.v(T, P); s = Ai.sTP(T, P);
    } else if (st === 'Compression') {
      s = Ai.sTP(tv(90, 'T'), tv(90, 'P'));
      m = tv(90, 'm'); v = Vol / m;
      T = Ai.T_sv(s, v); P = Ai.P(T, v); u = Ai.u(T);
    } else if (st === 'Power') {
      m = tv(181, 'm'); P = tv(181, 'P');
      if (!cutoffState) cutoffState = exactCutoffState(m, P);
      if (th <= CT) {
        v = Vol / m; T = P * v / Ai.R; u = Ai.u(T); s = Ai.sTv(T, v);
        st = 'Fuel Input';
      } else {
        s = cutoffState.s; v = Vol / m;
        T = Ai.T_sv(s, v); P = Ai.P(T, v); u = Ai.u(T);
      }
    } else {
      P = p.P_exhaust;
      s = tv(270, 's');
      T = Ai.T_sP(s, P); v = Ai.v(T, P); m = Vol / v; u = Ai.u(T); s = Ai.sTP(T, P);
    }
    return { m, T, P, u, v, s, Stroke: st };
  }

  function cycle(R, loop) {
    let Wc = 0, Wp = 0, eff = 0, T_max = 0, m = 1, Q_in = 0;
    if (R > 92 || loop > 1) m = tv(92, 'm');
    if (R > 181 || loop > 1) Wc = m * (tv(91, 'u') - tv(181, 'u'));
    if (R > 270 || loop > 1) {
      Wp = m * (tv(CutoffFuel, 'u') - tv(270, 'u'));
      Wp += tv(182, 'P') * (tv(CT / 2 + 1, 'Vol') - tv(181, 'Vol'));
      const T1 = tv(181, 'T'), T2 = tv(CT / 2 + 1, 'T');
      Q_in = m * (Ai.h(T2) - Ai.h(T1));
      eff = (Wp + Wc) / Q_in;
      T_max = T2;
    }
    return { W_compression: Wc, W_power: Wp, Efficiency: eff, T_max, Q_in };
  }

  for (let loop = 1; loop <= p.loops; loop++) {
    cutoffState = null;
    for (let i = 0; i < N; i++) {
      const theta = i * DTHETA, Vol = g.Vol(theta);
      const row = { theta, Vol, ...diesel(theta, Vol, loop) };
      tab[i] = row;
      Object.assign(row, cycle(i + 1, loop));
      row.Power = (row.W_compression + row.W_power) * p.RPM / 2 / 60;
    }
  }
  const last = tab[N - 1], k = 1.4, r = p.CompressionRatio, rc = p.CutoffRatio;
  const work = integrateCycleWorkD(tab, g, cutoffState, p);
  return {
    rows: tab, g, cutoffState,
    summary: {
      Efficiency: work.W_neto / last.Q_in, Power: work.W_neto * p.RPM / 2 / 60, T_max: last.T_max, Displacement: g.Displacement,
      CutOffTheta: CT, ...work,
      W_compression: work.W_compresion, W_power: work.W_expansion_total,
      W_net: work.W_neto, Q_in: last.Q_in, m: tv(92, 'm'),
      P_max: Math.max(...tab.map(x => x.P)),
      eta_diesel: 1 - Math.pow(r, 1 - k) * (Math.pow(rc, k) - 1) / (k * (rc - 1)),
    },
  };
}



/* ===================== Interfaz Diesel ===================== */
