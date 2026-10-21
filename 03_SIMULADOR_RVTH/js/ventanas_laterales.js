"use strict";

/* =====================================================
   SIMULADOR RVTH — VENTANAS LATERALES (etapa 20, 18-oct-2026)

   Copia de la implementación de 06_CALDERA_PIROTUBULAR
   (js/simulador.js): apertura y cierre de los paneles
   laterales (clase «abierto», aria-expanded, aria-hidden,
   inert y devolución del foco).
     · Izquierdo: procedimientos (botón ☰).
     · Derecho: panel vacío, reservado para el
       sincronoscopio (indicador redondo junto a Operación).
   Etapa 21 (19-oct-2026): se retira el anunciador de
   alarmas; el panel derecho queda limpio.
===================================================== */

/* ---------- Panel lateral izquierdo: procedimientos ---------- */

(() => {
    const panel = document.getElementById("panelProcedimientos");
    const abrir = document.getElementById("btnProcedimientos");
    const cerrar = document.getElementById("btnCerrarProcedimientos");

    // El panel lateral es auxiliar y no oculta la pantalla de proceso.
    panel.classList.add("panel-lateral");

    function cambiarMenuLateral(abierto) {
        panel.classList.toggle("abierto", abierto);
        abrir.setAttribute("aria-expanded", String(abierto));

        // Devolver el foco antes de ocultar el panel a ayudas técnicas.
        if (!abierto && panel.contains(document.activeElement)) {
            abrir.focus();
        }

        panel.setAttribute("aria-hidden", String(!abierto));
        panel.inert = !abierto;

        if (abierto) {
            cerrar.focus();
        }
    }

    abrir.addEventListener("click", () => cambiarMenuLateral(true));
    cerrar.addEventListener("click", () => cambiarMenuLateral(false));
    cambiarMenuLateral(false);

    /* ---------- Panel lateral derecho (reservado: sincronoscopio) ---------- */

    const panelAlarmas = document.getElementById("pantallaAlarmas");
    const abrirAlarmas = document.getElementById("btnAlarmas");
    const cerrarAlarmas = document.getElementById("btnCerrarAlarmas");

    function cambiarPanelAlarmas(abierto) {
        panelAlarmas.classList.toggle("abierto", abierto);
        if (!abierto && panelAlarmas.contains(document.activeElement)) {
            abrirAlarmas.focus();
        }
        panelAlarmas.setAttribute("aria-hidden", String(!abierto));
        panelAlarmas.inert = !abierto;
        if (abierto) {
            cerrarAlarmas.focus();
        }
    }

    if (panelAlarmas && abrirAlarmas && cerrarAlarmas) {
        cambiarPanelAlarmas(false);
        panelAlarmas.hidden = false;
        abrirAlarmas.addEventListener("click", () => cambiarPanelAlarmas(true));
        cerrarAlarmas.addEventListener("click", () => cambiarPanelAlarmas(false));
    }
})();
