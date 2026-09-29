/* =========================================================
   SIMULADOR RV
   VERSIÓN 14
========================================================= */


let V = 1.0;

let Vref = 1.0;

let If = 1.0;

let P = 1.0;

let Qcarga = 0.0;

let Q = 0.0;

let Qobjetivo = 0.0;

let IfManual = 1.0;

let integralError = 0.0;

let error = 0.0;

let Ve = 1.0;

let Vst = 0.0;

// Pulso visual sobre el conductor existente; no interviene en el modelo.
const conductorExcitacion = document.getElementById("conductorExcitacion");
const pulsoExcitacion = document.getElementById("pulsoExcitacion");
const flujoExcitacion = document.getElementById("flujoExcitacion");
const segmentosFlujoExcitacion = flujoExcitacion.querySelectorAll("line");
let avanceFlujoExcitacion = 0;

function posicionarFlujoExcitacion(){
    segmentosFlujoExcitacion.forEach((segmento, indice) => {
        const distancia = (avanceFlujoExcitacion +
            indice * longitudConductorExcitacion / 4) % longitudConductorExcitacion;
        const punto = conductorExcitacion.getPointAtLength(distancia);
        const anterior = conductorExcitacion.getPointAtLength(Math.max(0, distancia - 4));
        const siguiente = conductorExcitacion.getPointAtLength(
            Math.min(longitudConductorExcitacion, distancia + 4));
        const angulo = Math.atan2(siguiente.y - anterior.y, siguiente.x - anterior.x)
            * 180 / Math.PI;
        segmento.setAttribute("transform",
            `translate(${punto.x} ${punto.y}) rotate(${angulo})`);
    });
}

function actualizarFlujoExcitacion(segundos){
    if(pausado) return;
    // Misma velocidad anterior: 20 unidades en 0.5 s, independiente de If.
    avanceFlujoExcitacion = (avanceFlujoExcitacion + 70 * segundos)
        % longitudConductorExcitacion;
    posicionarFlujoExcitacion();
}
const longitudConductorExcitacion = conductorExcitacion.getTotalLength();
const [haloExteriorPulso, haloInteriorPulso, nucleoPulso] =
    pulsoExcitacion.querySelectorAll("circle");
const esperaPulsoExcitacion = 1.6; // Segundos; independiente de If.
let avancePulsoExcitacion = 0;
let pulsoExcitacionEnEspera = false;
let esperaTranscurridaPulsoExcitacion = 0;

// If controla solo el halo rojo; el trazo blanco y su movimiento no cambian.
// Flujo independiente sobre el conductor de retorno.
const conductorRetornoExcitacion = document.getElementById("conductorRetornoExcitacion");
const segmentosFlujoRetornoExcitacion = document.querySelectorAll("#flujoRetornoExcitacion line");
const longitudConductorRetornoExcitacion = conductorRetornoExcitacion.getTotalLength();
let avanceFlujoRetornoExcitacion = 0;

function posicionarFlujoRetornoExcitacion(){
    segmentosFlujoRetornoExcitacion.forEach((segmento, indice) => {
        const distancia = longitudConductorRetornoExcitacion - (avanceFlujoRetornoExcitacion +
            indice * longitudConductorRetornoExcitacion / 4) % longitudConductorRetornoExcitacion;
        const punto = conductorRetornoExcitacion.getPointAtLength(distancia);
        const anterior = conductorRetornoExcitacion.getPointAtLength(Math.max(0, distancia - 4));
        const siguiente = conductorRetornoExcitacion.getPointAtLength(
            Math.min(longitudConductorRetornoExcitacion, distancia + 4));
        const angulo = Math.atan2(siguiente.y - anterior.y, siguiente.x - anterior.x)
            * 180 / Math.PI;
        segmento.setAttribute("transform",
            `translate(${punto.x} ${punto.y}) rotate(${angulo})`);
    });
}

function actualizarFlujoRetornoExcitacion(segundos){
    if(pausado) return;
    // Retorno a 70 unidades/s, independiente de If.
    avanceFlujoRetornoExcitacion = (avanceFlujoRetornoExcitacion + 70 * segundos)
        % longitudConductorRetornoExcitacion;
    posicionarFlujoRetornoExcitacion();
}
function actualizarHaloFlujoRetornoExcitacion(){
    const nivel = (limitar(If, IF_MIN, IF_MAX) - IF_MIN) / (IF_MAX - IF_MIN);
    const desenfoque = 2 + 10 * nivel;
    const opacidad = 0.20 + 0.80 * nivel;
    segmentosFlujoRetornoExcitacion.forEach(segmento => {
        segmento.style.filter =
            `drop-shadow(0 0 2px rgba(255, 0, 0, ${opacidad}))
            drop-shadow(0 0 5px rgba(255, 0, 0, ${opacidad}))
            drop-shadow(0 0 ${desenfoque}px rgba(255, 0, 0, ${opacidad}))`;
    });
}

function actualizarHaloFlujoExcitacion(){
    const nivel = (limitar(If, IF_MIN, IF_MAX) - IF_MIN) / (IF_MAX - IF_MIN);
    const desenfoque = 2 + 10 * nivel;
    const opacidad = 0.20 + 0.80 * nivel;
    segmentosFlujoExcitacion.forEach(segmento => {
        segmento.style.filter =
            `drop-shadow(0 0 2px rgba(255, 0, 0, ${opacidad}))
            drop-shadow(0 0 5px rgba(255, 0, 0, ${opacidad}))
            drop-shadow(0 0 ${desenfoque}px rgba(255, 0, 0, ${opacidad}))`;
    });
}

function actualizarLuminosidadPulsoExcitacion(){
    // If solo modifica la apariencia del pulso, nunca sus tiempos.
    const nivel = (limitar(If, IF_MIN, IF_MAX) - IF_MIN) / (IF_MAX - IF_MIN);
    const intensidadHalo = nivel * nivel;
    haloExteriorPulso.setAttribute("r", 5 + 12 * intensidadHalo);
    haloExteriorPulso.setAttribute("opacity", 0.05 + 0.80 * intensidadHalo);
    haloExteriorPulso.style.filter = "blur(1.5px)";
    haloInteriorPulso.setAttribute("r", 3.5 + 6 * intensidadHalo);
    haloInteriorPulso.setAttribute("opacity", 0.15 + 0.85 * nivel);
    haloInteriorPulso.style.filter = "blur(0.6px)";
    // El radio del núcleo permanece en sus 2.5 unidades originales.
    nucleoPulso.setAttribute("opacity", 0.35 + 0.65 * nivel);
}

function reiniciarPulsoExcitacion(){
    avancePulsoExcitacion = 0;
    pulsoExcitacionEnEspera = false;
    esperaTranscurridaPulsoExcitacion = 0;
    const punto = conductorExcitacion.getPointAtLength(0);
    pulsoExcitacion.setAttribute("transform", `translate(${punto.x} ${punto.y})`);
    pulsoExcitacion.setAttribute("visibility", "visible");
    actualizarLuminosidadPulsoExcitacion();
}

function actualizarPulsoExcitacion(segundos){
    if(pausado){
        return;
    }

    actualizarLuminosidadPulsoExcitacion();

    if(pulsoExcitacionEnEspera){
        esperaTranscurridaPulsoExcitacion += segundos;
        if(esperaTranscurridaPulsoExcitacion + 1e-9 >= esperaPulsoExcitacion){
            reiniciarPulsoExcitacion();
        }
        return;
    }

    // Velocidad original constante, independiente de If.
    avancePulsoExcitacion = Math.min(
        avancePulsoExcitacion + 120 * segundos,
        longitudConductorExcitacion
    );
    const punto = conductorExcitacion.getPointAtLength(avancePulsoExcitacion);
    pulsoExcitacion.setAttribute("transform", `translate(${punto.x} ${punto.y})`);

    if(avancePulsoExcitacion >= longitudConductorExcitacion){
        pulsoExcitacion.setAttribute("visibility", "hidden");
        pulsoExcitacionEnEspera = true;
        esperaTranscurridaPulsoExcitacion = 0;
    }
}

let pausado = false;



const dt = 0.02;

const TQ = 0.35;

const KQ = 0.12;

// Red fuerte: sensibilidad residual de la barra (aproximación didáctica).
const KRED = 0.05;

const KIF = 0.42;

const TV = 0.65;

const KP = 3.5;

const KI = 2.2;

const TEXC = 0.45;

const KST = 0.04;

const TST = 0.30;

const IF_MIN = 0.50;

const IF_MAX = 1.50;

const VE_MIN = 0.50;

const VE_MAX = 1.50;



/* =========================================================
   PARÁMETROS DE LA CURVA DE CAPACIDAD
========================================================= */

const SmaxCapacidad = 1.0;

const VCapacidad = 1.0;

const XsCapacidad = 1.5;

const EmaxCapacidad = 2.0;

// Límite térmico didáctico parametrizado de subexcitación.
// Los coeficientes se adoptan para fines educativos y no
// corresponden a datos de un fabricante específico.
const Q0Cabezal = -0.62;
const mCabezal = 0.30175;

// Parámetros exclusivamente visuales para evaluar la recta didáctica verde.
const Q0CabezalVisual = -0.7312;
const mCabezalVisual = 0.50;

// Límites didácticos adoptados para esta turbina; no son valores universales.
const PminTurbina = 0.10;
const PmaxTurbina = 1.05;

// Ángulo límite didáctico adoptado para este modelo, expresado en grados.
const deltaLimEstabilidad = 70;

const origenXCapacidad = 35;

const origenYCapacidad = 110;

const escalaPCapacidad = 100;

const escalaQCapacidad = 100;



/* =========================================================
   ELEMENTOS DOM
========================================================= */

const sliderP =
document.getElementById("sliderP");

const valorP =
document.getElementById("valorP");

const sliderQ =
document.getElementById("sliderQ");

const sliderIf =
document.getElementById("sliderIf");

const sliderVref =
document.getElementById("sliderVref");

const modo =
document.getElementById("modo");

const valorQ =
document.getElementById("valorQ");

const valorIf =
document.getElementById("valorIf");

const valorVref =
document.getElementById("valorVref");

const displayV =
document.getElementById("displayV");

const displayIf =
document.getElementById("displayIf");

const displayP =
document.getElementById("displayP");

const displayQ =
document.getElementById("displayQ");

const displayFP =
document.getElementById("displayFP");

const estadoExcitacion =
document.getElementById("estadoExcitacion");

const textoVref =
document.getElementById("textoVref");

const textoError =
document.getElementById("textoError");

const textoVoltaje =
document.getElementById("textoVoltaje");

const textoIfLinea =
document.getElementById("textoIfLinea");

const textoPCarga =
document.getElementById("textoPCarga");

const textoQCarga =
document.getElementById("textoQCarga");

const textoVi =
document.getElementById("textoVi");

const textoVe =
document.getElementById("textoVe");

const simboloR =
document.getElementById("simboloR");

const simboloXL =
document.getElementById("simboloXL");

const simboloXC =
document.getElementById("simboloXC");

const estado =
document.getElementById("estado");

const puntoOperacion =
document.getElementById("puntoOperacion");



/* =========================================================
   HALO LUMINOSO DE LAS FASES
========================================================= */


/* ---------------------------------------------------------
   HALOS HORIZONTALES

   Generador -> Carga
--------------------------------------------------------- */

const haloFaseA =
document.getElementById("haloFaseA");

const haloFaseB =
document.getElementById("haloFaseB");

const haloFaseC =
document.getElementById("haloFaseC");


/* ---------------------------------------------------------
   HALOS VERTICALES

   Fases A-B-C -> Detector de tensión
--------------------------------------------------------- */

const haloMedicionA =
document.getElementById("haloMedicionA");

const haloMedicionB =
document.getElementById("haloMedicionB");

const haloMedicionC =
document.getElementById("haloMedicionC");



/* =========================================================
   ACTUALIZACIÓN DEL HALO DE LAS FASES

   El conductor NO se modifica.

   Solamente cambia la intensidad del halo.

   Q = -100 %  -> 0.80
   Q =    0 %  -> 0.60
   Q = +100 %  -> 0.40
========================================================= */

function actualizarHaloCarga(q){


    /* -----------------------------------------------------
       CÁLCULO DE LA INTENSIDAD
    ----------------------------------------------------- */

    const intensidad =
    0.60 - (q / 100) * 0.20;

    /* -----------------------------------------------------
       HALOS HORIZONTALES

       Generador -> Carga
    ----------------------------------------------------- */

    [
        haloFaseA,
        haloFaseB,
        haloFaseC

    ].forEach(halo => {

        if(halo){

            halo.style.opacity =
            intensidad;

        }

    });



    /* -----------------------------------------------------
       HALOS VERTICALES

       Fases A-B-C -> Detector
    ----------------------------------------------------- */

    [
        haloMedicionA,
        haloMedicionB,
        haloMedicionC

    ].forEach(halo => {

        if(halo){

            halo.style.opacity =
            intensidad;

        }

    });

}



/* =========================================================
   POTENCIA ACTIVA
========================================================= */

sliderP.addEventListener(
"input",
function(){

    P =
    Number(sliderP.value) / 100;

    actualizarPantalla();

    valorP.textContent =
    Number(sliderP.value).toFixed(0);

});



/* =========================================================
   CARGA REACTIVA
========================================================= */

sliderQ.addEventListener(
"input",
function(){

    const q =
    Number(sliderQ.value);

    valorQ.textContent =
    q;

    // Los elementos de salida se actualizan con Q real en actualizarPantalla().

});



function actualizarSimboloCarga(q){

    if(q > 0){

        simboloR.style.display =
        "none";

        simboloXC.style.display =
        "none";

        simboloXL.style.display =
        "block";

    }

    else if(q < 0){

        simboloR.style.display =
        "none";

        simboloXL.style.display =
        "none";

        simboloXC.style.display =
        "block";

    }

    else{

        simboloXL.style.display =
        "none";

        simboloXC.style.display =
        "none";

        simboloR.style.display =
        "block";

    }

}



/* =========================================================
   EXCITACIÓN MANUAL
========================================================= */

sliderIf.addEventListener(
"input",
function(){

    IfManual =
    Number(sliderIf.value) / 100;

});



/* =========================================================
   Vref
========================================================= */

sliderVref.addEventListener(
"input",
function(){

    Vref =
    Number(sliderVref.value) / 100;

    if(valorVref) valorVref.textContent = Vref.toFixed(2);

});



/* =========================================================
   AUTO / MANUAL
========================================================= */

modo.addEventListener(
"change",
function(){

    if(modo.value === "manual"){

        sliderIf.disabled =
        false;

        sliderIf.value =
        Math.round(If * 100);

        IfManual =
        If;

    }

    else{

        sliderIf.disabled =
        true;

        integralError =
        (If - 1) / KI;

    }

});



/* =========================================================
   APLICAR PERTURBACIÓN REACTIVA
========================================================= */

document
.getElementById("aplicar")
.addEventListener(
"click",
function(){

    Qobjetivo =
    Number(sliderQ.value) / 100;

});



/* =========================================================
   PAUSA
========================================================= */

document
.getElementById("pausa")
.addEventListener(
"click",
function(){

    pausado =
    !pausado;



    if(pausado){

        pausarRotor();

    }

    else{

        iniciarRotor();

    }


    this.textContent =
    pausado
    ? "CONTINUAR"
    : "PAUSA";

});



/* =========================================================
   REINICIAR
========================================================= */

document
.getElementById("reiniciar")
.addEventListener(
"click",
reiniciar
);



function reiniciar(){

    V = 1.0;

    Vref = 1.0;

    If = 1.0;

    P = 1.0;

    Qcarga = 0.0;

    Q = 0.0;

    Qobjetivo = 0.0;

    IfManual = 1.0;

    integralError = 0.0;

    error = 0.0;

    Ve = 1.0;

    Vst = 0.0;

    pausado = false;

    reiniciarPulsoExcitacion();

    actualizarHaloFlujoExcitacion();
    avanceFlujoExcitacion = 0;
    posicionarFlujoExcitacion();
    avanceFlujoRetornoExcitacion = 0;
    posicionarFlujoRetornoExcitacion();
    actualizarHaloFlujoRetornoExcitacion();


    sliderP.value = 100;

    sliderQ.value = 0;

    sliderIf.value = 100;

    sliderVref.value = 100;


    modo.value = "auto";


    sliderIf.disabled = true;


    valorP.textContent = "100";

    valorQ.textContent = "0";


//    valorIf.textContent = "100";

//    valorVref.textContent = "1.00";


    document
    .getElementById("pausa")
    .textContent =
    "PAUSA";


    actualizarSimboloCarga(0);

    actualizarHaloCarga(0);

    actualizarPantalla();

    reiniciarRotor();

    iniciarRotor();
}



/* =========================================================
   LIMITADOR
========================================================= */

function limitar(valor,min,max){

    return Math.max(
        min,
        Math.min(
            max,
            valor
        )
    );

}



/* =========================================================
   MODELO DINÁMICO
========================================================= */

function simularPaso(){


    /* ---------------------------------------------------------
       RESPUESTA DINÁMICA DE LA CARGA REACTIVA

       Qobjetivo representa el valor seleccionado por el
       usuario al pulsar APLICAR.

       Qcarga evoluciona gradualmente hacia ese valor.
    --------------------------------------------------------- */

    Qcarga +=
    ((Qobjetivo - Qcarga) / TQ) * dt;



    // Aproximación lineal de reactivos suministrados por la excitación.
    // Qcarga conserva la demanda aplicada; Q representa la salida real.
    Q = (KIF / KQ) * (If - 1);

    // La red atenúa la desviación de tensión, pero conserva su transitorio.
    const Vnatural = 1 + KRED * (KIF * (If - 1) - KQ * Qcarga);


    /* ---------------------------------------------------------
       DINÁMICA DE LA TENSIÓN TERMINAL
    --------------------------------------------------------- */

    V +=
    ((Vnatural - V) / TV) * dt;



    /* ---------------------------------------------------------
       ERROR DEL AVR
    --------------------------------------------------------- */

    error =
    Vref - V;

    // Compensación reactiva: Vref desplaza Q sin arrastrar la barra.
    const errorControl = error - KQ * (Q - Qcarga);



    /* ---------------------------------------------------------
       ESTABILIZADOR
    --------------------------------------------------------- */

    const VstObjetivo =
    KST * (If - 1);


    Vst +=
    ((VstObjetivo - Vst) / TST) * dt;



    /* ---------------------------------------------------------
       AVR AUTOMÁTICO
    --------------------------------------------------------- */

    if(modo.value === "auto"){

        integralError +=
        errorControl * dt;


        integralError =
        limitar(
            integralError,
            -0.25,
            0.25
        );


        Ve =

        1
        +
        KP * errorControl
        +
        KI * integralError
        -
        Vst;


        Ve =
        limitar(
            Ve,
            VE_MIN,
            VE_MAX
        );

    }

    else{

        /* -----------------------------------------------------
           EXCITACIÓN MANUAL
        ----------------------------------------------------- */

        Ve =
        IfManual;

    }



    /* ---------------------------------------------------------
       DINÁMICA DE LA EXCITATRIZ
    --------------------------------------------------------- */

    If +=
    ((Ve - If) / TEXC) * dt;


    If =
    limitar(
        If,
        IF_MIN,
        IF_MAX
    );



    // Recalcular con la excitación del paso actual para todas las salidas.
    Q = (KIF / KQ) * (If - 1);


    actualizarPantalla();

}



/* =========================================================
   FACTOR DE POTENCIA
========================================================= */

function calcularFP(){

    const S =
    Math.sqrt(
        P * P +
        Q * Q
    );

    if(S === 0){

        return 1;

    }

    return P / S;

}



/* =========================================================
   LÍMITE DE CALENTAMIENTO DE CABEZALES
========================================================= */

function limiteCabezalVisual(Pcap){
    return Q0CabezalVisual + mCabezalVisual * Pcap;
}

function limiteCabezal(Pcap){

    return Q0Cabezal + mCabezal * Pcap;

}



/* =========================================================
   VERIFICACIÓN DE LA CURVA DE CAPACIDAD
========================================================= */

function estaDentroCurvaCapacidad(Pcap,Qcap){


    /* =====================================================
       1. LÍMITE DEL ESTATOR
    ===================================================== */

    const limiteEstator =
    (
        Pcap * Pcap
        +
        Qcap * Qcap
    )
    <=
    (
        SmaxCapacidad *
        SmaxCapacidad
        +
        0.000001
    );



    /* =====================================================
       2. LÍMITE DE CORRIENTE DE CAMPO DEL ROTOR
    ===================================================== */

    const desplazamientoQ =
    VCapacidad *
    VCapacidad /
    XsCapacidad;


    const radioRotor =
    VCapacidad *
    EmaxCapacidad /
    XsCapacidad;


    const limiteRotor =
    (
        Pcap * Pcap
        +
        Math.pow(
            Qcap + desplazamientoQ,
            2
        )
    )
    <=
    (
        radioRotor *
        radioRotor
        +
        0.000001
    );



    /* =====================================================
       3. LÍMITE INFERIOR DE CABEZAL Y ESTABILIDAD ANGULAR
    ===================================================== */

    const QminCabezal = limiteCabezalVisual(Pcap);
    const QminEstabilidad = limiteEstabilidadAngular(Pcap);

    const limiteInferiorOK =
    Qcap >= Math.max(QminCabezal, QminEstabilidad);


    return(
        limiteEstator
        &&
        limiteRotor
        &&
        limiteInferiorOK
    );

}



/* =========================================================
   PANTALLA
========================================================= */

function actualizarPantalla(){


    const fp =
    calcularFP();


    const qPorcentaje =
    Q * 100;

    actualizarHaloCarga(qPorcentaje);
    actualizarSimboloCarga(Math.abs(Q) < 0.001 ? 0 : qPorcentaje);


    const pPorcentaje =
    P * 100;


    const vi =
    error - Vst;



    displayV.textContent =
    V.toFixed(3);


    displayIf.textContent =
    If.toFixed(3);


    displayP.textContent =
    pPorcentaje.toFixed(1);


    displayQ.textContent =
    qPorcentaje.toFixed(1);



    /* =====================================================
       FACTOR DE POTENCIA Y ESTADO DE EXCITACIÓN
    ===================================================== */

    if(Q > 0.001){

        displayFP.textContent =
        fp.toFixed(2) +
        " ATRASADO";


        estadoExcitacion.textContent =
        "SOBREEXCITADO";

    }

    else if(Q < -0.001){

        displayFP.textContent =
        fp.toFixed(2) +
        " ADELANTADO";


        estadoExcitacion.textContent =
        "SUBEXCITADO";

    }

    else{

        displayFP.textContent =
        fp.toFixed(2);


        estadoExcitacion.textContent =
        "EXCITACIÓN NORMAL";

    }



    textoVref.textContent =
    "Vref = " +
    Vref.toFixed(3) +
    " pu";


    textoError.textContent =
    "e = " +
    error.toFixed(3) +
    " pu";


    textoVoltaje.textContent =
    "V = " +
    V.toFixed(3) +
    " pu";


    textoIfLinea.textContent =
    "If = " +
    If.toFixed(3) +
    " pu";


    textoVi.textContent =
    "Vi = " +
    vi.toFixed(3);


    textoVe.textContent =
    "Ve = " +
    Ve.toFixed(3);


    textoPCarga.textContent =
    "P = " +
    pPorcentaje.toFixed(1) +
    " %";


    textoQCarga.textContent =
    "Q = " +
    qPorcentaje.toFixed(1) +
    " %";



    /* =====================================================
       PUNTO DE OPERACIÓN
    ===================================================== */

    const puntoPQ =
    convertirASVGCapacidad(
        P,
        Q
    );


    puntoOperacion.setAttribute(
        "cx",
        puntoPQ.x
    );


    puntoOperacion.setAttribute(
        "cy",
        puntoPQ.y
    );



    /* =====================================================
       COLOR DEL PUNTO

       VERDE = OPERACIÓN PERMITIDA
       ROJO  = FUERA DE CURVA
    ===================================================== */

    const operacionPermitida =
    estaDentroCurvaCapacidad(
        P,
        Q
    );


    if(operacionPermitida){

        puntoOperacion.style.fill =
        "#1f9d55";

    }

    else{

        puntoOperacion.style.fill =
        "#d32f2f";

    }



    /* =====================================================
       ESTADO DEL AVR
    ===================================================== */

    if(Math.abs(1 - V) < 0.003){

        estado.textContent =
        "TENSIÓN NOMINAL";

        estado.style.background =
        "#d5e8d4";

        estado.style.borderColor =
        "#6a9a68";

    }

    else if(V < 1){

        estado.textContent =
        "V ↓  —  AVR AUMENTA EXCITACIÓN";

        estado.style.background =
        "#fff2cc";

        estado.style.borderColor =
        "#c9a227";

    }

    else{

        estado.textContent =
        "V ↑  —  AVR REDUCE EXCITACIÓN";

        estado.style.background =
        "#f4cccc";

        estado.style.borderColor =
        "#b85450";

    }

}



/* =========================================================
   CONVERSIÓN P-Q A SVG
========================================================= */

function convertirASVGCapacidad(Pcap,Qcap){

    const x =
    origenXCapacidad +
    Pcap * escalaPCapacidad;

    const y =
    origenYCapacidad -
    Qcap * escalaQCapacidad;

    return {
        x:x,
        y:y
    };

}



/* =========================================================
   CURVA DE CORRIENTE DEL ESTATOR
========================================================= */

/* Referencias visuales: no intervienen en la validación de capacidad. */
function limiteEstabilidadAngular(Pcap){
    const deltaRad = deltaLimEstabilidad * Math.PI / 180;
    return Pcap / Math.tan(deltaRad)
        - (VCapacidad * VCapacidad / XsCapacidad);
}

// Referencia exclusivamente visual; no modifica la envolvente ni la validación.
function generarCurvaEstabilidadAngular(){
    const inicio = convertirASVGCapacidad(0, limiteEstabilidadAngular(0));
    const fin = convertirASVGCapacidad(
        PmaxTurbina, limiteEstabilidadAngular(PmaxTurbina)
    );
    const trayectoria = "M " + inicio.x + " " + inicio.y
        + " L " + fin.x + " " + fin.y;
    document.getElementById("curvaEstabilidadAngular")
        .setAttribute("d", trayectoria);
}

// Límites exclusivamente visuales; no intervienen en la validación.
function generarLimitesTurbina(){
    for(const [id, potencia] of [
        ["limiteTurbinaMin", PminTurbina],
        ["limiteTurbinaMax", PmaxTurbina]
    ]){
        const superior = convertirASVGCapacidad(potencia, 1.0);
        const inferior = convertirASVGCapacidad(potencia, -1.0);
        const trayectoria = "M " + superior.x + " " + superior.y
            + " L " + inferior.x + " " + inferior.y;
        document.getElementById(id).setAttribute("d", trayectoria);
    }
}

function generarCurvasReferencia(){
    const desplazamientoQ = VCapacidad * VCapacidad / XsCapacidad;
    const radioRotor = VCapacidad * EmaxCapacidad / XsCapacidad;
    const QA = (radioRotor * radioRotor - SmaxCapacidad * SmaxCapacidad
        - desplazamientoQ * desplazamientoQ) / (2 * desplazamientoQ);
    const PA = Math.sqrt(SmaxCapacidad * SmaxCapacidad - QA * QA);
    const coeficiente = 1 + mCabezal * mCabezal;
    const PB = (-Q0Cabezal * mCabezal + Math.sqrt(
        coeficiente * SmaxCapacidad * SmaxCapacidad - Q0Cabezal * Q0Cabezal
    )) / coeficiente;
    const QB = limiteCabezal(PB);

    function tramo(numeroPuntos, calcular){
        let trayectoria = "";
        for(let i = 0; i <= numeroPuntos; i++){
            const {Pcap, Qcap} = calcular(i / numeroPuntos);
            const punto = convertirASVGCapacidad(Pcap, Qcap);
            trayectoria += (i === 0 ? "M " : " L ")
                + punto.x.toFixed(2) + " " + punto.y.toFixed(2);
        }
        return trayectoria;
    }

    // Dos subpaths separados: no duplicar el arco efectivo A → M → B.
    const estatorSuperior = tramo(200, t => {
        const Qcap = t === 1 ? QA : SmaxCapacidad + (QA - SmaxCapacidad) * t;
        const Pcap = t === 1 ? PA : Math.sqrt(
            Math.max(0, SmaxCapacidad * SmaxCapacidad - Qcap * Qcap)
        );
        return {Pcap, Qcap};
    });
    const estatorInferior = tramo(200, t => {
        const Qcap = t === 1 ? -SmaxCapacidad : QB + (-SmaxCapacidad - QB) * t;
        const Pcap = t === 0 ? PB : Math.sqrt(
            Math.max(0, SmaxCapacidad * SmaxCapacidad - Qcap * Qcap)
        );
        return {Pcap, Qcap};
    });
    document.getElementById("curvaEstatorReferencia")
        .setAttribute("d", estatorSuperior + " " + estatorInferior);

    // Con los parámetros actuales, el rotor sale por el borde inferior.
    // Obtener ese límite del viewBox sin modificarlo ni fijar coordenadas SVG.
    const vista = document.getElementById("graficaCapacidad").viewBox.baseVal;
    const QbordeInferior = (origenYCapacidad - (vista.y + vista.height))
        / escalaQCapacidad;
    const QfinalRotor = Math.max(-desplazamientoQ - radioRotor, QbordeInferior);
    const rotor = tramo(300, t => {
        const Qcap = t === 1 ? QfinalRotor : QA + (QfinalRotor - QA) * t;
        const Pcap = t === 0 ? PA : Math.sqrt(Math.max(0,
            radioRotor * radioRotor - (Qcap + desplazamientoQ) ** 2
        ));
        return {Pcap, Qcap};
    });
    document.getElementById("curvaRotorReferencia").setAttribute("d", rotor);

    // Intersección positiva de la recta verde visual con el estator.
    const coeficienteVisual = 1 + mCabezalVisual * mCabezalVisual;
    const PBVisual = (-Q0CabezalVisual * mCabezalVisual + Math.sqrt(
        coeficienteVisual * SmaxCapacidad * SmaxCapacidad
        - Q0CabezalVisual * Q0CabezalVisual
    )) / coeficienteVisual;
    const QBVisual = limiteCabezalVisual(PBVisual);

    // Continuación desde la intersección visual hasta P = PmaxTurbina.
    const cabezal = tramo(100, t => {
        const Pcap = t === 1 ? PmaxTurbina : PBVisual + (PmaxTurbina - PBVisual) * t;
        return {Pcap, Qcap: t === 0 ? QBVisual : limiteCabezalVisual(Pcap)};
    });
    document.getElementById("curvaCabezalReferencia").setAttribute("d", cabezal);
}


function generarCurvaEstator(){

    const numeroPuntos = 200;

    let trayectoria = "";


    const desplazamientoQ = VCapacidad * VCapacidad / XsCapacidad;
    const radioRotor = VCapacidad * EmaxCapacidad / XsCapacidad;
    const QA = (radioRotor * radioRotor - SmaxCapacidad * SmaxCapacidad
        - desplazamientoQ * desplazamientoQ) / (2 * desplazamientoQ);

    // Intersección positiva del estator con Q = Q0CabezalVisual + mCabezalVisual * P.
    const coeficienteVisual = 1 + mCabezalVisual * mCabezalVisual;
    const PBVisual = (-Q0CabezalVisual * mCabezalVisual + Math.sqrt(
        coeficienteVisual * SmaxCapacidad * SmaxCapacidad - Q0CabezalVisual * Q0CabezalVisual
    )) / coeficienteVisual;
    const QBVisual = limiteCabezalVisual(PBVisual);

    for(let i = 0; i <= numeroPuntos; i++){

        // A → M → B: incluir Q = 0 exactamente en la mitad del recorrido.
        const mitad = numeroPuntos / 2;
        const Qcap = i <= mitad
            ? QA * (1 - i / mitad)
            : QBVisual * ((i - mitad) / mitad);

        const Pcap = i === numeroPuntos ? PBVisual : Math.sqrt(
            Math.max(0, SmaxCapacidad * SmaxCapacidad - Qcap * Qcap)
        );

        const punto =
        convertirASVGCapacidad(
            Pcap,
            Qcap
        );


        if(i === 0){

            trayectoria =
            "M " +
            punto.x.toFixed(2) +
            " " +
            punto.y.toFixed(2);

        }

        else{

            trayectoria +=
            " L " +
            punto.x.toFixed(2) +
            " " +
            punto.y.toFixed(2);

        }

    }


    document
    .getElementById("curvaEstator")
    .setAttribute(
        "d",
        trayectoria
    );

}



/* =========================================================
   CURVA DE CORRIENTE DE CAMPO DEL ROTOR
========================================================= */

function generarCurvaRotor(){

    const numeroPuntos = 300;

    let trayectoria = "";


    const Qcentro =
    -(
        VCapacidad *
        VCapacidad
        /
        XsCapacidad
    );


    const radio =
    VCapacidad *
    EmaxCapacidad /
    XsCapacidad;


    // Intersección A entre las circunferencias de rotor y estator.
    const desplazamientoQ = -Qcentro;
    const QA = (radio * radio - SmaxCapacidad * SmaxCapacidad
        - desplazamientoQ * desplazamientoQ) / (2 * desplazamientoQ);
    const PA = Math.sqrt(SmaxCapacidad * SmaxCapacidad - QA * QA);

    for(let i = 0; i <= numeroPuntos; i++){

        // Solo la rama superior D → A.
        const Pcap = PA * (i / numeroPuntos);
        const Qcap = i === numeroPuntos ? QA : Qcentro + Math.sqrt(
            Math.max(0, radio * radio - Pcap * Pcap)
        );

        const punto =
        convertirASVGCapacidad(
            Pcap,
            Qcap
        );


        if(i === 0){

            trayectoria =
            "M " +
            punto.x.toFixed(2) +
            " " +
            punto.y.toFixed(2);

        }

        else{

            trayectoria +=
            " L " +
            punto.x.toFixed(2) +
            " " +
            punto.y.toFixed(2);

        }

    }


    document
    .getElementById("curvaRotor")
    .setAttribute(
        "d",
        trayectoria
    );

}



/* =========================================================
   GENERAR LÍMITE DE CABEZALES
========================================================= */

function generarCurvaCabezal(){

    const numeroPuntos = 100;

    let trayectoria = "";


    // Intersección positiva de la recta verde visual con el estator.
    const coeficienteVisual = 1 + mCabezalVisual * mCabezalVisual;
    const PBVisual = (-Q0CabezalVisual * mCabezalVisual + Math.sqrt(
        coeficienteVisual * SmaxCapacidad * SmaxCapacidad
        - Q0CabezalVisual * Q0CabezalVisual
    )) / coeficienteVisual;
    const QBVisual = limiteCabezalVisual(PBVisual);

    for(let i = 0; i <= numeroPuntos; i++){

        // Desde P = 0 hasta la intersección visual, sin cerrar la envolvente.
        const Pcap = PBVisual * (i / numeroPuntos);

        const Qcap =
        i === numeroPuntos ? QBVisual : limiteCabezalVisual(Pcap);


        const punto =
        convertirASVGCapacidad(
            Pcap,
            Qcap
        );


        if(i === 0){

            trayectoria =
            "M " +
            punto.x.toFixed(2) +
            " " +
            punto.y.toFixed(2);

        }

        else{

            trayectoria +=
            " L " +
            punto.x.toFixed(2) +
            " " +
            punto.y.toFixed(2);

        }

    }


    document
    .getElementById("curvaCabezal")
    .setAttribute(
        "d",
        trayectoria
    );

}



/* =========================================================
   TEMPORIZADOR
========================================================= */

setInterval(
function(){

    if(!pausado){

        simularPaso();

        actualizarPulsoExcitacion(dt);
        actualizarHaloFlujoExcitacion();
        actualizarFlujoExcitacion(dt);
        actualizarHaloFlujoRetornoExcitacion();
        actualizarFlujoRetornoExcitacion(dt);

    }

},
20
);



/* =========================================================
   INICIALIZACIÓN
========================================================= */

posicionarFlujoExcitacion();
actualizarHaloFlujoExcitacion();
posicionarFlujoRetornoExcitacion();
actualizarHaloFlujoRetornoExcitacion();

actualizarSimboloCarga(0);

actualizarHaloCarga(0);

generarCurvaEstabilidadAngular();

generarLimitesTurbina();

generarCurvasReferencia();

generarCurvaEstator();

generarCurvaRotor();

generarCurvaCabezal();

actualizarPantalla();



/* =========================================================
   ANIMACIÓN DEL ROTOR DEL GENERADOR SÍNCRONO
========================================================= */

function posicionRotor(angulo) {

    const A =
        document.getElementById("geometria-A");

    const B =
        document.getElementById("geometria-B");

    const C =
        document.getElementById("geometria-C");

    const Cinversa =
        document.getElementById("geometria-C-inversa");


    const vistas = [
        "vista-0",
        "vista-45",
        "vista-90",
        "vista-135",
        "vista-180",
        "vista-225",
        "vista-270",
        "vista-315"
    ];


    /* Ocultar geometrías */

    A.style.display = "none";

    B.style.display = "none";

    C.style.display = "none";

    Cinversa.style.display = "none";


    /* Ocultar todas las vistas */

    vistas.forEach(id => {

        document
        .getElementById(id)
        .style.display = "none";

    });



    /* =====================================================
       POSICIONES DEL ROTOR
    ===================================================== */


    // 0°

    if (angulo === 0) {

        A.style.display =
        "inline";

        document
        .getElementById("vista-0")
        .style.display =
        "inline";

    }


    // 45°

    else if (angulo === 45) {

        C.style.display =
        "inline";

        document
        .getElementById("vista-45")
        .style.display =
        "inline";

    }


    // 90°

    else if (angulo === 90) {

        B.style.display =
        "inline";

        document
        .getElementById("vista-90")
        .style.display =
        "inline";

    }


    // 135°

    else if (angulo === 135) {

        Cinversa.style.display =
        "inline";

        document
        .getElementById("vista-135")
        .style.display =
        "inline";

    }


    // 180°

    else if (angulo === 180) {

        A.style.display =
        "inline";

        document
        .getElementById("vista-180")
        .style.display =
        "inline";

    }


    // 225°

    else if (angulo === 225) {

        C.style.display =
        "inline";

        document
        .getElementById("vista-225")
        .style.display =
        "inline";

    }


    // 270°

    else if (angulo === 270) {

        B.style.display =
        "inline";

        document
        .getElementById("vista-270")
        .style.display =
        "inline";

    }


    // 315°

    else if (angulo === 315) {

        Cinversa.style.display =
        "inline";

        document
        .getElementById("vista-315")
        .style.display =
        "inline";

    }

}



/* =========================================================
   SECUENCIA DE GIRO
========================================================= */

const posicionesRotor = [
    0,
    45,
    90,
    135,
    180,
    225,
    270,
    315
];


let indiceRotor = 0;

let animacionRotor = null;



/* =========================================================
   INICIAR ROTOR
========================================================= */

function iniciarRotor() {

    if (animacionRotor !== null) {

        return;

    }


    animacionRotor =
    setInterval(
        function() {

            indiceRotor++;


            if (
                indiceRotor >=
                posicionesRotor.length
            ) {

                indiceRotor = 0;

            }


            posicionRotor(
                posicionesRotor[indiceRotor]
            );

        },

        500
    );

}



/* =========================================================
   PAUSAR ROTOR
========================================================= */

function pausarRotor() {

    clearInterval(
        animacionRotor
    );


    animacionRotor =
    null;

}



/* =========================================================
   REINICIAR ROTOR
========================================================= */

function reiniciarRotor() {

    pausarRotor();


    indiceRotor =
    0;


    posicionRotor(0);

}



/* =========================================================
   ARRANQUE DEL ROTOR

   El SVG del generador está integrado directamente
   dentro del index.html.

   Por lo tanto:

   - no usamos contentDocument
   - no esperamos el evento load del SVG
   - no necesitamos setTimeout para esperar el SVG
========================================================= */

indiceRotor =
0;


posicionRotor(0);


iniciarRotor();