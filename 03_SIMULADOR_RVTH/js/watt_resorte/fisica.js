/* =====================================================================
 * fisica.js — Dinámica del regulador centrífugo con resorte (1 GDL)
 * ---------------------------------------------------------------------
 * Coordenada generalizada: s = elevación del manguito desde el tope
 * inferior [m] (la misma s del módulo Watt v3; 0 ≤ s ≤ 0.098 m).
 * Velocidad del husillo Ω impuesta (no hay reacción sobre el eje).
 *
 * Lagrangiano (bolas puntuales de masa m a radio r(s) y altura yB(s),
 * manguito m_c, brazos sin masa):
 *   T = ½·M(s)·ṡ² + m·r²·Ω²            M(s) = 2m(r'² + yB'²) + m_c + m_res/3
 *   V = 2m·g·yB + m_cg·g·s + E_res(s, a)
 * Ecuación de movimiento:
 *   M·s̈ + ½·M'·ṡ² = 2m·r·r'·Ω² − 2m·g·yB' − m_cg·g − F_L − F_res(s, a) − c·ṡ
 * F_L = carga del mando sobre el collar (P.mando.cargaVarillaje, ASUMIDA 0).
 * F_res = k·(L0 − L) si L < L0 (si no, 0); L = y_asiento − y_cara_sup_platillo
 * (apoyos reales, RW.AjusteGeo.apoyos).
 * La elevación NO se impone: resulta de integrar esta ecuación (RK4, paso
 * fijo). Topes inelásticos en s = 0 y s = sMax.
 *
 * r(s), yB(s) se obtienen de RW.Cinematica.resolver (sin cambios) y se
 * tabulan cada 0.05 mm; derivadas por diferencias finitas sobre la tabla.
 * ===================================================================== */
(function (RW) {
  'use strict';

  const P = RW.PARAM, G = RW.GEOMETRIA, C = RW.Cinematica;
  const g = P.g;
  const m = P.masas.bola;
  const mc = P.masas.manguito;
  const R = P.resorte;
  const Mfija = mc + R.masa / 3;           // masa equivalente del manguito + 1/3 del resorte
  const mcg = mc + R.masa / 2;             // peso que carga el manguito (mitad del resorte)
  const SMAX = C.LIMITES.sMax / 1000;      // m

  /* ---------------- Tabla geométrica ---------------- */
  const H = 0.05;                          // mm
  const N = Math.round(C.LIMITES.sMax / H);
  const tr = new Float64Array(N + 1), ty = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const e = C.resolver(i * H);
    tr[i] = e.derecho.centroMasa.x / 1000;   // m
    ty[i] = e.derecho.centroMasa.y / 1000;   // m
  }
  const h = H / 1000;
  function d1(t, i) {                       // derivada 1ª (2.º orden, también en bordes)
    if (i === 0) return (-3 * t[0] + 4 * t[1] - t[2]) / (2 * h);
    if (i === N) return (3 * t[N] - 4 * t[N - 1] + t[N - 2]) / (2 * h);
    return (t[i + 1] - t[i - 1]) / (2 * h);
  }
  const trp = new Float64Array(N + 1), typ = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) { trp[i] = d1(tr, i); typ[i] = d1(ty, i); }
  const trpp = new Float64Array(N + 1), typp = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) { trpp[i] = d1(trp, i); typp[i] = d1(typ, i); }

  /** Geometría interpolada en s [m]. */
  function geo(s) {
    const u = Math.min(N, Math.max(0, s / h));
    const i = Math.min(N - 1, Math.floor(u)), f = u - i;
    const L = (t) => t[i] + f * (t[i + 1] - t[i]);
    return { r: L(tr), yB: L(ty), rp: L(trp), yp: L(typ), rpp: L(trpp), ypp: L(typp) };
  }

  /* ---------------- Resorte y ajuste ---------------- */
  const AJ = P.ajuste;
  // Apoyos reales del resorte (cara superior del platillo inferior y cara
  // inferior del asiento): definición única en js/ajuste_geometria.js.
  const yAsiento = (a) => RW.AjusteGeo.yAsiento(a) / 1000;          // a en mm → m
  function longitudResorte(s, a) { return RW.AjusteGeo.apoyos(s * 1000, a).L / 1000; }
  function fuerzaResorte(s, a) {
    const c = R.L0 - longitudResorte(s, a);
    return c > 0 ? R.k * c : 0;
  }

  /* ---------------- Transmisión (derivada) ---------------- */
  const omega2Eq = (s, a, FL = P.mando.cargaVarillaje) => {
    const q = geo(s);
    return (2 * m * g * q.yp + mcg * g + FL + fuerzaResorte(s, a)) / (2 * m * q.r * q.rp);
  };
  const i_trans = Math.sqrt(omega2Eq(P.transmision.sDiseno / 1000, AJ.inicial)) /
                  (P.transmision.nDiseno * 2 * Math.PI / 60);
  const omegaDesdeN = (n) => i_trans * n * 2 * Math.PI / 60;
  const nDesdeOmega = (w) => w / (i_trans * 2 * Math.PI / 60);

  /** Velocidad del eje [rpm] de equilibrio para s [m] y ajuste a [mm]. */
  function nEquilibrio(s, a) { return nDesdeOmega(Math.sqrt(Math.max(0, omega2Eq(s, a)))); }

  /** n de equilibrio con una carga de mando F_L [N] distinta de la nominal. */
  function nEquilibrioConCarga(s, a, FL) { return nDesdeOmega(Math.sqrt(Math.max(0, omega2Eq(s, a, FL)))); }

  /** s de equilibrio estático [m] para n [rpm] y ajuste a [mm] (con topes). */
  function sEquilibrio(n, a) {
    if (nEquilibrio(0, a) >= n) return 0;
    if (nEquilibrio(SMAX, a) <= n) return SMAX;
    let lo = 0, hi = SMAX;
    for (let k = 0; k < 60; k++) { const md = (lo + hi) / 2; if (nEquilibrio(md, a) < n) lo = md; else hi = md; }
    return (lo + hi) / 2;
  }

  /* ---------------- Fuerzas generalizadas ---------------- */
  function fuerzas(s, v, n, a) {
    const q = geo(s), W = omegaDesdeN(n);
    const M = 2 * m * (q.rp ** 2 + q.yp ** 2) + Mfija;
    const Mp = 4 * m * (q.rp * q.rpp + q.yp * q.ypp);
    const Fc = 2 * m * q.r * q.rp * W * W;          // centrífuga reducida a s
    const Fg = 2 * m * g * q.yp + mcg * g;          // gravedad reducida a s
    const FL = P.mando.cargaVarillaje;                // carga del mando (asumida 0)
    const Fr = fuerzaResorte(s, a);
    const Fd = P.amortiguamiento.c * v;
    const Fv = 0.5 * Mp * v * v;
    return { M, Fc, Fg, Fr, Fd, Fv, FL, neta: Fc - Fg - FL - Fr - Fd - Fv,
             centrifugaBola: m * q.r * W * W, r: q.r, yB: q.yB, W };
  }

  /* ---------------- Estado e integración ---------------- */
  function crearEstado() {
    return { t: 0, s: 0, v: 0, n: 0, nConsigna: 0, a: AJ.inicial, motor: 0, tope: 'inferior',
             fc: { lento: false, rapido: false }, reaccionTope: 0 };
  }

  function acel(s, v, n, a) { const f = fuerzas(s, v, n, a); return f.neta / f.M; }

  /** Avanza un paso fijo dt [s]. */
  function paso(e, dt) {
    // velocidad del eje: rampa hacia la consigna (ensayo con velocidad impuesta)
    const dn = P.ensayo.rampa * dt;
    e.n += Math.max(-dn, Math.min(dn, e.nConsigna - e.n));

    // motor del ajuste con finales de carrera
    if (e.motor !== 0) {
      e.a += e.motor * AJ.velocidadMotor * dt;
    }
    if (e.a <= 0) { e.a = 0; if (e.motor < 0) e.motor = 0; }
    if (e.a >= AJ.recorrido) { e.a = AJ.recorrido; if (e.motor > 0) e.motor = 0; }
    e.fc.lento = e.a <= 1e-9;
    e.fc.rapido = e.a >= AJ.recorrido - 1e-9;

    // RK4 sobre (s, v) con n y a congelados durante el paso
    const n = e.n, a = e.a;
    const k1s = e.v, k1v = acel(e.s, e.v, n, a);
    const k2s = e.v + 0.5 * dt * k1v, k2v = acel(e.s + 0.5 * dt * k1s, k2s, n, a);
    const k3s = e.v + 0.5 * dt * k2v, k3v = acel(e.s + 0.5 * dt * k2s, k3s, n, a);
    const k4s = e.v + dt * k3v, k4v = acel(e.s + dt * k3s, k4s, n, a);
    let s = e.s + dt / 6 * (k1s + 2 * k2s + 2 * k3s + k4s);
    let v = e.v + dt / 6 * (k1v + 2 * k2v + 2 * k3v + k4v);

    // topes inelásticos
    e.tope = null; e.reaccionTope = 0;
    if (s <= 0) { s = 0; if (v < 0) v = 0; }
    if (s >= SMAX) { s = SMAX; if (v > 0) v = 0; }
    if (s === 0) {
      const f = fuerzas(0, 0, n, a);
      if (f.neta <= 0) { v = 0; e.tope = 'inferior'; e.reaccionTope = -f.neta; }
    } else if (s === SMAX) {
      const f = fuerzas(SMAX, 0, n, a);
      if (f.neta >= 0) { v = 0; e.tope = 'superior'; e.reaccionTope = f.neta; }
    }
    e.s = s; e.v = v; e.t += dt;
  }

  /** Simula `duracion` segundos con el paso fijo. */
  function simular(e, duracion, dt = P.ensayo.dt) {
    const pasos = Math.round(duracion / dt);
    for (let k = 0; k < pasos; k++) paso(e, dt);
    return e;
  }

  /** Magnitudes derivadas para lecturas y dibujo. */
  function lecturas(e) {
    const f = fuerzas(e.s, e.v, e.n, e.a);
    const sMm = e.s * 1000;
    const RV = P.rvth;
    const yAmm = C.LIMITES.yPMin + sMm + G.salida.dyDesdePivote;   // mm (módulo)
    const L = longitudResorte(e.s, e.a);
    return {
      sMm, vMm: e.v * 1000, n: e.n, nHusillo: e.n * i_trans,
      a: e.a, yAsientoMm: yAsiento(e.a) * 1000, apoyos: RW.AjusteGeo.apoyos(sMm, e.a),
      Fres: f.Fr, Fc: f.Fc, Fg: f.Fg, centrifugaBola: f.centrifugaBola,
      precarga: fuerzaResorte(0, e.a),                // fuerza con el manguito en el tope inferior
      Lres: L * 1000, compresion: (R.L0 - L) * 1000, holguraSolida: (L - R.Lsolida) * 1000,
      r: f.r * 1000, yB: f.yB * 1000,
      tope: e.tope, reaccionTope: e.reaccionTope,
      A: { xMm: RV.orejaA / RV.escala, yMm: yAmm,
           xRvth: RV.xA, yRvth: RV.origenWatt.y - RV.escala * yAmm },
      nRef: nEquilibrio(P.transmision.sDiseno / 1000, e.a),
      sEq: sEquilibrio(e.n, e.a) * 1000,
    };
  }

  RW.Fisica = Object.freeze({
    i: i_trans, SMAX, geo, fuerzas, fuerzaResorte, longitudResorte, yAsiento,
    nEquilibrio, nEquilibrioConCarga, sEquilibrio, omegaDesdeN, nDesdeOmega,
    crearEstado, paso, simular, lecturas,
    masaEquivalente: (s) => { const q = geo(s); return 2 * m * (q.rp ** 2 + q.yp ** 2) + Mfija; },
  });
})(window.RW = window.RW || {});
