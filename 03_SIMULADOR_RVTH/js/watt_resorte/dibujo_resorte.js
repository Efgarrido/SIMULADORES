/* =====================================================================
 * dibujo_resorte.js — Capas nuevas sobre la escena del Watt v3
 * ---------------------------------------------------------------------
 * Usa RW.Dibujo (copia idéntica del módulo v3) para brazos, bolas,
 * manguito, topes y cabezal, y AÑADE:
 *   · resorte helicoidal coaxial (mitad trasera / delantera, gira con φ)
 *   · platillo inferior (sobre el manguito) y asiento superior móvil
 *   · corte del husillo hueco: ranuras, pasador transversal, empujador
 *     (gira), rodamiento axial y extremo del tornillo de ajuste (no gira)
 *   · parte superior: tornillo trasladable, cubo fijo con corona-tuerca y
 *     dial, collar de leva, finales de carrera FC LENTO / FC RÁPIDO
 *   Todas las cotas del ajuste y de los apoyos del resorte vienen de
 *   RW.AjusteGeo (la misma definición que usan física y verificación).
 *   · bastidor fijo: pie, columna, brazo, cubo con dial, motorreductor
 *   · finales de carrera (LENTO / RÁPIDO)
 *   · collar de salida (no gira) con oreja y pasador A
 *   · regla de compatibilidad con la ventana útil de DESARROLLO_GOBERNADOR
 *   · flechas de fuerza (opcionales)
 * El remate decorativo del cabezal v3 se oculta: su lugar lo ocupa el cubo
 * fijo del ajuste. No se modifica ningún archivo del módulo v3.
 * Sólo dibuja: nunca calcula la física ni la cinemática.
 * ===================================================================== */
(function (RW) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const P = RW.PARAM, G = RW.GEOMETRIA, C = RW.Cinematica, F = RW.Fisica;
  const R = P.resorte, AG = P.ajusteGeo, B = P.bastidor, RV = P.rvth, AGP = RW.AjusteGeo;
  const Rm = R.D / 2 * 1000, dW = R.d * 1000;
  const f3 = (v) => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(3);

  function el(tag, attrs, padre) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (padre) padre.appendChild(n);
    return n;
  }
  function setA(n, o) { for (const k in o) n.setAttribute(k, typeof o[k] === 'number' ? f3(o[k]) : o[k]); }
  const rectXY = (x0, x1, y0, y1, attrs, padre) =>
    el('rect', Object.assign({ x: Math.min(x0, x1), y: -Math.max(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) }, attrs), padre);
  function setRect(n, x0, x1, y0, y1) {
    setA(n, { x: Math.min(x0, x1), y: -Math.max(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) });
  }

  function crearEscena(svg) {
    const n = RW.Dibujo.crearEscena(svg);
    const yTop = Math.ceil(AGP.alturaMaxima / 10) * 10 + 20;
    svg.setAttribute('viewBox', `-500 ${-yTop} 1000 ${yTop + 700}`);

    // defs (rayado de rosca)
    const defs = el('defs', {}, svg); svg.insertBefore(defs, svg.firstChild);
    const pat = el('pattern', { id: 'rosca', width: 6, height: 4, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(-20)' }, defs);
    el('line', { x1: 0, y1: 0, x2: 6, y2: 0, class: 'rosca-linea' }, pat);

    // Ocultar el remate decorativo del cabezal v3 (lo sustituye el cubo fijo)
    const hijos = n.cabezal.children;
    if (hijos[1]) hijos[1].style.display = 'none';
    if (hijos[2]) hijos[2].style.display = 'none';
    n.salida.style.display = 'none';           // se dibuja un collar con su punto A
    n.cotas.style.display = 'none';

    /* ---------------- Bastidor fijo (detrás de todo) ---------------- */
    const fijo = svg.querySelector('#rw-fijo');
    const bas = el('g', { id: 'rr-bastidor' }); fijo.insertBefore(bas, fijo.firstChild);
    rectXY(B.pie.x0, B.pie.x1, B.pie.y0, B.pie.y1, { class: 'pieza fija' }, bas);
    rectXY(B.columnaX0, B.columnaX1, B.pie.y1, B.brazoY1, { class: 'pieza fija' }, bas);
    rectXY(B.columnaX0, B.cubo.semiancho, B.brazoY0, B.brazoY1, { class: 'pieza fija' }, bas);
    const mot = el('g', { id: 'rr-motor' }, bas);
    rectXY(B.motor.x0, B.motor.x1, B.motor.y0, B.motor.y1, { class: 'pieza motor', rx: 4 }, mot);
    el('text', { x: (B.motor.x0 + B.motor.x1) / 2, y: -(B.motor.y0 + B.motor.y1) / 2 + 6, class: 'rotulo-chico', 'text-anchor': 'middle' }, mot).textContent = 'M';
    n.rrMotor = mot;
    // eje del motor dentro del brazo hasta el sinfín del cubo (línea discontinua)
    el('line', { x1: B.motor.x1, y1: -(B.brazoY0 + B.brazoY1) / 2, x2: -B.cubo.semiancho, y2: -(B.brazoY0 + B.brazoY1) / 2, class: 'eje-oculto' }, bas);
    const yc = (B.pie.y1 + B.brazoY0) / 2, xc = (B.columnaX0 + B.columnaX1) / 2 + 26;
    el('text', { x: xc, y: -yc, class: 'rotulo-chico tenue', 'text-anchor': 'middle', transform: `rotate(-90 ${xc} ${-yc})` }, bas).textContent = 'columna fija del ajuste (fuera del barrido de las bolas)';

    /* ---------------- Piezas centrales nuevas ---------------- */
    const centro = n.centro;
    n.rrResAtras = el('path', { class: 'resorte resorte-atras', 'stroke-width': Math.max(dW, 2.5) });
    centro.insertBefore(n.rrResAtras, centro.firstChild);

    // corte del husillo hueco (encima del husillo, debajo del asiento).
    // Todas las cotas salen de RW.AjusteGeo (misma definición que la verificación).
    const corte = el('g', { id: 'rr-corte' });
    const eje = centro.querySelector('#rw-eje');
    centro.insertBefore(corte, eje.nextSibling);
    const rz = AG.ranuras, yCabAbajo = G.cabezal.alturaPivotes + G.cabezal.cuboAbajo;
    rectXY(-AG.taladro.semiancho, AG.taladro.semiancho, rz.y0 - AG.taladro.margenFondo, yCabAbajo, { class: 'corte-fondo' }, corte);
    rectXY(-G.husillo.semiancho + 0.8, G.husillo.semiancho - 0.8, rz.y0, rz.y1, { class: 'ranura-contorno' }, corte);
    n.rrTornillo = el('rect', { class: 'tornillo' }, corte);
    n.rrTornilloRosca = el('rect', { fill: 'url(#rosca)', class: 'tornillo-rosca' }, corte);
    n.rrRodam = el('rect', { class: 'rodamiento-caja' }, corte);
    n.rrBolaR1 = el('circle', { r: AG.rodamiento.alto / 2 - 0.3, class: 'rodamiento' }, corte);
    n.rrBolaR2 = el('circle', { r: AG.rodamiento.alto / 2 - 0.3, class: 'rodamiento' }, corte);
    n.rrEmpuj = el('rect', { class: 'empujador' }, corte);

    // platillo inferior (sobre la cara superior del manguito)
    n.rrPlatillo = el('path', { class: 'pieza platillo' });
    centro.insertBefore(n.rrPlatillo, centro.querySelector('#rw-cabezal'));

    // asiento superior + pasador transversal
    n.rrAsiento = el('g', { id: 'rr-asiento' });
    centro.insertBefore(n.rrAsiento, centro.querySelector('#rw-cabezal'));
    n.rrAsientoDisco = el('rect', { class: 'pieza asiento', rx: 2 }, n.rrAsiento);
    n.rrAsientoCubo = el('rect', { class: 'pieza asiento' }, n.rrAsiento);
    n.rrPasador = el('rect', { class: 'pasador-transversal', rx: 3 }, n.rrAsiento);
    n.rrMarcaAsiento = el('line', { class: 'marca-giro' }, n.rrAsiento);

    n.rrResDelante = el('path', { class: 'resorte resorte-delante', 'stroke-width': Math.max(dW, 2.5) });
    centro.insertBefore(n.rrResDelante, centro.querySelector('#rw-cabezal'));

    /* ---------------- Parte superior del ajuste (fija y tornillo) ----------
       Tornillo NO giratorio que se traslada; corona-tuerca en el cubo fijo;
       collar de leva y finales de carrera FC LENTO (poste) y FC RÁPIDO (cubo). */
    const sup = el('g', { id: 'rr-ajuste-superior' }, svg);
    n.rrTornilloSup = el('rect', { class: 'tornillo' }, sup);
    n.rrTornilloSupRosca = el('rect', { fill: 'url(#rosca)', class: 'tornillo-rosca' }, sup);
    rectXY(-B.cubo.semiancho, B.cubo.semiancho, B.cubo.y0, B.cubo.y1, { class: 'pieza fija', rx: 3 }, sup);
    const yDial = (B.cubo.y0 + B.cubo.y1) / 2;
    el('circle', { cx: 0, cy: -yDial, r: 13, class: 'dial' }, sup);
    n.rrAguja = el('line', { x1: 0, y1: -yDial, x2: 0, y2: -yDial - 11, class: 'aguja' }, sup);
    const po = AGP.poste;
    rectXY(po.x0, po.x1, po.y0, po.y1, { class: 'pieza fija' }, sup);
    n.rrFcRapido = rectXY(AGP.fcRapido.x0, AGP.fcRapido.x1, AGP.fcRapido.y0, AGP.fcRapido.y1, { class: 'final-carrera' }, sup);
    n.rrFcLento = rectXY(AGP.fcLento.x0, AGP.fcLento.x1, AGP.fcLento.y0, AGP.fcLento.y1, { class: 'final-carrera' }, sup);
    n.rrCollarLeva = el('rect', { class: 'collar-leva', rx: 2 }, sup);

    /* ---------------- Salida: collar (no gira) y punto A ---------------- */
    const sal = el('g', { id: 'rr-salida' }, svg);
    n.rrCollar = el('rect', { class: 'collar', rx: 3 }, sal);
    n.rrOreja = el('line', { class: 'oreja' }, sal);
    n.rrA = el('circle', { r: 8, class: 'punto-a' }, sal);
    n.rrATxt = el('text', { class: 'rotulo-a' }, sal); n.rrATxt.textContent = 'A';

    /* ---------------- Regla de compatibilidad RVTH (ampliada ×3) ----------
       Escala vertical propia: 3 mm de dibujo por mm de s, para que la
       ventana útil (23.5 mm) sea legible. No es una pieza. */
    const reg = el('g', { id: 'rr-regla' }, svg);
    const xr = 232, ySal = (s) => -688 + 3 * s;
    el('line', { x1: xr, y1: -ySal(0), x2: xr, y2: -ySal(C.LIMITES.sMax), class: 'regla' }, reg);
    rectXY(xr - 6, xr + 6, ySal(RV.sMinUtil), ySal(RV.sMaxUtil), { class: 'ventana' }, reg);
    for (let s = 0; s <= 98; s += 10) el('line', { x1: xr - 4, y1: -ySal(s), x2: xr + 4, y2: -ySal(s), class: 'regla' }, reg);
    const marcas = [[RV.sMinUtil, '39.6  apertura 100 %'], [RV.sReferencia, '49.0  referencia'], [RV.sMaxUtil, '63.0  cierre (neutro, Fink cerrado)']];
    for (const [s, t] of marcas) {
      el('line', { x1: xr - 9, y1: -ySal(s), x2: xr + 11, y2: -ySal(s), class: 'regla-marca' }, reg);
      el('text', { x: xr + 15, y: -ySal(s) + 4, class: 'rotulo-chico' }, reg).textContent = t;
    }
    el('text', { x: xr + 15, y: -ySal(0) + 4, class: 'rotulo-chico tenue' }, reg).textContent = '0  tope inferior';
    el('text', { x: xr + 15, y: -ySal(98) + 4, class: 'rotulo-chico tenue' }, reg).textContent = '98  tope superior';
    el('text', { x: xr - 10, y: -ySal(98) - 30, class: 'rotulo-chico' }, reg).textContent = 's del manguito [mm] · escala ×3';
    el('text', { x: xr - 10, y: -ySal(98) - 14, class: 'rotulo-chico tenue' }, reg).textContent = 'banda: ventana útil del RVTH';
    n.rrPuntero = el('path', { class: 'puntero' }, reg);
    n.rrYsal = ySal;

    /* ---------------- Flechas de fuerza ---------------- */
    n.rrFuerzas = el('g', { id: 'rr-fuerzas' }, svg);
    n.rrFlechas = {};
    for (const k of ['cIzq', 'cDer', 'gIzq', 'gDer', 'res']) {
      const g = el('g', { class: 'flecha ' + (k[0] === 'c' ? 'f-centrifuga' : k[0] === 'g' ? 'f-peso' : 'f-resorte') }, n.rrFuerzas);
      n.rrFlechas[k] = { linea: el('line', {}, g), punta: el('path', {}, g) };
    }
    n.rrFuerzaTxt = el('text', { class: 'rotulo-chico f-resorte-txt' }, n.rrFuerzas);
    return n;
  }

  /** Trazo de la hélice proyectada, dividido en mitades trasera y delantera. */
  function helice(y0, y1, fase) {
    const Nt = R.Na + R.extremos, pasos = Nt * 36;
    const yDe = (u) => {                          // u en vueltas [0, Nt]
      const e = R.extremos / 2, act = y1 - y0 - R.extremos * dW;
      if (u <= e) return y0 + u * dW;
      if (u >= Nt - e) return y1 - (Nt - u) * dW;
      return y0 + e * dW + (u - e) / R.Na * act;
    };
    let atras = '', delante = '', prevZ = null;
    for (let k = 0; k <= pasos; k++) {
      const u = k / pasos * Nt, th = 2 * Math.PI * u + fase;
      const X = Rm * Math.cos(th), Z = Rm * Math.sin(th), Y = -yDe(u);
      const pt = f3(X) + ' ' + f3(Y);
      const lado = Z >= 0;
      if (prevZ === null || lado !== prevZ) {
        if (lado) delante += ' M' + pt; else atras += ' M' + pt;
      } else {
        if (lado) delante += ' L' + pt; else atras += ' L' + pt;
      }
      prevZ = lado;
    }
    return { atras, delante };
  }

  function flecha(f, x0, y0, dx, dy) {
    const L = Math.hypot(dx, dy);
    if (L < 2) { f.linea.setAttribute('visibility', 'hidden'); f.punta.setAttribute('visibility', 'hidden'); return; }
    f.linea.setAttribute('visibility', 'visible'); f.punta.setAttribute('visibility', 'visible');
    const ux = dx / L, uy = dy / L, x1 = x0 + dx, y1 = y0 + dy, a = 9;
    setA(f.linea, { x1: x0, y1: y0, x2: x1 - ux * a, y2: y1 - uy * a });
    f.punta.setAttribute('d', `M${f3(x1)} ${f3(y1)} L${f3(x1 - ux * a - uy * a * 0.5)} ${f3(y1 - uy * a + ux * a * 0.5)} L${f3(x1 - ux * a + uy * a * 0.5)} ${f3(y1 - uy * a - ux * a * 0.5)} Z`);
  }

  /**
   * est   : RW.Cinematica.resolver(s)
   * lec   : RW.Fisica.lecturas(estado)
   * fase  : ángulo visual [rad]
   * opc   : { fuerzas: bool, escalaFuerza: mm/N }
   */
  function actualizar(n, est, lec, fase, opc = {}) {
    const proy = RW.Dibujo.actualizar(n, est, fase);
    // Apoyos y piezas del ajuste: definición única (RW.AjusteGeo)
    const ap = AGP.apoyos(lec.sMm, lec.a), pz = AGP.piezas(lec.a);
    const PI = AG.platilloInferior;
    const yMang = ap.yCaraManguito;

    // platillo inferior (anillo sobre el manguito, rodea el tope S)
    const y0 = ap.yCaraManguito, y1 = ap.yInf;
    n.rrPlatillo.setAttribute('d',
      `M${-PI.semiancho} ${f3(-y1)} H${-PI.rInterior} V${f3(-y0)} H${-PI.semiancho} Z ` +
      `M${PI.rInterior} ${f3(-y1)} H${PI.semiancho} V${f3(-y0)} H${PI.rInterior} Z`);

    // asiento superior (disco + cubo) y pasador transversal
    setRect(n.rrAsientoDisco, -pz.disco.semiancho, pz.disco.semiancho, pz.disco.y0, pz.disco.y1);
    setRect(n.rrAsientoCubo, -pz.cubo.semiancho, pz.cubo.semiancho, pz.cubo.y0, pz.cubo.y1);
    const pa = pz.pasador;
    const cf = Math.abs(Math.cos(fase)), sf = Math.abs(Math.sin(fase));
    const lp = 2 * pa.semilargo * cf + 2 * pa.r * sf;           // pasador visto girando
    setA(n.rrPasador, { x: -lp / 2, y: -pa.y1, width: Math.max(lp, 2 * pa.r), height: 2 * pa.r });
    const Xm = -pz.cubo.semiancho * 0.85 * Math.sin(fase);
    setA(n.rrMarcaAsiento, { x1: Xm, x2: Xm, y1: -(pz.disco.y0 + 2), y2: -(pz.cubo.y1 - 2) });
    n.rrMarcaAsiento.style.display = Math.cos(fase) > 0.15 ? '' : 'none';

    // interior del husillo: empujador (gira), rodamiento axial, tornillo (no gira, se traslada)
    const yCabAbajo = G.cabezal.alturaPivotes + G.cabezal.cuboAbajo, yCabArriba = G.cabezal.alturaPivotes + G.cabezal.cuboArriba;
    setRect(n.rrEmpuj, -pz.empujador.semiancho, pz.empujador.semiancho, pz.empujador.y0, pz.empujador.y1);
    setRect(n.rrRodam, -pz.rodamiento.semiancho, pz.rodamiento.semiancho, pz.rodamiento.y0, pz.rodamiento.y1);
    const yb = (pz.rodamiento.y0 + pz.rodamiento.y1) / 2;
    setA(n.rrBolaR1, { cx: -pz.rodamiento.semiancho * 0.55, cy: -yb }); setA(n.rrBolaR2, { cx: pz.rodamiento.semiancho * 0.55, cy: -yb });
    const ts = pz.tornillo.semiancho, tTop = Math.min(pz.tornillo.y1, yCabAbajo);
    for (const r of [n.rrTornillo, n.rrTornilloRosca]) setRect(r, -ts, ts, pz.tornillo.y0, tTop);
    for (const r of [n.rrTornilloSup, n.rrTornilloSupRosca]) setRect(r, -ts, ts, yCabArriba, pz.collar.y0);
    setRect(n.rrCollarLeva, -pz.collar.semiancho, pz.collar.semiancho, pz.collar.y0, pz.collar.y1);
    n.rrFcLento.classList.toggle('activo', !!lec.fcLento);
    n.rrFcRapido.classList.toggle('activo', !!lec.fcRapido);

    // dial (corona-tuerca) y motor
    const ang = (lec.a / P.ajuste.pasoTornillo) * 360;
    const yDial = (B.cubo.y0 + B.cubo.y1) / 2;
    n.rrAguja.setAttribute('transform', `rotate(${f3(ang % 360)} 0 ${f3(-yDial)})`);
    n.rrMotor.classList.toggle('en-marcha', !!lec.motor);

    // resorte
    const h = helice(ap.yInf, ap.ySup, fase);
    n.rrResAtras.setAttribute('d', h.atras);
    n.rrResDelante.setAttribute('d', h.delante);
    n.rrResDelante.classList.toggle('alerta', lec.holguraSolida < 5 || lec.compresion <= 0);

    // salida: collar no giratorio y pasador A (oreja hacia la derecha)
    const yS = est.salida.y, sc = G.manguito.cuerpoSemiancho + 10;
    const xA = RV.orejaA / RV.escala;
    setA(n.rrCollar, { x: -sc, y: -(yS + 12), width: 2 * sc, height: 31 });
    setA(n.rrOreja, { x1: sc, y1: -yS, x2: xA, y2: -yS });
    setA(n.rrA, { cx: xA, cy: -yS });
    setA(n.rrATxt, { x: xA - 4, y: -yS - 14 });

    // puntero de la regla
    const xr = 232, yp = -n.rrYsal(lec.sMm);
    n.rrPuntero.setAttribute('d', `M${xr - 6} ${f3(yp)} L${xr - 18} ${f3(yp - 6)} L${xr - 18} ${f3(yp + 6)} Z`);
    const enVentana = lec.sMm >= RV.sMinUtil && lec.sMm <= RV.sMaxUtil;
    n.rrPuntero.classList.toggle('fuera', !enVentana);

    // fuerzas
    n.rrFuerzas.style.display = opc.fuerzas ? '' : 'none';
    if (opc.fuerzas) {
      const k = opc.escalaFuerza || 1.2;
      const mg = P.masas.bola * P.g;
      for (const [lado, sg] of [['izq', -1], ['der', 1]]) {
        const Bp = proy.lados[lado].B;
        const ct = Math.cos(fase);
        flecha(n.rrFlechas[lado === 'izq' ? 'cIzq' : 'cDer'], Bp.X, Bp.Y, sg * ct * lec.centrifugaBola * k, 0);
        flecha(n.rrFlechas[lado === 'izq' ? 'gIzq' : 'gDer'], Bp.X, Bp.Y, 0, mg * k);
      }
      flecha(n.rrFlechas.res, 60, -(yMang + 30), 0, lec.Fres * k);
      n.rrFuerzaTxt.textContent = '';
    }
    return proy;
  }

  RW.DibujoResorte = Object.freeze({ crearEscena, actualizar });
})(window.RW = window.RW || {});
