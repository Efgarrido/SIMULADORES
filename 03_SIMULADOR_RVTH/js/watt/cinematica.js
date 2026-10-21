/* =====================================================================
 * cinematica.js — Cálculo de posiciones (sin dibujo, sin tiempo)
 * ---------------------------------------------------------------------
 * VARIABLE INDEPENDIENTE: s = elevación del manguito [mm] desde su posición
 * más baja (apoyado en el tope inferior). s ∈ [0, sMax]; sMax lo fija el
 * tope superior.
 *
 * Cada lado se resuelve con SUS propios pivotes (versión 2):
 *     A —(L1)— E —(L2)— P
 *   A = pasador superior de ese lado en el cabezal (fijo en el plano),
 *   P = pivote del manguito de ese lado (conocido a partir de s),
 *   E = codo (incógnita) = intersección de las circunferencias (A, L1) y
 *       (P, L2), rama con el codo hacia fuera.
 *   La bola está en la prolongación A→E, a `distanciaCentro` de A.
 * Los dos lados se calculan por separado; la simetría se comprueba después
 * (no se impone copiando un lado en el otro).
 *
 * Funciones puras: no tocan el DOM.
 * ===================================================================== */
(function (RW) {
  'use strict';

  const G = RW.GEOMETRIA;
  const a = G.cabezal.separacionPivotes / 2;
  const yA = G.cabezal.alturaPivotes;

  const yPMin = G.topes.inferior.caraSuperior - G.manguito.caraInferior;
  const yPMax = G.topes.superior.caraInferior - G.manguito.caraSuperior;
  const LIMITES = Object.freeze({ sMin: 0, sMax: yPMax - yPMin, yPMin, yPMax });

  /** Convierte una entrada a número finito; devuelve NaN si no es válida. */
  function aNumeroFinito(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v.trim().replace(',', '.'));
      return Number.isFinite(n) ? n : NaN;
    }
    return NaN;
  }

  /** Intersección de circunferencias (C1, r1) y (C2, r2); signo = +1 rama
      exterior derecha (mayor x), −1 rama exterior izquierda (menor x). */
  function intersecar(C1, r1, C2, r2, signo) {
    const dx = C2.x - C1.x, dy = C2.y - C1.y;
    const d = Math.hypot(dx, dy);
    if (!(d > 0) || d > r1 + r2 || d < Math.abs(r1 - r2)) return null;
    const m = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, r1 * r1 - m * m));
    const ux = dx / d, uy = dy / d;
    const Mx = C1.x + m * ux, My = C1.y + m * uy;
    const p1 = { x: Mx - h * uy, y: My + h * ux };
    const p2 = { x: Mx + h * uy, y: My - h * ux };
    return (signo > 0) === (p1.x >= p2.x) ? p1 : p2;
  }

  function resolverLado(signo, yP) {
    const L1 = G.brazoSuperior.L, L2 = G.brazoInferior.L;
    const A = { x: signo * a, y: yA };
    const P = { x: signo * G.manguito.excentricidadPivote, y: yP };
    const E = intersecar(A, L1, P, L2, signo);
    if (!E) return null;
    const ux = (E.x - A.x) / L1, uy = (E.y - A.y) / L1; // dirección A→E
    const at = (d) => ({ x: A.x + ux * d, y: A.y + uy * d });
    const B = at(G.masa.distanciaCentro);
    const C = at(G.masa.distanciaCentro - G.masa.radio - G.masa.cuelloLongitud);

    // Ángulos (positivos hacia fuera), medidos respecto a la vertical
    const alfa = Math.atan2(signo * ux, -uy);               // brazo superior
    const beta = Math.atan2(signo * (E.x - P.x), E.y - P.y); // brazo inferior
    const v1 = { x: A.x - E.x, y: A.y - E.y }, v2 = { x: P.x - E.x, y: P.y - E.y };
    const anguloCodo = Math.acos(Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / (L1 * L2))));

    // Ángulos de dibujo (rotación SVG, grados, y hacia abajo en pantalla)
    const rotBrazoSup = Math.atan2(-uy, ux) * 180 / Math.PI;
    const rotBrazoInf = Math.atan2(-(E.y - P.y), E.x - P.x) * 180 / Math.PI;

    return { pivoteSuperior: A, codo: E, pivoteManguito: P, centroMasa: B, finBrazo: C,
             alfa, beta, anguloCodo, rotBrazoSup, rotBrazoInf };
  }

  /**
   * Resuelve la configuración para una elevación s. Lanza RangeError si s
   * no es un número finito (el llamador conserva entonces su último estado).
   * Fuera de [0, sMax] se limita al tope y se indica en `enTope`.
   */
  function resolver(sPedido) {
    const sNum = aNumeroFinito(sPedido);
    if (Number.isNaN(sNum)) throw new RangeError('Posición no válida: ' + String(sPedido));
    const s = Math.min(LIMITES.sMax, Math.max(LIMITES.sMin, sNum));
    const enTope = s <= LIMITES.sMin + 1e-9 ? 'inferior'
                 : s >= LIMITES.sMax - 1e-9 ? 'superior' : null;
    const yP = LIMITES.yPMin + s;

    const der = resolverLado(+1, yP), izq = resolverLado(-1, yP);
    if (!der || !izq) throw new Error('Configuración imposible para s = ' + s.toFixed(3));

    const B = der.centroMasa;
    const r = B.x;                       // radio de la masa, desde el EJE
    const alfa = der.alfa;
    // Altura del cono: vertical desde el centro de la bola hasta el punto
    // donde la PROLONGACIÓN del brazo superior corta el eje (vértice virtual).
    // Es la h de la relación del péndulo cónico h = g/ω² (r desde el eje).
    // Con pivote central coincidía con (yA − yB); con pivotes separados el
    // vértice queda POR ENCIMA de los pasadores: h = hPivote + a/tan α.
    const alturaCono = r / Math.tan(alfa);
    const yVertice = B.y + alturaCono;
    const alturaPivoteBola = der.pivoteSuperior.y - B.y; // dato geométrico auxiliar

    return {
      s, enTope,
      yPivoteManguito: yP,
      eje: { x: 0, y: 0 },
      derecho: der, izquierdo: izq,
      manguito: {
        yCaraSuperior: yP + G.manguito.caraSuperior,
        yCaraInferior: yP + G.manguito.caraInferior,
      },
      salida: { x: G.salida.x, y: yP + G.salida.dyDesdePivote, desplazamiento: s },
      alfa, beta: der.beta, anguloCodo: der.anguloCodo,
      radioMasa: r,
      alturaCono, yVertice, alturaPivoteBola,
    };
  }

  /** Mayor desviación (mm) respecto a las restricciones del mecanismo. */
  function residuos(est) {
    const L1 = G.brazoSuperior.L, L2 = G.brazoInferior.L, Lb = G.masa.distanciaCentro;
    const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
    const vals = [];
    for (const [sg, l] of [[+1, est.derecho], [-1, est.izquierdo]]) {
      const A = l.pivoteSuperior, E = l.codo, B = l.centroMasa, P = l.pivoteManguito;
      vals.push(
        Math.abs(dist(A, E) - L1),                         // longitud brazo superior
        Math.abs(dist(E, P) - L2),                         // longitud brazo inferior
        Math.abs(dist(A, B) - Lb),                         // distancia pivote–bola
        // colinealidad A–E–B: distancia de B a la recta AE
        Math.abs((E.x - A.x) * (B.y - A.y) - (E.y - A.y) * (B.x - A.x)) / L1,
        Math.max(0, -((E.x - A.x) * (B.x - A.x) + (E.y - A.y) * (B.y - A.y))), // B al mismo lado que E
        Math.abs(A.x - sg * a), Math.abs(A.y - yA),         // pasador superior en su sitio
        Math.abs(P.x - sg * G.manguito.excentricidadPivote),
        Math.abs(P.y - est.yPivoteManguito));
    }
    // simetría respecto al eje
    for (const k of ['pivoteSuperior', 'codo', 'pivoteManguito', 'centroMasa', 'finBrazo']) {
      vals.push(Math.abs(est.derecho[k].x + est.izquierdo[k].x),
                Math.abs(est.derecho[k].y - est.izquierdo[k].y));
    }
    return Math.max(...vals);
  }

  /** Holguras geométricas (mm) para detectar interferencias evidentes. */
  function holguras(est) {
    const G2 = G, l = est.derecho;
    const segDist = (p, q, r) => { // distancia de r al segmento pq
      const vx = q.x - p.x, vy = q.y - p.y;
      const t = Math.max(0, Math.min(1, ((r.x - p.x) * vx + (r.y - p.y) * vy) / (vx * vx + vy * vy)));
      return Math.hypot(p.x + t * vx - r.x, p.y + t * vy - r.y);
    };
    const minXSeg = (p, q) => Math.min(p.x, q.x);
    const cab = G2.cabezal, rOjo = G2.trazos.brazoSuperior / 2;
    const esquinaCubo = { x: cab.cuboSemiancho, y: cab.alturaPivotes + cab.cuboAbajo };
    return {
      // ojo del brazo superior (extremo redondeado) al cubo del cabezal
      ojoBrazoCubo: l.pivoteSuperior.x - rOjo - cab.cuboSemiancho,
      // cuerpo del brazo superior a la esquina inferior del cubo
      brazoSupCubo: segDist(l.pivoteSuperior, l.finBrazo, esquinaCubo) - rOjo,
      // brazo inferior al husillo
      brazoInfEje: minXSeg(l.codo, l.pivoteManguito) - G2.husillo.semiancho - G2.trazos.brazoInferior / 2,
      // bola al brazo inferior
      bolaBrazoInf: segDist(l.codo, l.pivoteManguito, l.centroMasa) - G2.masa.radio - G2.trazos.brazoInferior / 2,
      // bola al husillo
      bolaEje: l.centroMasa.x - G2.masa.radio - G2.husillo.semiancho,
      // brazo inferior al brazo superior (en el lado del codo no cuenta): ángulo en el codo
      anguloCodo: l.anguloCodo * 180 / Math.PI,
    };
  }

  /** Recorre el intervalo [0, sMax] con n+1 muestras y resume los resultados. */
  function barridoVerificacion(n = 10000) {
    let maxRes = 0, errores = 0, noFinitos = 0, monotono = true;
    let minCodo = Infinity, maxCodo = -Infinity, prevR = -Infinity, prevH = Infinity;
    const minH = { ojoBrazoCubo: Infinity, brazoSupCubo: Infinity, brazoInfEje: Infinity, bolaBrazoInf: Infinity, bolaEje: Infinity };
    for (let i = 0; i <= n; i++) {
      const s = LIMITES.sMax * i / n;
      let e;
      try { e = resolver(s); } catch (_) { errores++; continue; }
      const nums = [e.radioMasa, e.alturaCono, e.alfa, e.beta, e.anguloCodo, e.salida.y];
      for (const l of [e.derecho, e.izquierdo]) for (const k of ['codo', 'centroMasa', 'finBrazo']) nums.push(l[k].x, l[k].y);
      if (!nums.every(Number.isFinite)) { noFinitos++; continue; }
      maxRes = Math.max(maxRes, residuos(e));
      const h = holguras(e);
      for (const k in minH) minH[k] = Math.min(minH[k], h[k]);
      minCodo = Math.min(minCodo, h.anguloCodo); maxCodo = Math.max(maxCodo, h.anguloCodo);
      if (e.radioMasa < prevR - 1e-9 || e.alturaCono > prevH + 1e-9) monotono = false;
      prevR = e.radioMasa; prevH = e.alturaCono;
    }
    const sinInterferencia = Object.values(minH).every((v) => v > 0);
    return { muestras: n + 1, errores, noFinitos, residuoMax: maxRes,
             anguloCodoMinGrados: minCodo, anguloCodoMaxGrados: maxCodo,
             holgurasMin: minH, sinInterferencia, monotono };
  }

  RW.Cinematica = Object.freeze({ LIMITES, aNumeroFinito, resolver, residuos, holguras, barridoVerificacion });
})(window.RW = window.RW || {});
