/* =====================================================================
 * geometria.js — Parámetros centralizados del regulador centrífugo de Watt
 * ---------------------------------------------------------------------
 * ÚNICA fuente de dimensiones del módulo. Ningún otro archivo debe
 * contener cotas del mecanismo; el cálculo y el dibujo leen de aquí.
 *
 * VERSIÓN 2 — cabezal giratorio con DOS pivotes superiores separados
 * (sustituye al pivote común sobre el eje de la versión 1).
 *
 * SISTEMA DE COORDENADAS (plano meridiano del regulador)
 *   Origen O : punto del EJE del husillo a la altura donde la versión 1
 *              tenía el pivote común (referencia de IMG_2477). Con los
 *              valores actuales, los dos pivotes superiores están a esa
 *              misma altura: A_der = (+a, yA), A_izq = (−a, yA), yA = 0.
 *   x        : radial, positivo hacia la derecha.
 *   y        : vertical, positivo hacia ARRIBA (el mecanismo queda en y < 0).
 *   Unidades : mm.
 *   Topes, manguito y salida conservan sus cotas absolutas de la versión 1.
 *
 * ESTADO DE CADA DATO (campo `fuente`)
 *   'figura'  : proporción medida sobre IMG_2477.jpeg (sin cotas, ±2 px).
 *   'asumido' : valor elegido para construir el modelo; no deducible de las
 *               imágenes. Ajustable; confirmar antes de calcular fuerzas.
 *   Ninguna cota está confirmada con un plano acotado.
 *
 * ESCALA: se ASUME 1 px de IMG_2477 = 1 mm (ver LEEME.md).
 * ===================================================================== */
(function (RW) {
  'use strict';

  const ESCALA = 1.0; // mm por px de la figura — ASUMIDO
  const px = (v) => v * ESCALA;

  RW.GEOMETRIA = Object.freeze({
    version: 2,
    unidades: 'mm',
    escala: { valor: ESCALA, fuente: 'asumido', nota: '1 px de IMG_2477 = 1 mm' },

    /* ---------------- Cabezal giratorio (solidario al husillo) ----------
       Bloque fijado a la parte alta del husillo; gira con él. Lleva dos
       horquillas con un pasador cada una, simétricas respecto al eje. */
    cabezal: {
      separacionPivotes: 70,   // distancia ENTRE los dos pasadores (2a) — asumido
      alturaPivotes: 0,        // y de los pasadores en el sistema O — asumido
      cuboSemiancho: 22,       // cubo central que abraza el husillo — asumido
      cuboArriba: 26,          // cara superior del cubo, relativa a yA — asumido
      cuboAbajo: -30,          // cara inferior del cubo, relativa a yA — asumido
      horquillaSemialto: 15,   // semialtura de cada orejeta portapasador — asumido
      horquillaExceso: 14,     // la orejeta sobresale este tanto más allá del pasador — asumido
      radioPasador: 7,         // — asumido
      remate: { alto: 22, radio: 12 }, // pomo superior decorativo — asumido
      fuente: 'asumido',
      nota: 'Sin cotas en las referencias; valores ajustables',
    },

    /* Brazo superior: de SU pasador superior (A) al codo (E). */
    brazoSuperior: {
      L: px(246), fuente: 'figura',
      nota: 'A → codo; longitud conservada de la versión 1',
    },

    /* La masa va en la prolongación del brazo superior: A, codo y centro
       de la bola son colineales; distancia medida desde A. */
    masa: {
      distanciaCentro: px(362), fuente: 'figura',
      radio: px(47), fuenteRadio: 'figura',
      cuelloLongitud: px(14), fuenteCuello: 'asumido',
      valorMasa: null, fuenteMasa: 'pendiente — no deducible de la figura',
    },

    /* Brazo inferior: del codo al pivote del manguito. */
    brazoInferior: { L: px(227), fuente: 'figura', nota: 'Codo → pivote del manguito' },

    /* Manguito. Cotas verticales RELATIVAS a la altura de sus pivotes (yP). */
    manguito: {
      excentricidadPivote: px(48), fuente: 'figura',
      caraSuperior: px(12),
      caraInferior: px(-99),
      orejetas: { ySup: px(12), yInf: px(-13), semiancho: px(48) },
      cuerpoSemiancho: px(27),
      bridaSuperior: { ySup: px(-36), yInf: px(-51), semiancho: px(54) },
      bridaInferior: { ySup: px(-86), yInf: px(-99), semiancho: px(54) },
      fuenteDetalles: 'figura (forma simplificada)',
    },

    /* Punto de salida hacia el varillaje: centro de la ranura del collar. */
    salida: { x: 0, dyDesdePivote: px(-65), fuente: 'figura' },

    /* Topes S: collares fijados al husillo (giran con él). No son resortes. */
    topes: {
      superior: { caraInferior: px(-301), alto: px(20), semiancho: px(24) },
      inferior: { caraSuperior: px(-510), alto: px(27), semiancho: px(24) },
      fuente: 'figura',
    },

    /* Husillo (gira). */
    husillo: {
      semiancho: px(13), fuente: 'figura',
      yAbajo: px(-662), fuenteLongitud: 'asumido (figura recortada)',
      // el extremo superior queda dentro del cabezal
    },

    /* Soporte fijo: cojinete + bancada que sostienen el husillo y permiten
       su giro. Las referencias no muestran el apoyo: posición y forma asumidas. */
    soporteFijo: {
      cojinete: { yArriba: -600, yAbajo: -650, semiancho: 34 },
      bancada:  { yArriba: -650, yAbajo: -670, semiancho: 90 },
      fuente: 'asumido',
    },

    trazos: { brazoSuperior: 16, brazoInferior: 12, pasador: 7 },

    /* Espesores tangenciales (perpendiculares al plano meridiano). Sólo se
       notan durante el giro, cuando las piezas se ven de canto. — asumidos */
    espesores: {
      horquilla: 26,         // horquillas del cabezal
      orejetaManguito: 22,   // orejetas del manguito
      pasadorSuperior: 30,   // longitud de los pasadores superiores
      pasadorCodo: 18,
      pasadorManguito: 24,
      fuente: 'asumido',
    },

    /* Animación del giro (sólo visual; NO es la velocidad física). */
    giro: {
      velocidadVisualInicial: 90,  // rpm visuales a 360 rpm del eje (25 %): 0.6667 s por vuelta, como Francis (etapa 22; antes 36)
      velocidadVisualMin: 1,
      velocidadVisualMax: 120,     // etapa 22: margen sobre los 90 rpm nominales (antes 60)
      saltoMaximoMs: 250,          // separación entre fotogramas que se trata como pausa
    },

    /* Reservado para un resorte coaxial futuro (no se suponen sus datos). */
    resorte: null,

    /* Elevación del manguito que aparece en IMG_2477 (botón de la página). */
    referenciaFigura: { yPivoteManguito: px(-390), fuente: 'figura' },
  });
})(window.RW = window.RW || {});
