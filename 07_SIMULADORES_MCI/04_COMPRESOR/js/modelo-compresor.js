
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

/* ===================== Compresor de aire ===================== */
const DEFAULTSC = {
  V_tank: 0.15, P_o: 400, T_o: 300, DELTAP: 0.5, P_relief: 1200,
  ClearanceRatio: 0.03, N_cyl: 4, RPM: 3000, cycles: 150,
  Stroke: 75, Bore: 130, L_2: 110, P_supply: 101.3,
};
const NROWS = 361; // tabla 'Compressor': θ = 0..360° en pasos de 1°

function geometryC(p) {
  const L_1 = p.Stroke / 2, L_2 = p.L_2;
  const H_min = p.ClearanceRatio * p.Stroke;           // ClearanceRatio = ClearanceVol/Displacement
  const TopofCylinder = 70 + L_2 - L_1 - H_min;
  const A = Math.PI * p.Bore ** 2 / 4;
  const pistonTop = th => {
    const t = th * Math.PI / 180, ca = -Math.asin(L_1 / L_2 * Math.sin(t));
    return 70 + L_2 * Math.cos(-ca) - L_1 * Math.cos(t) + L_1 * Math.sin(Math.abs(ca)) * Math.abs(Math.sin(t));
  };
  return {
    L_1, L_2, H_min, TopofCylinder, A, pistonTop,
    Vol: th => A * (pistonTop(th) - TopofCylinder) * 1e-9,
    Displacement: A * p.Stroke * 1e-9,
    ClearanceVol: A * H_min * 1e-9,
  };
}

function runModelC(p, onProgress) {
  const Ai = AIR, R = Ai.R, g = geometryC(p);
  const T_supply = p.T_o, P_in = p.P_supply - p.DELTAP;
  const loops = p.cycles + 1;            // un loop extra para cerrar el resumen del último ciclo
  const cyclesTab = [];                  // tabla 'Compressor' de cada ciclo
  const results = [];                    // Lookup 'Results'
  let prev = null;                       // tabla del loop anterior

  const closedValves = (m1, P1, T1, V1, V2) => {
    const u1 = Ai.u(T1);
    const f = T2 => { const P2 = P1 * V1 * T2 / (V2 * T1); return m1 * (Ai.u(T2) - u1) + (P1 + P2) / 2 * (V2 - V1); };
    let T = T1, T0 = T1 * 1.01, f0 = f(T0), f1 = f(T);
    for (let i = 0; i < 50 && Math.abs(f1) > 1e-14; i++) { const Tn = T - f1 * (T - T0) / (f1 - f0); T0 = T; f0 = f1; T = Tn; f1 = f(T); }
    const P2 = P1 * V1 * T / (V2 * T1);
    return { m: m1, P: P2, T, W: (P1 + P2) / 2 * (V2 - V1) };
  };
  const intakeOpen = (m1, T1, V1, V2) => {
    const m_in = (V2 - V1) / Ai.v(T_supply, P_in);
    const m2 = m1 + m_in, W = p.P_supply * (V2 - V1);
    const T2 = Ai.T_u((Ai.h(T_supply) * m_in - W + m1 * Ai.u(T1)) / m2);
    return { m: m2, P: P_in, T: T2, m_in, W };
  };
  const exhaustOpen = (m1, T1, V2, P_tank) => {
    const P2 = P_tank + p.DELTAP, T2 = T1, m2 = V2 / Ai.v(T2, P2), dm = m1 - m2;
    return { m: m2, P: P2, T: T2, dm, W: -dm * R * T1 };
  };

  for (let loop = 1; loop <= loops; loop++) {
    // procedure InitialConditions
    const P_tank_o = loop <= 1 ? p.P_o : prev[NROWS - 1].P_tank;
    const T_tank_o = loop <= 1 ? p.T_o : prev[NROWS - 1].T_tank;
    const m_tank_o = P_tank_o * p.V_tank / (R * T_tank_o);
    const U_tank_o = m_tank_o * Ai.u(T_tank_o);
    // procedure CycleSummary
    const eta_volumetric = loop <= 1 ? 0 : prev[NROWS - 1].m_in_cycle / (g.Displacement / Ai.v(T_supply, p.P_supply));
    const tab = [];
    for (let i = 0; i < NROWS; i++) {
      const theta = i, Vol = g.Vol(theta), run = i + 1;
      const last = tab[i - 1];
      // estado del tanque con las integrales (trapecio en θ)
      const tank = (m_out, T) => {
        const dU = Ai.h(T) * p.N_cyl * m_out;
        const m_tank = m_tank_o + (last ? last.I_mout + (p.N_cyl * m_out + p.N_cyl * last.m_out) / 2 : 0);
        const U_tank = U_tank_o + (last ? last.I_dU + (dU + last.dU) / 2 : 0);
        const T_tank = Ai.T_u(U_tank / m_tank);
        return { dU, m_tank, U_tank, T_tank, P_tank: Math.min(p.P_relief, m_tank * R * T_tank / p.V_tank) };
      };
      // procedure MassInOut (P_tank es implícito: se itera)
      const massInOut = P_tank => {
        let s = { m_in: 0, m_out: 0, W: 0, IV: false, EV: false };
        if (run === 1) {
          if (loop <= 1) {
            s.P = p.P_o;
            s.T = T_supply * Math.exp(R / Ai.cp(T_supply) * Math.log(p.P_o / p.P_supply));
          } else { s.P = prev[NROWS - 1].P; s.T = prev[NROWS - 1].T; }
          s.m = s.P * Vol / (R * s.T);
        } else {
          const { Vol: V1, m: m1, P: P1, T: T1 } = last;
          Object.assign(s, closedValves(m1, P1, T1, V1, Vol));
          if (s.P < P_in) { Object.assign(s, intakeOpen(m1, T1, V1, Vol)); s.IV = true; }
          if (s.P > P_tank + p.DELTAP) {
            const e = exhaustOpen(m1, T1, Vol, P_tank);
            Object.assign(s, { m: e.m, T: e.T, W: e.W, m_out: e.dm, P: P_tank, EV: true });
          }
        }
        return s;
      };
      let P_tank = last ? last.P_tank : P_tank_o, s, t;
      for (let it = 0; it < 60; it++) {
        s = massInOut(P_tank);
        t = tank(s.m_out, s.T);
        if (Math.abs(t.P_tank - P_tank) < 1e-9) break;
        P_tank = t.P_tank;
      }
      s = massInOut(t.P_tank);
      const row = { theta, Vol, ...s, ...t };
      row.P_tank = t.P_tank;
      row.I_mout = row.m_tank - m_tank_o;
      row.I_dU = row.U_tank - U_tank_o;
      row.W_cycle = last ? last.W_cycle + (s.W + last.W) / 2 : 0;
      row.m_in_cycle = last ? last.m_in_cycle + (s.m_in + last.m_in) / 2 : 0;
      row.relief = row.P_tank >= p.P_relief;
      row.eta_volumetric = eta_volumetric;
      tab.push(row);
    }
    // procedure OutputResults (fila Loop-1 del Lookup 'Results', escrita en la corrida 1 del loop siguiente)
    if (loop > 1) {
      const r1 = tab[0];
      results.push({
        Cycle: loop - 1, P_tank: r1.P_tank, T_tank: r1.T_tank, eta_volumetric,
        Power: Math.abs(prev[NROWS - 1].W_cycle) * p.N_cyl * p.RPM / 60,
        m_tank: r1.P_tank * p.V_tank / (R * r1.T_tank),
        W_cycle: prev[NROWS - 1].W_cycle, m_in_cycle: prev[NROWS - 1].m_in_cycle,
      });
    }
    if (loop <= p.cycles) cyclesTab.push(tab);
    prev = tab;
  }
  return { cycles: cyclesTab, results, g };
}

/* Compresor ideal periódico independiente; trabajo en kJ, masa en kg. */
const DEFAULTSC_IDEAL = {
  Stroke: 75, Bore: 130, L_2: 110, ClearanceRatio: 0.03,
  P_admision: 101.3, P_descarga: 600, T_admision: 300,
  RPM: 3000, N_cyl: 1, DELTAP: 0,
};

function runModelC_ideal(parameters = {}, { integrationStep = 1 } = {}) {
  const p = { ...DEFAULTSC_IDEAL, ...parameters };
  for (const key of Object.keys(DEFAULTSC_IDEAL)) {
    if (!Number.isFinite(p[key])) throw new Error(`Parámetro no finito: ${key}`);
  }
  if (!(p.P_admision > 0 && p.P_descarga > p.P_admision &&
        p.T_admision >= 100 && p.T_admision < 6000 && p.RPM > 0 &&
        p.Stroke > 0 && p.Bore > 0 && p.L_2 > p.Stroke / 2 &&
        p.ClearanceRatio > 0 && p.N_cyl === 1 && p.DELTAP === 0)) {
    throw new Error('Parámetros incompatibles con el compresor ideal monocilíndrico.');
  }
  if (!(Number.isFinite(integrationStep) && integrationStep >= 0.001 && integrationStep <= 1)) {
    throw new Error('Paso interno de integración fuera de [0.001, 1] grados.');
  }
  const g = geometryC(p), Pa = p.P_admision, Pd = p.P_descarga, Ta = p.T_admision;
  const entropy = AIR.sTP(Ta, Pa), Td = AIR.T_sP(entropy, Pd);
  if (!(Td > 0 && Td < 6000) || Math.abs(AIR.sTP(Td, Pd) - entropy) > 1e-9) {
    throw new Error('No convergió el estado isentrópico de descarga.');
  }
  const va = AIR.v(Ta, Pa), vd = AIR.v(Td, Pd);
  const Vmin = g.Vol(0), Vmax = g.Vol(180);
  const mA = Vmin / vd, mC = Vmax / va;
  const VB = mA * va, VD = mC * vd;
  if (!(Vmin < VB && VB < Vmax && Vmin < VD && VD < Vmax && mC > mA)) {
    throw new Error('La relación de presiones no permite admisión y descarga en esta geometría.');
  }
  const angleAtVolume = (volume, lo, hi, increasing) => {
    for (let i = 0; i < 80 && hi - lo > 1e-11; i++) {
      const mid = (lo + hi) / 2;
      if ((g.Vol(mid) < volume) === increasing) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const theta_B = angleAtVolume(VB, 0, 180, true);
  const theta_D = angleAtVolume(VD, 180, 360, false);
  const state = (theta, process) => {
    const Vol = g.Vol(theta);
    let T, P, m;
    if (process === 'BC') { T = Ta; P = Pa; m = Vol / va; }
    else if (process === 'DA') { T = Td; P = Pd; m = Vol / vd; }
    else {
      m = process === 'AB' ? mA : mC;
      T = AIR.T_sv(entropy, Vol / m);
      P = m * AIR.R * T / Vol;
    }
    const s = AIR.sTP(T, P);
    if (!(T > 0 && P > 0 && m > 0 && Number.isFinite(s)) || Math.abs(s - entropy) > 1e-9) {
      throw new Error(`Estado termodinámico inválido en ${theta} grados.`);
    }
    return { theta, Vol, P, T, m, u: AIR.u(T), s,
      IV: process === 'BC', EV: process === 'DA', process };
  };
  const processes = [
    { name: 'AB', lo: 0, hi: theta_B },
    { name: 'BC', lo: theta_B, hi: 180 },
    { name: 'CD', lo: 180, hi: theta_D },
    { name: 'DA', lo: theta_D, hi: 360 },
  ];
  // Cada intervalo de la trayectoria se integra una vez, incluidos B y D exactos.
  const works = {}, energyResiduals = {};
  for (const process of processes) {
    const first = state(process.lo, process.name);
    let last = first, W = 0;
    const count = Math.ceil((process.hi - process.lo) / integrationStep);
    for (let i = 1; i <= count; i++) {
      const next = state(Math.min(process.hi, process.lo + i * integrationStep), process.name);
      W += (last.P + next.P) / 2 * (next.Vol - last.Vol);
      last = next;
    }
    works[`W_${process.name}`] = W;
    const dmIn = process.name === 'BC' ? last.m - first.m : 0;
    const dmOut = process.name === 'DA' ? first.m - last.m : 0;
    energyResiduals[process.name] = last.m * last.u - first.m * first.u + W
      - dmIn * AIR.h(Ta) + dmOut * AIR.h(Td);
  }
  const rows = [];
  const admitted = theta => (g.Vol(Math.min(180, Math.max(theta_B, theta))) - VB) / va;
  const discharged = theta => (VD - g.Vol(Math.min(360, Math.max(theta_D, theta)))) / vd;
  for (let theta = 0; theta <= 360; theta++) {
    const process = theta < theta_B ? 'AB' : theta <= 180 ? 'BC' : theta < theta_D ? 'CD' : 'DA';
    const row = state(theta, process);
    row.m_in = theta ? admitted(theta) - admitted(theta - 1) : 0;
    row.m_out = theta ? discharged(theta) - discharged(theta - 1) : 0;
    row.m_in_cycle = admitted(theta);
    row.m_out_cycle = discharged(theta);
    if (row.m_in < 0 || row.m_out < 0) throw new Error('Flujo inverso en una válvula ideal.');
    rows.push(row);
  }
  const m_admitida = mC - mA, m_descargada = discharged(360);
  const W_cycle = works.W_AB + works.W_BC + works.W_CD + works.W_DA;
  const W_abs = -W_cycle;
  if (!(W_abs > 0)) throw new Error('Signo incorrecto del trabajo absorbido.');
  const summary = {
    W_cycle, W_abs, Power: W_abs * p.RPM / 60,
    eta_volumetric: m_admitida * va / g.Displacement,
    P_admision: Pa, P_descarga: Pd, T_descarga: Td, pressure_ratio: Pd / Pa,
    m_admitida, m_descargada, ...works, theta_B, theta_D,
    W_abs_enthalpy: m_admitida * (AIR.h(Td) - AIR.h(Ta)),
    energyResiduals, integrationStep,
  };
  return { rows, summary, g };
}
