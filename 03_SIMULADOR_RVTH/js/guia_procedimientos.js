"use strict";

/* =====================================================
   SIMULADOR RVTH — GUÍA DE PROCEDIMIENTOS (etapa 20)

   Copia de 06_CALDERA_PIROTUBULAR/js/guia-arranque.js.
   Guías manuales independientes del proceso y sin
   almacenamiento persistente: las marcas las pone el
   alumno, no son una validación automática.
   Diferencia con la caldera: aquí Paro también tiene
   actividades, así que el contador y el color de las
   pestañas funcionan en ambos procedimientos.
===================================================== */

(() => {
    const panel = document.getElementById("panelProcedimientos");
    const selector = document.getElementById("selectorProcedimiento");
    const anterior = document.getElementById("guiaAnterior");
    const siguiente = document.getElementById("guiaSiguiente");
    const contenidoArranque = document.getElementById("contenidoProcedimiento");
    const contenidoParo = document.getElementById("contenidoProcedimientoParo");
    const filaParo = document.getElementById("guiaPestanasParo");
    const filaArranque = document.getElementById("guiaPestanasArranque");
    const grupos = {
        arranque: { fila: filaArranque, contenido: contenidoArranque, seleccionado: 0 },
        paro: { fila: filaParo, contenido: contenidoParo, seleccionado: 0 }
    };
    Object.values(grupos).forEach(grupo => {
        grupo.pestañas = Array.from(grupo.fila.querySelectorAll('[role="tab"]'));
        grupo.pasos = Array.from(grupo.contenido.querySelectorAll('[role="tabpanel"]'));
    });

    function contar(nombre, paso, indice) {
        const casillas = Array.from(paso.querySelectorAll('input[type="checkbox"]'));
        const marcadas = casillas.filter(casilla => casilla.checked).length;
        const completo = casillas.length > 0 && marcadas === casillas.length;
        const pestaña = grupos[nombre].pestañas[indice];
        pestaña.classList.toggle("guia-completo", completo);
        pestaña.setAttribute("aria-label", `Paso ${indice}, ${completo ? "completo" : "incompleto"}`);
        const contador = paso.querySelector(".guia-contador");
        if (contador) contador.textContent = `${marcadas} de ${casillas.length} actividades marcadas`;
    }

    function seleccionar(nombre, indice, enfocar = false) {
        const grupo = grupos[nombre];
        grupo.seleccionado = indice;
        grupo.pestañas.forEach((pestaña, i) => {
            pestaña.setAttribute("aria-selected", String(i === indice));
            pestaña.tabIndex = i === indice ? 0 : -1;
            grupo.pasos[i].hidden = i !== indice;
        });
        if (selector.value === nombre) {
            anterior.disabled = indice === 0;
            siguiente.disabled = indice === grupo.pasos.length - 1;
        }
        if (enfocar) {
            grupo.pestañas[indice].focus();
            grupo.pestañas[indice].scrollIntoView({ block: "nearest", inline: "nearest" });
        }
    }

    Object.entries(grupos).forEach(([nombre, grupo]) => {
        grupo.pestañas.forEach((pestaña, i) => {
            pestaña.addEventListener("click", () => seleccionar(nombre, i));
            pestaña.addEventListener("keydown", ev => {
                let destino;
                if (ev.key === "ArrowRight") destino = (i + 1) % grupo.pasos.length;
                else if (ev.key === "ArrowLeft") destino = (i + grupo.pasos.length - 1) % grupo.pasos.length;
                else if (ev.key === "Home") destino = 0;
                else if (ev.key === "End") destino = grupo.pasos.length - 1;
                else return;
                ev.preventDefault();
                seleccionar(nombre, destino, true);
            });
        });
        grupo.pasos.forEach((paso, i) => {
            paso.addEventListener("change", () => contar(nombre, paso, i));
            contar(nombre, paso, i);
        });
        seleccionar(nombre, 0);
    });
    anterior.addEventListener("click", () => {
        const grupo = grupos[selector.value];
        if (!grupo) return;
        seleccionar(selector.value, Math.max(0, grupo.seleccionado - 1), true);
    });
    siguiente.addEventListener("click", () => {
        const grupo = grupos[selector.value];
        if (!grupo) return;
        seleccionar(selector.value, Math.min(grupo.pasos.length - 1, grupo.seleccionado + 1), true);
    });
    // Limpia el procedimiento que se está mostrando.
    document.getElementById("guiaLimpiar").addEventListener("click", () => {
        const nombre = selector.value;
        grupos[nombre].pasos.forEach((paso, i) => {
            paso.querySelectorAll('input[type="checkbox"]').forEach(casilla => { casilla.checked = false; });
            contar(nombre, paso, i);
        });
    });
    function mostrarProcedimiento() {
        if (!Object.hasOwn(grupos, selector.value)) selector.value = "arranque";
        Object.entries(grupos).forEach(([nombre, grupo]) => {
            grupo.fila.hidden = grupo.contenido.hidden = selector.value !== nombre;
        });
        seleccionar(selector.value, grupos[selector.value].seleccionado);
    }
    selector.addEventListener("change", mostrarProcedimiento);
    mostrarProcedimiento();
})();
