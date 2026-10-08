"use strict";

// Equivalencia didáctica lineal masa/altura; no representa geometría cilíndrica.
const CAPACIDAD_EQUIVALENTE_AGUA = 1000; // kg
const CAUDAL_MAX_AGUA = 0.50; // kg/s
const CAUDAL_MAX_COMBUSTIBLE = 0.025; // kg/s; relación didáctica lineal, sin combustión
const CAUDAL_MAX_AIRE = 0.50; // kg/s; aproximación didáctica lineal
// Supuestos didácticos ajustables; no son el ajuste certificado de un quemador real.
const CONTROL_AIRE = {
    relacionAireDiesel: 14.5, // kg de aire/kg de combustible
    excesoAire: 1.20,
    aperturaPreparacion: 30 // % con quemador apagado
};
// PI didáctico: error en puntos porcentuales del HMI relativo; tiempo simulado.
const CONTROL_NIVEL = Object.freeze({
    consigna: 0,
    kp: 0.030, // kg/(s·% relativo)
    ki: 0.000030, // kg/(s²·% relativo)
    velocidadApertura: 1.0 // puntos de apertura/s; transición gradual del actuador
});
function iniciarControlNivel(estado, relativo) {
    estado.integralNivel = CAUDAL_MAX_AGUA * estado.aperturaAlimentacion / 100 -
        estado.caudalSalidasNivel - CONTROL_NIVEL.kp * (CONTROL_NIVEL.consigna - relativo);
}
function regularNivel(estado, relativo, dt) {
    if (estado.modoAlimentacion !== "automatico" || !estado.bombaEnMarcha) return;
    const error = CONTROL_NIVEL.consigna - relativo;
    const base = estado.caudalSalidasNivel + CONTROL_NIVEL.kp * error;
    const candidata = estado.integralNivel + CONTROL_NIVEL.ki * error * dt;
    const solicitada = base + candidata;
    // Integración condicional: permitir siempre la recuperación de la saturación.
    if (!((solicitada > CAUDAL_MAX_AGUA && error > 0) || (solicitada < 0 && error < 0))) {
        estado.integralNivel = candidata;
    }
    const objetivo = 100 * Math.min(CAUDAL_MAX_AGUA, Math.max(0, base + estado.integralNivel)) / CAUDAL_MAX_AGUA;
    const paso = CONTROL_NIVEL.velocidadApertura * dt;
    estado.aperturaAlimentacion += Math.min(paso, Math.max(-paso, objetivo - estado.aperturaAlimentacion));
}
// PI didáctico FV-2: bar(a), kg/s de combustible y segundos simulados.
// Nivel relativo del HMI (%), segundos simulados. Alarma informativa.
const ALARMA_NIVEL_BAJO = Object.freeze({ activacion: -10, reposicion: -8, retardo: 2 });
function crearAlarmaNivelBajo() {
    return { activa: false, reconocida: false, aviso: false, contador: 0, aparicion: null };
}
const ALARMAS_NIVEL_ALTO = Object.freeze({
    nivelAlto: Object.freeze({ activacion: 10, reposicion: 8, retardo: 2 }),
    nivelMuyAlto: Object.freeze({ activacion: 15, reposicion: 13, retardo: 2 })
});
// Reflejar el eje de nivel permite reutilizar el mismo retardo e histéresis.
function evaluarAlarmaNivelAlto(a, n0, n1, t0, dt, cfg, nombre) {
    return evaluarCondicionNivel(a, -n0, -n1, t0, dt,
        { activacion: -cfg.activacion, reposicion: -cfg.reposicion, retardo: cfg.retardo }, nombre);
}
// Presión manométrica del HMI (bar(g)); tiempo en segundos simulados.
const PROTECCIONES_SERVICIOS = Object.freeze({ aireActivacion: 0.80, aireReposicion: 0.90, retardoAire: 1 });
const ALARMAS_PRESION = Object.freeze({
    presionAlta: Object.freeze({ activacion: 7.50, reposicion: 7.30, retardo: 1 }),
    presionMuyAlta: Object.freeze({ activacion: 8.00, reposicion: 7.80, retardo: 1 })
});
function evaluarAlarmaPresion(a, p0, p1, t0, dt, cfg, nombre) {
    return evaluarCondicionNivel(a, -p0, -p1, t0, dt,
        { activacion: -cfg.activacion, reposicion: -cfg.reposicion, retardo: cfg.retardo }, nombre);
}
const DISPARO_NIVEL_MUY_BAJO = Object.freeze({ activacion: -20, reposicion: -18, retardo: 2 });
function evaluarAlarmaNivelBajo(a, n0, n1, t0, dt) {
    return evaluarCondicionNivel(a, n0, n1, t0, dt, ALARMA_NIVEL_BAJO, "Nivel bajo");
}
function evaluarNivelMuyBajo(a, n0, n1, t0, dt) {
    return evaluarCondicionNivel(a, n0, n1, t0, dt, DISPARO_NIVEL_MUY_BAJO, "Nivel muy bajo");
}
function evaluarCondicionNivel(a, n0, n1, t0, dt, cfg, nombre) {
    const eventos = [];
    if (![n0, n1, t0, dt].every(Number.isFinite) || dt <= 0) { a.contador = 0; return eventos; }
    // Evitar que la conversión inversa de nivel desplace un umbral exacto
    // por unas unidades de redondeo binario; no usar el HMI redondeado.
    for (const umbral of [cfg.activacion, cfg.reposicion]) {
        if (Math.abs(n0 - umbral) < 1e-10) n0 = umbral;
        if (Math.abs(n1 - umbral) < 1e-10) n1 = umbral;
    }
    if (!a.activa) {
        let inicio = 0, duracion = 0;
        if (n0 <= cfg.activacion && n1 <= cfg.activacion) duracion = dt;
        else if (n0 > cfg.activacion && n1 <= cfg.activacion) {
            inicio = dt * (n0 - cfg.activacion) / (n0 - n1);
            duracion = dt - inicio; a.contador = 0;
        } else if (n0 <= cfg.activacion && n1 > cfg.activacion) {
            duracion = dt * (cfg.activacion - n0) / (n1 - n0);
        } else a.contador = 0;
        if (duracion > 0 && a.contador + duracion >= cfg.retardo - 1e-10) {
            a.aparicion = t0 + inicio + Math.max(0, cfg.retardo - a.contador);
            a.activa = true; a.reconocida = false; a.aviso = true; a.contador = 0;
            eventos.push({ descripcion: `Aparición de alarma: ${nombre}`, tiempo: a.aparicion });
        } else a.contador += duracion;
        if (n1 > cfg.activacion) a.contador = 0;
    }
    if (a.activa && n1 >= cfg.reposicion) {
        const tiempo = n0 >= cfg.reposicion ? t0 : t0 + dt * (cfg.reposicion - n0) / (n1 - n0);
        a.activa = false; a.contador = 0;
        if (a.reconocida) a.aviso = false;
        eventos.push({ descripcion: `Desaparición de alarma: ${nombre}`, tiempo });
    }
    return eventos;
}
const CONTROL_PRESION = Object.freeze({
    consignaAbsoluta: 8.00, // 6.98675 bar(g) con la atmósfera existente
    kp: 0.0040, // kg/(s·bar)
    ki: 0.0000060, // kg/(s²·bar)
    aperturaMinima: 0,
    aperturaMaxima: 100,
    velocidadApertura: 0.50 // puntos porcentuales/s simulado
});
function anticipacionCombustible(estado) {
    const perdidas = TERMICA.perdidas * (estado.temperatura - TERMICA.ambiente);
    return Math.max(0, estado.cargaTermicaCombustible + perdidas) / (TERMICA.pciDiesel * TERMICA.eficiencia);
}
function iniciarControlPresion(estado) {
    estado.integralPresion = CAUDAL_MAX_COMBUSTIBLE * estado.aperturaCombustible / 100 -
        anticipacionCombustible(estado) - CONTROL_PRESION.kp * (CONTROL_PRESION.consignaAbsoluta - estado.presionAbsoluta);
}
function regularPresion(estado, dt) {
    if (estado.protecciones?.enclavado) { estado.integralPresion = 0; return; }
    if (estado.modoCombustible !== "automatico" || !estado.quemadorEncendido ||
        !estado.vtfEnMarcha || !estado.bombaCombustibleEnMarcha || !estado.corteCombustibleAbierto || estado.caudalAire <= 0) return;
    const error = CONTROL_PRESION.consignaAbsoluta - estado.presionAbsoluta;
    const base = anticipacionCombustible(estado) + CONTROL_PRESION.kp * error;
    const candidata = estado.integralPresion + CONTROL_PRESION.ki * error * dt;
    const minimo = CAUDAL_MAX_COMBUSTIBLE * CONTROL_PRESION.aperturaMinima / 100;
    const maximo = CAUDAL_MAX_COMBUSTIBLE * CONTROL_PRESION.aperturaMaxima / 100;
    const solicitada = base + candidata;
    if (!((solicitada > maximo && error > 0) || (solicitada < minimo && error < 0))) {
        estado.integralPresion = candidata;
    }
    const objetivo = 100 * Math.min(maximo, Math.max(minimo, base + estado.integralPresion)) / CAUDAL_MAX_COMBUSTIBLE;
    const paso = CONTROL_PRESION.velocidadApertura * dt;
    estado.aperturaCombustible += Math.min(paso, Math.max(-paso, objetivo - estado.aperturaCombustible));
}
// Potencia de reposición a T/P constante, sin incluir pérdidas ni calor de combustión.
// dE/dM de mezcla a volumen fijo evita contar otra vez la energía almacenada.
function cargaTermicaSalidas(actual, nuevo, dt) {
    const derivada = (actual.vv * actual.ul - actual.vl * actual.uv) / (actual.vv - actual.vl);
    return ((nuevo.salidaProceso + nuevo.salidaVenteo) * (actual.hv - derivada) +
        nuevo.salidaLiquida * (actual.hl - derivada) -
        nuevo.entradaAceptada * (TABLA_AGUA_SATURADA.entalpiaAlimentacion - derivada)) / dt;
}
const CAUDAL_DRENAJE = 0.02; // kg/s; 40 % del caudal original (0.05 kg/s)
const FACTOR_TIEMPO = 30;
const VENTANA_TENDENCIAS = 12000; // s simulados = 400 s reales a ×30
const INTERVALO_MUESTREO = 10; // s simulados
const ESPERA_REPETICION_APERTURA_MS = 250;
const INTERVALO_REPETICION_APERTURA_MS = 20;

// Supuestos didácticos ajustables; energía en kJ, potencia en kW = kJ/s.
const TERMICA = {
    pciDiesel: 42500, // kJ/kg
    eficiencia: 0.80, // transferencia; las pérdidas ambientales se restan por separado
    ambiente: 25, alimentacion: 25, // °C
    cpAgua: 4.18, // kJ/(kg·K), constante
    capacidadMetal: 250, // kJ/K
    perdidas: 0.10, // kW/K
    atmosfera: 1.01325, // bar(a)
    // CoolProp IF97::Water a P=101325 Pa, Q=0/1 (IAPWS-IF97):
    // https://coolprop.org/fluid_properties/IF97.html
    // T=373.12430000048073 K; hf=418990.7178041907, hg=2675531.466041948 J/kg.
    saturacion: 99.97430000048073, // °C
    latente: 2256.540748237757, // kJ/kg; (hg-hf)/1000
    subpaso: 0.25 // s simulados; limita cambios de masa y transiciones de fase
};

// Balance abierto de agua + metal, con energía sensible referida a 25 °C.
// E=(m·cp+Cmetal)·(T-Tamb). Entrada fría y drenaje a T del recipiente.
function integrarAguaTermica(masa, temperatura, entrada, drenaje, combustible, quemador, venteo, dt) {
    const salida = Math.min(drenaje * dt, masa + entrada * dt);
    const entrante = Math.min(entrada * dt, Math.max(0, CAPACIDAD_EQUIVALENTE_AGUA - masa + salida));
    let nuevaMasa = Math.max(0, Math.min(CAPACIDAD_EQUIVALENTE_AGUA, masa + entrante - salida));
    let nuevaTemperatura = temperatura;
    let evaporada = 0, instanteEbullicion = null;
    if (venteo) {
        const cp = TERMICA.cpAgua;
        const c0 = TERMICA.capacidadMetal + cp * masa;
        const c1 = TERMICA.capacidadMetal + cp * nuevaMasa;
        // Sin agua ni alimentación, no se calienta el recipiente vacío.
        const potencia = quemador && masa + entrante > 0 ? combustible * TERMICA.pciDiesel * TERMICA.eficiencia : 0;
        const flujoEntrada = entrante / dt;
        const k = TERMICA.perdidas + cp * flujoEntrada;
        const pendienteCapacidad = (c1 - c0) / dt;
        const equilibrio = (potencia + cp * flujoEntrada * (TERMICA.alimentacion - TERMICA.ambiente)) / k;
        const factor = Math.abs(pendienteCapacidad) < 1e-12 ? Math.exp(-k * dt / c0) :
            Math.exp(-k * Math.log(c1 / c0) / pendienteCapacidad);
        const theta0 = temperatura - TERMICA.ambiente;
        const theta1 = equilibrio + (theta0 - equilibrio) * factor;
        const thetaSat = TERMICA.saturacion - TERMICA.ambiente;
        nuevaTemperatura = TERMICA.ambiente + theta1;
        if (nuevaMasa > 0 && theta1 >= thetaSat) {
            if (theta0 < thetaSat) {
                const razon = (thetaSat - equilibrio) / (theta0 - equilibrio);
                instanteEbullicion = Math.abs(pendienteCapacidad) < 1e-12 ? -c0 * Math.log(razon) / k :
                    c0 * (Math.exp(-pendienteCapacidad * Math.log(razon) / k) - 1) / pendienteCapacidad;
            }
            // El exceso sensible se consume como calor latente. Al salir vapor también
            // sale su energía sensible: la reducción de capacidad cancela ese término.
            const exceso = Math.max(0, c1 * (theta1 - thetaSat));
            evaporada = Math.min(nuevaMasa, exceso / TERMICA.latente);
            nuevaMasa -= evaporada;
            // Si se agota el agua dentro del subpaso, conserva el pequeño residual
            // en el metal; los siguientes pasos vacíos solo permiten enfriamiento.
            nuevaTemperatura = TERMICA.saturacion +
                Math.max(0, exceso - evaporada * TERMICA.latente) /
                (TERMICA.capacidadMetal + cp * nuevaMasa);
        }
    }
    return { masa: nuevaMasa, temperatura: nuevaTemperatura, entrante, salida, evaporada, instanteEbullicion };
}

/* =========================================================
   SIMULADOR DE CALDERA PIROTUBULAR
========================================================= */

(() => {
    const panel = document.getElementById("panelProcedimientos");
    const abrir = document.getElementById("btnProcedimientos");
    const cerrar = document.getElementById("btnCerrarProcedimientos");

    // El panel lateral es auxiliar y no oculta la pantalla de proceso.
    panel.classList.add("panel-lateral");

    // Reservar los controles anteriores para una futura etapa de contenidos.
    panel.querySelectorAll(":scope > button").forEach((boton) => {
        boton.hidden = true;
    });

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


// Rangos provisionales de presentación; no intervienen en el modelo del proceso.
const ESCALAS_EJES_PREPARADOS = { presion: 10, temperatura: 200, vapor: 0.50 };
function dibujarGraficaHMIVacia(canvas, estadoEjes = null) {
    const ancho = canvas.clientWidth;
    const alto = canvas.clientHeight;
    if (!ancho || !alto) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const escala = window.devicePixelRatio || 1;
    canvas.width = Math.round(ancho * escala);
    canvas.height = Math.round(alto * escala);
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ancho, alto);
    const esTermica = canvas.id === "graficaDisponible5";
    const izquierda = 54;
    const derecha = ancho - (esTermica ? 54 : 16);
    const arriba = 8;
    const abajo = alto - 27;
    if (derecha <= izquierda || abajo <= arriba) return;
    const inicio = Math.max(0, (estadoEjes?.tiempo || 0) - VENTANA_TENDENCIAS);
    const x = i => izquierda + (derecha - izquierda) * i / 4;
    const y = i => abajo - (abajo - arriba) * i / 4;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#e0e0e0";
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
        ctx.moveTo(x(i), arriba); ctx.lineTo(x(i), abajo);
        ctx.moveTo(izquierda, y(i)); ctx.lineTo(derecha, y(i));
    }
    ctx.stroke();
    ctx.strokeStyle = "#777777";
    ctx.beginPath();
    ctx.moveTo(izquierda, arriba); ctx.lineTo(izquierda, abajo); ctx.lineTo(derecha, abajo);
    if (esTermica) ctx.lineTo(derecha, arriba);
    ctx.stroke();
    ctx.font = "9px Arial, Helvetica, sans-serif";
    ctx.fillStyle = "#555555";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) {
        // Alineación hacia dentro en los extremos para evitar recortes.
        ctx.textAlign = i === 0 ? "left" : i === 4 ? "right" : "center";
        ctx.fillText((inicio + VENTANA_TENDENCIAS * i / 4).toFixed(0), x(i), abajo + 9,
            Math.max(1, (derecha - izquierda) / 4));
    }
    const ejes = esTermica ? [
        { titulo: "Presión [bar(g)]", color: "#2f86c0", maximo: ESCALAS_EJES_PREPARADOS.presion, decimales: 1, derecha: false },
        { titulo: "Temperatura [°C]", color: "#c94f4f", maximo: ESCALAS_EJES_PREPARADOS.temperatura, decimales: 0, derecha: true }
    ] : [{ titulo: "Flujo [kg/s]", color: "#555555", maximo: ESCALAS_EJES_PREPARADOS.vapor, decimales: 3, derecha: false }];
    for (const eje of ejes) {
        ctx.fillStyle = eje.color;
        ctx.textAlign = eje.derecha ? "left" : "right";
        if (eje.maximo !== null) for (let i = 0; i <= 4; i++) {
            ctx.fillText((eje.maximo * i / 4).toFixed(eje.decimales),
                eje.derecha ? derecha + 6 : izquierda - 6, y(i), 30);
        }
        ctx.save();
        ctx.translate(eje.derecha ? ancho - 10 : 10, alto / 2);
        ctx.rotate(-Math.PI / 2); ctx.textAlign = "center";
        ctx.fillText(eje.titulo, 0, 0, Math.max(1, alto - 8));
        ctx.restore();
    }
    ctx.fillStyle = "#555555"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("Tiempo [s]", (izquierda + derecha) / 2, alto - 1);
}


/* Tendencias: muestreo cada 10 s simulados, ventana de 12000 s.
   Solo avanzar() recibe datos del ciclo existente; redimensionar no añade muestras. */
function crearTendenciaNivel(canvas, esFlujo = false, maximoFlujo = CAUDAL_MAX_AGUA, decimalesEje = 3) {
    const VENTANA = VENTANA_TENDENCIAS;
    const INTERVALO = INTERVALO_MUESTREO;
    let maximo = esFlujo ? maximoFlujo : 100;
    let muestras = [{ tiempo: 0, nivel: 0 }];
    let siguienteMuestra = INTERVALO;
    let actual = { tiempo: 0, nivel: 0 };
    function asegurarEscala(valor) {
        if (!esFlujo || !Number.isFinite(valor) || valor <= maximo) return;
        const base = maximoFlujo || 0.5;
        const paso = base / 4;
        maximo = Math.ceil(valor * 1.10 / paso) * paso;
    }

    function dibujar() {
        const ancho = canvas.clientWidth;
        const alto = canvas.clientHeight;
        if (!ancho || !alto) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const escala = window.devicePixelRatio || 1;
        canvas.width = Math.round(ancho * escala);
        canvas.height = Math.round(alto * escala);
        ctx.setTransform(escala, 0, 0, escala, 0, 0);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, ancho, alto);
        const izquierda = esFlujo && decimalesEje > 3 ? 64 : 54;
        const derecha = ancho - 12;
        const arriba = 8;
        const abajo = alto - 27;
        if (derecha <= izquierda || abajo <= arriba) return;
        const inicio = Math.max(0, actual.tiempo - VENTANA);
        const x = (t) => izquierda + (t - inicio) / VENTANA * (derecha - izquierda);
        const y = (n) => abajo - n / maximo * (abajo - arriba);
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#e0e0e0";
        ctx.beginPath();
        for (let i = 0; i <= 4; i++) {
            const px = izquierda + (derecha - izquierda) * i / 4;
            const py = arriba + (abajo - arriba) * i / 4;
            ctx.moveTo(px, arriba); ctx.lineTo(px, abajo);
            ctx.moveTo(izquierda, py); ctx.lineTo(derecha, py);
        }
        ctx.stroke();
        ctx.strokeStyle = "#777777";
        ctx.beginPath();
        ctx.moveTo(izquierda, arriba); ctx.lineTo(izquierda, abajo); ctx.lineTo(derecha, abajo);
        ctx.stroke();
        ctx.font = "9px Arial, Helvetica, sans-serif";
        ctx.fillStyle = "#555555";
        ctx.textBaseline = "middle";
        ctx.textAlign = "right";
        for (let i = 0; i <= 4; i++) ctx.fillText(esFlujo ? (maximo * i / 4).toFixed(decimalesEje) : String(i * 25), izquierda - 6, y(maximo * i / 4));
        ctx.textAlign = "center";
        for (let i = 0; i <= 4; i++) ctx.fillText((inicio + VENTANA * i / 4).toFixed(0), x(inicio + VENTANA * i / 4), abajo + 9);
        ctx.textBaseline = "bottom";
        ctx.fillText("Tiempo [s]", (izquierda + derecha) / 2, alto - 1);
        ctx.save();
        ctx.translate(10, alto / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textBaseline = "middle";
        ctx.fillText(esFlujo ? "Flujo [kg/s]" : "Nivel [% de altura]", 0, 0, Math.max(1, alto - 8));
        ctx.restore();
        ctx.save();
        ctx.beginPath(); ctx.rect(izquierda, arriba, derecha - izquierda, abajo - arriba); ctx.clip();
        ctx.strokeStyle = "#2f86c0";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        muestras.forEach((m, i) => {
            if (i === 0) ctx.moveTo(x(m.tiempo), y(m.nivel));
            else {
                if (esFlujo) ctx.lineTo(x(m.tiempo), y(muestras[i - 1].nivel));
                ctx.lineTo(x(m.tiempo), y(m.nivel));
            }
        });
        // Extremo actual para continuidad visual, sin guardarlo como muestra adicional.
        ctx.lineTo(x(actual.tiempo), y(actual.nivel));
        ctx.stroke();
        ctx.fillStyle = "#2f86c0";
        ctx.beginPath(); ctx.arc(x(actual.tiempo), y(actual.nivel), 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    const observador = new ResizeObserver(dibujar);
    observador.observe(canvas);
    return {
        dibujar,
        avanzar(t0, nivel0, tiempo, balance, redibujar = true) {
            if (tiempo <= t0) return;
            asegurarEscala(nivel0);
            const inicio = Math.max(0, tiempo - VENTANA);
            // Un cuadro tardío no genera ni guarda muestras fuera de la ventana.
            siguienteMuestra = Math.max(siguienteMuestra, Math.floor(inicio / INTERVALO) * INTERVALO);
            while (siguienteMuestra <= tiempo) {
                const nivel = esFlujo ? nivel0 : Math.min(1, Math.max(0, nivel0 + balance * (siguienteMuestra - t0))) * 100;
                muestras.push({ tiempo: siguienteMuestra, nivel });
                siguienteMuestra += INTERVALO;
            }
            // Conservar solo un punto previo al borde para recortar la curva con continuidad.
            while (muestras.length > 1 && muestras[1].tiempo <= inicio) muestras.shift();
            actual = { tiempo, nivel: esFlujo ? nivel0 : Math.min(1, Math.max(0, nivel0 + balance * (tiempo - t0))) * 100 };
            if (redibujar) dibujar();
        },
        cambiar(tiempo, valor) {
            if (!esFlujo || actual.nivel === valor) return;
            asegurarEscala(valor);
            // Escalón exacto al maniobrar; coalescer cambios en el mismo instante.
            if (muestras.length > 1 && muestras.at(-1).tiempo === tiempo) muestras.pop();
            muestras.push({ tiempo, nivel: valor });
            actual = { tiempo, nivel: valor };
            dibujar();
        },
        reiniciar() {
            maximo = esFlujo ? maximoFlujo : 100;
            muestras = [{ tiempo: 0, nivel: 0 }];
            siguienteMuestra = INTERVALO;
            actual = { tiempo: 0, nivel: 0 };
            dibujar();
        }
    };
}

// Dos curvas continuas, alimentadas exclusivamente por el reloj central.
function crearTendenciaTermica(canvas, estado) {
    let muestras = [{ tiempo: 0, presion: estado.presion, temperatura: estado.temperatura }];
    let siguiente = INTERVALO_MUESTREO;
    function dibujar() {
        dibujarGraficaHMIVacia(canvas, estado);
        const ctx = canvas.getContext("2d"), ancho = canvas.clientWidth, alto = canvas.clientHeight;
        const izq = 54, der = ancho - 54, arriba = 8, abajo = alto - 27;
        if (!ctx || der <= izq || abajo <= arriba) return;
        const inicio = Math.max(0, estado.tiempo - VENTANA_TENDENCIAS);
        const puntos = [...muestras, { tiempo: estado.tiempo, presion: estado.presion, temperatura: estado.temperatura }];
        ctx.save(); ctx.beginPath(); ctx.rect(izq, arriba, der - izq, abajo - arriba); ctx.clip();
        for (const [campo, color, maximo] of [["presion", "#2f86c0", ESCALAS_EJES_PREPARADOS.presion], ["temperatura", "#c94f4f", ESCALAS_EJES_PREPARADOS.temperatura]]) {
            ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
            puntos.forEach((p, i) => {
                const x = izq + (p.tiempo - inicio) / VENTANA_TENDENCIAS * (der - izq);
                const y = abajo - p[campo] / maximo * (abajo - arriba);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }); ctx.stroke();
        }
        ctx.restore();
    }
    const observador = new ResizeObserver(dibujar); observador.observe(canvas);
    return {
        dibujar,
        avanzar(t0, p0, temp0) {
            while (siguiente <= estado.tiempo + 1e-9) {
                const f = Math.min(1, Math.max(0, (siguiente - t0) / (estado.tiempo - t0)));
                muestras.push({ tiempo: siguiente, presion: p0 + (estado.presion - p0) * f, temperatura: temp0 + (estado.temperatura - temp0) * f });
                siguiente += INTERVALO_MUESTREO;
            }
            const inicio = Math.max(0, estado.tiempo - VENTANA_TENDENCIAS);
            while (muestras.length > 1 && muestras[1].tiempo <= inicio) muestras.shift();
        },
        reiniciar() { muestras = [{ tiempo: 0, presion: estado.presion, temperatura: estado.temperatura }]; siguiente = INTERVALO_MUESTREO; dibujar(); }
    };
}

/* Primera operación en frío. DOMContentLoaded ocurre después del script de escena,
   aunque simulador.js se cargue antes. La API conserva la propiedad del dibujo. */
(() => {
    function inicializarOperacion() {
        const escena = window.EscenaCaldera;
        if (!escena) return;
        const aplicar = document.getElementById("btnAplicar");
        const pausa = document.getElementById("btnPausa");
        const reiniciar = document.getElementById("btnReiniciar");
        const tendenciaNivel = crearTendenciaNivel(document.getElementById("graficaDisponible1"));
        const tendenciaAgua = crearTendenciaNivel(document.getElementById("graficaDisponible2"), true);
        const tendenciaAire = crearTendenciaNivel(document.getElementById("graficaDisponible3"), true, CAUDAL_MAX_AIRE);
        const tendenciaCombustible = crearTendenciaNivel(document.getElementById("graficaDisponible4"), true, CAUDAL_MAX_COMBUSTIBLE, 5);
        const registro = document.getElementById("contenidoRegistradorEventos");
        const estacionAlimentacion = document.getElementById("estacionAlimentacion");
        const lecturaApertura = document.getElementById("lecturaApertura");
        const marcadorApertura = document.getElementById("marcadorApertura");
        const escalaApertura = estacionAlimentacion.querySelector(".escala-apertura");

        const estacionAire = document.getElementById("estacionAire");
        const lecturaAire = document.getElementById("lecturaAperturaAire");
        const marcadorAire = document.getElementById("marcadorAperturaAire");
        const escalaAire = estacionAire.querySelector(".escala-apertura");

        const estacionCombustible = document.getElementById("estacionCombustible");
        const lecturaCombustible = document.getElementById("lecturaAperturaCombustible");
        const marcadorCombustible = document.getElementById("marcadorAperturaCombustible");
        const escalaCombustible = estacionCombustible.querySelector(".escala-apertura");

        const estacionVapor = document.getElementById("estacionVapor");
        const lecturaVapor = document.getElementById("lecturaAperturaVapor");
        const marcadorVapor = document.getElementById("marcadorAperturaVapor");
        const escalaVapor = estacionVapor.querySelector(".escala-apertura");

        const estado = {
            alarmas: { nivelBajo: crearAlarmaNivelBajo(), nivelMuyBajo: crearAlarmaNivelBajo(), nivelAlto: crearAlarmaNivelBajo(), nivelMuyAlto: crearAlarmaNivelBajo(), presionAlta: crearAlarmaNivelBajo(), presionMuyAlta: crearAlarmaNivelBajo(), perdidaFlama: crearAlarmaNivelBajo(), faltaAire: crearAlarmaNivelBajo(), faltaCombustible: crearAlarmaNivelBajo() }, fallasPendientes: [], aireRequeridoFalla: 0, retardoAire: 0,
            protecciones: { enclavado: false, causasActivas: [] },
            nivel: 0, aperturaAlimentacion: 0, modoAlimentacion: "manual", integralNivel: 0, caudalSalidasNivel: 0, vtfEnMarcha: false, corteCombustibleAbierto: false, aperturaAire: 0, modoAire: "manual", bombaCombustibleEnMarcha: false, aperturaCombustible: 0, modoCombustible: "manual", integralPresion: 0, cargaTermicaCombustible: 0, aperturaVapor: 0, modoVapor: "manual", bombaEnMarcha: false,
            presion: 0, presionAbsoluta: TERMICA.atmosfera, masaLiquida: 0, masaVapor: 0, masaTotal: 0, energiaTotal: 0, inventario: null, limiteModelo: null, temperatura: TERMICA.ambiente, enEbullicion: false, termicaSuspendida: false, pilotoEncendido: false, quemadorEncendido: false, inicioQuemador: null, drenajeAbierto: true, venteoAbierto: true, ejecutando: false, pausado: false, tiempo: 0, tiempoVisual: 0, caudalAgua: 0, caudalAire: 0, caudalCombustible: 0, caudalVaporProceso: 0, generacionVapor: 0
        };
        const graficaTermica = document.getElementById("graficaDisponible5");
        const graficaVapor = document.getElementById("graficaDisponible6");
        const tendenciaTermica = crearTendenciaTermica(graficaTermica, estado);
        const tendenciaVapor = crearTendenciaNivel(graficaVapor, true, ESCALAS_EJES_PREPARADOS.vapor);
        const redibujarTermica = () => {
            tendenciaTermica.dibujar();
            tendenciaVapor.dibujar();
        };
        const observadorTermico = new ResizeObserver(redibujarTermica);
        observadorTermico.observe(graficaTermica);
        observadorTermico.observe(graficaVapor);
        let cuadro = null;
        let ultimoTiempo = null;
        let generacion = 0;
        // Copia de presentación del último caudal efectivo: la lectura disponible
        // durante pausa no debe animar una descarga que nunca se integró.
        let caudalProcesoVisual = 0;

        function registrar(descripcion, tiempo = estado.tiempo) {
            const entrada = document.createElement("div");
            entrada.textContent = `[${tiempo.toFixed(1)} s] ${descripcion}`;
            registro.appendChild(entrada);
            registro.scrollTop = registro.scrollHeight;
        }

        const flamaDetectada = () => estado.pilotoEncendido || estado.quemadorEncendido;
        function nivelPermiteEncendido() {
            return escena.nivelRelativo(estado.nivel) > DISPARO_NIVEL_MUY_BAJO.activacion + 1e-10;
        }
        function presionPermiteEncendido() {
            return estado.presion < ALARMAS_PRESION.presionMuyAlta.activacion - 1e-10;
        }
        function permisoQuemador() {
            return estado.ejecutando && !estado.protecciones.enclavado && nivelPermiteEncendido() && presionPermiteEncendido() && estado.pilotoEncendido &&
                flamaDetectada() &&
                estado.vtfEnMarcha && CAUDAL_MAX_AIRE * estado.aperturaAire / 100 > 0 &&
                estado.bombaCombustibleEnMarcha && estado.corteCombustibleAbierto;
        }
        function cancelarAjusteCombustible() {
            if (ajuste?.control.campo === "aperturaCombustible") terminarAjuste();
        }
        function apagarQuemador(descripcion) {
            cancelarAjusteCombustible();
            const estabaEncendido = estado.quemadorEncendido;
            estado.quemadorEncendido = false;
            estado.inicioQuemador = null;
            estado.aperturaCombustible = 0;
            estado.integralPresion = 0;
            if (estabaEncendido) registrar(descripcion);
        }
        // Guardar las señales ANTES del apagado inmediato existente. El siguiente
        // subpaso registra el disparo, incluso si el HMI ya apagó el quemador.
        function capturarFallasServicios() {
            if (!estado.ejecutando || estado.protecciones.enclavado) return;
            const requiere = estado.quemadorEncendido || estado.pilotoEncendido;
            const causas = [];
            if (requiere && !flamaDetectada()) causas.push("perdidaFlama");
            if (requiere && (!estado.bombaCombustibleEnMarcha || !estado.corteCombustibleAbierto)) causas.push("faltaCombustible");
            if (estado.quemadorEncendido && (!estado.vtfEnMarcha || estado.caudalAire <= 0)) causas.push("faltaAire");
            if (causas.includes("faltaAire")) estado.aireRequeridoFalla = Math.max(estado.aireRequeridoFalla,
                estado.caudalCombustible * CONTROL_AIRE.relacionAireDiesel);
            for (const id of causas) if (!estado.fallasPendientes.includes(id)) estado.fallasPendientes.push(id);
        }
        function cambiarAlarmaServicio(id, activa, tiempo = estado.tiempo) {
            const a = estado.alarmas[id];
            if (a.activa === activa) return;
            a.activa = activa; a.contador = 0;
            const nombre = ventanasAlarmas[id].nombre.toLocaleLowerCase("es");
            const etiqueta = nombre[0].toLocaleUpperCase("es") + nombre.slice(1);
            if (activa) { a.aviso = true; a.reconocida = false; a.aparicion = tiempo; }
            else if (a.reconocida) a.aviso = false;
            registrar(`${activa ? "Aparición" : "Desaparición"} de alarma: ${etiqueta}`, tiempo);

        }
        function servicioDisponible(id) {
            if (id === "perdidaFlama") return true; // Sin sensor independiente: no exigir flama apagada por disparo.
            if (id === "faltaCombustible") return estado.bombaCombustibleEnMarcha; // CV debe seguir cerrada.
            return estado.vtfEnMarcha && estado.caudalAire > 0 &&
                estado.caudalAire >= PROTECCIONES_SERVICIOS.aireReposicion * estado.aireRequeridoFalla;
        }
        function evaluarServicios(dt, tiempo) {
            capturarFallasServicios();
            if (!estado.protecciones.enclavado && estado.quemadorEncendido && estado.caudalCombustible > 0) {
                const requerido = estado.caudalCombustible * CONTROL_AIRE.relacionAireDiesel;
                if (estado.caudalAire < PROTECCIONES_SERVICIOS.aireActivacion * requerido) {
                    estado.retardoAire += dt;
                    if (estado.retardoAire >= PROTECCIONES_SERVICIOS.retardoAire - 1e-10) {
                        estado.aireRequeridoFalla = requerido;
                        if (!estado.fallasPendientes.includes("faltaAire")) estado.fallasPendientes.push("faltaAire");
                    }
                } else estado.retardoAire = 0;
            } else estado.retardoAire = 0;
            // Todas las causas se obtuvieron antes de ejecutar el primer disparo.
            const causas = estado.fallasPendientes.splice(0);
            for (const id of causas) dispararCaldera(id, tiempo);
            for (const id of ["faltaAire", "faltaCombustible"]) {
                if (!causas.includes(id) && servicioDisponible(id))
                    estado.protecciones.causasActivas = estado.protecciones.causasActivas.filter(c => c !== id);
            }
        }
        // Anunciación independiente de las causas enclavadas y de los permisos.
        function actualizarAvisosServicios(tiempo) {
            cambiarAlarmaServicio("perdidaFlama", !flamaDetectada(), tiempo);
            const insuficiencia = estado.protecciones.causasActivas.includes("faltaAire") && !servicioDisponible("faltaAire");
            cambiarAlarmaServicio("faltaAire", !estado.vtfEnMarcha || estado.caudalAire <= 0 || insuficiencia, tiempo);
            cambiarAlarmaServicio("faltaCombustible", !estado.bombaCombustibleEnMarcha ||
                !estado.corteCombustibleAbierto || estado.caudalCombustible <= 0, tiempo);
        }
        function motivoRestablecimiento() {
            const motivos = [];
            const causas = estado.protecciones.causasActivas.filter(id =>
                !["manual", "perdidaFlama", "faltaAire", "faltaCombustible"].includes(id));
            if (causas.length) motivos.push(`Causas activas: ${causas.map(id => ventanasAlarmas[id].nombre).join(", ")}`);
            if (!estado.vtfEnMarcha || estado.caudalAire <= 0) motivos.push("VTF y caudal de aire positivo requeridos");
            if (!estado.bombaCombustibleEnMarcha) motivos.push("Bomba de combustible requerida; suministro aguas arriba no disponible");
            if (estado.protecciones.causasActivas.includes("faltaAire") && !servicioDisponible("faltaAire"))
                motivos.push("Aire inferior al 90 % de la demanda previa al disparo");
            return motivos.join(". ");
        }
        function comprobarQuemador() {
            capturarFallasServicios();
            if (estado.quemadorEncendido) {
                const causa = !flamaDetectada() ? "pérdida de flama" : !estado.vtfEnMarcha ? "paro de VTF" :
                    !estado.bombaCombustibleEnMarcha ? "paro de bomba de combustible" :
                    !estado.corteCombustibleAbierto ? "cierre de CV" : estado.aperturaCombustible === 0 ? "cierre de FV-2" :
                    estado.caudalAire === 0 ? "pérdida de aire" : null;
                if (causa) apagarQuemador(`Apagado del quemador: ${causa}`);
            }
        }
        function pilotoBloqueado() {
            return estado.quemadorEncendido && estado.tiempo - estado.inicioQuemador >= 60;
        }
        function actualizarSuministros() {
            // Primero combustible efectivo, luego consigna y caudal real de aire.
            estado.caudalCombustible = estado.bombaCombustibleEnMarcha && estado.corteCombustibleAbierto ?
                CAUDAL_MAX_COMBUSTIBLE * estado.aperturaCombustible / 100 : 0;
            if (estado.modoAire === "automatico") {
                const objetivo = estado.quemadorEncendido ?
                    100 * estado.caudalCombustible * CONTROL_AIRE.relacionAireDiesel * CONTROL_AIRE.excesoAire / CAUDAL_MAX_AIRE :
                    CONTROL_AIRE.aperturaPreparacion;
                estado.aperturaAire = Math.min(100, Math.max(0, objetivo));
            }
            estado.caudalAire = estado.vtfEnMarcha ? CAUDAL_MAX_AIRE * estado.aperturaAire / 100 : 0;
        }
        // Metadatos de las nueve condiciones del registro central.
        const ventanasAlarmas = {
            nivelBajo: { nombre: "NIVEL BAJO", explicacion: "Nivel por debajo del límite. Verifique la bomba de alimentación y la apertura de FV-1." },
            nivelMuyBajo: { nombre: "NIVEL MUY BAJO", explicacion: "Nivel muy bajo: disparo a ≤ −20 % relativo durante 2 s simulados; la causa desaparece a ≥ −18 %. Recupere el nivel con FV-1 y restablezca el disparo manualmente." },
            nivelAlto: { nombre: "NIVEL ALTO", explicacion: "Exceso de nivel. Verifique el modo y la apertura de FV-1 y reduzca la alimentación si corresponde." },
            nivelMuyAlto: { nombre: "NIVEL MUY ALTO", explicacion: "Nivel muy alto. Corrija el exceso de alimentación y observe la recuperación del nivel." },
            presionAlta: { nombre: "PRESIÓN ALTA", explicacion: "Presión alta. Verifique la regulación de combustible y la demanda de vapor." },
            presionMuyAlta: { nombre: "PRESIÓN MUY ALTA", explicacion: "Disparo por presión muy alta. Corrija la causa y espere a que disminuya la presión antes de restablecer." },
            perdidaFlama: { nombre: "AUSENCIA DE FLAMA", explicacion: "Ausencia de detección de piloto y quemador. La ausencia inicial o por apagado ordenado es un aviso; una pérdida durante operación provoca disparo. El modelo no dispone de sensor independiente." },
            faltaAire: { nombre: "FALTA DE AIRE", explicacion: "Falta de aire. Verifique VTF y FZ-1. Insuficiencia por debajo del 80 % del aire requerido durante 1 s; recuperación al 90 %." },
            faltaCombustible: { nombre: "FALTA DE COMBUSTIBLE", explicacion: "Falta de combustible. Verifique la bomba de suministro. CV permanece cerrada por el disparo y debe abrirse manualmente después de restablecer." }
        };
        const PRUEBA_LAMPARAS_MS = 1500; // Duración visual real, sin avanzar el proceso.
        let alarmaSeleccionada = "nivelBajo", pruebaLamparas = false, temporizadorLamparas = null;
        const estadoVentana = alarma => !alarma ? "Pendiente de implementar" :
            !alarma.aviso ? "Normal" : alarma.activa ?
                (alarma.reconocida ? "Activa reconocida" : "Activa sin reconocer") : "Desaparecida sin reconocer";
        function actualizarAlarmas() {
            for (const [id, info] of Object.entries(ventanasAlarmas)) {
                const a = estado.alarmas[id] || null;
                const ventana = document.getElementById(`seleccionarAlarma${id[0].toUpperCase() + id.slice(1)}`);
                ventana.classList.toggle("alarma-nueva", !!a?.activa && !a.reconocida);
                ventana.classList.toggle("alarma-reconocida", !!a?.activa && a.reconocida);
                ventana.classList.toggle("alarma-pendiente", !!a?.aviso && !a.activa);
                ventana.classList.toggle("prueba-lamparas", pruebaLamparas);
                ventana.setAttribute("aria-pressed", String(alarmaSeleccionada === id));
                const descripcion = `${info.nombre}: ${estadoVentana(a)}${pruebaLamparas ? "; prueba visual de lámparas" : ""}`;
                ventana.setAttribute("aria-label", descripcion);
                ventana.title = descripcion;
            }
            const info = ventanasAlarmas[alarmaSeleccionada];
            const a = estado.alarmas[alarmaSeleccionada] || null;
            document.getElementById("nombreAlarmaSeleccionada").textContent = info.nombre;
            document.getElementById("estadoAlarmaSeleccionada").textContent = estadoVentana(a);
            document.getElementById("tiempoAlarmaSeleccionada").textContent = a?.aviso && a.aparicion !== null ? `Aparición: ${a.aparicion.toFixed(2)} s simulados` : "";
            document.getElementById("detalleAlarmaSeleccionada").textContent = alarmaSeleccionada === "faltaCombustible" && estado.ejecutando ?
                !estado.bombaCombustibleEnMarcha ? "Bomba parada: suministro aguas arriba de CV no disponible." :
                !estado.corteCombustibleAbierto ? "Suministro representado por la bomba disponible; CV cerrada." :
                estado.caudalCombustible <= 0 ? "Caudal cero con suministro disponible y FV-2 cerrada." : "Suministro y caudal de combustible disponibles." : info.explicacion;
            // Agregación del registro central: ninguna alarma borra a otra.
            const avisos = Object.values(estado.alarmas).filter(alarma => alarma.aviso);
            const pendientes = avisos.some(alarma => !alarma.reconocida);
            const activas = avisos.some(alarma => alarma.activa);
            document.getElementById("btnReconocerAlarmas").disabled = !estado.ejecutando || !pendientes;
            const indicador = document.getElementById("btnAlarmas");
            indicador.classList.toggle("alarma-nueva", pendientes);
            indicador.classList.toggle("alarma-activa", !pendientes && activas);
            indicador.setAttribute("aria-label", pendientes ? "Abrir alarmas: avisos sin reconocer" : activas ? "Abrir alarmas: alarma activa reconocida" : "Abrir alarmas");
        }
        for (const id of Object.keys(ventanasAlarmas)) {
            document.getElementById(`seleccionarAlarma${id[0].toUpperCase() + id.slice(1)}`).addEventListener("click", () => {
                alarmaSeleccionada = id;
                actualizarAlarmas();
            });
        }
        document.getElementById("btnReconocerAlarmas").addEventListener("click", () => {
            if (!estado.ejecutando) return;
            for (const [id, a] of Object.entries(estado.alarmas)) {
                if (!a.aviso || a.reconocida) continue;
                a.reconocida = true;
                if (!a.activa) a.aviso = false;
                registrar(`Reconocimiento de alarma: ${id === "nivelBajo" ? "Nivel bajo" : id === "nivelMuyBajo" ? "Nivel muy bajo" : id === "nivelAlto" ? "Nivel alto" : id === "nivelMuyAlto" ? "Nivel muy alto" : id === "presionAlta" ? "Presión alta" : id === "presionMuyAlta" ? "Presión muy alta" : ventanasAlarmas[id].nombre.charAt(0) + ventanasAlarmas[id].nombre.slice(1).toLocaleLowerCase("es")}`);
            }
            actualizarAlarmas();
        });
        document.getElementById("btnPruebaLamparas").addEventListener("click", () => {
            if (temporizadorLamparas !== null) clearTimeout(temporizadorLamparas);
            pruebaLamparas = true;
            actualizarAlarmas();
            temporizadorLamparas = setTimeout(() => {
                temporizadorLamparas = null;
                pruebaLamparas = false;
                actualizarAlarmas();
            }, PRUEBA_LAMPARAS_MS);
        });

        function actualizarDibujo() {
            actualizarAlarmas();
            // El balance usa presión absoluta; HMI y tendencia comparten la conversión manométrica.
            escena.setPresion(estado.presion);
            escena.setTemperatura(estado.temperatura);
            redibujarTermica();
            // Cierre desde frío fuera del modelo: se explica sin inventar presión del aire.
            const cierreFrio = !estado.venteoAbierto && !estado.inventario;
            if (cierreFrio && estado.ejecutando && !estado.termicaSuspendida) {
                registrar("Cierre de venteo desde frío fuera del modelo: abrir y alcanzar ebullición antes de presurizar");
            }
            estado.termicaSuspendida = cierreFrio;
            if (estado.protecciones.enclavado) {
                estado.pilotoEncendido = false;
                estado.corteCombustibleAbierto = false;
                estado.quemadorEncendido = false;
                estado.inicioQuemador = null;
                estado.aperturaCombustible = 0;
                estado.integralPresion = 0;
            }
            actualizarSuministros();
            comprobarQuemador();
            if (!estado.quemadorEncendido) {
                if (ajuste?.control.campo === "aperturaCombustible") terminarAjuste(false);
                if (estado.aperturaCombustible > 0) {
                    estado.aperturaCombustible = 0;
                    registrar("Cierre de FV-2: quemador apagado");
                }
            }
            actualizarSuministros();
            escena.setManiobrasHabilitadas(estado.ejecutando);
            document.getElementById("btnAbrirCV").disabled = !estado.ejecutando || estado.protecciones.enclavado;
            document.getElementById("btnAbrirCV").title = estado.protecciones.enclavado ? "Bloqueada por disparo" : "Abrir válvula de corte";
            escena.setDisparoEnclavado(estado.protecciones.enclavado);
            const motivo = estado.protecciones.enclavado ? motivoRestablecimiento() : "";
            document.getElementById("estadoDisparo").textContent = estado.protecciones.enclavado ?
                `Caldera disparada${motivo ? ". Restablecimiento bloqueado: " + motivo : ""}` : "Caldera restablecida";
            document.getElementById("btnDispararCaldera").disabled = !estado.ejecutando;
            document.getElementById("btnRestablecerDisparo").disabled = !estado.ejecutando || !!motivo;
            document.getElementById("btnRestablecerDisparo").title = motivo || "Restablecer disparo";
            document.getElementById("btnCerrarCV").disabled = !estado.ejecutando;
            // Una actualización conjunta conserva la llama principal al apagar el piloto.
            escena.setLlama(estado.quemadorEncendido ? "principal" : estado.pilotoEncendido ? "piloto" : "apagada", estado.aperturaCombustible);
            escena.setFlamaDetectada(flamaDetectada());
            escena.setGasesCombustion(estado.quemadorEncendido, estado.tiempoVisual);
            for (const [id, accion, habilitado] of [
                ["btnEncenderPiloto", "Encender piloto", estado.ejecutando && !estado.protecciones.enclavado && nivelPermiteEncendido() && presionPermiteEncendido() && !pilotoBloqueado()],
                ["btnApagarPiloto", "Apagar piloto", estado.ejecutando],
                ["btnEncenderQuemador", "Encender quemador", permisoQuemador() && !estado.quemadorEncendido],
                ["btnApagarQuemador", "Apagar quemador", estado.ejecutando]
            ]) {
                const boton = document.getElementById(id);
                boton.disabled = !habilitado;
                boton.setAttribute("aria-disabled", String(!habilitado));
                boton.title = ["btnEncenderPiloto", "btnEncenderQuemador"].includes(id) ?
                    estado.protecciones.enclavado ? "Bloqueada por disparo" : !nivelPermiteEncendido() ? "Bloqueado por nivel muy bajo" : !presionPermiteEncendido() ? "Bloqueado por presión muy alta" : accion : accion;
                boton.setAttribute("aria-label", accion);
            }
            for (const circuito of ["Agua", "Aire", "Combustible", "Vapor"]) {
                for (const accion of ["Manual", "Aumentar", "Reducir"]) {
                    document.getElementById(`btn${accion}${circuito}`).disabled = !estado.ejecutando;
                }
            }
            const aperturaAirePresentada = Number(estado.aperturaAire.toFixed(2));
            for (const [id, modo] of [["btnManualAire", "manual"], ["btnAutomaticoAire", "automatico"]]) {
                const boton = document.getElementById(id);
                const seleccionado = estado.modoAire === modo;
                boton.disabled = !estado.ejecutando;
                boton.classList.toggle("modo-seleccionado", seleccionado);
                boton.setAttribute("aria-pressed", String(seleccionado));
                boton.title = `Modo ${modo} de FZ-1; apertura ${aperturaAirePresentada} %`;
                boton.setAttribute("aria-label", boton.title);
            }
            for (const id of ["btnAumentarAire", "btnReducirAire"]) {
                document.getElementById(id).disabled = !estado.ejecutando || estado.modoAire !== "manual";
            }
            const aperturaAguaPresentada = Math.round(estado.aperturaAlimentacion);
            for (const [id, modo] of [["btnManualAgua", "manual"], ["btnAutomaticoAgua", "automatico"]]) {
                const boton = document.getElementById(id);
                boton.disabled = !estado.ejecutando;
                boton.classList.toggle("modo-seleccionado", estado.modoAlimentacion === modo);
                boton.setAttribute("aria-pressed", String(estado.modoAlimentacion === modo));
                boton.title = `Modo ${modo} de FV-1; apertura ${aperturaAguaPresentada} %`;
                boton.setAttribute("aria-label", boton.title);
            }
            for (const id of ["btnAumentarAgua", "btnReducirAgua"]) {
                document.getElementById(id).disabled = !estado.ejecutando || estado.modoAlimentacion !== "manual";
            }
            escena.setAperturaValvulaAgua(estado.aperturaAlimentacion);
            lecturaApertura.textContent = `${aperturaAguaPresentada} %`;
            lecturaApertura.title = `Apertura de FV-1: ${aperturaAguaPresentada} %`;
            lecturaApertura.setAttribute("aria-label", lecturaApertura.title);
            marcadorApertura.title = lecturaApertura.title;
            marcadorApertura.style.left = `${estado.aperturaAlimentacion}%`;
            escalaApertura.setAttribute("aria-label", `Apertura de alimentación: ${aperturaAguaPresentada} %`);
            escena.setValvula("valvulaDrenaje", estado.drenajeAbierto);
            escena.setValvula("valvulaVenteo", estado.venteoAbierto);
            escena.setEquipo("BAA", estado.bombaEnMarcha);
            escena.setEquipo("VTF", estado.vtfEnMarcha);
            escena.setEquipo("unidadCombustible", estado.bombaCombustibleEnMarcha);
            const aperturaCombustiblePresentada = Math.round(estado.aperturaCombustible);
            for (const [id, modo] of [["btnManualCombustible", "manual"], ["btnAutomaticoCombustible", "automatico"]]) {
                const boton = document.getElementById(id);
                boton.disabled = !estado.ejecutando;
                boton.classList.toggle("modo-seleccionado", estado.modoCombustible === modo);
                boton.setAttribute("aria-pressed", String(estado.modoCombustible === modo));
                boton.title = `Modo ${modo} de FV-2; apertura ${aperturaCombustiblePresentada} %`;
                boton.setAttribute("aria-label", boton.title);
            }
            escena.setAperturaValvulaCombustible(estado.aperturaCombustible);
            escena.setPermisoAperturaCombustible(estado.ejecutando && !estado.protecciones.enclavado && estado.quemadorEncendido, estado.quemadorEncendido, estado.protecciones.enclavado);
            const aumentarCombustible = document.getElementById("btnAumentarCombustible");
            aumentarCombustible.disabled = !estado.ejecutando || estado.protecciones.enclavado || !estado.quemadorEncendido || estado.modoCombustible !== "manual";
            document.getElementById("btnReducirCombustible").disabled = !estado.ejecutando || estado.modoCombustible !== "manual";
            aumentarCombustible.title = estado.protecciones.enclavado ? "Bloqueada por disparo" : estado.quemadorEncendido ? "Aumentar apertura de FV-2" : "Enciende el quemador para regular FV-2";
            aumentarCombustible.setAttribute("aria-label", "Aumentar apertura de FV-2");
            aumentarCombustible.setAttribute("aria-description", estado.protecciones.enclavado ? "Bloqueada por disparo" : estado.quemadorEncendido ? "" : "Enciende el quemador para regular FV-2");
            escena.setAperturaValvulaVapor(estado.aperturaVapor);
            lecturaVapor.textContent = `${estado.aperturaVapor} %`;
            marcadorVapor.style.left = `${estado.aperturaVapor}%`;
            escalaVapor.setAttribute("aria-label", `Apertura de FV-3: ${estado.aperturaVapor} %`);
            escena.setFlujoCombustibleVisual(estado.bombaCombustibleEnMarcha && estado.corteCombustibleAbierto && estado.aperturaCombustible > 0, estado.aperturaCombustible, estado.tiempoVisual);
            lecturaCombustible.textContent = `${aperturaCombustiblePresentada} %`;
            lecturaCombustible.title = `Apertura de FV-2: ${aperturaCombustiblePresentada} %`;
            lecturaCombustible.setAttribute("aria-label", lecturaCombustible.title);
            marcadorCombustible.title = lecturaCombustible.title;
            marcadorCombustible.style.left = `${estado.aperturaCombustible}%`;
            escalaCombustible.setAttribute("aria-label", `Apertura de combustible: ${aperturaCombustiblePresentada} %`);
            escena.setValvula("valvulaCorteCombustible", estado.corteCombustibleAbierto, estado.protecciones.enclavado);
            escena.setAperturaCompuertaAire(estado.aperturaAire);
            escena.setAireCombustion(estado.vtfEnMarcha && estado.aperturaAire > 0, estado.aperturaAire, estado.tiempoVisual);
            lecturaAire.textContent = `${Math.round(estado.aperturaAire)} %`;
            lecturaAire.title = `Apertura de FZ-1: ${aperturaAirePresentada} %`;
            lecturaAire.setAttribute("aria-label", lecturaAire.title);
            marcadorAire.style.left = `${estado.aperturaAire}%`;
            marcadorAire.title = lecturaAire.title;
            escalaAire.setAttribute("aria-label", `Apertura de aire: ${aperturaAirePresentada} %`);
            escena.setFlujo("flujoCombustible", estado.caudalCombustible, "kg/s");
            if (!estado.pausado && estado.modoCombustible === "manual") tendenciaCombustible.cambiar(estado.tiempo, estado.caudalCombustible);
            escena.setFlujo("flujoAire", estado.caudalAire, "kg/s");
            if (!estado.pausado && estado.modoCombustible === "manual") tendenciaAire.cambiar(estado.tiempo, estado.caudalAire);
            if (!estado.bombaEnMarcha) estado.caudalAgua = 0;
            escena.setFlujo("flujoAgua", estado.caudalAgua, "kg/s");

            if (estado.pausado) {
                estado.caudalVaporProceso = estado.inventario ? calcularCaudalVaporProceso(estado.aperturaVapor, estado.presionAbsoluta) : 0;
            }
            escena.setFlujo("flujoVapor", estado.caudalVaporProceso, "kg/s");
            escena.setNivelAgua(estado.nivel);
            escena.setVaporVisual(estado.generacionVapor,
                estado.aperturaVapor > 0 ? caudalProcesoVisual : 0, estado.nivel, estado.tiempoVisual);
            const evoluciona = estado.ejecutando && !estado.pausado && !document.hidden;
            const entrada = evoluciona && estado.bombaEnMarcha && estado.aperturaAlimentacion > 0;
            const salida = evoluciona && estado.drenajeAbierto && estado.nivel > 0;
            // Simplificación visual: tubería vacía al cesar el flujo, sin modelar agua retenida.
            escena.setTuberia("tuberiaAgua", entrada ? "agua" : "vacio");
            escena.setTuberia("tuberiaDrenaje", salida ? "agua" : "vacio");
            escena.svg.dataset.operacionPausada = estado.pausado ? "si" : "no";
            pausa.textContent = estado.pausado ? "CONTINUAR" : "PAUSA";
            // Los colores se derivan del único estado de operación existente.
            aplicar.classList.toggle("operacion-activa", estado.ejecutando && !estado.pausado);
            pausa.classList.toggle("operacion-activa", estado.pausado);
        }

        function avanzar(ahora) {
            if (!estado.ejecutando || estado.pausado || document.hidden || ultimoTiempo === null) return;
            const dtReal = Math.max(0, (ahora - ultimoTiempo) / 1000);
            const dtSimulacion = dtReal * FACTOR_TIEMPO;
            ultimoTiempo = ahora;
            if (dtSimulacion === 0) return;
            const tiempoAnterior = estado.tiempo;

            let restante = dtSimulacion;
            while (restante > 1e-9) {
                const dt = Math.min(TERMICA.subpaso, restante);
                const t0 = estado.tiempo, n0 = estado.nivel, temp0 = estado.temperatura, p0 = estado.presion;
                regularNivel(estado, escena.nivelRelativo(n0), dt);
                actualizarSuministros();
                evaluarServicios(dt, t0 + dt);
                comprobarQuemador();
                regularPresion(estado, dt);
                actualizarSuministros();
                comprobarQuemador();
                actualizarSuministros();
                const entrada = estado.bombaEnMarcha ? CAUDAL_MAX_AGUA * estado.aperturaAlimentacion / 100 : 0;
                estado.caudalAgua = 0;
                estado.caudalSalidasNivel = 0;
                let r;
                if (estado.inventario) {
                    const nuevo = integrarInventario(estado.inventario, entrada,
                        estado.drenajeAbierto ? CAUDAL_DRENAJE : 0, estado.caudalCombustible,
                        estado.quemadorEncendido, estado.venteoAbierto, estado.aperturaVapor, dt);
                    if (nuevo) {
                        estado.cargaTermicaCombustible = cargaTermicaSalidas(estado.inventario, nuevo, dt);
                        estado.generacionVapor = nuevo.generacionVapor;
                        estado.caudalVaporProceso = nuevo.salidaProceso / dt;
                        estado.caudalAgua = nuevo.entradaAceptada / dt;
                        estado.caudalSalidasNivel = (nuevo.salidaProceso + nuevo.salidaVenteo + nuevo.salidaLiquida) / dt;
                        estado.inventario = nuevo;
                        estado.limiteModelo = null;
                        estado.masaLiquida = nuevo.masaLiquida;
                        estado.masaVapor = nuevo.masaVapor;
                        estado.masaTotal = nuevo.masaTotal;
                        estado.energiaTotal = nuevo.energiaTotal;
                        estado.presionAbsoluta = nuevo.presionAbsoluta;
                        r = { masa: nuevo.masaLiquida, temperatura: nuevo.temperatura,
                            evaporada: Math.max(0, n0 * CAPACIDAD_EQUIVALENTE_AGUA + nuevo.entradaAceptada - nuevo.salidaLiquida - nuevo.masaLiquida),
                            instanteEbullicion: null };
                    } else {
                        estado.generacionVapor = 0;
                        estado.caudalVaporProceso = 0;
                        estado.cargaTermicaCombustible = 0;
                        const aviso = "Límite del modelo de saturación (25–300 °C o fuera de la región bifásica): balance suspendido, sin extrapolar";
                        if (estado.limiteModelo !== aviso) registrar(aviso, t0);
                        estado.limiteModelo = aviso;
                        r = { masa: n0 * CAPACIDAD_EQUIVALENTE_AGUA, temperatura: temp0, evaporada: 0, instanteEbullicion: null };
                    }
                } else {
                    estado.caudalVaporProceso = 0;
                    r = integrarAguaTermica(n0 * CAPACIDAD_EQUIVALENTE_AGUA, temp0,
                        entrada, estado.drenajeAbierto ? CAUDAL_DRENAJE : 0,
                        estado.caudalCombustible, estado.quemadorEncendido, estado.venteoAbierto, dt);
                    // Referencia sensible relativa a ambiente de la etapa abierta.
                    estado.cargaTermicaCombustible = (r.entrante * TERMICA.cpAgua * (temp0 - TERMICA.alimentacion) + r.evaporada * TERMICA.latente) / dt;
                    estado.generacionVapor = r.evaporada / dt;
                    estado.caudalAgua = r.entrante / dt;
                    estado.caudalSalidasNivel = (r.salida + r.evaporada) / dt;
                    estado.masaLiquida = r.masa;
                    estado.masaVapor = 0;
                    estado.masaTotal = r.masa;
                    // Referencia original de la primera etapa, relativa a 25 °C.
                    estado.energiaTotal = (r.masa * TERMICA.cpAgua + TERMICA.capacidadMetal) * (r.temperatura - TERMICA.ambiente);
                    estado.presionAbsoluta = TERMICA.atmosfera;
                }
                estado.nivel = r.masa / CAPACIDAD_EQUIVALENTE_AGUA;
                estado.temperatura = r.temperatura;
                estado.presion = estado.presionAbsoluta - TERMICA.atmosfera;
                const ebullicion = estado.venteoAbierto && r.masa > 0 && r.temperatura >= TERMICA.saturacion - 1e-9;
                if (estado.venteoAbierto) {
                    if ((ebullicion || r.instanteEbullicion !== null) && !estado.enEbullicion) {
                        registrar("Llegada a ebullición", t0 + Math.min(dt, Math.max(0, r.instanteEbullicion ?? 0)));
                    }
                    estado.enEbullicion = ebullicion;
                }
                const llegada = n0 > 0 && estado.nivel === 0 ? "Llegada a vacío" : n0 < 1 && estado.nivel === 1 ? "Llegada a lleno" : null;
                if (llegada) {
                    const balanceMasa = entrada - (estado.drenajeAbierto ? CAUDAL_DRENAJE : 0) - r.evaporada / dt;
                    const instante = Math.min(dt, Math.max(0, (estado.nivel - n0) * CAPACIDAD_EQUIVALENTE_AGUA / balanceMasa));
                    registrar(llegada, t0 + instante);
                }
                estado.tiempo = t0 + dt;
                for (const evento of evaluarAlarmaNivelBajo(estado.alarmas.nivelBajo,
                    escena.nivelRelativo(n0), escena.nivelRelativo(estado.nivel), t0, dt)) {
                    registrar(evento.descripcion, evento.tiempo);
                }
                tendenciaNivel.avanzar(t0, n0, estado.tiempo, (estado.nivel - n0) / dt, false);
                tendenciaTermica.avanzar(t0, p0, temp0);
                // Registrar el caudal efectivo de cada subpaso sin redondeos ni
                // puntos por cuadro: el muestreo conserva sus 10 s simulados.
                tendenciaCombustible.avanzar(t0, estado.caudalCombustible, estado.tiempo, 0, false);
                tendenciaAire.avanzar(t0, estado.caudalAire, estado.tiempo, 0, false);
                tendenciaAgua.avanzar(t0, estado.caudalAgua, estado.tiempo, 0, false);
                tendenciaVapor.avanzar(t0, estado.caudalVaporProceso, estado.tiempo, 0, false);
                const muyBajo = estado.alarmas.nivelMuyBajo;
                for (const evento of evaluarNivelMuyBajo(muyBajo,
                    escena.nivelRelativo(n0), escena.nivelRelativo(estado.nivel), t0, dt)) {
                    registrar(evento.descripcion, evento.tiempo);
                    if (evento.descripcion.startsWith("Aparición")) dispararCaldera("nivelMuyBajo", evento.tiempo);
                    else estado.protecciones.causasActivas = estado.protecciones.causasActivas.filter(id => id !== "nivelMuyBajo");
                }
                for (const [id, cfg] of Object.entries(ALARMAS_NIVEL_ALTO)) {
                    for (const evento of evaluarAlarmaNivelAlto(estado.alarmas[id],
                        escena.nivelRelativo(n0), escena.nivelRelativo(estado.nivel), t0, dt,
                        cfg, id === "nivelAlto" ? "Nivel alto" : "Nivel muy alto")) {
                        registrar(evento.descripcion, evento.tiempo);
                    }
                }
                for (const [id, cfg] of Object.entries(ALARMAS_PRESION)) {
                    for (const evento of evaluarAlarmaPresion(estado.alarmas[id], p0, estado.presion,
                        t0, dt, cfg, id === "presionAlta" ? "Presión alta" : "Presión muy alta")) {
                        registrar(evento.descripcion, evento.tiempo);
                        if (id === "presionMuyAlta") {
                            if (evento.descripcion.startsWith("Aparición")) dispararCaldera(id, evento.tiempo);
                            else estado.protecciones.causasActivas = estado.protecciones.causasActivas.filter(causa => causa !== id);
                        }
                    }
                }
                actualizarSuministros();
                actualizarAvisosServicios(estado.tiempo);
                restante -= dt;
            }
            tendenciaNivel.dibujar();
            estado.tiempoVisual += dtReal;
            caudalProcesoVisual = estado.caudalVaporProceso;
            if (estado.quemadorEncendido && estado.inicioQuemador !== null &&
                tiempoAnterior < estado.inicioQuemador + 60 && estado.tiempo >= estado.inicioQuemador + 60 &&
                estado.pilotoEncendido) {
                estado.pilotoEncendido = false;
                registrar("Apagado automático del piloto", estado.inicioQuemador + 60);
            }
            tendenciaAgua.dibujar();
            tendenciaAire.dibujar();
            tendenciaCombustible.dibujar();
            tendenciaVapor.dibujar();
        }

        function detenerCuadro() {
            generacion++;
            if (cuadro !== null) cancelAnimationFrame(cuadro);
            cuadro = null;
            ultimoTiempo = null;
        }

        function programarCuadro() {
            if (cuadro !== null || !estado.ejecutando || estado.pausado || document.hidden) return;
            const actual = generacion;
            cuadro = requestAnimationFrame((ahora) => {
                if (actual !== generacion) return;
                cuadro = null;
                avanzar(ahora);
                actualizarDibujo();
                programarCuadro();
            });
        }

        function continuar() {
            if (estado.ejecutando && !estado.pausado) return;
            const reanudando = estado.pausado;
            estado.ejecutando = true;
            estado.pausado = false;
            ultimoTiempo = document.hidden ? null : performance.now();
            registrar(reanudando ? "Continuación" : "Inicio");
            actualizarDibujo();
            programarCuadro();
        }

        // Temporizador de pulsación, independiente del único ciclo temporal del modelo.
        let ajuste = null;
        let temporizadorAjuste = null;
        let generacionAjuste = 0;
        function cambiarApertura(paso, control) {
            if (!estado.ejecutando || estado[control.modo] !== "manual") return;
            avanzar(performance.now());
            if (control.campo === "aperturaCombustible" && paso > 0 && (estado.protecciones.enclavado || !estado.quemadorEncendido)) return;
            estado[control.campo] = Math.min(100, Math.max(0, estado[control.campo] + paso));
            if (control.campo === "aperturaVapor" && estado.aperturaVapor === 0) caudalProcesoVisual = 0;
            if (control.campo === "aperturaVapor" && estado.aperturaVapor === 0 && !estado.pausado) {
                estado.caudalVaporProceso = 0;
                tendenciaVapor.cambiar(estado.tiempo, 0);
            }
            actualizarDibujo();
        }
        function terminarAjuste(registrarCambio = true) {
            generacionAjuste++;
            if (temporizadorAjuste !== null) clearTimeout(temporizadorAjuste);
            temporizadorAjuste = null;
            if (ajuste && registrarCambio && ajuste.inicial !== estado[ajuste.control.campo]) {
                registrar(`${ajuste.control.descripcion}: ${["aperturaAlimentacion", "aperturaCombustible"].includes(ajuste.control.campo) ? Math.round(estado[ajuste.control.campo]) : estado[ajuste.control.campo]} %`);
            }
            ajuste = null;
        }
        function iniciarAjuste(boton, paso, origen, control) {
            if (!estado.ejecutando || document.hidden || ajuste || estado[control.modo] !== "manual") return;
            if (control.campo === "aperturaCombustible" && paso > 0 && (estado.protecciones.enclavado || !estado.quemadorEncendido)) return;
            ajuste = { boton, origen, control, inicial: estado[control.campo] };
            cambiarApertura(paso, control);
            if (!ajuste) return;
            const version = generacionAjuste;
            function repetir() {
                if (!ajuste || version !== generacionAjuste) return;
                cambiarApertura(paso, control);
                if (!ajuste || version !== generacionAjuste) return;
                temporizadorAjuste = setTimeout(repetir, INTERVALO_REPETICION_APERTURA_MS);
            }
            temporizadorAjuste = setTimeout(repetir, ESPERA_REPETICION_APERTURA_MS);
        }
        const controlesApertura = [
            { campo: "aperturaAlimentacion", modo: "modoAlimentacion", descripcion: "Apertura de alimentación", mas: "btnAumentarAgua", menos: "btnReducirAgua" },
            { campo: "aperturaAire", modo: "modoAire", descripcion: "Apertura de aire", mas: "btnAumentarAire", menos: "btnReducirAire" },
            { campo: "aperturaCombustible", modo: "modoCombustible", descripcion: "Apertura de combustible", mas: "btnAumentarCombustible", menos: "btnReducirCombustible" },
            { campo: "aperturaVapor", modo: "modoVapor", descripcion: "Apertura de FV-3", mas: "btnAumentarVapor", menos: "btnReducirVapor" }
        ];
        for (const control of controlesApertura) {
            for (const [id, paso] of [[control.mas, 1], [control.menos, -1]]) {
                const boton = document.getElementById(id);
                boton.addEventListener("pointerdown", (ev) => {
                    if (!estado.ejecutando || boton.disabled || estado[control.modo] !== "manual" || ev.button !== 0 || !ev.isPrimary) return;
                    ev.preventDefault();
                    boton.focus();
                    boton.setPointerCapture(ev.pointerId);
                    iniciarAjuste(boton, paso, "puntero", control);
                });
                for (const evento of ["pointerup", "pointercancel", "lostpointercapture", "blur"]) {
                    boton.addEventListener(evento, () => { if (ajuste?.boton === boton) terminarAjuste(); });
                }
                boton.addEventListener("keydown", (ev) => {
                    if (ev.key !== "Enter" && ev.key !== " ") return;
                    ev.preventDefault();
                    if (!ev.repeat) iniciarAjuste(boton, paso, ev.key, control);
                });
                boton.addEventListener("keyup", (ev) => {
                    if (ev.key !== "Enter" && ev.key !== " ") return;
                    ev.preventDefault();
                    if (ajuste?.boton === boton && ajuste.origen === ev.key) terminarAjuste();
                });
                // Click sintetizado por ayudas técnicas. Ratón/teclado ya se atienden arriba.
                boton.addEventListener("click", (ev) => {
                    if (!estado.ejecutando || boton.disabled || estado[control.modo] !== "manual" || ev.detail !== 0 || ajuste) return;
                    const anterior = estado[control.campo];
                    cambiarApertura(paso, control);
                    if (anterior !== estado[control.campo]) registrar(`${control.descripcion}: ${["aperturaAlimentacion", "aperturaCombustible"].includes(control.campo) ? Math.round(estado[control.campo]) : estado[control.campo]} %`);
                });
            }
        }
        document.getElementById("btnManualVapor").addEventListener("click", () => { if (estado.ejecutando) estacionVapor.focus(); });
        for (const [id, modo] of [["btnManualCombustible", "manual"], ["btnAutomaticoCombustible", "automatico"]]) {
            const boton = document.getElementById(id);
            boton.addEventListener("keydown", ev => {
                if (ev.repeat && (ev.key === "Enter" || ev.key === " ")) ev.preventDefault();
            });
            boton.addEventListener("click", () => {
                if (!estado.ejecutando || document.hidden) return;
                if (estado.modoCombustible !== modo) {
                    avanzar(performance.now());
                    cancelarAjusteCombustible();
                    if (modo === "automatico" && !estado.protecciones.enclavado) iniciarControlPresion(estado);
                    estado.modoCombustible = modo;
                    registrar(`FV-2: modo ${modo}`);
                    actualizarDibujo();
                }
                estacionCombustible.focus();
            });
        }
        for (const [id, modo] of [["btnManualAire", "manual"], ["btnAutomaticoAire", "automatico"]]) {
            const boton = document.getElementById(id);
            boton.addEventListener("keydown", ev => {
                if (ev.repeat && (ev.key === "Enter" || ev.key === " ")) ev.preventDefault();
            });
            boton.addEventListener("click", () => {
                if (!estado.ejecutando) return;
                if (estado.modoAire !== modo) {
                    avanzar(performance.now());
                    if (ajuste?.control.campo === "aperturaAire") terminarAjuste();
                    estado.modoAire = modo;
                    registrar(`FZ-1: modo ${modo}`);
                    actualizarDibujo();
                }
                estacionAire.focus();
            });
        }
        for (const [id, modo] of [["btnManualAgua", "manual"], ["btnAutomaticoAgua", "automatico"]]) {
            const boton = document.getElementById(id);
            boton.addEventListener("keydown", ev => {
                if (ev.repeat && (ev.key === "Enter" || ev.key === " ")) ev.preventDefault();
            });
            boton.addEventListener("click", () => {
                if (!estado.ejecutando || document.hidden) return;
                if (estado.modoAlimentacion !== modo) {
                    avanzar(performance.now());
                    if (ajuste?.control.campo === "aperturaAlimentacion") terminarAjuste();
                    if (modo === "automatico") iniciarControlNivel(estado, escena.nivelRelativo(estado.nivel));
                    estado.modoAlimentacion = modo;
                    registrar(`FV-1: modo ${modo}`);
                    actualizarDibujo();
                }
                estacionAlimentacion.focus();
            });
        }
        window.addEventListener("blur", () => terminarAjuste());

        aplicar.addEventListener("click", continuar);
        pausa.addEventListener("click", () => {
            if (estado.pausado) { continuar(); return; }
            if (!estado.ejecutando) return;
            avanzar(performance.now());
            estado.pausado = true;
            detenerCuadro();
            registrar("Pausa");
            actualizarDibujo();
        });

        function restablecer() {
            terminarAjuste(false);
            detenerCuadro();
            Object.assign(estado, {
                alarmas: { nivelBajo: crearAlarmaNivelBajo(), nivelMuyBajo: crearAlarmaNivelBajo(), nivelAlto: crearAlarmaNivelBajo(), nivelMuyAlto: crearAlarmaNivelBajo(), presionAlta: crearAlarmaNivelBajo(), presionMuyAlta: crearAlarmaNivelBajo(), perdidaFlama: crearAlarmaNivelBajo(), faltaAire: crearAlarmaNivelBajo(), faltaCombustible: crearAlarmaNivelBajo() }, fallasPendientes: [], aireRequeridoFalla: 0, retardoAire: 0,
            protecciones: { enclavado: false, causasActivas: [] },
            nivel: 0, aperturaAlimentacion: 0, modoAlimentacion: "manual", integralNivel: 0, caudalSalidasNivel: 0, vtfEnMarcha: false, corteCombustibleAbierto: false, aperturaAire: 0, modoAire: "manual", bombaCombustibleEnMarcha: false, aperturaCombustible: 0, modoCombustible: "manual", integralPresion: 0, cargaTermicaCombustible: 0, aperturaVapor: 0, modoVapor: "manual", bombaEnMarcha: false,
                presion: 0, presionAbsoluta: TERMICA.atmosfera, masaLiquida: 0, masaVapor: 0, masaTotal: 0, energiaTotal: 0, inventario: null, limiteModelo: null, temperatura: TERMICA.ambiente, enEbullicion: false, termicaSuspendida: false, pilotoEncendido: false, quemadorEncendido: false, inicioQuemador: null, drenajeAbierto: true, venteoAbierto: true, ejecutando: false, pausado: false, tiempo: 0, tiempoVisual: 0, caudalAgua: 0, caudalAire: 0, caudalCombustible: 0, caudalVaporProceso: 0, generacionVapor: 0
            });
            caudalProcesoVisual = 0;
            alarmaSeleccionada = "nivelBajo";
            pruebaLamparas = false;
            if (temporizadorLamparas !== null) clearTimeout(temporizadorLamparas);
            temporizadorLamparas = null;
            escena.reiniciar();
            tendenciaNivel.reiniciar();
            tendenciaTermica.reiniciar();
            tendenciaAgua.reiniciar();
            tendenciaAire.reiniciar();
            tendenciaCombustible.reiniciar();
            tendenciaVapor.reiniciar();
            registro.textContent = "";
            registrar("Estado inicial");
            actualizarDibujo();
        }
        reiniciar.addEventListener("click", restablecer);

        // Botones nativos: clic, Enter y Espacio comparten una sola activación.
        for (const [id, encendido] of [["btnEncenderPiloto", true], ["btnApagarPiloto", false]]) {
            const boton = document.getElementById(id);
            boton.addEventListener("keydown", ev => {
                if (ev.repeat && (ev.key === "Enter" || ev.key === " ")) ev.preventDefault();
            });
            boton.addEventListener("click", () => {
                if (!estado.ejecutando || estado.pilotoEncendido === encendido) return;
                avanzar(performance.now());
                if (encendido && (estado.protecciones.enclavado || !nivelPermiteEncendido() || !presionPermiteEncendido() || pilotoBloqueado())) { actualizarDibujo(); return; }
                estado.pilotoEncendido = encendido;
                registrar(encendido ? "Encendido del piloto" : "Apagado del piloto");
                actualizarDibujo();
            });
        }

        for (const [id, encender] of [["btnEncenderQuemador", true], ["btnApagarQuemador", false]]) {
            const boton = document.getElementById(id);
            boton.addEventListener("keydown", ev => {
                if (ev.repeat && (ev.key === "Enter" || ev.key === " ")) ev.preventDefault();
            });
            boton.addEventListener("click", () => {
                if (!estado.ejecutando) return;
                avanzar(performance.now());
                if (encender) {
                    if (estado.quemadorEncendido || !permisoQuemador()) { actualizarDibujo(); return; }
                    cancelarAjusteCombustible();
                    estado.aperturaCombustible = 15;
                    estado.quemadorEncendido = true;
                    estado.inicioQuemador = estado.tiempo;
                    if (estado.modoCombustible === "automatico") iniciarControlPresion(estado);
                    registrar("Encendido del quemador");
                } else apagarQuemador("Apagado del quemador");
                actualizarDibujo();
            });
        }

        // Una función central para disparo manual y causas automáticas identificadas.
        // La causa manual solo se retira mediante restablecimiento.
        function dispararCaldera(causa = "manual", tiempo = estado.tiempo) {
            if (!estado.ejecutando || estado.protecciones.causasActivas.includes(causa)) return;
            const estabaEnclavado = estado.protecciones.enclavado;
            estado.protecciones.causasActivas.push(causa);
            estado.protecciones.enclavado = true;
            const nombre = causa === "manual" ? "disparo manual" : causa === "perdidaFlama" ? "pérdida de flama" : ventanasAlarmas[causa].nombre.toLocaleLowerCase("es");
            if (!estabaEnclavado) {
                cancelarAjusteCombustible();
                estado.pilotoEncendido = false;
                estado.corteCombustibleAbierto = false;
                apagarQuemador(`Apagado del quemador: ${nombre}`);
            }
            registrar(causa === "manual" ? "Disparo manual de caldera" : `Disparo de caldera: ${nombre.charAt(0).toLocaleUpperCase("es") + nombre.slice(1)}`, tiempo);
        }
        function restablecerDisparo() {
            if (!estado.ejecutando || !estado.protecciones.enclavado) return;
            avanzar(performance.now());
            actualizarSuministros();
            // Los permisos no dependen de los avisos ni de cierres impuestos por el disparo.
            if (motivoRestablecimiento()) { actualizarDibujo(); return; }
            estado.protecciones.causasActivas = [];
            estado.aireRequeridoFalla = 0;
            estado.protecciones.enclavado = false;
            // No recuperar aperturas ni encendido. El PI se inicializa al encender.
            estado.integralPresion = 0;
            registrar("Restablecimiento de disparo");
            actualizarDibujo();
        }
        document.getElementById("btnDispararCaldera").addEventListener("click", () => {
            if (!estado.ejecutando || estado.protecciones.causasActivas.includes("manual")) return;
            avanzar(performance.now());
            dispararCaldera("manual");
            actualizarDibujo();
        });
        document.getElementById("btnRestablecerDisparo").addEventListener("click", restablecerDisparo);

        // Órdenes explícitas; el símbolo CV ya no participa en las maniobras.
        function ordenarCorteCombustible(abierta) {
            if (!estado.ejecutando || (abierta && estado.protecciones.enclavado) || estado.corteCombustibleAbierto === abierta) return;
            avanzar(performance.now());
            if (abierta && estado.protecciones.enclavado) return;
            estado.corteCombustibleAbierto = abierta;
            registrar(abierta ? "Apertura de corte de combustible" : "Cierre de corte de combustible");
            actualizarDibujo(); // Reutiliza suministro y apagado por pérdida de combustible.
        }
        for (const [id, abierta] of [["btnAbrirCV", true], ["btnCerrarCV", false]]) {
            document.getElementById(id).addEventListener("click", () => ordenarCorteCombustible(abierta));
        }

        // Un solo callback de maniobras; reiniciar no vuelve a registrarlo.
        escena.alClic((nombre) => {
            if (!estado.ejecutando) return;
            if (!["valvulaAgua", "valvulaDrenaje", "BAA", "VTF", "compuertaAire", "unidadCombustible", "valvulaCombustible", "valvulaVenteo", "valvulaVapor"].includes(nombre)) return;
            avanzar(performance.now());
            if (nombre === "valvulaAgua") {
                estacionAlimentacion.focus();
            } else if (nombre === "compuertaAire") {
                estacionAire.focus();
            } else if (nombre === "valvulaVapor") {
                estacionVapor.focus();
            } else if (nombre === "valvulaCombustible") {
                estacionCombustible.focus();
            } else if (nombre === "unidadCombustible") {
                estado.bombaCombustibleEnMarcha = !estado.bombaCombustibleEnMarcha;
                registrar(estado.bombaCombustibleEnMarcha ? "Arranque de bomba de combustible" : "Paro de bomba de combustible");

            } else if (nombre === "VTF") {
                estado.vtfEnMarcha = !estado.vtfEnMarcha;
                registrar(estado.vtfEnMarcha ? "Arranque de VTF" : "Paro de VTF");
            } else if (nombre === "valvulaVenteo") {
                estado.venteoAbierto = !estado.venteoAbierto;
                if (!estado.venteoAbierto && !estado.inventario) {
                    const inicial = iniciarPresurizacion(estado.nivel * CAPACIDAD_EQUIVALENTE_AGUA, estado.temperatura);
                    if (inicial && estado.enEbullicion) {
                        estado.inventario = inicial;
                        estado.masaLiquida = inicial.masaLiquida;
                        estado.masaVapor = inicial.masaVapor;
                        estado.masaTotal = inicial.masaTotal;
                        estado.energiaTotal = inicial.energiaTotal;
                        estado.presionAbsoluta = inicial.presionAbsoluta;
                        estado.presion = inicial.presionAbsoluta - TERMICA.atmosfera;
                    }
                }
                registrar(estado.venteoAbierto ? "Apertura de venteo" : "Cierre de venteo");
            } else if (nombre === "valvulaDrenaje") {
                estado.drenajeAbierto = !estado.drenajeAbierto;
                registrar(estado.drenajeAbierto ? "Apertura de drenaje" : "Cierre de drenaje");
            } else {
                estado.bombaEnMarcha = !estado.bombaEnMarcha;
                if (estado.bombaEnMarcha && estado.modoAlimentacion === "automatico") {
                    iniciarControlNivel(estado, escena.nivelRelativo(estado.nivel));
                }
                registrar(estado.bombaEnMarcha ? "Arranque de BAA" : "Paro de BAA");
            }
            actualizarDibujo();
        });

        // Una pulsación sostenida no debe repetir la maniobra por autorepetición.
        escena.svg.addEventListener("keydown", (ev) => {
            const nombre = ev.target.closest(".interactivo")?.dataset.elemento;
            if (ev.repeat && (ev.key === "Enter" || ev.key === " ") &&
                ["valvulaAgua", "valvulaDrenaje", "BAA", "VTF", "compuertaAire", "unidadCombustible", "valvulaCombustible", "valvulaVenteo", "valvulaVapor"].includes(nombre)) {
                ev.preventDefault();
                ev.stopImmediatePropagation();
            }
        }, true);

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) terminarAjuste();
            // Se descarta el intervalo oculto; ni nivel ni reloj recuperan ese tiempo.
            detenerCuadro();
            if (!document.hidden && estado.ejecutando && !estado.pausado) {
                ultimoTiempo = performance.now();
                programarCuadro();
            }
            actualizarDibujo();
        });
        restablecer();
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", inicializarOperacion, { once: true });
    } else {
        inicializarOperacion();
    }
})();
