"use strict";

/* =====================================================
   SIMULADOR RVTH — RED, EXCITACIÓN Y SINCRONIZACIÓN
   AUTOMÁTICA 25A (etapa 27, 20-oct-2026)

   Archivo: sincronizacion.js
   Se carga DESPUÉS de watt_resorte_integracion.js y ANTES
   de simulador.js. Adapta (no incrusta) las funciones del
   módulo de referencia soportes/SINCRONOSCOPIO/index.html,
   que NO se modifica.

   UN SOLO MODELO DE UNIDAD
     Velocidad / frecuencia: `frecuencia` (modelo.js),
       60 Hz = 360 rpm, 20 polos.
     Interruptor: `interruptorCerrado` (modelo.js) y el
       botón del RVTH (simulador.js).
     Potencias: `potenciaMecanica` y `cargaElectrica`
       (modelo.js). Aquí solo se calcula Pe con el
       interruptor cerrado.
     Tiempo y pausa: este módulo avanza solo dentro del
       paso fijo del RVTH (avanzarSincronizacion, llamado
       por simulador.js tras ejecutarModelo). Abrir o cerrar
       la ventana lateral no afecta al proceso.

   1. RED (bus infinito de 115 kV, 60 Hz)
      La red impone la referencia de frecuencia fBus = 60 Hz
      y la tensión vBus = 1 pu. Ángulo del generador respecto
      al bus (grados eléctricos):
          dδ/dt = 360·(f_gen − f_bus)
      integrado con el tiempo de simulación (nunca con los
      ángulos de las animaciones, que giran al 25 %).
      Convención: tensiones y ángulos REFERIDOS AL LADO DE
      115 kV (lado de los contactos del 52G). El generador
      (13.8 kV) se refiere con la relación nominal 13.8/115
      (pu iguales en ambos lados) y se SUPONE que los TP del
      sincronizador compensan el desfase de grupo de conexión
      del transformador. δ > 0: generador adelantado.

   2. POTENCIA ELÉCTRICA CONECTADO (interruptor cerrado)
          Pe = (E·vBus / X)·sen δ + Kd·(f_gen − f_bus)
      E = tensión interna ≈ tensión del generador (AVR),
      X = 0.50 pu (reactancia transitoria + transformador,
      SUPUESTO), Kd = devanados amortiguadores (SUPUESTO,
      elegido para ζ ≈ 0.26 en la oscilación electromecánica
      de ≈ 0.64 Hz con la INERCIA del modelo).
      La ecuación de velocidad (modelo.js) pasa a ser:
          df/dt = (T_turbina − Pe·f_N/f) / INERCIA
      Se ELIMINA el término AMORTIGUAMIENTO·(f − 60) del
      modelo aislado anterior: el amortiguamiento respecto a
      la red queda solo en Kd (no se duplica). Las pérdidas
      siguen solo en parPerdidas (modelo.js).
      Ya no hay una demanda fija del 80 %: Pe resulta del
      acoplamiento y del balance mecánico.

   3. EXCITACIÓN SIMPLIFICADA (adaptada del módulo)
      Sin campo: tensión remanente 0.03·f/60. Con campo:
      E_obj = exc·f/60 (V/Hz), primer orden τ = 0.8 s. El
      AVR solo recibe pulsos ▲/▼ del 25A (0.03 pu/s). Etapa 29:
      el campo se aplica solo al pulsar INICIAR SINCRONIZACIÓN
      (AUTO regulando, velocidad ≥ 95 %); se retiene al cancelar,
      se retira por debajo del 90 % y al REINICIAR. Sin mandos
      manuales de excitación.

   4. SINCRONIZADOR 25A Y VERIFICACIÓN 25 (adaptados)
      Igualación de tensión por pulsos al AVR y de frecuencia
      por pulsos a M1 (motor REAL del ajuste del resorte, a su
      velocidad y con sus finales de carrera). Como el lazo
      del Watt es lento (oscilación de ≈ 30 s), los pulsos de
      velocidad son de «pulso y espera»: duración calculada
      con la sensibilidad estática del Watt y espera a que
      Δf se estabilice antes del siguiente.
      Permisivos: tensiones válidas (±10 %), |ΔV| ≤ 3 %,
      0.005 < Δf ≤ 0.15 Hz (deslizamiento positivo pequeño),
      |dΔf/dt| ≤ 0.012 Hz/s sin pulso en curso, todos
      durante 1.5 s; orden anticipada el tiempo de cierre
      del 52G (80 ms) antes de que δ pase por 0.
      Orden de cierre: 20 ms CANCELABLES (bobina y retén:
      si la verificación 25 deja de cumplirse, la orden se
      retira y el interruptor sigue abierto) + 60 ms de
      recorrido IRREVERSIBLE de los contactos.

   5. TOMA INICIAL DEL 5 %
      Tras el cierre, pulsos a M1 (pulso y espera, con Pe
      estable: |dPe/dt| ≤ 0.02 %/s durante 5 s) hasta que Pe
      (activa, base nominal) quede en 5 % ± 0.5 % con
      oscilación pico a pico ≤ 0.4 % y deriva ≤ 0.1 % durante
      30 s (un periodo de la oscilación lenta del lazo). Después
      M1 vuelve a + / − (operador); no queda ningún lazo de
      potencia.
===================================================== */

const RED = {
    fBus: 60,                 // Hz (red infinita)
    vBus: 1.0,                // pu (115 kV)
    kVBus: 115,
    kVGen: 13.8,
    X: 0.50,                  // pu, SUPUESTO
    Kd: 1.6,                  // pu de potencia por Hz de deslizamiento, SUPUESTO
    tauV: 0.8,                // s, constante de la tensión (módulo de referencia)
    remanente: 0.03,          // pu a velocidad nominal sin campo
    excInicial: 0.95,         // pu: consigna del AVR antes de igualar (SUPUESTO didáctico)
    nCampo: 0.95,             // fracción de 360 rpm para aplicar el campo
    nSinCampo: 0.90,          // por debajo se retira el campo
    vValida: 0.80             // pu: señal válida para el sincronoscopio
};

const SINC = {
    slip: 0.067,              // Hz objetivo (módulo de referencia)
    banda: 0.02,              // Hz: sin pulsos si |Δf − slip| ≤ banda
    dfMin: 0.005, dfMax: 0.15,
    dvMax: 0.03, vTol: 0.10, ventanaAngulo: 10,
    tcb: 0.080, tCancelable: 0.020,
    tVentana: 1.5, dfDotMax: 0.012,
    ganancia: 0.8, pulsoMin: 0.03, pulsoMax: 1.0,
    dfDotEstable: 0.004, tEstable: 5, esperaMin: 30, tauMedia: 15,
    avrRate: 0.03, avrPeriodo: 1.0,
    tSinConvergencia: 300, tMaxIgualacion: 600,
    /* Toma inicial: referencia a 0.5 puntos porcentuales/s (0.005 pu/s).
       Se convierte en recorrido de M1; Pe siempre resulta del modelo. */
    pRampa: 0.005,
    /* Seguimiento de Pe mediante M1 (solo toma inicial al 5 %).
       Ajuste didáctico verificado con la planta actual. No cambia
       el Watt, el dashpot, la hidráulica ni la potencia calculada.
       sensibilidad: pu/mm; adelanto: s; integral: 1/s. */
    sensibilidadCarga: 0.048, adelantoCarga: 35,
    kpCarga: 2, kiCarga: 0.2, integralCargaMax: 0.1,
    pulsoCargaMax: 0.1,
    pObjetivo: 0.05, pBanda: 0.005, pOscilacion: 0.004, pDeriva: 0.001, tConfCarga: 30,
    pdotEstable: 0.0002, tMaxCarga: 600
};

const estadoRed = { delta: 0, vg: 0, exc: RED.excInicial, campo: false };

const estadoSinc = {
    fase: "esperandoAuto",
    orden: false,                 // etapa 29: autorización explícita (INICIAR)
    motivo: "",
    aviso: "",
    pulsoM1: 0, espera: 0, tEstable: 0,
    pulsoV: 0, tAvr: 0,
    okT: 0, tIgualando: 0, errT: 0,
    dfPrev: null, dfDot: 0, dfMedia: 0,
    tCierre: 0, cierre: null,
    peF: 0, pePrev: null, peDot: 0, tCarga: 0, pReferencia: 0, pInicioCarga: 0, aInicioCarga: 0, integralCarga: 0, rampaCargaActiva: false, ventanaPe: [], tMuestraPe: 0,
    tiempo: 0,
    registro: []
};

const FASES_SINC = {
    esperandoAuto: "Esperando AUTO",
    aproximacion: "Aproximación a nominal",
    lista: "Lista para iniciar sincronización",
    excitando: "Excitando",
    igualando: "Igualando frecuencia y tensión",
    esperandoSincronismo: "Esperando sincronismo",
    cerrando: "Cerrando 52G",
    tomandoCarga: "Tomando carga (5 %)",
    enServicio: "En servicio · AUTO",
    bloqueada: "Secuencia detenida"
};


/* ---------- Red y tensión ---------- */

function desfaseGrados(){                 // δ envuelto en [−180, 180)
    const d = ((estadoRed.delta + 180) % 360 + 360) % 360 - 180;
    return d;
}

function deslizamientoHz(){ return frecuencia - RED.fBus; }

function tensionGeneradorPu(){ return estadoRed.vg; }

function potenciaElectricaRed(){
    const d = estadoRed.delta * Math.PI / 180;
    return estadoRed.vg * RED.vBus / RED.X * Math.sin(d) + RED.Kd * (frecuencia - RED.fBus);
}

function avanzarRed(dt){
    estadoRed.delta += 360 * (frecuencia - RED.fBus) * dt;
    if(!interruptorCerrado){                         // abierto: solo representación acotada
        estadoRed.delta = desfaseGrados();
    }
    const fr = Math.max(0, frecuencia) / F_NOMINAL;
    if(estadoRed.campo && fr < RED.nSinCampo){
        estadoRed.campo = false;
        registrarSinc("Campo retirado: velocidad < 90 %", "w");
    }
    if(estadoSinc.pulsoV !== 0){
        estadoRed.exc += Math.sign(estadoSinc.pulsoV) * SINC.avrRate * dt;
    }
    const obj = estadoRed.campo ? estadoRed.exc * fr : RED.remanente * fr;
    estadoRed.vg += (obj - estadoRed.vg) * Math.min(1, dt / RED.tauV);
}

function senalValida(){
    return estadoRed.vg >= RED.vValida && RED.vBus >= RED.vValida;
}


/* ---------- Registro de eventos ---------- */

function registrarSinc(texto, clase){
    estadoSinc.registro.push({ t: estadoSinc.tiempo, texto, clase: clase || "" });
    if(estadoSinc.registro.length > 200){ estadoSinc.registro.shift(); }
    estadoSinc.registroCambiado = true;
}


/* ---------- Propiedad de M1 ---------- */

function sincronizadorTieneM1(){
    const f = estadoSinc.fase;
    return f === "excitando" || f === "igualando" || f === "esperandoSincronismo" ||
           f === "cerrando" || f === "tomandoCarga";
}

function mandoM1Sincronizador(){
    if(!sincronizadorTieneM1()){ return null; }
    return estadoSinc.pulsoM1 > 0 ? 1 : estadoSinc.pulsoM1 < 0 ? -1 : 0;
}


/* ---------- Permisivos y verificación 25 ---------- */

function permisivosSinc(){
    const df = deslizamientoHz(), dv = estadoRed.vg - RED.vBus;
    const p = {
        v: Math.abs(estadoRed.vg - 1) <= SINC.vTol && Math.abs(RED.vBus - 1) <= SINC.vTol,
        dv: Math.abs(dv) <= SINC.dvMax,
        df: df > SINC.dfMin && df <= SINC.dfMax,
        st: Math.abs(estadoSinc.dfDot) <= SINC.dfDotMax && estadoSinc.pulsoM1 === 0
    };
    p.todos = p.v && p.dv && p.df && p.st;
    return p;
}

function tiempoHastaCero(){              // s hasta que δ pase por 0 (Δf > 0, giro horario)
    const df = deslizamientoHz(), d = desfaseGrados();
    if(df > 0.002){ return (d <= 0 ? -d : 360 - d) / (360 * df); }
    return Infinity;
}

function modoAutoRegulando(){
    return estadoMando.modo === "auto" && estadoMando.fase === "regulando";
}

/* Verificación 25: ángulo PREVISTO al tocar los contactos
   (dentro del tiempo restante), Δf, ΔV, tensiones y modo */
function verificacion25(tRestante){
    const df = deslizamientoHz();
    const dPrev = desfaseGrados() + 360 * df * tRestante;
    const why = [];
    if(!modoAutoRegulando()){ why.push("modo no AUTO"); }
    if(!senalValida() || Math.abs(estadoRed.vg - 1) > SINC.vTol){ why.push("tensión no válida"); }
    if(Math.abs(estadoRed.vg - RED.vBus) > SINC.dvMax){ why.push("ΔV " + ((estadoRed.vg - RED.vBus) * 100).toFixed(1) + " %"); }
    if(!(df > 0 && df <= SINC.dfMax)){ why.push("Δf " + df.toFixed(3) + " Hz"); }
    if(Math.abs(dPrev) > SINC.ventanaAngulo){ why.push("ángulo previsto " + dPrev.toFixed(1) + "°"); }
    return { ok: why.length === 0, why, dPrev };
}


/* ---------- Pulsos a M1 (pulso y espera) ---------- */

function sensibilidadHzPorMm(){
    /* Sensibilidad ESTÁTICA del Watt en el punto actual
       (física del regulador, sin conexión): Δn/Δa → Hz */
    const a = estadoGobernador.a, s = estadoGobernador.s;
    const dn = FISICA_GOB.nEquilibrio(s, a + 0.1) - FISICA_GOB.nEquilibrio(s, a - 0.1);
    return Math.max(0.01, dn / 0.2 * F_NOMINAL / RPM_NOMINAL);
}

function emitirPulsoM1(mm){
    const v = RW.PARAM.ajuste.velocidadMotor;
    let t = Math.abs(mm) / v;
    if(t < SINC.pulsoMin){ return false; }
    t = Math.min(SINC.pulsoMax, t);
    estadoSinc.pulsoM1 = Math.sign(mm) * t;
    estadoSinc.espera = 0;
    estadoSinc.tEstable = 0;
    return true;
}

function avanzarPulsos(dt){
    if(estadoSinc.pulsoM1 !== 0){
        const r = Math.abs(estadoSinc.pulsoM1) - dt;
        estadoSinc.pulsoM1 = r <= 1e-9 ? 0 : Math.sign(estadoSinc.pulsoM1) * r;
    }
    if(estadoSinc.pulsoV !== 0){
        const r = Math.abs(estadoSinc.pulsoV) - dt;
        estadoSinc.pulsoV = r <= 1e-9 ? 0 : Math.sign(estadoSinc.pulsoV) * r;
    }
}

function detenerPulsos(){
    estadoSinc.pulsoM1 = 0;
    estadoSinc.pulsoV = 0;
}


/* ---------- Transiciones ---------- */

function irAFase(f, texto, clase){
    if(estadoSinc.fase === f){ return; }
    estadoSinc.fase = f;
    if(texto){ registrarSinc(texto, clase); }
}

function bloquearSecuencia(motivo, clase){
    detenerPulsos();
    estadoSinc.cierre = null;
    estadoSinc.orden = false;
    estadoSinc.motivo = motivo;
    irAFase("bloqueada", motivo, clase || "a");
}

/* Etapa 29 (20-oct-2026): INICIO EXPLÍCITO.
   La secuencia (excitación, igualación, espera, cierre y toma
   del 5 %) solo arranca con INICIAR SINCRONIZACIÓN. APLICAR,
   AUTO, la llegada a nominal, abrir la ventana, REINICIAR o
   abrir el 52G no la inician. Sin orden: ni campo ni pulsos.
   CANCELAR (solo con el 52G abierto y la orden de cierre aún
   cancelable) detiene los pulsos y retira la orden; el campo y
   la consigna del AVR se RETIENEN tal como están (sin saltos de
   tensión) y M1 vuelve a + / − sin reposicionarse. Un nuevo
   intento exige INICIAR, que rearma internamente pero vuelve a
   comprobar todos los permisivos (no los omite). */

const FASES_ACTIVAS = ["excitando", "igualando", "esperandoSincronismo", "cerrando", "tomandoCarga"];

function secuenciaActiva(){
    return estadoSinc.orden && FASES_ACTIVAS.indexOf(estadoSinc.fase) >= 0;
}

function condicionesInicio(){
    const why = [];
    if(!simulando){ why.push("simulación detenida"); }
    if(pausado){ why.push("simulación en pausa"); }
    if(estadoMando.modo !== "auto" || estadoMando.fase !== "regulando"){ why.push("el gobernador debe estar en AUTO regulando"); }
    if(interruptorCerrado){ why.push("52G cerrado"); }
    if(estadoSinc.fase === "cerrando" || secuenciaActiva()){ why.push("secuencia en curso"); }
    if(velocidadEjeRpm() < RED.nCampo * RPM_NOMINAL){ why.push("velocidad < 95 %"); }
    return why;
}

function iniciarSincronizacion(){
    const why = condicionesInicio();
    if(why.length){
        if(simulando && !pausado && !secuenciaActiva()){
            registrarSinc("INICIAR rechazado: " + why.join(", "), "w");
        }
        return false;
    }
    const e = estadoSinc;
    e.orden = true;
    e.motivo = ""; e.aviso = "";
    e.okT = 0; e.tIgualando = 0; e.errT = 0;
    e.espera = SINC.esperaMin; e.tEstable = 0; e.tCarga = 0;
    e.ventanaPe = []; e.cierre = null; e.tCierre = 0;
    e.fase = "excitando";
    if(!estadoRed.campo){
        estadoRed.campo = true;
        registrarSinc("INICIAR SINCRONIZACIÓN: campo aplicado, excitando el generador", "g");
    }else{
        registrarSinc("INICIAR SINCRONIZACIÓN: campo ya aplicado (retenido)", "g");
    }
    return true;
}

function cancelacionPermitida(){
    const f = estadoSinc.fase;
    if(!simulando || pausado || interruptorCerrado || !estadoSinc.orden){ return false; }
    if(f === "cerrando"){ return estadoSinc.tCierre < SINC.tCancelable; }
    return f === "excitando" || f === "igualando" || f === "esperandoSincronismo";
}

function cancelarSincronizacion(){
    if(estadoSinc.fase === "cerrando" && estadoSinc.tCierre >= SINC.tCancelable){
        registrarSinc("Cancelación rechazada: contactos del 52G ya en recorrido irreversible", "w");
        return false;
    }
    if(!cancelacionPermitida()){ return false; }
    const e = estadoSinc;
    if(e.fase === "cerrando"){ registrarSinc("Orden de cierre retirada (fase cancelable)", "w"); }
    detenerPulsos();
    e.orden = false;
    e.cierre = null;
    e.aviso = "Sincronización cancelada · lista para nuevo inicio";
    e.fase = "lista";
    registrarSinc("Sincronización cancelada por el operador (campo y consigna del AVR retenidos; M1 liberado)", "w");
    return true;
}

/* Compatibilidad: el antiguo «Rearmar 25A» ya no existe como
   mando visible; INICIAR hace el rearme interno. */
function rearmarSincronizacion(){ return iniciarSincronizacion(); }

/* Apertura del 52G (operador, botón del RVTH): siempre
   permitida; no hay nuevo cierre automático sin INICIAR */
function aperturaInterruptorOperador(){
    const e = estadoSinc;
    detenerPulsos();
    e.orden = false;
    e.cierre = null;
    e.motivo = "";
    e.aviso = "52G abierto por el operador · lista para nuevo inicio";
    e.fase = estadoMando.modo !== "auto" ? "esperandoAuto" :
             estadoMando.fase === "regulando" ? "lista" : "aproximacion";
    registrarSinc("52G abierto por el operador: nuevo cierre solo con INICIAR", "w");
}

/* Motivo por el que el botón del RVTH no puede cerrar */
function motivoRechazoCierreOperador(){
    if(estadoMando.modo !== "auto"){ return "Cierre solo por 25A en AUTO"; }
    if(estadoSinc.fase === "lista" || estadoSinc.fase === "bloqueada"){ return "Cierre solo por 25A · pulse INICIAR SINCRONIZACIÓN"; }
    return "Cierre solo por 25A · " + FASES_SINC[estadoSinc.fase];
}


/* ---------- Avance (cada PASO_INTEGRACION) ---------- */

function avanzarSincronizacion(dt){

    if(!simulando){ return; }
    const e = estadoSinc;
    e.tiempo += dt;

    avanzarPulsos(dt);

    /* derivada filtrada de Δf (τ = 0.6 s, como el módulo) */
    const df = deslizamientoHz();
    if(e.dfPrev !== null){
        e.dfDot += ((df - e.dfPrev) / dt - e.dfDot) * Math.min(1, dt / 0.6);
    }
    e.dfPrev = df;
    /* Δf medio (τ = 15 s ≈ media sobre la oscilación lenta
       del lazo del Watt, periodo ≈ 30 s): base de los pulsos */
    e.dfMedia += (df - e.dfMedia) * Math.min(1, dt / SINC.tauMedia);

    /* Pe filtrada (τ = 1 s) y su derivada */
    const pe = interruptorCerrado ? cargaElectrica : 0;
    e.peF += (pe - e.peF) * Math.min(1, dt / 1.0);
    if(e.pePrev !== null){ e.peDot += ((e.peF - e.pePrev) / dt - e.peDot) * Math.min(1, dt / 1.0); }
    e.pePrev = e.peF;

    /* Interruptor abierto mientras estaba en carga (salvaguarda;
       la apertura del operador ya lo trata) */
    if(!interruptorCerrado && (e.fase === "tomandoCarga" || e.fase === "enServicio")){
        aperturaInterruptorOperador();
    }

    if(e.fase === "bloqueada" && interruptorCerrado){ return; }

    /* M1 de un solo responsable: si la secuencia lo tiene, se
       anula cualquier orden previa de + / − */
    if(sincronizadorTieneM1()){ estadoMando.motorAjuste = 0; }

    if(e.fase === "enServicio"){ return; }

    if(e.fase === "tomandoCarga"){
        if(estadoMando.modo !== "auto" || estadoMando.fase !== "regulando"){
            bloquearSecuencia("Toma de carga interrumpida: modo no AUTO", "a");
            return;
        }
        avanzarTomaCarga(dt);
        return;
    }

    if(e.fase === "cerrando"){
        avanzarCierre(dt);
        return;
    }

    if(interruptorCerrado){ return; }              // conectado sin secuencia activa

    /* Desde aquí, interruptor ABIERTO */

    const auto = estadoMando.modo === "auto" && estadoMando.fase !== "pasandoManual";

    if(!auto){
        if(e.orden){
            detenerPulsos();
            e.orden = false;
            e.cierre = null;
            registrarSinc("Sincronización cancelada: MANUAL seleccionado (se requiere INICIAR)", "w");
        }
        e.fase = "esperandoAuto";
        e.aviso = ""; e.motivo = "";
        e.okT = 0; e.tIgualando = 0; e.errT = 0;
        return;
    }

    if(!e.orden){
        if(estadoMando.fase !== "regulando"){ e.fase = "aproximacion"; }
        else if(e.fase !== "bloqueada"){ e.fase = "lista"; }
        return;
    }

    if(estadoMando.fase !== "regulando" || velocidadEjeRpm() < RED.nCampo * RPM_NOMINAL){
        bloquearSecuencia("Secuencia detenida: el gobernador no regula a velocidad nominal");
        return;
    }

    if(!estadoRed.campo){                           // retirado por subvelocidad
        estadoRed.campo = true;
        registrarSinc("Campo aplicado de nuevo", "w");
    }

    if(e.fase === "excitando"){
        if(estadoRed.vg >= 0.9){
            e.tIgualando = 0; e.errT = 0; e.espera = SINC.esperaMin; e.tEstable = 0;
            irAFase("igualando", "Tensión presente: igualando frecuencia y tensión");
        }
        return;
    }

    /* igualando / esperandoSincronismo */
    avanzarIgualacion(dt);

}


function avanzarIgualacion(dt){

    const e = estadoSinc;
    const df = deslizamientoHz();
    const err = SINC.slip - e.dfMedia;

    /* Pulsos al AVR (cada 1 s, como el módulo) */
    e.tAvr += dt;
    if(e.tAvr >= SINC.avrPeriodo){
        e.tAvr = 0;
        const dv = estadoRed.vg - RED.vBus;
        if(Math.abs(dv) > 0.008 && e.pulsoV === 0 && estadoRed.vg > 0.5){
            e.pulsoV = -Math.sign(dv) * Math.max(0.08, Math.min(0.9, Math.abs(dv) / SINC.avrRate * 0.7));
        }
    }

    /* Pulsos a M1: pulso y espera. Solo con Δf estable
       (|dΔf/dt| ≤ 0.004 Hz/s durante 5 s) y al menos 30 s
       (un periodo de la oscilación lenta) tras el anterior;
       la duración sale del Δf MEDIO y de la sensibilidad
       estática del Watt. Sin pulsos forzados por tiempo: si
       no se estabiliza, actúan los tiempos máximos. */
    if(e.pulsoM1 === 0){
        e.espera += dt;
        e.tEstable = Math.abs(e.dfDot) <= SINC.dfDotEstable ? e.tEstable + dt : 0;
        if(Math.abs(err) > SINC.banda && e.tEstable >= SINC.tEstable && e.espera >= SINC.esperaMin){
            const mm = err / sensibilidadHzPorMm() * SINC.ganancia;
            if(emitirPulsoM1(mm)){
                registrarSinc("Pulso " + (mm > 0 ? "▲" : "▼") + " velocidad a M1: " +
                    Math.abs(mm).toFixed(2) + " mm (Δf medio " + e.dfMedia.toFixed(3) + " Hz)");
            }
        }
    }

    const p = permisivosSinc();
    e.okT = p.todos ? e.okT + dt : 0;
    e.tIgualando += dt;
    e.errT = Math.abs(err) > 0.03 ? e.errT + dt : 0;

    if(e.okT >= SINC.tVentana){
        irAFase("esperandoSincronismo", "Permisivos cumplidos: esperando el ángulo de adelanto");
    }else if(e.fase === "esperandoSincronismo" && !p.todos){
        e.fase = "igualando";
    }

    if(e.errT > SINC.tSinConvergencia){
        bloquearSecuencia("25A: la frecuencia no converge (" + SINC.tSinConvergencia + " s) · pulse INICIAR para reintentar");
        return;
    }
    if(e.tIgualando > SINC.tMaxIgualacion && e.fase !== "esperandoSincronismo"){
        const why = [];
        if(!p.v){ why.push("tensiones"); }
        if(!p.dv){ why.push("ΔV"); }
        if(!p.df){ why.push("Δf"); }
        if(!p.st){ why.push("estabilidad"); }
        bloquearSecuencia("25A: tiempo de sincronización excedido (" + (why.join(", ") || "permisivos intermitentes") + ") · pulse INICIAR para reintentar");
        return;
    }

    if(e.fase === "esperandoSincronismo" && desfaseGrados() < 0 && tiempoHastaCero() <= SINC.tcb){
        const v = verificacion25(SINC.tcb);
        if(!v.ok){
            registrarSinc("Verificación 25 bloqueó la orden: " + v.why.join(", "), "a");
            e.okT = 0;
            e.fase = "igualando";
            return;
        }
        e.tCierre = 0;
        e.cierre = { tOrden: e.tiempo, deltaOrden: desfaseGrados(), df, dPrev: v.dPrev };
        e.fase = "cerrando";
        registrarSinc("Orden de cierre al 52G: δ = " + desfaseGrados().toFixed(1) + "°, Δf = " +
            df.toFixed(3) + " Hz, δ previsto al contacto " + v.dPrev.toFixed(1) + "°");
    }

}


function avanzarCierre(dt){

    const e = estadoSinc;
    e.tCierre += dt;

    if(e.tCierre < SINC.tCancelable){
        const v = verificacion25(SINC.tcb - e.tCierre);
        if(!v.ok){
            registrarSinc("Orden retirada en la fase cancelable: " + v.why.join(", "), "a");
            e.cierre = null;
            e.okT = 0;
            e.fase = "igualando";            // la orden sigue vigente; si cambió el modo, se cancela en el paso siguiente
            return;
        }
        return;
    }

    if(e.tCierre + 1e-9 >= SINC.tcb){
        const df = deslizamientoHz();
        const dv = estadoRed.vg - RED.vBus;
        e.cierre.contacto = {
            t: e.tiempo, delta: desfaseGrados(), df, dv,
            rpm: velocidadEjeRpm(), vg: estadoRed.vg
        };
        estadoRed.delta = desfaseGrados();          // δ continuo (sin salto), acotado
        cerrarContactos52G();
        e.tCarga = 0; e.ventanaPe = []; e.espera = SINC.esperaMin; e.tEstable = 0;
        detenerPulsos();
        e.pInicioCarga = Math.max(0, Math.min(SINC.pObjetivo, cargaElectrica));
        e.pReferencia = e.pInicioCarga;
        e.aInicioCarga = estadoGobernador.a;
        e.integralCarga = 0;
        e.rampaCargaActiva = true;
        e.tMuestraPe = 0;
        e.fase = "tomandoCarga";
        registrarSinc("Toma de carga: referencia a 0.5 %/s hasta 5 %", "g");
        registrarSinc("52G CERRADO: δ = " + e.cierre.contacto.delta.toFixed(2) + "°, Δf = " +
            df.toFixed(3) + " Hz, ΔV = " + (dv * 100).toFixed(2) + " %", "g");
    }

}


function avanzarTomaCarga(dt){

    const e = estadoSinc;
    e.tCarga += dt;
    e.pReferencia = Math.min(SINC.pObjetivo, e.pInicioCarga + SINC.pRampa * e.tCarga);

    /* Referencia en rampa + anticipación de la respuesta lenta de la
       planta + corrección PI de la potencia eléctrica medida.
       La salida es posición de ajuste solicitada; el único actuador
       sigue siendo M1 con sus pulsos, velocidad y finales de carrera.
       Nunca se escribe cargaElectrica, potenciaMecanica ni el pistón. */
    const estabaEnRampa = e.rampaCargaActiva;
    e.rampaCargaActiva = e.pReferencia < SINC.pObjetivo - 1e-9;
    const error = e.pReferencia - e.peF;
    const tasa = e.rampaCargaActiva ? SINC.pRampa : 0;
    const integralPrevia = e.integralCarga;
    e.integralCarga = Math.max(-SINC.integralCargaMax,
        Math.min(SINC.integralCargaMax, e.integralCarga + error * dt));
    const objetivoSinTope = () => e.aInicioCarga +
        (e.pReferencia - e.pInicioCarga + SINC.adelantoCarga * tasa +
         SINC.kpCarga * error + SINC.kiCarga * e.integralCarga) / SINC.sensibilidadCarga;
    const recorrido = RW.PARAM.ajuste.recorrido;
    let objetivo = objetivoSinTope();
    // Evitar acumular error contra los finales de carrera de M1.
    if((objetivo > recorrido && error > 0) || (objetivo < 0 && error < 0)){
        e.integralCarga = integralPrevia;
        objetivo = objetivoSinTope();
    }
    objetivo = Math.max(0, Math.min(recorrido, objetivo));
    if(e.pulsoM1 === 0){
        const pasoMax = RW.PARAM.ajuste.velocidadMotor * SINC.pulsoCargaMax;
        const mm = Math.max(-pasoMax, Math.min(pasoMax, objetivo - estadoGobernador.a));
        emitirPulsoM1(mm);
    }
    if(estabaEnRampa && !e.rampaCargaActiva){
        e.ventanaPe = []; e.tMuestraPe = 0;
        registrarSinc("Referencia en 5 %; continúa seguimiento de Pe y confirmación de estabilidad", "g");
    }

    /* ventana de confirmación (muestras cada 0.1 s) */
    e.tMuestraPe += dt;
    if(e.tMuestraPe >= 0.1){
        e.tMuestraPe = 0;
        e.ventanaPe.push(cargaElectrica);
        const n = Math.round(SINC.tConfCarga / 0.1);
        while(e.ventanaPe.length > n){ e.ventanaPe.shift(); }
    }

    const n = Math.round(SINC.tConfCarga / 0.1);
    if(!e.rampaCargaActiva && e.ventanaPe.length >= n && e.pulsoM1 === 0){
        let mn = Infinity, mx = -Infinity, s = 0;
        for(const v of e.ventanaPe){ mn = Math.min(mn, v); mx = Math.max(mx, v); s += v; }
        const media = s / e.ventanaPe.length;
        /* deriva: media de los 3 s finales − media de los 3 s iniciales */
        const k = 30, v0 = e.ventanaPe.slice(0, k), v1 = e.ventanaPe.slice(-k);
        const deriva = v1.reduce((a, b) => a + b, 0) / k - v0.reduce((a, b) => a + b, 0) / k;
        if(Math.abs(media - SINC.pObjetivo) <= SINC.pBanda && mx - mn <= SINC.pOscilacion &&
           Math.abs(deriva) <= SINC.pDeriva){
            detenerPulsos();
            e.fase = "enServicio";
            registrarSinc("Toma inicial terminada: Pe media " + (media * 100).toFixed(2) +
                " % (pico a pico " + ((mx - mn) * 100).toFixed(2) + " %, deriva " +
                (deriva * 100).toFixed(2) + " %) durante " +
                SINC.tConfCarga + " s · + / − vuelven al operador", "g");
            return;
        }
    }

    if(e.tCarga > SINC.tMaxCarga){
        bloquearSecuencia("Toma inicial no converge (" + SINC.tMaxCarga + " s): M1 liberado, unidad conectada");
    }

}


function reiniciarSincronizacion(){
    estadoRed.delta = 0;
    estadoRed.vg = 0;
    estadoRed.exc = RED.excInicial;
    estadoRed.campo = false;
    const e = estadoSinc;
    e.fase = "esperandoAuto"; e.orden = false; e.motivo = ""; e.aviso = "";
    e.pulsoM1 = 0; e.espera = 0; e.tEstable = 0; e.pulsoV = 0; e.tAvr = 0;
    e.okT = 0; e.tIgualando = 0; e.errT = 0; e.dfPrev = null; e.dfDot = 0; e.dfMedia = 0;
    e.tCierre = 0; e.cierre = null;
    e.pReferencia = 0; e.pInicioCarga = 0; e.aInicioCarga = 0; e.integralCarga = 0; e.rampaCargaActiva = false;
    e.peF = 0; e.pePrev = null; e.peDot = 0; e.tCarga = 0; e.ventanaPe = []; e.tMuestraPe = 0;
    e.tiempo = 0;
    e.registro = [];
    e.registroCambiado = true;
}


/* =====================================================
   INSTRUMENTO Y PANEL (ventana lateral «SINCRONOSCOPIO»)
   Dibujo adaptado del módulo de referencia. Solo LEE el
   estado anterior; abrirla o cerrarla no afecta al proceso.
===================================================== */

const UISINC = (function(){

    const cont = document.getElementById("contenidoPanelDerecho");
    if(!cont){ return null; }

    cont.innerHTML = `
<div class="sinc-rejilla">
  <div class="sinc-col">
    <section class="sinc-panel">
      <div class="sinc-cab">
        <h3>Sincronoscopio</h3>
        <div class="sinc-tipo" role="radiogroup" aria-label="Tipo de sincronoscopio">
          <label><input type="radio" name="sincTipo" value="analogico" checked> Analógico</label>
          <label><input type="radio" name="sincTipo" value="digital"> Digital</label>
        </div>
      </div>
      <svg id="sincScope" viewBox="0 0 400 400" aria-label="Sincronoscopio"></svg>
      <p id="sincSinSenal" class="sinc-sin-senal">SIN SEÑAL VÁLIDA</p>
      <div class="sinc-placa" role="group" aria-label="Datos de placa">
        <div class="sinc-placa-titulo">DATOS DE PLACA</div>
        <dl>
          <div><dt>Generador</dt><dd>20 polos</dd></div>
          <div><dt>Velocidad</dt><dd>360 rpm</dd></div>
          <div><dt>Frecuencia</dt><dd>60 Hz</dd></div>
          <div><dt>Tensión</dt><dd>13.8 kV</dd></div>
          <div><dt>Transformador</dt><dd>13.8/115 kV</dd></div>
          <div><dt>Bus</dt><dd>115 kV</dd></div>
        </dl>
      </div>
    </section>
    <section class="sinc-panel sinc-ondas">
      <h3>Ondas de tensión (115 kV)</h3>
      <canvas id="sincOndas"></canvas>
      <div class="sinc-leyenda"><span><i style="background:#1f6fc0"></i>Bus</span><span><i style="background:#e08a00"></i>Generador</span><span><i style="background:#d33"></i>Tensión a través del 52G</span></div>
    </section>
    <section class="sinc-panel sinc-lecturas" hidden>
      <h3>Lecturas (referidas a 115 kV)</h3>
      <div class="sinc-kv">
        <div><small>Δf (gen − bus)</small><b id="sincDf">—</b></div>
        <div><small>Δφ</small><b id="sincDphi">—</b></div>
        <div><small>ΔV</small><b id="sincDv">—</b></div>
        <div><small>Tiempo por vuelta</small><b id="sincT">—</b></div>
      </div>
      <p class="sinc-nota">Tensiones y ángulos comparados en el lado de 115 kV (relación nominal 13.8/115; desfase del transformador compensado en los TP del sincronizador, supuesto). Giro horario: generador más rápido que el bus.</p>
    </section>
  </div>
  <div class="sinc-col">
    <section class="sinc-panel">
      <h3>Unidad</h3>
      <svg id="sincUnifilar" viewBox="0 0 640 150" aria-label="Diagrama unifilar"></svg>
      <div class="sinc-kv">
        <div><small>Velocidad</small><b id="sincRpm">—</b></div>
        <div><small>Frecuencia gen / bus</small><b id="sincF">—</b></div>
        <div><small>Tensión gen / bus</small><b id="sincV">—</b></div>
        <div><small>Pe / Pm</small><b id="sincP">—</b></div>
      </div>
    </section>
    <section class="sinc-panel">
      <div class="sinc-cab-25a">
        <h3>Sincronizador 25A</h3>
        <div class="sinc-botones-25a">
          <button type="button" id="sincIniciar" class="boton-simulador">INICIAR SINCRONIZACIÓN</button>
          <button type="button" id="sincCancelar" class="boton-simulador">CANCELAR SINCRONIZACIÓN</button>
          <button type="button" id="sincInterruptor52G" class="boton-simulador danger" aria-pressed="false">52G ABIERTO</button>
        </div>
      </div>
      <div id="sincEstado" class="sinc-estado"><span id="sincEstadoTxt">—</span><span id="sincCuenta"></span></div>
      <ul class="sinc-pasos" id="sincPasos">
        <li data-f="esperandoAuto"><i></i>Esperando AUTO</li>
        <li data-f="aproximacion"><i></i>Aproximación a nominal</li>
        <li data-f="lista"><i></i>Lista para iniciar</li>
        <li data-f="excitando"><i></i>Excitando</li>
        <li data-f="igualando"><i></i>Igualando f y V (M1 / AVR)</li>
        <li data-f="esperandoSincronismo"><i></i>Esperando sincronismo</li>
        <li data-f="cerrando"><i></i>Cerrando 52G</li>
        <li data-f="tomandoCarga"><i></i>Tomando carga (5 %)</li>
        <li data-f="enServicio"><i></i>En servicio · AUTO</li>
      </ul>
      <div class="sinc-perm" id="sincPerm" hidden>
        <div id="sincPV"><span>Tensiones válidas (±10 %)</span><span></span></div>
        <div id="sincPDV"><span>|ΔV| ≤ 3 %</span><span></span></div>
        <div id="sincPDF"><span>0.005 &lt; Δf ≤ 0.15 Hz</span><span></span></div>
        <div id="sincPST"><span>Deslizamiento estable</span><span></span></div>
        <div id="sincPANG"><span>Ángulo de adelanto (80 ms)</span><span></span></div>
      </div>
      <div class="sinc-lamparas">
        <div id="sincLSU">▲ VEL (M1)</div><div id="sincLSD">▼ VEL (M1)</div>
        <div id="sincLVU">▲ TENSIÓN</div><div id="sincLVD">▼ TENSIÓN</div>
      </div>
      <!-- Etapa 29: «Rearmar 25A» oculto; INICIAR hace el rearme interno -->
      <button type="button" id="sincRearmar" class="boton-simulador" hidden disabled>Rearmar 25A</button>
    </section>
    <section class="sinc-panel">
      <h3>Eventos</h3>
      <div id="sincRegistro" class="sinc-registro"></div>
    </section>
  </div>
</div>`;

    const $ = id => document.getElementById(id);
    const NS = "http://www.w3.org/2000/svg";
    const DEG = Math.PI / 180;
    const NLED = 36;
    const scope = $("sincScope");
    const leds = [];
    let capa = scope, capaDigital, capaAnalogica, aguja, ledSync, ledBus, ledGen;

    function mk(tag, attrs, parent){
        const el = document.createElementNS(NS, tag);
        for(const k in attrs){ el.setAttribute(k, attrs[k]); }
        (parent || capa).appendChild(el);
        return el;
    }

    /* ----- sincronoscopio (adaptado de buildScope) ----- */
    (function construir(){
        const defs = mk("defs", {});
        const f = mk("filter", { id: "sincGlow", x: "-100%", y: "-100%", width: "300%", height: "300%" }, defs);
        mk("feGaussianBlur", { stdDeviation: "3.2", result: "b" }, f);
        const m = mk("feMerge", {}, f);
        mk("feMergeNode", { in: "b" }, m); mk("feMergeNode", { in: "SourceGraphic" }, m);
        const gr = mk("radialGradient", { id: "sincFace", cx: "50%", cy: "40%", r: "70%" }, defs);
        mk("stop", { offset: "0%", "stop-color": "#f4f5f2" }, gr);
        mk("stop", { offset: "100%", "stop-color": "#dfe2de" }, gr);
        const gc = mk("radialGradient", { id: "sincCaratula", cx: "50%", cy: "42%", r: "62%" }, defs);
        mk("stop", { offset: "0%", "stop-color": "#fbfbf8" }, gc);
        mk("stop", { offset: "100%", "stop-color": "#e3e4df" }, gc);
        const gb = mk("radialGradient", { id: "sincPerilla", cx: "40%", cy: "35%", r: "70%" }, defs);
        mk("stop", { offset: "0%", "stop-color": "#ffffff" }, gb);
        mk("stop", { offset: "100%", "stop-color": "#c9cbc6" }, gb);

        /* Digital */
        capaDigital = capa = mk("g", { id: "sincDigital" }, scope);
        mk("rect", { x: 4, y: 4, width: 392, height: 392, rx: 14, fill: "#1a1a1a" });
        mk("rect", { x: 18, y: 18, width: 364, height: 364, rx: 8, fill: "#cfd2cd" });
        mk("rect", { x: 26, y: 26, width: 348, height: 348, rx: 6, fill: "url(#sincFace)" });
        const txt = (x, y, s, size) => {
            const t = mk("text", { x, y, "text-anchor": "middle", "font-size": size, "font-weight": 700,
                fill: "#151515", "font-family": "Arial,sans-serif", "letter-spacing": 0.5 });
            t.textContent = s; return t;
        };
        txt(200, 58, "SINCRONOSCOPIO", 21);
        txt(64, 92, "GEN", 15); txt(64, 110, "LENTO", 15);
        txt(336, 92, "GEN", 15); txt(336, 110, "RÁPIDO", 15);
        mk("path", { d: "M 128 88 A 120 120 0 0 1 272 88", fill: "none", stroke: "#151515", "stroke-width": 2.4 });
        mk("path", { d: "M 128 88 l 11 -1 M 128 88 l 4 10", stroke: "#151515", "stroke-width": 2.4, fill: "none" });
        mk("path", { d: "M 272 88 l -11 -1 M 272 88 l -4 10", stroke: "#151515", "stroke-width": 2.4, fill: "none" });
        txt(200, 160, "SYNC", 16);
        txt(64, 346, "BUS", 16); txt(336, 346, "GEN", 16);
        const cx = 200, cy = 222, r = 112;
        for(let i = 0; i < NLED; i++){
            const a = i * 360 / NLED * DEG;
            const x = cx + r * Math.sin(a), y = cy - r * Math.cos(a);
            const verde = i === 0;
            mk("circle", { cx: x, cy: y, r: 7.4, fill: "#9a9a9a" });
            const c = mk("circle", { cx: x, cy: y, r: 6.2, fill: verde ? "#1c4a26" : "#5a1d1a" });
            c.dataset.g = verde ? 1 : 0;
            leds.push(c);
        }
        mk("circle", { cx: 200, cy: 134, r: 7.4, fill: "#9a9a9a" });
        ledSync = mk("circle", { cx: 200, cy: 134, r: 6.2, fill: "#1c4a26" });
        mk("circle", { cx: 64, cy: 364, r: 7.4, fill: "#9a9a9a" });
        ledBus = mk("circle", { cx: 64, cy: 364, r: 6.2, fill: "#1c4a26" });
        mk("circle", { cx: 336, cy: 364, r: 7.4, fill: "#9a9a9a" });
        ledGen = mk("circle", { cx: 336, cy: 364, r: 6.2, fill: "#1c4a26" });

        /* Analógico */
        capaAnalogica = capa = mk("g", { id: "sincAnalogico" }, scope);
        const C = 200;
        mk("rect", { x: 4, y: 4, width: 392, height: 392, rx: 22, fill: "#141414" });
        mk("rect", { x: 10, y: 10, width: 380, height: 380, rx: 18, fill: "none", stroke: "#2b2b2b", "stroke-width": 3 });
        for(const [x, y] of [[30, 30], [370, 30], [30, 370], [370, 370]]){
            mk("circle", { cx: x, cy: y, r: 8, fill: "#0b0b0b", stroke: "#3a3a3a", "stroke-width": 1.5 });
            mk("line", { x1: x - 5, y1: y, x2: x + 5, y2: y, stroke: "#3a3a3a", "stroke-width": 1.5 });
        }
        mk("circle", { cx: C, cy: C, r: 172, fill: "#cfd1cc" });
        mk("circle", { cx: C, cy: C, r: 164, fill: "url(#sincCaratula)", stroke: "#9a9c97", "stroke-width": 1.5 });
        const t2 = (x, y, s, size) => {
            const t = mk("text", { x, y, "text-anchor": "middle", "font-size": size, "font-weight": 800,
                fill: "#111", "font-family": "Arial, Helvetica, sans-serif", "letter-spacing": 1 });
            t.textContent = s; return t;
        };
        mk("path", { d: `M ${C - 9} 42 L ${C + 9} 42 L ${C} 56 Z`, fill: "#111" });
        for(let a = 0; a < 360; a += 10){
            if(a === 0){ continue; }
            const r1 = a % 90 === 0 ? 146 : 152, rad = a * DEG;
            mk("line", { x1: C + r1 * Math.sin(rad), y1: C - r1 * Math.cos(rad), x2: C + 158 * Math.sin(rad), y2: C - 158 * Math.cos(rad),
                stroke: "#555", "stroke-width": a % 90 === 0 ? 2 : 1 });
        }
        const arco = (a1, a2, rr) => {
            const p1 = [C + rr * Math.sin(a1 * DEG), C - rr * Math.cos(a1 * DEG)], p2 = [C + rr * Math.sin(a2 * DEG), C - rr * Math.cos(a2 * DEG)];
            return `M ${p1[0]} ${p1[1]} A ${rr} ${rr} 0 0 ${a2 > a1 ? 1 : 0} ${p2[0]} ${p2[1]}`;
        };
        const punta = (a, sentido, rr) => {
            const x = C + rr * Math.sin(a * DEG), y = C - rr * Math.cos(a * DEG);
            const tx = Math.cos(a * DEG) * sentido, ty = Math.sin(a * DEG) * sentido;
            const nx = Math.sin(a * DEG), ny = -Math.cos(a * DEG);
            return `M ${x} ${y} L ${x - 10 * tx + 5 * nx} ${y - 10 * ty + 5 * ny} L ${x - 10 * tx - 5 * nx} ${y - 10 * ty - 5 * ny} Z`;
        };
        for(const [a1, a2, s] of [[-14, -50, -1], [14, 50, 1]]){
            mk("path", { d: arco(a1, a2, 122), fill: "none", stroke: "#111", "stroke-width": 2.4 });
            mk("path", { d: punta(a2, s, 122), fill: "#111" });
        }
        t2(118, 186, "LENTO", 26); t2(282, 186, "RÁPIDO", 26);
        t2(C, 292, "SINCRONOSCOPIO", 17);
        aguja = mk("g", { transform: `rotate(225 ${C} ${C})` });
        mk("path", { d: `M ${C} 52 L ${C + 6.5} ${C} L ${C} ${C + 30} L ${C - 6.5} ${C} Z`, fill: "#111" }, aguja);
        mk("circle", { cx: C, cy: C, r: 18, fill: "url(#sincPerilla)", stroke: "#9a9c97", "stroke-width": 1.5 });
        mk("circle", { cx: C, cy: C, r: 4, fill: "#8d908b" });
        capa = scope;
    })();

    function mostrarTipo(tipo){
        capaDigital.style.display = tipo === "analogico" ? "none" : "";
        capaAnalogica.style.display = tipo === "analogico" ? "" : "none";
    }
    document.querySelectorAll('input[name="sincTipo"]').forEach(r =>
        r.addEventListener("change", () => { if(r.checked){ mostrarTipo(r.value); } }));
    mostrarTipo("analogico");

    function led(c, on, verde){
        if(on){ c.setAttribute("fill", verde ? "#4dff7c" : "#ff3a2e"); c.setAttribute("filter", "url(#sincGlow)"); }
        else{ c.setAttribute("fill", verde ? "#1c4a26" : "#5a1d1a"); c.removeAttribute("filter"); }
    }

    /* ----- unifilar (adaptado de buildSld) ----- */
    const sld = $("sincUnifilar");
    let brk, brkEstado;
    (function(){
        const m = (tag, a) => { const el = document.createElementNS(NS, tag); for(const k in a){ el.setAttribute(k, a[k]); } sld.appendChild(el); return el; };
        const T = (x, y, s, sz, col) => { const t = m("text", { x, y, "font-size": sz || 12, fill: col || "#555", "text-anchor": "middle", "font-family": "Arial,sans-serif" }); t.textContent = s; return t; };
        const L = "#263640", W = 2.5, Y = 70;
        const ln = (x1, y1, x2, y2) => m("line", { x1, y1, x2, y2, stroke: L, "stroke-width": W, "stroke-linecap": "round" });
        const gx = 80, r = 34;
        m("circle", { cx: gx, cy: Y, r, fill: "none", stroke: L, "stroke-width": W });
        for(const ang of [0, 120, 240]){ const t = ang * DEG; ln(gx, Y, gx + r * Math.cos(t), Y + r * Math.sin(t)); }
        T(gx, 128, "Generador · 13.8 kV");
        ln(gx + r, Y, 214, Y);
        const c1 = 214, c2 = 240, h = 15;
        let d1 = `M ${c1} ${Y - 2 * h}`, d2 = `M ${c2} ${Y - 2 * h}`;
        for(let i = 0; i < 4; i++){ d1 += ` q 12 ${h / 2} 0 ${h}`; d2 += ` q -12 ${h / 2} 0 ${h}`; }
        m("path", { d: d1, fill: "none", stroke: L, "stroke-width": W, "stroke-linecap": "round" });
        m("path", { d: d2, fill: "none", stroke: L, "stroke-width": W, "stroke-linecap": "round" });
        T((c1 + c2) / 2, 22, "TR 13.8/115 kV", 12, L);
        T((c1 + c2) / 2, 128, "Transformador de potencia");
        ln(c2, Y, 382, Y);
        brk = m("rect", { x: 382, y: Y - 20, width: 34, height: 40, fill: "#e3f3e5", stroke: "#2e8b3d", "stroke-width": W });
        T(399, 40, "52G", 13, L);
        brkEstado = T(399, 112, "Abierto", 12, "#2e8b3d");
        ln(416, Y, 560, Y);
        m("circle", { cx: 563, cy: Y, r: 4.5, fill: L });
        m("line", { x1: 563, y1: 16, x2: 563, y2: 124, stroke: L, "stroke-width": 6, "stroke-linecap": "round" });
        T(600, 62, "BUS", 13, L); T(600, 80, "115 kV", 11); T(600, 95, "60 Hz", 11);
    })();

    // Mismo mando del 52G que en la escena; no evita los permisos del 25A.
    $("sincInterruptor52G").addEventListener("click", () => {
        cambiarInterruptor(!interruptorCerrado);
        actualizarVisual();
    });

    $("sincIniciar").addEventListener("click", () => { iniciarSincronizacion(); });
    $("sincCancelar").addEventListener("click", () => { cancelarSincronizacion(); });

    const cv = $("sincOndas"), ctx = cv.getContext("2d");

    function ondas(){
        const dpr = window.devicePixelRatio || 1;
        const w = cv.clientWidth, h = cv.clientHeight;
        if(w < 2 || h < 2){ return; }
        if(cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)){ cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
        const mid = h / 2, amp = h * 0.36;
        ctx.strokeStyle = "#e0e6eb"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();
        for(let k = 1; k < 4; k++){ ctx.beginPath(); ctx.moveTo(w * k / 4, 0); ctx.lineTo(w * k / 4, h); ctx.stroke(); }
        const N = 240;
        const curva = (fn, col, lw, dash) => {
            ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash(dash || []);
            ctx.beginPath();
            for(let i = 0; i <= N; i++){
                const th = i / N * 4 * Math.PI, y = mid - fn(th) * amp;
                if(i){ ctx.lineTo(i / N * w, y); }else{ ctx.moveTo(0, y); }
            }
            ctx.stroke(); ctx.setLineDash([]);
        };
        const ph = desfaseGrados() * DEG, vg = estadoRed.vg, vb = RED.vBus;
        curva(th => vb * Math.sin(th), "#1f6fc0", 2.2);
        if(vg > 0.01){
            curva(th => vg * Math.sin(th + ph), "#e08a00", 2.2);
            if(!interruptorCerrado){ curva(th => vg * Math.sin(th + ph) - vb * Math.sin(th), "#d33", 1.6, [5, 4]); }
        }
        ctx.fillStyle = "#596872"; ctx.font = "11px Arial";
        ctx.fillText("2 ciclos del bus (33 ms)", 8, h - 8);
    }

    const fmtS = (x, n) => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(n);
    const ordenPasos = ["esperandoAuto", "aproximacion", "lista", "excitando", "igualando", "esperandoSincronismo", "cerrando", "tomandoCarga", "enServicio"];

    function mostrar(){
        const valida = senalValida();
        const d = desfaseGrados(), df = deslizamientoHz(), dv = estadoRed.vg - RED.vBus;
        const cerrado = interruptorCerrado;

        let idx = -1;
        if(valida){ idx = ((Math.round(d / (360 / NLED)) % NLED) + NLED) % NLED; }
        leds.forEach((c, i) => led(c, i === idx, c.dataset.g === "1"));
        const enSinc = cerrado || (valida && Math.abs(d) <= SINC.ventanaAngulo && Math.abs(df) <= SINC.dfMax && Math.abs(dv) <= SINC.dvMax);
        led(ledSync, enSinc && valida, true);
        led(ledBus, Math.abs(RED.vBus - 1) <= SINC.vTol, true);
        led(ledGen, Math.abs(estadoRed.vg - 1) <= SINC.vTol, true);
        aguja.setAttribute("transform", `rotate(${valida ? d : 225} 200 200)`);
        $("sincSinSenal").classList.toggle("activo", !valida);

        $("sincDf").textContent = valida ? fmtS(df, 3) + " Hz" : "—";
        $("sincDphi").textContent = valida ? fmtS(d, 1) + "°" : "—";
        $("sincDv").textContent = estadoRed.vg > 0.1 ? fmtS(dv * 100, 1) + " %" : "—";
        $("sincT").textContent = valida && !cerrado && Math.abs(df) > 0.002 ? (1 / Math.abs(df)).toFixed(1) + " s" : "—";
        $("sincRpm").textContent = velocidadEjeRpm().toFixed(1) + " rpm";
        $("sincF").textContent = frecuencia.toFixed(3) + " / " + RED.fBus.toFixed(3) + " Hz";
        $("sincV").textContent = (estadoRed.vg * RED.kVBus).toFixed(1) + " / " + (RED.vBus * RED.kVBus).toFixed(1) + " kV";
        $("sincP").textContent = (cerrado ? (cargaElectrica * 100).toFixed(1) : "0.0") + " / " +
            (cerrado ? (potenciaMecanica * 100).toFixed(1) : "0.0") + " %";

        const enCierre = estadoSinc.fase === "cerrando";
        if(cerrado){ brk.setAttribute("fill", "#f6dada"); brk.setAttribute("stroke", "#c0392b"); brkEstado.textContent = "Cerrado"; brkEstado.setAttribute("fill", "#c0392b"); }
        else if(enCierre){ brk.setAttribute("fill", "#fbefd5"); brk.setAttribute("stroke", "#d08a00"); brkEstado.textContent = "Cerrando…"; brkEstado.setAttribute("fill", "#d08a00"); }
        else{ brk.setAttribute("fill", "#e3f3e5"); brk.setAttribute("stroke", "#2e8b3d"); brkEstado.textContent = "Abierto"; brkEstado.setAttribute("fill", "#2e8b3d"); }

        const f = estadoSinc.fase;
        const est = $("sincEstado");
        $("sincEstadoTxt").textContent =
            f === "bloqueada" ? estadoSinc.motivo :
            f === "lista" && estadoSinc.aviso ? estadoSinc.aviso : FASES_SINC[f];
        est.className = "sinc-estado" + (f === "bloqueada" ? " alarma" : f === "enServicio" ? " bien" : "");
        let cd = "";
        if(f === "esperandoSincronismo"){ const tz = tiempoHastaCero(); if(isFinite(tz)){ cd = "orden en " + Math.max(0, tz - SINC.tcb).toFixed(1) + " s"; } }
        if(f === "tomandoCarga"){ cd = "Ref " + (estadoSinc.pReferencia * 100).toFixed(2) + " % · Pe " + (estadoSinc.peF * 100).toFixed(2) + " %"; }
        $("sincCuenta").textContent = cd;

        const ia = ordenPasos.indexOf(f);
        document.querySelectorAll("#sincPasos li").forEach(li => {
            const i = ordenPasos.indexOf(li.dataset.f);
            li.className = ia < 0 ? "" : i < ia ? "hecho" : i === ia ? "activo" : "";
        });

        const p = permisivosSinc();
        const vis = !cerrado && (f === "igualando" || f === "esperandoSincronismo" || f === "cerrando");
        const ps = (id, ok, val) => { const el = $(id); el.className = vis ? (ok ? "ok" : "no") : ""; el.lastElementChild.textContent = val; };
        ps("sincPV", p.v, (estadoRed.vg * 100).toFixed(0) + " % / " + (RED.vBus * 100).toFixed(0) + " %");
        ps("sincPDV", p.dv, fmtS(dv * 100, 1) + " %");
        ps("sincPDF", p.df, fmtS(df, 3) + " Hz");
        ps("sincPST", p.st, fmtS(estadoSinc.dfDot, 3) + " Hz/s");
        ps("sincPANG", f === "cerrando" || cerrado, "adelanto " + (360 * Math.max(df, 0) * SINC.tcb).toFixed(1) + "°");
        $("sincLSU").classList.toggle("on", estadoSinc.pulsoM1 > 0);
        $("sincLSD").classList.toggle("on", estadoSinc.pulsoM1 < 0);
        $("sincLVU").classList.toggle("on", estadoSinc.pulsoV > 0);
        $("sincLVD").classList.toggle("on", estadoSinc.pulsoV < 0);

        const activo = simulando && !pausado;
        const bIni = $("sincIniciar");
        const motivosIni = condicionesInicio();
        bIni.disabled = motivosIni.length > 0;
        bIni.title = motivosIni.length ? "No disponible: " + motivosIni.join(", ") : "Inicia excitación, igualación, cierre y toma del 5 %";
        $("sincCancelar").disabled = !cancelacionPermitida();

        if(estadoSinc.registroCambiado){
            estadoSinc.registroCambiado = false;
            const r = $("sincRegistro");
            r.innerHTML = "";
            for(const ev of estadoSinc.registro.slice(-60)){
                const dv2 = document.createElement("div");
                if(ev.clase){ dv2.className = ev.clase; }
                dv2.textContent = "t=" + ev.t.toFixed(2).padStart(8) + " s  " + ev.texto;
                r.appendChild(dv2);
            }
            r.scrollTop = r.scrollHeight;
        }

        ondas();
    }

    return { mostrar };

})();

function mostrarSincronizacion(){
    if(UISINC){ UISINC.mostrar(); }
}
