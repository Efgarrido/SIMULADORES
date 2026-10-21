/* =====================================================================
 * interfaz.js — API pública del módulo para conectar el varillaje
 * ---------------------------------------------------------------------
 * Uso desde otro módulo (cuando se integre):
 *
 *   const rw = RW.Regulador;
 *   rw.limites()            -> { sMin: 0, sMax, unidades: 'mm' }
 *   rw.fijarPosicion(s)     -> fija la elevación del manguito (se limita a topes).
 *                              Si s no es un número finito se rechaza: devuelve
 *                              { aceptada: false, ... } con el último estado válido.
 *   rw.salida()             -> { x, y, desplazamiento, enTope, unidades }
 *   rw.alCambiar(fn)        -> fn(salida, estadoCompleto) cuando cambia la apertura s.
 *                              El giro NO dispara este aviso: la salida es una
 *                              referencia vertical que no orbita con el husillo.
 *   rw.giro()               -> { enMarcha, faseGrados, velocidadVisual, unidades }
 *                              (velocidad de ANIMACIÓN, no RPM físicas)
 *   rw.estado()             -> estado cinemático completo (codos, masas, r, h…)
 *
 * Coordenadas de `salida()`: sistema del regulador (origen en el EJE a la
 * altura de los pasadores superiores del cabezal, x radial a la derecha, y hacia arriba, mm). `desplazamiento` es
 * la elevación del punto de salida desde el tope inferior (positivo hacia
 * arriba) y coincide con s, porque el punto de salida es solidario al
 * manguito. Para el varillaje basta normalmente con `desplazamiento`;
 * x, y sirven para situar físicamente la articulación.
 * ===================================================================== */
(function (RW) {
  'use strict';

  function crear(animador) {
    const aSalida = (e) => ({
      x: e.salida.x, y: e.salida.y,
      desplazamiento: e.salida.desplazamiento,
      enTope: e.enTope, unidades: RW.GEOMETRIA.unidades,
    });
    return Object.freeze({
      limites: () => ({ sMin: RW.Cinematica.LIMITES.sMin, sMax: RW.Cinematica.LIMITES.sMax, unidades: RW.GEOMETRIA.unidades }),
      fijarPosicion: (s) => { const ok = animador.fijarPosicion(s); return Object.assign({ aceptada: ok }, aSalida(animador.ultimoEstado())); },
      salida: () => aSalida(animador.ultimoEstado()),
      estado: () => animador.ultimoEstado(),
      alCambiar: (fn) => {
        let sPrevia = null;
        animador.suscribir((e) => {
          if (e.s === sPrevia) return;      // sólo cambios de apertura
          sPrevia = e.s;
          fn(aSalida(e), e);
        });
      },
      giro: () => ({
        enMarcha: animador.estado.giro,
        faseGrados: animador.estado.fase * 180 / Math.PI,
        velocidadVisual: animador.estado.velocidadVisual,
        unidades: 'vueltas/min de animación (no RPM físicas)',
      }),
    });
  }

  RW.crearInterfaz = crear;
})(window.RW = window.RW || {});
