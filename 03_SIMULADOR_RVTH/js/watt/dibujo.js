/* =====================================================================
 * dibujo.js — Representación SVG con giro proyectado (versión 3)
 * ---------------------------------------------------------------------
 * No calcula la cinemática ni maneja el tiempo. Recibe:
 *   est  : configuración articulada en el PLANO MERIDIANO (Cinematica.resolver)
 *   fase : ángulo de giro φ del conjunto giratorio [rad] (un único ángulo)
 * y la proyecta. Nunca recalcula el mecanismo a partir de lo que se ve.
 *
 * PROYECCIÓN ORTOGRÁFICA (mismo principio que el rotor del simulador RV,
 * 02_SIMULADOR _RTTH/js/simulador.js: un ángulo, giro y proyección):
 *   Un punto del plano meridiano tiene coordenada radial con signo x
 *   (derecha > 0, izquierda < 0), altura y, y opcionalmente un desplazamiento
 *   tangencial t (espesor de piezas). Al girar φ alrededor del eje vertical:
 *       X = x·cos φ − t·sen φ        (horizontal en pantalla)
 *       Z = x·sen φ + t·cos φ        (profundidad, positiva hacia el observador)
 *       Y = −y                        (vertical SVG)
 *   φ = 0 reproduce la vista plana anterior. Con φ > 0 la bola derecha se
 *   acerca al observador. Las esferas conservan su radio.
 *
 * ORDEN DE PROFUNDIDAD
 *   Cada mitad del mecanismo (izquierda/derecha) vive en un semiplano
 *   meridiano: toda ella tiene el mismo signo de Z (= signo de x·sen φ).
 *   Se dibuja: lado de atrás → piezas centrales de revolución → lado de
 *   delante. Dentro de cada lado el orden es fijo (horquilla, orejeta,
 *   biela, brazo + bola, pasadores), porque en un mismo semiplano las
 *   piezas sólo se tocan en sus articulaciones.
 *
 * JERARQUÍA
 *   #rw-fijo > #rw-soporte-fijo                (no gira)
 *   #rw-giratorio                              (gira con el ángulo único)
 *     #rw-lado-izq / #rw-lado-der              (se reordenan por profundidad)
 *        #rw-horquilla-*  (pieza del cabezal)   #rw-orejeta-* (del manguito)
 *        #rw-brazo-inf-*  #rw-brazo-sup-* > #rw-masa-*
 *        #rw-pasador-sup-*  #rw-pasador-codo-*  #rw-pasador-manguito-*
 *     #rw-centro                               (piezas de revolución)
 *        #rw-eje  #rw-tope-superior  #rw-tope-inferior  #rw-manguito  #rw-cabezal
 *   #rw-resorte   (vacío, reservado)
 *   #rw-salida    (referencia vertical, NO orbita)
 *   #rw-cotas     (ayudas geométricas; vértice virtual con estilo propio)
 * ===================================================================== */
(function (RW) {
  'use strict';

  const G = RW.GEOMETRIA;
  const NS = 'http://www.w3.org/2000/svg';
  const ESP = G.espesores;

  /** Proyección ortográfica de un punto del plano meridiano girado φ. */
  function proyectar(p, fase = 0, t = 0) {
    const c = Math.cos(fase), s = Math.sin(fase);
    return { X: p.x * c - t * s, Y: -p.y, Z: p.x * s + t * c };
  }

  function el(tag, attrs, padre) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (padre) padre.appendChild(n);
    return n;
  }
  const f3 = (v) => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(3);
  function setA(n, obj) { for (const k in obj) n.setAttribute(k, typeof obj[k] === 'number' ? f3(obj[k]) : obj[k]); }

  /** Rectángulo de revolución (silueta invariante con el giro). */
  function rectRev(padre, semiancho, yArriba, yAbajo, attrs) {
    return el('rect', Object.assign({ x: -semiancho, y: -yArriba, width: 2 * semiancho, height: yArriba - yAbajo }, attrs), padre);
  }

  /** Silueta de una caja radial (r0..r1 con signo, espesor tangencial w). */
  function siluetaCaja(r0, r1, w, fase) {
    const c = Math.cos(fase), s = Math.sin(fase);
    const xs = [];
    for (const r of [r0, r1]) for (const t of [-w / 2, w / 2]) xs.push(r * c - t * s);
    return { x0: Math.min(...xs), x1: Math.max(...xs) };
  }

  /** Pasador de eje tangencial: cápsula proyectada (círculo a φ = 0). */
  function pasador(n, p, R, L, fase) {
    const P = proyectar(p, fase);
    const c = Math.abs(Math.cos(fase)), s = Math.abs(Math.sin(fase));
    const ancho = L * s + 2 * R * c;
    setA(n, { x: P.X - ancho / 2, y: P.Y - R, width: Math.max(ancho, 0.5), height: 2 * R,
              rx: Math.max(R * c, 0.01), ry: R });
    return P;
  }

  function crearEscena(svg) {
    const m = 40;
    const a = G.cabezal.separacionPivotes / 2, yA = G.cabezal.alturaPivotes;
    const ancho = 2 * (a + G.masa.distanciaCentro + G.masa.radio) + 2 * m;
    const yTop = yA + G.cabezal.cuboArriba + G.cabezal.remate.alto + 2 * G.cabezal.remate.radio + m;
    const yBot = G.soporteFijo.bancada.yAbajo - m;
    svg.setAttribute('viewBox', `${-ancho / 2} ${-yTop} ${ancho} ${yTop - yBot}`);
    svg.innerHTML = '';
    const n = { lados: {} };

    /* ================= FIJO ================= */
    const fijo = el('g', { id: 'rw-fijo' }, svg);
    const sop = el('g', { id: 'rw-soporte-fijo' }, fijo);
    const SF = G.soporteFijo;
    rectRev(sop, SF.bancada.semiancho, SF.bancada.yArriba, SF.bancada.yAbajo, { class: 'pieza fija' });
    rectRev(sop, SF.cojinete.semiancho, SF.cojinete.yArriba, SF.cojinete.yAbajo, { class: 'pieza fija-cojinete' });

    /* ================= GIRATORIO ================= */
    n.giratorio = el('g', { id: 'rw-giratorio' }, svg);

    /* ---- Centro: piezas de revolución ---- */
    n.centro = el('g', { id: 'rw-centro' });
    const eje = el('g', { id: 'rw-eje' }, n.centro);
    rectRev(eje, G.husillo.semiancho, yA + G.cabezal.cuboArriba, G.husillo.yAbajo, { class: 'pieza eje' });
    el('line', { x1: 0, y1: -(yA + G.cabezal.cuboArriba + G.cabezal.remate.alto + 2 * G.cabezal.remate.radio + 12),
                 x2: 0, y2: -G.soporteFijo.bancada.yAbajo + 10, class: 'linea-eje' }, eje);

    const T = G.topes;
    const ts = el('g', { id: 'rw-tope-superior' }, n.centro);
    rectRev(ts, T.superior.semiancho, T.superior.caraInferior + T.superior.alto, T.superior.caraInferior, { class: 'pieza tope' });
    el('text', { x: T.superior.semiancho + 8, y: -(T.superior.caraInferior + T.superior.alto / 2) + 7, class: 'rotulo' }, ts).textContent = 'S';
    const ti = el('g', { id: 'rw-tope-inferior' }, n.centro);
    rectRev(ti, T.inferior.semiancho, T.inferior.caraSuperior, T.inferior.caraSuperior - T.inferior.alto, { class: 'pieza tope' });
    el('text', { x: T.inferior.semiancho + 8, y: -(T.inferior.caraSuperior - T.inferior.alto / 2) + 7, class: 'rotulo' }, ti).textContent = 'S';

    n.manguito = el('g', { id: 'rw-manguito' }, n.centro);
    n.manguitoInterior = el('g', {}, n.manguito);
    const M = G.manguito;
    rectRev(n.manguitoInterior, M.cuerpoSemiancho, M.caraSuperior, M.caraInferior, { class: 'pieza manguito-cuerpo' });
    rectRev(n.manguitoInterior, M.bridaSuperior.semiancho, M.bridaSuperior.ySup, M.bridaSuperior.yInf, { class: 'pieza manguito-brida' });
    rectRev(n.manguitoInterior, M.bridaInferior.semiancho, M.bridaInferior.ySup, M.bridaInferior.yInf, { class: 'pieza manguito-brida' });
    n.marcaManguito = el('line', { class: 'marca-giro', y1: -(M.bridaSuperior.yInf - 3), y2: -(M.bridaInferior.ySup + 3) }, n.manguitoInterior);

    const C = G.cabezal;
    n.cabezal = el('g', { id: 'rw-cabezal' }, n.centro);
    rectRev(n.cabezal, C.cuboSemiancho, yA + C.cuboArriba, yA + C.cuboAbajo, { class: 'pieza cabezal', rx: 3 });
    el('rect', { x: -5, y: -(yA + C.cuboArriba + C.remate.alto), width: 10, height: C.remate.alto, class: 'pieza cabezal' }, n.cabezal);
    el('circle', { cx: 0, cy: -(yA + C.cuboArriba + C.remate.alto + C.remate.radio), r: C.remate.radio, class: 'pieza cabezal' }, n.cabezal);
    n.marcaCabezal = el('line', { class: 'marca-giro', y1: -(yA + C.cuboArriba - 6), y2: -(yA + C.cuboAbajo + 6) }, n.cabezal);

    /* ---- Lados: piezas desplazadas del eje ---- */
    for (const lado of ['izq', 'der']) {
      const g = el('g', { id: 'rw-lado-' + lado, class: 'lado' });
      const L = { g };
      L.horquilla = el('rect', { id: 'rw-horquilla-' + lado, class: 'pieza cabezal-horquilla', 'data-pieza': 'cabezal', rx: 4 }, g);
      L.orejeta = el('rect', { id: 'rw-orejeta-' + lado, class: 'pieza manguito-cuerpo', 'data-pieza': 'manguito' }, g);
      const bi = el('g', { id: 'rw-brazo-inf-' + lado }, g);
      L.biela = el('line', { class: 'barra brazo-inf' }, bi);
      const bs = el('g', { id: 'rw-brazo-sup-' + lado }, g);
      L.brazo = el('line', { class: 'barra brazo-sup' }, bs);
      const masa = el('g', { id: 'rw-masa-' + lado }, bs);
      L.cuello = el('line', { class: 'cuello' }, masa);
      L.bola = el('circle', { r: G.masa.radio, class: 'pieza masa' }, masa);
      L.brillo = el('circle', { r: G.masa.radio * 0.28, class: 'brillo' }, masa);
      L.pSup = el('rect', { id: 'rw-pasador-sup-' + lado, class: 'pasador', 'data-pieza': 'cabezal' }, g);
      L.pCodo = el('rect', { id: 'rw-pasador-codo-' + lado, class: 'pasador' }, g);
      L.pMang = el('rect', { id: 'rw-pasador-manguito-' + lado, class: 'pasador' }, g);
      n.lados[lado] = L;
    }
    n.ordenActual = '';

    /* ================= CAPAS AUXILIARES ================= */
    n.resorte = el('g', { id: 'rw-resorte' }, svg); // reservado, vacío

    n.salida = el('g', { id: 'rw-salida' }, svg);
    n.salidaGuia = el('line', { class: 'salida-guia' }, n.salida);
    n.salidaMarca = el('circle', { r: 7, class: 'salida' }, n.salida);
    n.salidaRotulo = el('text', { class: 'rotulo salida-rotulo' }, n.salida);
    n.salidaRotulo.textContent = 'Salida (no gira)';

    n.cotas = el('g', { id: 'rw-cotas' }, svg);
    n.cotaR = el('line', { class: 'cota' }, n.cotas);
    n.cotaRTxt = el('text', { class: 'cota-txt' }, n.cotas);
    n.cotaProlong = el('line', { class: 'cota cota-tenue' }, n.cotas);
    n.cotaH = el('line', { class: 'cota' }, n.cotas);
    n.cotaHRef = el('line', { class: 'cota cota-tenue' }, n.cotas);
    n.cotaHTxt = el('text', { class: 'cota-txt' }, n.cotas);
    n.vertice = el('g', { id: 'rw-vertice-virtual', class: 'vertice' }, n.cotas);
    el('circle', { r: 7, class: 'vertice-anillo' }, n.vertice);
    el('line', { x1: -10, y1: 0, x2: 10, y2: 0, class: 'vertice-cruz' }, n.vertice);
    el('line', { x1: 0, y1: -10, x2: 0, y2: 10, class: 'vertice-cruz' }, n.vertice);
    n.verticeTxt = el('text', { class: 'cota-txt vertice-txt' }, n.cotas);
    n.verticeTxt.textContent = 'vértice virtual';

    // registro de la última proyección (para pruebas y depuración)
    n.ultimaProyeccion = null;
    return n;
  }

  function linea(nd, p, q) { setA(nd, { x1: p.X, y1: p.Y, x2: q.X, y2: q.Y }); }

  /** Actualiza todas las piezas para la configuración `est` y el ángulo `fase`. */
  function actualizar(n, est, fase = 0) {
    const c = Math.cos(fase), s = Math.sin(fase);
    const proy = { fase, lados: {} };

    for (const [lado, l] of [['izq', est.izquierdo], ['der', est.derecho]]) {
      const L = n.lados[lado];
      const sg = lado === 'der' ? 1 : -1;
      const A = proyectar(l.pivoteSuperior, fase), E = proyectar(l.codo, fase);
      const P = proyectar(l.pivoteManguito, fase), B = proyectar(l.centroMasa, fase);
      const Cf = proyectar(l.finBrazo, fase);

      // horquilla del cabezal (caja radial) y orejeta del manguito
      const hq = siluetaCaja(sg * (G.cabezal.cuboSemiancho - 2), sg * (G.cabezal.separacionPivotes / 2 + G.cabezal.horquillaExceso), ESP.horquilla, fase);
      const yA = G.cabezal.alturaPivotes;
      setA(L.horquilla, { x: hq.x0, y: -(yA + G.cabezal.horquillaSemialto), width: hq.x1 - hq.x0, height: 2 * G.cabezal.horquillaSemialto });
      const M = G.manguito;
      const oj = siluetaCaja(sg * (M.cuerpoSemiancho - 2), sg * M.orejetas.semiancho, ESP.orejetaManguito, fase);
      setA(L.orejeta, { x: oj.x0, y: -(est.yPivoteManguito + M.orejetas.ySup), width: oj.x1 - oj.x0, height: M.orejetas.ySup - M.orejetas.yInf });

      linea(L.biela, P, E);
      linea(L.brazo, A, Cf);
      linea(L.cuello, Cf, B);
      setA(L.bola, { cx: B.X, cy: B.Y });
      // reflejo desplazado hacia la luz (arriba-izquierda): sólo estético
      setA(L.brillo, { cx: B.X - G.masa.radio * 0.32, cy: B.Y - G.masa.radio * 0.34 });

      const pA = pasador(L.pSup, l.pivoteSuperior, G.cabezal.radioPasador, ESP.pasadorSuperior, fase);
      const pE = pasador(L.pCodo, l.codo, G.trazos.pasador + 3, ESP.pasadorCodo, fase);
      const pP = pasador(L.pMang, l.pivoteManguito, G.trazos.pasador + 3, ESP.pasadorManguito, fase);

      proy.lados[lado] = { A, E, P, B, C: Cf, pA, pE, pP, profundidad: sg * s };
    }

    // Marcas de giro en piezas de revolución (punto tangencial t = R)
    const marca = (nd, R) => {
      const X = -R * s, Z = R * c;
      setA(nd, { x1: X, x2: X });
      nd.style.display = Z > 0.15 * R ? '' : 'none';
    };
    marca(n.marcaCabezal, G.cabezal.cuboSemiancho * 0.85);
    marca(n.marcaManguito, G.manguito.cuerpoSemiancho * 0.85);

    // Orden por profundidad: lado de atrás, centro, lado de delante
    const derDelante = s >= 0; // el lado derecho tiene Z = x·sen φ ≥ 0
    const detras = derDelante ? 'izq' : 'der', delante = derDelante ? 'der' : 'izq';
    // El lado de atrás se oscurece ligeramente sólo cuando hay profundidad
    // apreciable (en la vista frontal ambos lados están en Z = 0).
    const sombrear = Math.abs(s) > 0.03;
    const clave = detras + '|' + delante + '|' + sombrear;
    if (n.ordenActual !== clave || !n.centro.parentNode) {
      n.giratorio.appendChild(n.lados[detras].g);
      n.giratorio.appendChild(n.centro);
      n.giratorio.appendChild(n.lados[delante].g);
      n.lados[detras].g.classList.toggle('detras', sombrear);
      n.lados[delante].g.classList.remove('detras');
      n.ordenActual = clave;
    }
    proy.orden = [detras, 'centro', delante];

    n.manguitoInterior.setAttribute('transform', `translate(0 ${f3(-est.yPivoteManguito)})`);
    n.manguito.classList.toggle('en-tope', !!est.enTope);

    // Salida: referencia vertical fija en el eje (no se proyecta con φ)
    const Sy = -est.salida.y;
    setA(n.salidaMarca, { cx: est.salida.x, cy: Sy });
    setA(n.salidaGuia, { x1: est.salida.x + 10, y1: Sy, x2: est.salida.x + 58, y2: Sy });
    setA(n.salidaRotulo, { x: est.salida.x + 62, y: Sy + 5 });

    // Cotas sobre el lado que aparece a la derecha de la pantalla.
    // h es vertical (invariante con el giro); r se ve escorzado ×|cos φ|,
    // por eso el texto da siempre el valor VERDADERO.
    const lv = proy.lados[(est.derecho.centroMasa.x * c >= 0) ? 'der' : 'izq'];
    const B = lv.B, V = proyectar({ x: 0, y: est.yVertice }, fase);
    const yr = B.Y + G.masa.radio + 18;
    linea(n.cotaR, { X: 0, Y: yr }, { X: B.X, Y: yr });
    setA(n.cotaRTxt, { x: B.X / 2 + 20, y: yr + 17 });
    n.cotaRTxt.textContent = 'r = ' + est.radioMasa.toFixed(1) + (Math.abs(c) < 0.999 ? ' (verdadero)' : '');
    linea(n.cotaProlong, lv.A, V);
    n.vertice.setAttribute('transform', `translate(${f3(V.X)} ${f3(V.Y)})`);
    setA(n.verticeTxt, { x: V.X + 14, y: V.Y - 8 });
    const xh = Math.max(B.X, 0) + G.masa.radio + 22;
    linea(n.cotaH, { X: xh, Y: V.Y }, { X: xh, Y: B.Y });
    linea(n.cotaHRef, V, { X: xh, Y: V.Y });
    setA(n.cotaHTxt, { x: xh + 6, y: (V.Y + B.Y) / 2 });
    n.cotaHTxt.textContent = 'h = ' + est.alturaCono.toFixed(1);

    n.ultimaProyeccion = proy;
    return proy;
  }

  RW.Dibujo = Object.freeze({ crearEscena, actualizar, proyectar });
})(window.RW = window.RW || {});
