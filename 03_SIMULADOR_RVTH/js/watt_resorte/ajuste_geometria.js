/* =====================================================================
 * ajuste_geometria.js — Definición geométrica ÚNICA de los apoyos del
 * resorte y de la cadena de ajuste (asiento, pasador, empujador,
 * rodamiento, tornillo, collar de leva). La usan fisica.js, verificacion.js
 * y dibujo_resorte.js: ninguna de ellas recalcula estas cotas por su cuenta.
 * Unidades: mm, sistema del módulo (origen en el eje a la altura de los
 * pasadores superiores, y hacia arriba). Funciones puras.
 * ===================================================================== */
(function (RW) {
  'use strict';
  const P = RW.PARAM, G = RW.GEOMETRIA, C = RW.Cinematica;
  const AG = P.ajusteGeo, AJ = P.ajuste, B = P.bastidor;

  /** Cara inferior del asiento superior = apoyo superior del resorte. */
  const yAsiento = (a) => AJ.yAsientoLento - a;

  /** Superficies reales de apoyo del resorte para s [mm] y a [mm]. */
  function apoyos(sMm, a) {
    const yP = C.LIMITES.yPMin + sMm;                      // pivotes del manguito
    const yCaraManguito = yP + G.manguito.caraSuperior;    // cara superior del manguito
    const yInf = yCaraManguito + AG.platilloInferior.alto; // cara superior del platillo
    const ySup = yAsiento(a);
    return { yCaraManguito, yInf, ySup, L: ySup - yInf };
  }

  /* Final de carrera RÁPIDO: sobre la cara superior del cubo fijo.
     Longitud del tornillo: con a = recorrido (asiento abajo), la cara
     inferior del collar de leva llega justo al final de carrera RÁPIDO. */
  const fcRapido = { y0: B.cubo.y1, y1: B.cubo.y1 + 6, x0: 8, x1: 18 };
  function baseTornillo(a) {
    const yPin = yAsiento(a) + AG.asiento.alto + AG.cuboAsiento.alto / 2;
    return yPin + AG.empujador.semialto + AG.rodamiento.alto;
  }
  const longitudTornillo = (fcRapido.y1 + AG.collarLeva.alto) - baseTornillo(AJ.recorrido);

  /** Cotas (mm) de todas las piezas de la cadena de ajuste para un ajuste a. */
  function piezas(a) {
    const yAs = yAsiento(a);
    const disco = { y0: yAs, y1: yAs + AG.asiento.alto, semiancho: AG.asiento.semiancho };
    const cubo = { y0: disco.y1, y1: disco.y1 + AG.cuboAsiento.alto, semiancho: AG.cuboAsiento.semiancho };
    const yPin = (cubo.y0 + cubo.y1) / 2;
    const pasador = { yc: yPin, y0: yPin - AG.pasador.r, y1: yPin + AG.pasador.r, r: AG.pasador.r, semilargo: AG.pasador.semilargo };
    const empujador = { y0: yPin - AG.empujador.semialto, y1: yPin + AG.empujador.semialto, semiancho: AG.empujador.semiancho };
    const rodamiento = { y0: empujador.y1, y1: empujador.y1 + AG.rodamiento.alto, semiancho: AG.rodamiento.dExt / 2 };
    const tornillo = { y0: rodamiento.y1, y1: rodamiento.y1 + longitudTornillo, semiancho: AG.tornillo.semiancho };
    const collar = { y0: tornillo.y1 - AG.collarLeva.alto, y1: tornillo.y1, semiancho: AG.collarLeva.semiancho };
    return { yAs, disco, cubo, pasador, empujador, rodamiento, tornillo, collar };
  }

  /* Finales de carrera: posiciones fijas (en el cubo y en un poste del cubo),
     deducidas de las posiciones del collar en los extremos de la carrera. */
  const yCollarTopLento = piezas(0).collar.y1;
  const fcLento = { y0: yCollarTopLento, y1: yCollarTopLento + 6, x0: 8, x1: 18 };   // toca la cara superior del collar con a = 0
  const poste = { x0: 18, x1: 22, y0: B.cubo.y1, y1: fcLento.y1 + 4 };

  /** Altura máxima del conjunto sobre los pasadores (para la escena). */
  const alturaMaxima = Math.max(poste.y1, B.motor.y1, B.cubo.y1);

  RW.AjusteGeo = Object.freeze({ yAsiento, apoyos, piezas, longitudTornillo, fcRapido, fcLento, poste, alturaMaxima });
})(window.RW = window.RW || {});
