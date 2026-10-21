/* =====================================================
   SIMULADOR RVTH
   REGULADOR CENTRÍFUGO CON RESORTE — INTEGRACIÓN
   (etapa 12, 18-oct-2026)

   Archivo: watt_resorte_integracion.js
   Se carga DESPUÉS de watt_integracion.js y ANTES de
   simulador.js.

   CADENA FÍSICA
     frecuencia (modelo.js) → n = velocidadEjeRpm()
     → Ω husillo = i·n (js/watt_resorte/fisica.js)
     → ecuación de Lagrange del manguito (RK4, subpasos)
     → s → RW.Regulador.fijarPosicion(s) → punto A
     → varillaje A–F → piloto → servo piloto →
       distribuidora → servomotor → Fink → turbina.

   - El regulador avanza DENTRO del paso fijo del
     simulador (PASO_INTEGRACION = 5 ms, simulador.js),
     con SUBPASOS_GOBERNADOR subpasos de 1 ms. No hay
     otro reloj.
   - La velocidad de entrada es la del eje calculada por
     el RVTH. La consigna y la rampa del banco
     independiente no se usan: en cada subpaso se fija
     n = nConsigna = velocidadEjeRpm(), de modo que la
     rampa del módulo no actúa.
   - s NO se limita a la ventana útil 39.55–63.02 mm:
     solo actúan los topes físicos 0–98 mm del regulador.
   - HIPÓTESIS: carga del mando sobre el collar
     F_L = RW.PARAM.mando.cargaVarillaje = 0 N. No se
     demuestra capacidad para accionar el mando real.
   - Parámetros del módulo corregido sin cambios
     (js/watt_resorte/parametros_resorte.js).
===================================================== */

const FISICA_GOB = RW.Fisica;

const SUBPASOS_GOBERNADOR = 5;              // 5 × 1 ms por paso de 5 ms

const AJUSTE_INICIAL_REPOSO = 0;            // mm (etapa 13: reposo con a = 0)

const estadoGobernador =
FISICA_GOB.crearEstado();                  // s = 0, a = ajuste inicial, motor parado


/* Diagnóstico acumulado (para lectura y pruebas) */

const diagnosticoGobernador = {
    tiempo: 0,
    tiempoPilotoSaturada: 0,
    maxPilotoSolicitadaMm: 0,
    minPilotoSolicitadaMm: 0,
    tiempoTopeInferior: 0,
    tiempoTopeSuperior: 0
};


/* =====================================================
   MODO MANUAL / AUTO (etapa 18, 18-oct-2026)

   MANUAL  + y − mueven el LIMITADOR DE APERTURA (mando LÍMITE,
           posición de L1) a MANDO_GOB.velocidadLimite %/s. Con el
           eje parado el regulador pide abrir (s = 0) y el limitador
           es quien fija la apertura: el alumno abre, p. ej., un 4 %.
           El ajuste del resorte no se mueve.
   AUTO    Solo lo selecciona el alumno, y solo desde
           MANDO_GOB.rpmHabilitacionAuto (100 rpm). Secuencia:
             1) «arranque»: el motor del tornillo lleva el ajuste a
                AJUSTE_AUTO_360 (equilibrio estático en vacío a
                360 rpm, calculado abajo) y, a la vez, L1 se abre
                con una rampa lenta y visible
                (MANDO_GOB.rampaArranque %/s).
             2) «liberando»: cuando el regulador toma el control
                (el empujador deja de limitar durante
                MANDO_GOB.tiempoTomaControl s y el ajuste ya llegó),
                L1 se abre hasta 100 % a velocidadLimite %/s.
             3) «regulando»: limitador liberado; + y − mueven el
                ajuste del resorte (velocidad / carga).
           Volver a MANUAL detiene la secuencia y deja el
           limitador en la apertura actual del servomotor
           (transferencia sin salto); desde ahí el alumno lo mueve.
   Etapa 27: el interruptor lo cierra el sincronizador 25A
   (js/sincronizacion.js), que en «regulando» toma M1 hasta
   terminar la toma inicial del 5 %.
   Nada de esto cambia la física: solo mueve L1 y el motor del
   tornillo, que ya existían.
===================================================== */

const MANDO_GOB = {
    velocidadLimite: 2.0,          // %/s del mando LÍMITE (+ / − en MANUAL)
    rpmHabilitacionAuto: 100,      // rpm mínimas para seleccionar AUTO
    rampaArranque: 0.10,           // %/s: rampa lenta de L1 en AUTO
    tiempoTomaControl: 3           // s sin limitar para dar por tomado el control
};

/* Ajuste del resorte para 360 rpm en vacío (equilibrio estático):
   apertura de vacío (caudal = caudal de vacío a 60 Hz) → s con el
   pistón en equilibrio en esa apertura (varillaje) → a con
   n_eq(s, a) = 360 rpm (física del regulador). Bisecciones. */

const AJUSTE_AUTO_360 = (function(){
    let lo = 0, hi = 100;
    for(let k = 0; k < 60; k++){
        const m = (lo + hi) / 2;
        if(caudalRelativoObjetivo(m) < F1B_CAUDAL_VACIO){ lo = m; }else{ hi = m; }
    }
    const sVacio = buscarSParaPiston((lo + hi) / 2) / 1000;
    let a0 = 0, a1 = RW.PARAM.ajuste.recorrido;
    for(let k = 0; k < 60; k++){
        const m = (a0 + a1) / 2;
        if(FISICA_GOB.nEquilibrio(sVacio, m) < RPM_NOMINAL){ a0 = m; }else{ a1 = m; }
    }
    return (a0 + a1) / 2;
})();

const estadoMando = {
    modo: "manual",                // "manual" | "auto"
    fase: "",                      // AUTO: "arranque" | "liberando" | "regulando"
                                   //   | "pasandoManual" | "reabriendo" (etapa 25)
    motorLimite: 0,                // −1, 0, +1 (MANUAL)
    motorAjuste: 0,                // −1, 0, +1 (AUTO, regulando)
    tiempoSinLimitar: 0,
    faseRetorno: ""                // fase AUTO a la que vuelve si se cancela la transferencia
};

/* Etapa 25/26 (19-oct-2026): TRANSFERENCIA AUTO → MANUAL.
   Etapa 25 quitó el salto de L1 (antes el límite pasaba de golpe
   a la posición del pistón). Etapa 26 evita además que el
   limitador tome el mando antes de terminar la transferencia.

   DEMANDA EFECTIVA DEL REGULADOR EN C (pDemanda, % de carrera)
     Es el valor del límite con el que el empujador H tocaría
     exactamente C_ent en el estado ACTUAL del varillaje:
         H(B, alturaL1(pDemanda)).y = C_ent.y
     B y C_ent se toman de estadoVarillaje (el mismo resultado de
     resolverVarillaje con el que se hizo la selección de mínimo
     en el último paso), por lo que incluyen la realimentación por
     leva (pistón actual), el amortiguador de compensación (yd) y
     la posición real del manguito. H.y decrece al subir el límite
     (verificado), así que:
         limitador manda  ⇔  límite < pDemanda.
     No se usa pistonEquilibrio(s): ignora B real y yd y difiere
     de pDemanda en varios % durante los transitorios.

   SECUENCIA (fase «pasandoManual», modo aún AUTO, M1 parado)
     - Objetivo de M2: max(pistón, pDemanda) + reserva.
         reserva = TRANSFERENCIA.banda (2 %, lo que M2 recorre en
         1 s) mientras el regulador no esté en equilibrio;
         reserva = TRANSFERENCIA.margenFinal (0.10 %) cuando la
         demanda y el pistón coinciden (|pDemanda − pistón| ≤
         tolerancia) de forma continuada durante tConfirmacion
         (30 s, un periodo de la oscilación lenta del lazo).
     - M2 SUBE hacia el objetivo siempre que haga falta (devuelve
       el mando al Watt); solo BAJA cuando el regulador está en
       calma (|pDemanda − pistón| ≤ banda). Siempre a
       velocidadLimite y dentro de 0…100 % (finales de carrera).
     - Se completa (MANUAL activo, + y − mueven M2) cuando, tras
       tConfirmacion de coincidencia, el límite ha llegado al
       objetivo final y la selección efectiva en C sigue siendo
       C_ent (no limitando). El límite no se reposiciona: queda
       a ≤ margenFinal + tolerancia por encima del pistón.
     - Si no se dan las condiciones, la transferencia sigue
       abierta; AUTO la cancela.
   Unidades: limiteAperturaPct, posicionPiston y pDemanda son % de
   CARRERA del servomotor (no la apertura geométrica del Fink).
   Cancelación (AUTO durante la transferencia): se vuelve a la
   fase de origen sin saltos; si era «regulando», la fase
   «reabriendo» sube el límite a velocidadLimite hasta 100 % sin
   tocar el ajuste del resorte. */

const TRANSFERENCIA = {
    banda: 2.0,            // % carrera: reserva de aproximación y banda de calma (M2 en 1 s)
    margenFinal: 0.10,     // % carrera: reserva final = tolerancia (cubre la oscilación residual admitida)
    tolerancia: 0.10,      // % carrera: coincidencia demanda–pistón exigida
    tConfirmacion: 30      // s: un periodo de la oscilación lenta del lazo (≈ 30 s medido en
                           //    navegador); con 3 s el limitador llegó a tomar el mando 2.2 s
                           //    después de completar (rechazo de carga)
};

/* Límite con el que el empujador tocaría C_ent en el estado r */
function demandaReguladorEnC(r){
    if(!r || !r.B || !r.Cent){ return null; }
    const yC = r.Cent.y;
    const Hy = function(x){ return puntoEmpujadorLimitador(r.B, x).H.y; };
    if(Hy(0) <= yC){ return 0; }          // ni con 0 % tocaría: pide cerrar del todo
    if(Hy(100) > yC){ return 100; }       // pide más de 100 %
    let lo = 0, hi = 100;
    for(let k = 0; k < 40; k++){
        const m = (lo + hi) / 2;
        if(Hy(m) > yC){ lo = m; }else{ hi = m; }
    }
    return hi;
}

const diagTransferencia = { pDemanda: null, tCoincidencia: 0, reserva: 0, objetivo: null, motivo: "" };

function enTransferenciaManual(){
    return estadoMando.modo === "auto" && estadoMando.fase === "pasandoManual";
}

function avanzarMandoGobernador(dt){

    const e = estadoMando;

    if(e.modo === "manual"){
        estadoGobernador.motor = 0;
        limiteAperturaPct = Math.max(0, Math.min(100,
            limiteAperturaPct + e.motorLimite * MANDO_GOB.velocidadLimite * dt));
        return;
    }

    /* AUTO */

    /* Etapa 25: transferencia AUTO → MANUAL */

    if(e.fase === "pasandoManual"){
        estadoGobernador.motor = 0;                       // M1 detenido; el Watt sigue mandando
        const T = TRANSFERENCIA, dg = diagTransferencia;
        const r = estadoVarillaje;
        const pD = demandaReguladorEnC(r);
        dg.pDemanda = pD;
        if(pD === null){ dg.motivo = "sin varillaje"; return; }
        const p = Math.max(0, Math.min(100, posicionPiston));
        const brecha = Math.abs(pD - p);
        dg.tCoincidencia = brecha <= T.tolerancia ? dg.tCoincidencia + dt : 0;
        const final = dg.tCoincidencia >= T.tConfirmacion;
        dg.reserva = final ? T.margenFinal : T.banda;
        const objetivo = Math.max(0, Math.min(100, Math.max(p, pD) + dg.reserva));
        dg.objetivo = objetivo;
        const paso = MANDO_GOB.velocidadLimite * dt;      // M2 a su velocidad normal
        const d = objetivo - limiteAperturaPct;
        if(d > 0){
            limiteAperturaPct = Math.min(100, limiteAperturaPct + Math.min(d, paso));
            dg.motivo = "subiendo";
        }else if(d < 0 && brecha <= T.banda){
            limiteAperturaPct = Math.max(0, limiteAperturaPct + Math.max(d, -paso));
            dg.motivo = "bajando";
        }else{
            dg.motivo = d < 0 ? "esperando calma del regulador" : "en objetivo";
        }
        /* Entrega: coincidencia confirmada, límite en el objetivo
           final y selección efectiva en C = C_ent */
        const limitando = !!(r && r.limitando);
        if(final && !limitando && limiteAperturaPct >= pD &&
           Math.abs(limiteAperturaPct - objetivo) <= paso){
            e.modo = "manual";
            e.fase = "";
            e.faseRetorno = "";
            e.motorLimite = 0;
            e.motorAjuste = 0;
            dg.motivo = "completada";
        }
        return;
    }

    if(e.fase === "reabriendo"){
        estadoGobernador.motor = 0;
        limiteAperturaPct = Math.min(100, limiteAperturaPct + MANDO_GOB.velocidadLimite * dt);
        if(limiteAperturaPct >= 100){ e.fase = "regulando"; }
        return;
    }

    if(e.fase === "arranque" || e.fase === "liberando"){

        /* ajuste hacia AJUSTE_AUTO_360 con el motor del tornillo */
        const da = AJUSTE_AUTO_360 - estadoGobernador.a;
        const paso = RW.PARAM.ajuste.velocidadMotor * dt;
        if(Math.abs(da) <= paso){
            estadoGobernador.a = AJUSTE_AUTO_360;
            estadoGobernador.motor = 0;
        }else{
            estadoGobernador.motor = da > 0 ? 1 : -1;
        }
        const ajusteListo = estadoGobernador.motor === 0;

        if(e.fase === "arranque"){
            limiteAperturaPct = Math.min(100, limiteAperturaPct + MANDO_GOB.rampaArranque * dt);
            const limitando = !!(estadoVarillaje && estadoVarillaje.limitando);
            e.tiempoSinLimitar = limitando ? 0 : e.tiempoSinLimitar + dt;
            if(ajusteListo && e.tiempoSinLimitar >= MANDO_GOB.tiempoTomaControl){
                e.fase = "liberando";
            }
        }else{
            limiteAperturaPct = Math.min(100, limiteAperturaPct + MANDO_GOB.velocidadLimite * dt);
            if(limiteAperturaPct >= 100 && ajusteListo){ e.fase = "regulando"; }
        }
        return;
    }

    /* regulando: + / − mueven el ajuste. Etapa 27: mientras la
       secuencia de sincronización / toma inicial tiene M1, sus
       pulsos son la ÚNICA orden de M1 (js/sincronizacion.js) */
    const mSinc = mandoM1Sincronizador();
    estadoGobernador.motor = mSinc === null ? e.motorAjuste : mSinc;

}

function seleccionarModoGobernador(modo){

    if(!simulando || pausado){ return false; }

    const e = estadoMando;

    if(modo === "auto"){
        if(enTransferenciaManual()){                      // cancelación (etapa 25)
            e.fase = e.faseRetorno === "regulando" || e.faseRetorno === "reabriendo"
                ? "reabriendo" : (e.faseRetorno || "reabriendo");
            e.faseRetorno = "";
            return true;
        }
        if(e.modo === "auto"){ return true; }
        if(velocidadEjeRpm() < MANDO_GOB.rpmHabilitacionAuto){ return false; }
        e.modo = "auto";
        e.fase = "arranque";
        e.tiempoSinLimitar = 0;
        e.motorLimite = 0;
        e.motorAjuste = 0;
        return true;
    }

    if(modo === "manual" && e.modo === "auto" && !enTransferenciaManual()){
        /* Etapa 25: ya no se fija el límite de golpe; empieza la
           transferencia (ver avanzarMandoGobernador) */
        e.faseRetorno = e.fase;
        e.fase = "pasandoManual";
        diagTransferencia.tCoincidencia = 0;
        e.motorAjuste = 0;
        estadoGobernador.motor = 0;
    }

    return true;

}

function reiniciarMandoGobernador(){
    estadoMando.modo = "manual";
    estadoMando.fase = "";
    estadoMando.motorLimite = 0;
    estadoMando.motorAjuste = 0;
    estadoMando.tiempoSinLimitar = 0;
    estadoMando.faseRetorno = "";
    diagTransferencia.tCoincidencia = 0;
    diagTransferencia.pDemanda = null;
    diagTransferencia.motivo = "";
    limiteAperturaPct = 0;                     // Fink cerrado por el limitador
}


function reiniciarDiagnosticoGobernador(){
    for(const k in diagnosticoGobernador){
        diagnosticoGobernador[k] = 0;
    }
}


/* =====================================================
   AVANCE TEMPORAL (llamado por simulador.js en cada
   PASO_INTEGRACION, antes de ejecutarModelo)
===================================================== */

function avanzarGobernador(dt){

    /* Etapa 13: sin avance hasta APLICAR */

    if(!simulando){ return; }

    /* Etapa 24: valores previos para el estado de M1 y M2 */
    const aPrevio = estadoGobernador.a;
    const limPrevio = limiteAperturaPct;

    /* Etapa 18: mando MANUAL / AUTO (limitador y motor del
       tornillo) antes de integrar el regulador */

    avanzarMandoGobernador(dt);

    /* Etapa 19: amortiguador de compensación de la varilla V–B
       (con la posición del pistón del paso anterior) */

    avanzarAmortiguador(dt);

    const h = dt / SUBPASOS_GOBERNADOR;
    const n = Math.max(0, velocidadEjeRpm());

    for(let k = 0; k < SUBPASOS_GOBERNADOR; k++){
        estadoGobernador.n = n;
        estadoGobernador.nConsigna = n;
        FISICA_GOB.paso(estadoGobernador, h);
    }

    RW.Regulador.fijarPosicion(
        estadoGobernador.s * 1000
    );

    /* Etapa 24: estado EFECTIVO de los motores en este paso
       (variación real del ajuste a y del límite de L1; un
       final de carrera que impide avanzar da variación nula) */
    actualizarEstadoMotores(
        estadoGobernador.a - aPrevio,
        limiteAperturaPct - limPrevio,
        dt
    );

    /* Diagnóstico con el estado de este paso */

    const solicitadaMm = carretePilotoSolicitado * 1000;
    const limMm = PILOTO.carreraCarretePilotoMax * 1000;

    diagnosticoGobernador.tiempo += dt;

    if(Math.abs(solicitadaMm) > limMm + 1e-9){
        diagnosticoGobernador.tiempoPilotoSaturada += dt;
    }

    diagnosticoGobernador.maxPilotoSolicitadaMm =
    Math.max(diagnosticoGobernador.maxPilotoSolicitadaMm, solicitadaMm);

    diagnosticoGobernador.minPilotoSolicitadaMm =
    Math.min(diagnosticoGobernador.minPilotoSolicitadaMm, solicitadaMm);

    if(estadoGobernador.tope === "inferior"){ diagnosticoGobernador.tiempoTopeInferior += dt; }
    if(estadoGobernador.tope === "superior"){ diagnosticoGobernador.tiempoTopeSuperior += dt; }

}


/* =====================================================
   MOTORES ESQUEMÁTICOS M1 y M2 (etapa 24, 19-oct-2026)

   M1: motor reversible del ajuste de precarga del resorte.
       En marcha cuando el ajuste a VARÍA en el paso.
   M2: motor reversible del husillo de L1.
       En marcha cuando el LÍMITE de apertura que fija L1
       VARÍA en el paso (no se deduce del movimiento de L1,
       que también sigue al varillaje).
   Umbral: la cuarta parte del avance mínimo por paso
   (M1: velocidadMotor; M2: rampa lenta de arranque), muy
   por encima del ruido numérico y por debajo de cualquier
   avance real: sin parpadeos.
   La transferencia AUTO → MANUAL fija el límite en la
   posición del servomotor fuera del paso de integración
   (lógica existente, sin cambios): no se muestra como
   marcha de M2.
===================================================== */

const estadoMotores = { m1: 0, m2: 0 };

function actualizarEstadoMotores(da, dLim, dt){
    const umbralA = 0.25 * RW.PARAM.ajuste.velocidadMotor * dt;
    const umbralL = 0.25 * MANDO_GOB.rampaArranque * dt;
    estadoMotores.m1 = Math.abs(da) > umbralA ? Math.sign(da) : 0;
    estadoMotores.m2 = Math.abs(dLim) > umbralL ? Math.sign(dLim) : 0;
}

function reiniciarEstadoMotores(){
    estadoMotores.m1 = 0;
    estadoMotores.m2 = 0;
}

const elMotores = {
    m1: document.getElementById("m1-cuerpo"),
    m1Pos: document.getElementById("m1-sentido-pos"),
    m1Neg: document.getElementById("m1-sentido-neg"),
    m2: document.getElementById("m2-cuerpo"),
    m2Pos: document.getElementById("m2-sentido-pos"),
    m2Neg: document.getElementById("m2-sentido-neg"),
    enlace: document.getElementById("m2-enlace"),
    corredera: document.getElementById("lim-corredera-l1")
};

function dibujarMotores(){

    const e = elMotores;
    if(!e.m1){ return; }

    /* reposo (antes de APLICAR) y pausa: detenidos */
    const activo = simulando && !pausado;
    const m1 = activo ? estadoMotores.m1 : 0;
    const m2 = activo ? estadoMotores.m2 : 0;

    e.m1.classList.toggle("en-marcha", m1 !== 0);
    e.m1Pos.style.display = m1 > 0 ? "" : "none";
    e.m1Neg.style.display = m1 < 0 ? "" : "none";
    e.m2.classList.toggle("en-marcha", m2 !== 0);
    e.m2Pos.style.display = m2 > 0 ? "" : "none";
    e.m2Neg.style.display = m2 < 0 ? "" : "none";

    /* enlace M2 → corredera de L1 (el motor no se mueve) */
    if(e.enlace && e.corredera){
        e.enlace.setAttribute("y2", e.corredera.getAttribute("y"));
    }

}


function lecturasGobernador(){

    const l = FISICA_GOB.lecturas(estadoGobernador);

    l.fcLento = estadoGobernador.fc.lento;
    l.fcRapido = estadoGobernador.fc.rapido;
    l.motor = estadoGobernador.motor;

    return l;

}


/* =====================================================
   REINICIO: reposo físico coherente y reproducible
   (eje detenido → s = 0 en el tope inferior, ajuste en
   su posición inicial, motor parado)
===================================================== */

function reiniciarGobernador(){

    Object.assign(
        estadoGobernador,
        FISICA_GOB.crearEstado()
    );

    /* Etapa 13: condición inicial acordada del ajuste,
       a = 0 mm (asiento arriba, límite BAJAR). Es una
       condición inicial: no cambia ningún parámetro (la
       transmisión i sigue calibrada con el ajuste medio). */

    estadoGobernador.a = AJUSTE_INICIAL_REPOSO;
    estadoGobernador.fc.lento = true;
    estadoGobernador.fc.rapido = false;

    detenerMotorAjuste();

    reiniciarMandoGobernador();                 // MANUAL, limitador en 0 % (cerrado)

    reiniciarAmortiguador();                    // émbolo receptor centrado

    RW.Regulador.fijarPosicion(0);

    reiniciarDiagnosticoGobernador();

    reiniciarEstadoMotores();                   // etapa 24: M1 y M2 detenidos

}


/* =====================================================
   BOTONES + / − (mantener pulsado)
   Etapa 18: lo que mueven depende del modo:
     MANUAL            limitador de apertura (mando LÍMITE)
     AUTO, regulando   motor del tornillo de ajuste
                       (+ baja el asiento y aumenta la precarga:
                       sube velocidad / carga; − lo contrario)
     AUTO, secuencia   nada (la secuencia mueve L1 y el ajuste)
   Soltar detiene el movimiento. Se detiene también al soltar
   fuera del botón (captura del puntero y pointerup en la
   ventana), al cancelar el puntero, al perder el foco o al
   ocultar la página. En PAUSA y hasta APLICAR no actúan.
===================================================== */

const botonGobLento = document.getElementById("gobernadorLento");
const botonGobRapido = document.getElementById("gobernadorRapido");

function detenerMotorAjuste(){
    estadoMando.motorLimite = 0;
    estadoMando.motorAjuste = 0;
    if(estadoMando.modo === "manual" || estadoMando.fase === "regulando"){
        estadoGobernador.motor = 0;
    }
    if(botonGobLento){ botonGobLento.classList.remove("pulsado"); }
    if(botonGobRapido){ botonGobRapido.classList.remove("pulsado"); }
}

function arrancarMotorAjuste(sentido, boton){
    /* Bloqueado en PAUSA y hasta APLICAR (etapa 13) */
    if(pausado || !simulando || boton.disabled){ return; }
    if(estadoMando.modo === "manual"){
        estadoMando.motorLimite = sentido;
    }else if(estadoMando.fase === "regulando" && !sincronizadorTieneM1()){
        estadoMando.motorAjuste = sentido;
    }else{
        return;
    }
    botonGobLento.classList.toggle("pulsado", boton === botonGobLento);
    botonGobRapido.classList.toggle("pulsado", boton === botonGobRapido);
}

function conectarBotonAjuste(boton, sentido){

    boton.addEventListener("pointerdown", function(ev){
        if(ev.button > 0){ return; }
        ev.preventDefault();
        try{ boton.setPointerCapture(ev.pointerId); }catch(e){}
        arrancarMotorAjuste(sentido, boton);
    });

    ["pointerup", "pointercancel", "lostpointercapture"].forEach(function(tipo){
        boton.addEventListener(tipo, detenerMotorAjuste);
    });

    boton.addEventListener("keydown", function(ev){
        if((ev.key === " " || ev.key === "Enter") && !ev.repeat){
            ev.preventDefault();
            arrancarMotorAjuste(sentido, boton);
        }
    });

    boton.addEventListener("keyup", function(ev){
        if(ev.key === " " || ev.key === "Enter"){ detenerMotorAjuste(); }
    });

    boton.addEventListener("blur", detenerMotorAjuste);
    boton.addEventListener("contextmenu", function(ev){ ev.preventDefault(); });

}

if(botonGobLento && botonGobRapido){
    conectarBotonAjuste(botonGobLento, -1);
    conectarBotonAjuste(botonGobRapido, +1);
}

window.addEventListener("pointerup", detenerMotorAjuste);
window.addEventListener("blur", detenerMotorAjuste);
document.addEventListener("visibilitychange", function(){
    if(document.hidden){ detenerMotorAjuste(); }
});


/* Botones de modo MANUAL / AUTO (etapa 18) */

const botonModoManual = document.getElementById("gobModoManual");
const botonModoAuto = document.getElementById("gobModoAuto");

if(botonModoManual && botonModoAuto){
    botonModoManual.addEventListener("click", function(){
        detenerMotorAjuste();
        seleccionarModoGobernador("manual");
        mostrarGobernador();
    });
    botonModoAuto.addEventListener("click", function(){
        detenerMotorAjuste();
        seleccionarModoGobernador("auto");
        mostrarGobernador();
    });
}


/* =====================================================
   INDICADORES DEL PANEL «GOBERNADOR DE CARGA»
===================================================== */

const elGob = {
    s: document.getElementById("gobS"),
    a: document.getElementById("gobAjuste"),
    barra: document.getElementById("gobBarraAjuste"),
    fcL: document.getElementById("gobFcLento"),
    fcR: document.getElementById("gobFcRapido"),
    tope: document.getElementById("gobTope"),
    piloto: document.getElementById("gobPiloto"),
    aviso: document.getElementById("gobAvisoPiloto"),
    /* etapa 15: botonera estándar */
    escala: document.getElementById("gobEscala"),
    marcador: document.getElementById("gobMarcador"),
    lectura: document.getElementById("gobLectura"),
    modoManual: document.getElementById("gobModoManual"),
    modoAuto: document.getElementById("gobModoAuto"),
    numSubir: document.getElementById("gobNumSubir"),
    numBajar: document.getElementById("gobNumBajar")
};

function mostrarGobernador(){

    dibujarMotores();                           // etapa 24

    if(!elGob.s){ return; }

    const l = lecturasGobernador();
    const AJ = RW.PARAM.ajuste;

    elGob.s.textContent = l.sMm.toFixed(1);
    elGob.a.textContent = l.a.toFixed(1);
    elGob.barra.style.width = (100 * l.a / AJ.recorrido).toFixed(1) + "%";
    elGob.fcL.classList.toggle("activo", l.fcLento);
    elGob.fcR.classList.toggle("activo", l.fcRapido);

    elGob.tope.textContent =
    l.tope === "inferior" ? "tope inf." :
    l.tope === "superior" ? "tope sup." : "";

    const solicitadaMm = carretePilotoSolicitado * 1000;
    const limitadaMm = carretePilotoVarillaje * 1000;
    const limMm = PILOTO.carreraCarretePilotoMax * 1000;
    const fmt = function(v){ return (v >= -0.0005 ? "+" : "−") + Math.abs(v).toFixed(3); };

    const saturada = Math.abs(solicitadaMm) > limMm + 1e-9;

    elGob.piloto.textContent =
    simulando
    ? "piloto solicitada " + fmt(solicitadaMm) + " mm · aplicada " + fmt(limitadaMm) + " mm"
    : "piloto solicitada " + fmt(solicitadaMm) + " mm · sin movimiento hasta APLICAR";

    elGob.aviso.textContent =
    saturada
    ? "⚠ La geometría pide " + fmt(solicitadaMm) + " mm (> ±" + limMm.toFixed(1) +
      " mm): limitación NUMÉRICA, no mecánica"
    : "";

    elGob.aviso.title = saturada
    ? "La geometría del varillaje pide un desplazamiento de la piloto fuera de su carrera. " +
      "El simulador lo limita numéricamente; en un mecanismo rígido el tope bloquearía el varillaje."
    : "";

    elGob.aviso.classList.toggle("activo", saturada);

    /* Etapa 15/18: botonera estándar. MANUAL / AUTO siguen el
       patrón de la caldera: el modo seleccionado en rojo, el otro en
       verde; AUTO inhabilitado (atenuado) hasta 100 rpm.
       Etapa 22 (19-oct-2026): la escala y la lectura muestran SIEMPRE
       la apertura geométrica del distribuidor (misma variable que el
       indicador inferior y la gráfica), en ambos modos; antes
       mostraban el limitador en MANUAL y el ajuste del resorte en
       AUTO, y la lectura «saltaba» al cambiar de modo. Los extremos
       en rojo (fin de carrera) siguen indicando el ACCIONAMIENTO que
       mueven + y −, no la apertura. */

    if(elGob.marcador){

        const manual = estadoMando.modo === "manual";
        const apertura = ultimoEstadoDistribuidor
            ? Math.max(0, Math.min(100, ultimoEstadoDistribuidor.intensidadAgua * 100)) : 0;
        const txt = Math.round(apertura) + " %";
        const pctAccion = manual ? limiteAperturaPct : 100 * l.a / AJ.recorrido;
        const accion = manual ? "Limitador de apertura" : "Ajuste del resorte";
        const txtAccion = Math.round(pctAccion) + " %" +
            (manual ? "" : " de la carrera (a = " + l.a.toFixed(1) + " mm)");
        const enMin = manual ? limiteAperturaPct <= 1e-9 : l.fcLento;
        const enMax = manual ? limiteAperturaPct >= 100 - 1e-9 : l.fcRapido;

        elGob.marcador.style.left = apertura.toFixed(2) + "%";
        elGob.lectura.textContent = txt;
        elGob.lectura.title = "Apertura del distribuidor: " + apertura.toFixed(1) + " %\n" +
            accion + " (+ / −): " + txtAccion +
            (manual || estadoMando.fase === "regulando" ? "" :
             enTransferenciaManual() ? " · Pasando a MANUAL" : " · secuencia automática en curso");
        elGob.escala.setAttribute("aria-label", "Apertura del distribuidor: " + txt);
        elGob.numSubir.classList.toggle("limite-activo", enMax);
        elGob.numBajar.classList.toggle("limite-activo", enMin);
        elGob.numSubir.title = enMax ? accion + ": máximo" : "";
        elGob.numBajar.title = enMin ? accion + ": mínimo" : "";

        if(elGob.modoManual){

            const autoPermitido = simulando &&
                (!manual || velocidadEjeRpm() >= MANDO_GOB.rpmHabilitacionAuto);

            elGob.modoManual.disabled = !simulando;
            elGob.modoAuto.disabled = !autoPermitido;
            const transfiriendo = enTransferenciaManual();          // etapa 25
            elGob.modoManual.classList.toggle("modo-seleccionado", manual);
            elGob.modoManual.classList.toggle("modo-transicion", transfiriendo);
            const textoManual = transfiriendo ? "Pasando a MANUAL" : "MANUAL";
            if(elGob.modoManual.textContent !== textoManual){ elGob.modoManual.textContent = textoManual; }
            elGob.modoAuto.classList.toggle("modo-seleccionado", !manual);
            elGob.modoManual.setAttribute("aria-pressed", String(manual));
            elGob.modoAuto.setAttribute("aria-pressed", String(!manual));
            elGob.modoManual.title = transfiriendo
                ? "Pasando a MANUAL: limitador " + limiteAperturaPct.toFixed(1) +
                  " %, servomotor " + posicionPiston.toFixed(1) + " %, demanda del regulador " +
                  (diagTransferencia.pDemanda === null ? "—" : diagTransferencia.pDemanda.toFixed(1)) +
                  " % (de carrera) · " + diagTransferencia.motivo +
                  ". El regulador sigue en automático. AUTO cancela."
                : "Modo MANUAL: + y − mueven el limitador de apertura (" +
                  Math.round(limiteAperturaPct) + " %)";
            elGob.modoAuto.title = autoPermitido || !manual
                ? "Modo AUTO: arranque automático hasta 360 rpm; después + y − mueven el ajuste"
                : "Modo AUTO: disponible desde " + MANDO_GOB.rpmHabilitacionAuto + " rpm";
            elGob.modoManual.setAttribute("aria-label", elGob.modoManual.title);
            elGob.modoAuto.setAttribute("aria-label", elGob.modoAuto.title);

            /* + / −: sin efecto durante la secuencia automática */
            const masMenos = simulando && (manual ||
                (estadoMando.fase === "regulando" && !sincronizadorTieneM1()));
            botonGobRapido.disabled = !masMenos;
            botonGobLento.disabled = !masMenos;
            const quien = manual ? "limitador de apertura" : "ajuste (velocidad / carga)";
            botonGobRapido.title = "+ : sube " + quien + " (mantener pulsado)";
            botonGobLento.title = "− : baja " + quien + " (mantener pulsado)";
            botonGobRapido.setAttribute("aria-label", botonGobRapido.title);
            botonGobLento.setAttribute("aria-label", botonGobLento.title);
        }

    }

}


/* Estado inicial: reposo físico */

reiniciarGobernador();
