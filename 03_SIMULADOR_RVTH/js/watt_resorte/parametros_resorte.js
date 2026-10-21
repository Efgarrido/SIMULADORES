/* =====================================================================
 * parametros_resorte.js — ÚNICA fuente de parámetros físicos del
 * regulador centrífugo con resorte de regulación (módulo independiente).
 * ---------------------------------------------------------------------
 * La geometría articulada (brazos, pasadores, bolas, manguito, topes,
 * collar de salida) NO se define aquí: se toma sin cambios de
 * js/geometria.js (copia idéntica del módulo Watt v3, mm). Así el punto A
 * conserva exactamente la misma relación con s que en DESARROLLO_GOBERNADOR.
 *
 * Unidades: SI (m, kg, N, s) salvo donde se indica mm o px.
 * Cotas de dibujo del resorte/ajuste: mm, en el sistema del módulo
 * (origen en el eje a la altura de los pasadores superiores, y hacia arriba).
 *
 * Campo `estado` de cada grupo:
 *   'derivado'    : calculado a partir de otros datos (se indica de cuáles)
 *   'provisional' : supuesto razonado, pendiente de validar con datos reales
 *   'referencia'  : valor leído (solo lectura) de DESARROLLO_GOBERNADOR
 * ===================================================================== */
(function (RW) {
  'use strict';

  const g = 9.80665;                          // m/s²
  const rhoAcero = 7850;                      // kg/m³ — provisional
  const radioBola = RW.GEOMETRIA.masa.radio / 1000;   // 0.047 m (del dibujo)

  /* ---------------- Resorte helicoidal de compresión ----------------
     La rigidez NO se impone: se calcula con k = G·d⁴ / (8·D³·Na). */
  const resorte = {
    moduloG: 79.3e9,          // Pa, acero para resortes — provisional
    d: 3.5e-3,                // m, diámetro del alambre — provisional
    D: 70e-3,                 // m, diámetro medio (cabe entre tope S r=24 y bielas r≥42 mm)
    Na: 24,                   // espiras activas — provisional
    extremos: 2,              // espiras de asiento (extremos cerrados y esmerilados)
    L0: 0.360,                // m, longitud libre — provisional
    estado: 'provisional',
  };
  resorte.k = resorte.moduloG * resorte.d ** 4 / (8 * resorte.D ** 3 * resorte.Na); // N/m (derivado)
  resorte.Lsolida = (resorte.Na + resorte.extremos) * resorte.d;                    // m (derivado)
  resorte.masa = rhoAcero * Math.PI * resorte.d ** 2 / 4 * Math.PI * resorte.D * (resorte.Na + resorte.extremos); // kg
  resorte.indice = resorte.D / resorte.d;

  RW.PARAM = Object.freeze({
    version: 1,
    g,

    /* ---------------- Masas ---------------- */
    masas: {
      bola: rhoAcero * 4 / 3 * Math.PI * radioBola ** 3,   // kg por bola (esfera de acero r 47 mm) — derivado/provisional
      manguito: 3.0,          // kg: manguito + platillo inferior del resorte (estimado del volumen dibujado) — provisional
      brazos: 0,              // brazos sin masa (simplificación declarada)
      estado: 'provisional',
    },

    resorte: Object.freeze(resorte),

    /* ---------------- Asiento superior y ajuste de precarga --------------
       a = recorrido del asiento desde el final de carrera LENTO (a = 0)
       hasta el final de carrera RÁPIDO (a = recorrido). y_asiento = yLento − a.
       RÁPIDO baja el asiento → más compresión → más velocidad de equilibrio. */
    ajuste: {
      yAsientoLento: -65,     // mm (módulo): asiento con a = 0
      recorrido: 110,         // mm entre finales de carrera
      inicial: 55,            // mm: punto medio (diseño)
      velocidadMotor: 2.75,   // mm/s → 40 s de extremo a extremo — provisional
      pasoTornillo: 2,        // mm/vuelta (Tr 10×2, autobloqueante) — provisional
      estado: 'provisional',
    },

    /* ---------------- Amortiguamiento ----------------
       HIPÓTESIS DE ENSAYO: no hay ningún elemento diseñado que lo produzca.
       Físicamente podría venir de un amortiguador de aceite (dashpot) unido
       al collar, o del rozamiento viscoso del manguito y las articulaciones. */
    amortiguamiento: {
      c: 80,                  // N·s/m sobre s (ζ ≈ 0.5 en el punto de diseño)
      estado: 'hipótesis de ensayo',
    },

    /* ---------------- Carga del mando sobre el collar ----------------
       F_L: fuerza vertical que el varillaje (A–B–C, piloto, bielas) ejerce
       sobre el collar, positiva hacia abajo. NO se conoce: el RVTH es
       cinemático. Valor por defecto = 0 (carga nula ASUMIDA). */
    mando: {
      cargaVarillaje: 0,      // N
      estado: 'asumido (desconocido)',
    },

    /* ---------------- Transmisión turbina → husillo ----------------
       i se DERIVA al cargar: el valor que hace que n = 360 rpm dé
       s = 49 mm con el ajuste en su punto medio (fisica.js). */
    transmision: {
      nDiseno: 360,           // rpm del eje de la turbina (60 Hz)
      sDiseno: 49,            // mm (referencia de montaje de DESARROLLO_GOBERNADOR)
      estado: 'derivado',
    },

    /* ---------------- Ensayo (velocidad impuesta) ---------------- */
    ensayo: {
      rampa: 60,              // rpm/s: la velocidad del eje sigue a la consigna con esta rampa
      nMax: 450,              // rpm
      dt: 0.001,              // s, paso fijo de integración (RK4)
      estado: 'provisional',
    },

    /* ---------------- Animación (independiente de la física) ---------------- */
    visual: {
      escala: 0.1,            // vueltas visuales por vuelta física del husillo
      escalaMax: 1,
    },

    /* ---------------- Referencia DESARROLLO_GOBERNADOR (solo lectura) -------- */
    rvth: {
      origenWatt: { x: 358, y: 32 },  // px locales de #conjunto-mecanico
      escala: 0.25,                   // px/mm
      xA: 371.25,                     // px
      orejaA: 13.25,                  // px (eje → pasador A)
      sMinUtil: 39.55,                // mm (pistón 100 %)
      sMaxUtil: 63.02,                // mm (pistón 0 %)
      sReposoCerrado: 63.02,          // mm: piloto en neutro con Fink cerrado (p = 0, b = 0)
      sReferencia: 49,                // mm (p = 60.07 %)
      espacioGraficoSobrePasadores: 80, // mm de DIBUJO visibles sobre los pasadores en la escena (viewBox y = 45; pasadores en y = 65). Restricción gráfica, no física
      estado: 'referencia',
    },

    /* ---------------- Bastidor del ajuste (mm) ----------------
       Columna fija a la izquierda, fuera del barrido de las bolas
       (r_bola máx + radio = 352.5 mm), brazo superior hasta el eje y cubo
       fijo que aloja la corona-tuerca del tornillo de ajuste. — provisional */
    bastidor: {
      columnaX0: -440, columnaX1: -410,
      brazoY0: 40, brazoY1: 56,
      cubo: { semiancho: 20, y0: 30, y1: 76 },
      motor: { x0: -470, x1: -380, y0: 56, y1: 78 },
      pie: { x0: -470, x1: -90, y0: -670, y1: -650 },
      estado: 'provisional',
    },

    /* ---------------- Cadena de ajuste (definición geométrica ÚNICA, mm) -----
       La usan física, dibujo y verificación a través de js/ajuste_geometria.js.
       Alturas relativas a la cara INFERIOR del asiento superior (y_asiento).
       Corrección 2: tornillo NO giratorio que se traslada (chaveta en el cubo
       fijo) movido por una corona-tuerca giratoria alojada en el cubo; su
       extremo inferior empuja, por un rodamiento axial, al empujador que gira
       con el husillo y lleva el pasador transversal. — dimensiones provisionales */
    ajusteGeo: {
      platilloInferior: { semiancho: 42, alto: 5, rInterior: 28 },  // apoyo inferior del resorte (sobre el manguito)
      asiento: { semiancho: 44, alto: 8 },                          // disco: su cara inferior es el apoyo superior
      cuboAsiento: { semiancho: 20, alto: 12 },                     // cubo del asiento, desliza sobre el husillo
      pasador: { r: 4, semilargo: 20 },                             // Ø8, centrado en el cubo del asiento
      empujador: { semiancho: 7, semialto: 7 },                     // gira con el husillo
      rodamiento: { alto: 4.5, dExt: 12, dInt: 6 },                 // axial de bolas (p. ej. 6×12×4.5)
      tornillo: { semiancho: 5, espiga: 3 },                        // Tr 10×2; espiga Ø6 dentro del rodamiento
      collarLeva: { alto: 8, semiancho: 14 },                        // en el extremo superior: acciona los finales de carrera
      taladro: { semiancho: 8, margenFondo: 4 },                    // husillo Ø26 con taladro Ø16
      ranuras: { y0: -170, y1: -42, ancho: 8 },                     // ranuras axiales del husillo para el pasador
      estado: 'provisional',
    },
  });
})(window.RW = window.RW || {});
