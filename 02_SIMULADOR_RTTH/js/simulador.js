/* =========================================================
   SIMULADOR RV
   VERSIÓN 16
========================================================= */


let V = 1.0;

let Vref = 1.0;

let If = 1.0;

let P = 0.8;

let Qcarga = 0.0;

let Q = 0.0;

let Qobjetivo = 0.0;

let IfManual = 1.0;

let integralError = 0.0;

let error = 0.0;

let Ve = 1.0;

let Vst = 0.0;

// Etapa 3B — estado del transformador de estabilización (x) y
// entrada real del amplificador (Vi = e − Vst).
// integralError es el estado z del integrador: dz/dt = Vi.
let xEst = 1.0;

let Vi = 0.0;

let pausado = false;

// Flujo visual V1: longitud proporcional a If; velocidad fija.
const gruposFlujoDegradadoExcitacion = [
    ["flujoDegradadoExcitacion", "conductorExcitacion", false],
    ["flujoDegradadoRetornoExcitacion", "conductorRetornoExcitacion", true]
].map(([id, conductorId, retorno]) => {
    const PERIOD = 120, MAXLEN = 44;
    const grupo = document.getElementById(id);
    const d = document.getElementById(conductorId).getAttribute("d");
    grupo.style.setProperty("--dir", retorno ? "reverse" : "normal");
    for(let len = MAXLEN; len >= 4; len -= 4){
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        path.setAttribute("stroke-dasharray", len + " " + (PERIOD - len));
        // Misma alineación de cabeza y cola de setFlow() en V1.
        path.style.setProperty("--o", retorno ? "0px" : (len - MAXLEN) + "px");
        grupo.appendChild(path);
    }
    return grupo;
});

function actualizarLongitudFlujoDegradadoExcitacion(){
    const PERIOD = 120, MAXLEN = 60 * If;
    gruposFlujoDegradadoExcitacion.forEach(grupo => {
        const retorno = grupo.style.getPropertyValue("--dir") === "reverse";
        Array.from(grupo.children).forEach((path, indice) => {
            // Escalar las 11 capas originales sin recrearlas ni reiniciar su animación.
            const len = MAXLEN * (11 - indice) / 11;
            path.setAttribute("stroke-dasharray", len + " " + (PERIOD - len));
            path.style.setProperty("--o", retorno ? "0px" : (len - MAXLEN) + "px");
        });
    });
}

function actualizarPausaFlujoDegradadoExcitacion(){
    gruposFlujoDegradadoExcitacion.forEach(grupo => {
        grupo.getAnimations({subtree: true}).forEach(animacion => {
            if(pausado) animacion.pause();
            else animacion.play();
        });
    });
}

function reiniciarFlujoDegradadoExcitacion(){
    actualizarLongitudFlujoDegradadoExcitacion();
    gruposFlujoDegradadoExcitacion.forEach(grupo => {
        grupo.getAnimations({subtree: true}).forEach(animacion => {
            animacion.currentTime = 0;
            animacion.play();
        });
    });
}




const dt = 0.02;

/* ---------------------------------------------------------
   ETAPA 3B — MODELO DIDÁCTICO DEL AVR (variante P, Etapa 3A)
   Generador síncrono conectado a una red de elevada rigidez,
   pero finita. Todas las magnitudes en pu.
--------------------------------------------------------- */

const TQ = 0.35;

// Q = KQI·(If − 1): la excitación modifica principalmente Q.
const KQI = 2.0;

// Reactancia equivalente de la red (rígida, no infinita).
const KL = 0.10;

// KV = KQI·KL  →  Vnatural = 1 + KL·(Q − Qcarga)
const KV = 0.20;

const TV = 0.65;

const KP = 8.0;

const KI = 8.0;

const TEXC = 0.45;

// Transformador de estabilización: Vst = KST·(Ve − x), TST·dx/dt = Ve − x
const KST = 0.20;

const TST = 0.50;

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
const PmaxTurbina = 1.00;

// Extremo visual (en P) de la recta de estabilidad angular y de la
// continuación de la recta de cabezales. Conserva la geometría que
// tenían esas curvas cuando PmaxTurbina valía 1.05; no interviene
// en la validación del punto de operación.
const PextremoCurvasVisual = 1.05;

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

const displayQL =
document.getElementById("displayQL");

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

const textoQGen =
document.getElementById("textoQGen");

// Formato de potencia reactiva en %: evita mostrar "-0.0".
// Solo afecta al texto; no redondea ningún valor interno.
function formatoReactiva(valorPorcentaje){
    const texto = valorPorcentaje.toFixed(1);
    return texto === "-0.0" ? "0.0" : texto;
}

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

        // Etapa 3C: transferencia AUTO → MANUAL sin salto.
        // La consigna manual parte exactamente de la salida del AVR
        // (Ve). El redondeo a % entero solo afecta a la posición
        // visual del deslizador; IfManual conserva el valor exacto.
        sliderIf.value =
        Math.round(Ve * 100);

        IfManual =
        Ve;

    }

    else{

        sliderIf.disabled =
        true;

        // Etapa 3B: el integrador ya sigue a Ve durante MANUAL
        // (ver simularPaso), por lo que no se reinicializa aquí.

    }

    // Etapa 3C (ajuste final): refrescar de inmediato el cuadro de
    // estado y los indicadores, también en PAUSA. Solo actualiza la
    // pantalla; no ejecuta simularPaso() ni modifica variables dinámicas.
    actualizarPantalla();

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

    actualizarPausaFlujoDegradadoExcitacion();



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

    P = 0.8;

    Qcarga = 0.0;

    Q = 0.0;

    Qobjetivo = 0.0;

    IfManual = 1.0;

    integralError = 0.0;

    error = 0.0;

    Ve = 1.0;

    Vst = 0.0;

    xEst = 1.0;

    Vi = 0.0;

    pausado = false;

    reiniciarFlujoDegradadoExcitacion();




    sliderP.value = 80;

    sliderQ.value = 0;

    sliderIf.value = 100;

    sliderVref.value = 100;


    modo.value = "auto";


    sliderIf.disabled = true;


    valorP.textContent = "80";

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



    /* ---------------------------------------------------------
       ETAPA 3B — POTENCIA REACTIVA GENERADA
       Q = KQI·(If − 1)   (pu; se presenta en %)
    --------------------------------------------------------- */

    Q = KQI * (If - 1);

    // Red rígida pero finita: Vnatural = 1 + KL·(Q − Qcarga)
    const Vnatural = 1 + KV * (If - 1) - KL * Qcarga;


    /* ---------------------------------------------------------
       DINÁMICA DE LA TENSIÓN TERMINAL
       TV·dV/dt = Vnatural − V
    --------------------------------------------------------- */

    V +=
    ((Vnatural - V) / TV) * dt;



    /* ---------------------------------------------------------
       COMPARADOR — ERROR REAL DE TENSIÓN
       e = Vref − V   (sin compensaciones ocultas)
    --------------------------------------------------------- */

    error =
    Vref - V;



    if(modo.value === "auto"){

        /* -----------------------------------------------------
           AMPLIFICADOR + TRANSFORMADOR DE ESTABILIZACIÓN

           Vi  = e − Vst
           Ve  = 1 + KP·Vi + KI·z
           Vst = KST·(Ve − x)

           Lazo algebraico Ve → Vst → Vi → Ve resuelto
           dentro del paso (sin usar Ve del paso anterior):

           u = [1 + KP·(e + KST·x) + KI·z] / (1 + KP·KST)
        ----------------------------------------------------- */

        const g = 1 + KP * KST;

        const u =
        (1 + KP * (error + KST * xEst) + KI * integralError) / g;

        Ve =
        limitar(
            u,
            VE_MIN,
            VE_MAX
        );

        const saturado = Math.abs(Ve - u) > 1e-12;

        Vst = KST * (Ve - xEst);

        Vi = error - Vst;


        /* -----------------------------------------------------
           ANTI-WINDUP — INTEGRACIÓN CONDICIONAL
           No se integra si Ve está saturado y Vi empuja en el
           sentido de la saturación; sí se integra para salir.
        ----------------------------------------------------- */

        const empujaSaturacion =
        saturado &&
        ((u > Ve && Vi > 0) || (u < Ve && Vi < 0));

        if(!empujaSaturacion){

            integralError +=
            Vi * dt;

        }

    }

    else{

        /* -----------------------------------------------------
           EXCITACIÓN MANUAL
           Ve = IfManual; el integrador sigue a la salida para
           que el regreso a AUTO no produzca salto en Ve.
        ----------------------------------------------------- */

        Ve =
        IfManual;

        Vst = KST * (Ve - xEst);

        Vi = error - Vst;

        integralError =
        (Ve - 1 - KP * Vi) / KI;

    }


    // TST·dx/dt = Ve − x   (se actualiza después de calcular Ve)
    xEst +=
    ((Ve - xEst) / TST) * dt;



    /* ---------------------------------------------------------
       DINÁMICA DE LA EXCITATRIZ
       TEXC·dIf/dt = Ve − If
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
    Q = KQI * (If - 1);


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

    // Panel CARGA (J-1): la carga se representa con la demanda reactiva
    // efectivamente aplicada (Qcarga), no con la Q generada.
    const qCargaPorcentaje =
    Qcarga * 100;

    actualizarHaloCarga(qPorcentaje);
    actualizarSimboloCarga(Math.abs(Qcarga) < 0.001 ? 0 : qCargaPorcentaje);


    const pPorcentaje =
    P * 100;


    // Entrada real del amplificador, calculada en simularPaso().
    const vi =
    Vi;



    displayV.textContent =
    V.toFixed(3);


    displayIf.textContent =
    If.toFixed(3);


    displayP.textContent =
    pPorcentaje.toFixed(1);


    displayQ.textContent =
    formatoReactiva(qPorcentaje);


    // Potencia reactiva demandada aplicada: QL = Qcarga·100
    displayQL.textContent =
    formatoReactiva(qCargaPorcentaje);



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
    "PL = " +
    pPorcentaje.toFixed(1) +
    " %";


    textoQCarga.textContent =
    "QL = " +
    formatoReactiva(qCargaPorcentaje) +
    " %";


    textoQGen.textContent =
    "QG = " +
    formatoReactiva(qPorcentaje) +
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

    // Límites de capacidad existentes (estator, rotor, cabezales y
    // estabilidad angular), sin cambios.
    const fueraCurvaCapacidad =
    !estaDentroCurvaCapacidad(
        P,
        Q
    );

    // Límites de potencia de la turbina: Pmin <= P <= Pmax.
    const fueraLimiteTurbina =
    P < PminTurbina || P > PmaxTurbina;

    // Fuera de límites si incumple cualquiera de las condiciones (OR).
    const operacionPermitida =
    !(fueraCurvaCapacidad || fueraLimiteTurbina);


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

    // Etapa 3C: la condición se evalúa respecto a Vref
    // (e = Vref − V, tolerancia 0.003 pu). Describe la condición
    // de la tensión, no el movimiento instantáneo de la excitatriz.
    const eEstado =
    Vref - V;

    if(modo.value === "manual"){

        estado.textContent =
        "CONTROL MANUAL — AVR DESACTIVADO";

        estado.style.background =
        "#dae8fc";

        estado.style.borderColor =
        "#6c8ebf";

    }

    else if(Math.abs(eEstado) < 0.003){

        estado.textContent =
        "TENSIÓN REGULADA";

        estado.style.background =
        "#d5e8d4";

        estado.style.borderColor =
        "#6a9a68";

    }

    else if(eEstado >= 0.003){

        estado.textContent =
        "TENSIÓN BAJA — AVR SOLICITA MÁS EXCITACIÓN";

        estado.style.background =
        "#fff2cc";

        estado.style.borderColor =
        "#c9a227";

    }

    else{

        estado.textContent =
        "TENSIÓN ALTA — AVR SOLICITA MENOS EXCITACIÓN";

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
        PextremoCurvasVisual, limiteEstabilidadAngular(PextremoCurvasVisual)
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

    // Continuación desde la intersección visual hasta P = PextremoCurvasVisual.
    const cabezal = tramo(100, t => {
        const Pcap = t === 1 ? PextremoCurvasVisual : PBVisual + (PextremoCurvasVisual - PBVisual) * t;
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
        actualizarLongitudFlujoDegradadoExcitacion();


    }

},
20
);



/* =========================================================
   INICIALIZACIÓN
========================================================= */


actualizarLongitudFlujoDegradadoExcitacion();

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
   ANIMACIÓN DEL ROTOR DEL GENERADOR SÍNCRONO — V16
   ANIMACIÓN CONTINUA · DOS TIPOS DE ROTOR

   Sustituye a la secuencia anterior de 8 posiciones
   (posicionRotor + setInterval de 500 ms).

   · Un solo ángulo, un solo bucle (requestAnimationFrame):
         θ(t) = θ0 + ω·(t − t0),   ω = 360° / 4 s = 90 °/s
   · Dos representaciones del rotor, que comparten el ángulo:
         RotorSalientes  (grupo SVG "rotor-salientes")
         RotorCilindrico (grupo SVG "rotor-cilindrico")
     Solo se dibuja el rotor activo.
   · Funciones públicas sin cambios de nombre ni de uso:
         iniciarRotor(), pausarRotor(), reiniciarRotor()
     (las utilizan PAUSA y REINICIAR).
   · El rotor es exclusivamente gráfico: no interviene en el
     modelo eléctrico, la excitación ni la curva de capacidad.

   Convención angular (ambos rotores): el polo S está en
   ψ = θ, medido desde arriba hacia el observador.
   Altura en la vista: y = 380 − R·cos ψ (coordenadas del
   rotor, antes de translate(-100,-55)).
========================================================= */

const SVG_NS_ROTOR = "http://www.w3.org/2000/svg";


function crearElementoRotor(padre, etiqueta, atributos) {

    const e = document.createElementNS(SVG_NS_ROTOR, etiqueta);

    for (const [k, v] of Object.entries(atributos)) {

        e.setAttribute(k, v);

    }

    padre.appendChild(e);

    return e;

}


function letraPoloRotor(padre, polo, y, tam, opacidad) {

    const verde = polo === "S";

    const t = crearElementoRotor(padre, "text", {
        "x": 700,
        "y": y.toFixed(1),
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        "font-family": "Arial, Helvetica, sans-serif",
        "font-size": tam.toFixed(1),
        "font-weight": 700,
        "fill": verde ? "#2e8b3c" : "#d62828",
        "stroke": verde ? "#163d1d" : "#671414",
        "stroke-width": 0.8,
        "opacity": opacidad.toFixed(2)
    });

    t.textContent = polo;

}


/* =========================================================
   ROTOR DE DOS POLOS SALIENTES — PROYECCIÓN CONTINUA

   Sección transversal del rotor (radio 177) extruida a lo
   largo del eje y proyectada ortogonalmente:
       u = eje polar (hacia S), v = perpendicular
       Y = u·cos θ − v·sen θ   (y = 380 − Y)
       Z = u·sen θ + v·cos θ   (profundidad hacia el observador)
   Para cada altura (paso 0.25) se dibuja la superficie más
   cercana al observador: zapatas, núcleo o conductores del
   devanado de campo (20 conductores r = 9).
========================================================= */

const RotorSalientes = (() => {

    const EJE = 380;

    const PASO = 0.25;

    const PUNTA = 146;                    // esquina de la zapata a radio ≤ 177

    function cuadratica(p0, c, p1, n) {

        const pts = [];

        for (let i = 1; i < n; i++) {

            const t = i / n;

            pts.push([
                (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0],
                (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]
            ]);

        }

        return pts;

    }

    const ZAPATA_S = [
        [-65, 100], [-100, 123], [-100, PUNTA],
        ...cuadratica([-100, PUNTA], [0, 2 * 177 - PUNTA], [100, PUNTA], 16),
        [100, PUNTA], [100, 123], [65, 100]
    ];

    const PRIMITIVAS = [
        { id: "S", tipo: "zapata", pts: ZAPATA_S },
        { id: "N", tipo: "zapata", pts: ZAPATA_S.map(([v, u]) => [v, -u]) },
        { id: "nucleo", tipo: "nucleo", pts: [[-65, -118], [65, -118], [65, 118], [-65, 118]] }
    ];

    const CONDUCTORES = [74, -74].flatMap(v =>
        Array.from({ length: 10 }, (_, k) => ({ id: "c" + (v > 0 ? "a" : "b") + k, v: v, u: -85.5 + 19 * k, r: 9 }))
    );

    function bandasVisibles(theta) {

        const c = Math.cos(theta * Math.PI / 180);

        const s = Math.sin(theta * Math.PI / 180);

        const rot = ([v, u]) => [u * c - v * s, u * s + v * c];

        const polis = PRIMITIVAS.map(p => ({ ...p, q: p.pts.map(rot) }));

        const circ = CONDUCTORES.map(k => {

            const [Y, Z] = rot([k.v, k.u]);

            return { ...k, Y: Y, Z: Z };

        });

        const bandas = [];

        for (let y = 200; y <= 560 + 1e-9; y += PASO) {

            const Y = EJE - y;

            let zMax = -Infinity;

            let frente = null;

            for (const p of polis) {

                const q = p.q;

                for (let i = 0; i < q.length; i++) {

                    const [y1, z1] = q[i];

                    const [y2, z2] = q[(i + 1) % q.length];

                    if ((y1 - Y) * (y2 - Y) <= 0 && y1 !== y2) {

                        const z = z1 + (Y - y1) * (z2 - z1) / (y2 - y1);

                        if (z > zMax) {

                            zMax = z;

                            frente = p;

                        }

                    }

                }

            }

            for (const k of circ) {

                const d = Y - k.Y;

                if (Math.abs(d) <= k.r) {

                    const z = k.Z + Math.sqrt(k.r * k.r - d * d);

                    if (z > zMax) {

                        zMax = z;

                        frente = { id: k.id, tipo: "cobre" };

                    }

                }

            }

            const ultima = bandas[bandas.length - 1];

            if (ultima && frente && ultima.id === frente.id && Math.abs(ultima.y1 - y) < 1e-6) {

                ultima.y1 = y + PASO;

            }

            else if (frente) {

                bandas.push({ id: frente.id, tipo: frente.tipo, y0: y, y1: y + PASO });

            }

        }

        /* Recortar a la silueta física (radio 177 → y 203…557) */
        for (const b of bandas) {

            b.y0 = Math.max(EJE - 177, b.y0);

            b.y1 = Math.min(EJE + 177, b.y1);

        }

        return bandas.filter(b => b.y1 > b.y0);

    }

    function banda(padre, x, w, b, estilo) {

        const h = b.y1 - b.y0;

        const atributos = {
            x: x,
            y: b.y0.toFixed(2),
            width: w,
            height: h.toFixed(2),
            fill: estilo.fill,
            stroke: estilo.stroke,
            "stroke-width": Math.min(estilo.trazo, h).toFixed(2)
        };

        if (estilo.rx) {

            atributos.rx = Math.min(estilo.rx, h / 2).toFixed(2);

        }

        crearElementoRotor(padre, "rect", atributos);

    }

    const HIERRO = { fill: "url(#hierroGrad)", stroke: "#50575c", trazo: 3 };

    const COBRE = { fill: "url(#cobreGrad)", stroke: "#77300f", trazo: 1.4, rx: 3 };

    function dibujar(theta) {

        const gHierro = document.getElementById("salientes-hierro");

        const gCobre = document.getElementById("salientes-cobre");

        const gPolos = document.getElementById("salientes-polos");

        gHierro.replaceChildren();

        gCobre.replaceChildren();

        gPolos.replaceChildren();

        const bandas = bandasVisibles(theta);

        for (const b of bandas) {

            if (b.tipo === "zapata") {

                banda(gHierro, 430, 540, b, HIERRO);

            }

            else if (b.tipo === "nucleo") {

                banda(gHierro, 450, 500, b, HIERRO);

            }

            else {

                banda(gCobre, 430, 540, b, COBRE);

            }

        }

        /* N / S en la banda visible más alta de cada zapata */
        const nominal = 34 + 8 * Math.abs(Math.cos(2 * theta * Math.PI / 180));

        for (const polo of ["S", "N"]) {

            const propias = bandas.filter(b => b.id === polo);

            if (!propias.length) {

                continue;

            }

            const mayor = propias.reduce((a, b) => (b.y1 - b.y0 > a.y1 - a.y0 ? b : a));

            const h = mayor.y1 - mayor.y0;

            const tam = Math.min(nominal, 0.6 * h);

            if (tam >= 1) {

                letraPoloRotor(gPolos, polo, (mayor.y0 + mayor.y1) / 2, tam, Math.min(1, h / 40));

            }

        }

    }

    return { dibujar: dibujar, grupo: "rotor-salientes" };

})();


/* =========================================================
   ROTOR CILÍNDRICO DE DOS POLOS — PROYECCIÓN CONTINUA

   20 ranuras axiales (±36° … ±144°, paso 12°, ancho 21).
   Cada ranura (β ± 3.4°) se recorta a la cara visible
   0° ≤ ψ ≤ 180° y se proyectan sus dos bordes: entra y sale
   de la silueta sin saltos. El devanado ocupa el 70 %
   central de la ranura. Zonas polares lisas ±32.6°.
========================================================= */

const RotorCilindrico = (() => {

    const EJE = 380;

    const RADIO = 177;

    const X_RANURA = 430 + 28;

    const W_RANURA = 540 - 2 * 28;

    const MEDIO_RANURA = (21 / 2) / 177 * 180 / Math.PI;

    const MEDIO_ZONA_POLAR = 36 - MEDIO_RANURA;

    const RANURAS = [36, 48, 60, 72, 84, 96, 108, 120, 132, 144].flatMap(b => [b, -b]);

    function proyectarIntervalo(c, medio) {

        const cc = ((c % 360) + 360) % 360;

        const y = g => EJE - RADIO * Math.cos(g * Math.PI / 180);

        for (const k of [0, -360, 360]) {

            const a = Math.max(0, cc + k - medio);

            const b = Math.min(180, cc + k + medio);

            if (b > a) {

                return [y(a), y(b)];

            }

        }

        return null;

    }

    function franja(padre, y0, y1, x, w) {

        const h = y1 - y0;

        crearElementoRotor(padre, "rect", {
            x: x,
            y: y0.toFixed(2),
            width: w,
            height: h.toFixed(2),
            rx: Math.min(1, h / 2).toFixed(2),
            "stroke-width": Math.min(1, h).toFixed(2)
        });

    }

    function dibujar(theta) {

        const gRanuras = document.getElementById("ranuras-cilindrico");

        const gCobre = document.getElementById("devanado-cilindrico");

        const gPolos = document.getElementById("polos-cilindrico");

        gRanuras.replaceChildren();

        gCobre.replaceChildren();

        gPolos.replaceChildren();

        for (const b of RANURAS) {

            const r = proyectarIntervalo(theta + b, MEDIO_RANURA);

            if (!r) {

                continue;

            }

            franja(gRanuras, r[0], r[1], X_RANURA, W_RANURA);

            const c = proyectarIntervalo(theta + b, 0.70 * MEDIO_RANURA);

            if (c) {

                franja(gCobre, c[0], c[1], X_RANURA + 6, W_RANURA - 12);

            }

        }

        const nominal = 34 + 8 * Math.abs(Math.cos(2 * theta * Math.PI / 180));

        for (const [polo, centro] of [["S", theta], ["N", theta + 180]]) {

            const z = proyectarIntervalo(centro, MEDIO_ZONA_POLAR);

            if (!z) {

                continue;

            }

            const h = z[1] - z[0];

            const tam = Math.min(nominal, 1.04 * h);

            if (tam >= 1) {

                letraPoloRotor(gPolos, polo, (z[0] + z[1]) / 2, tam, Math.min(1, h / 27));

            }

        }

    }

    return { dibujar: dibujar, grupo: "rotor-cilindrico" };

})();


/* =========================================================
   CONTROLADOR COMÚN DEL ROTOR

   Un único estado angular y un único requestAnimationFrame
   para los dos tipos de rotor.
========================================================= */

const ROTORES = {
    salientes: RotorSalientes,
    cilindrico: RotorCilindrico
};

const PERIODO_VUELTA_ROTOR_MS = 4000;

const OMEGA_ROTOR_GRADOS_MS = 360 / PERIODO_VUELTA_ROTOR_MS;     // 0.09 °/ms

/* Separación máxima entre cuadros que se considera giro continuo.
   Si es mayor (pestaña oculta, equipo suspendido…), el giro se
   reanuda desde el último ángulo dibujado, sin saltos. */
const SALTO_MAXIMO_ROTOR_MS = 250;

let rotorActivo = "salientes";

let anguloRotor = 0;

let rotorEnMarcha = false;

let t0Rotor = 0;

let theta0Rotor = 0;

let tUltimoCuadroRotor = 0;

let idCuadroRotor = null;


function dibujarRotorActivo() {

    ROTORES[rotorActivo].dibujar(anguloRotor);

}


function mostrarAnguloRotor(angulo) {

    anguloRotor = ((angulo % 360) + 360) % 360;

    dibujarRotorActivo();

}


function anguloRotorEn(t) {

    return theta0Rotor + OMEGA_ROTOR_GRADOS_MS * Math.max(0, t - t0Rotor);

}


function reanclarRotor(t) {

    theta0Rotor = anguloRotor;

    t0Rotor = t;

    tUltimoCuadroRotor = t;

}


function cuadroRotor(t) {

    if (!rotorEnMarcha) {

        return;

    }

    if (t - tUltimoCuadroRotor > SALTO_MAXIMO_ROTOR_MS) {

        reanclarRotor(t);

    }

    tUltimoCuadroRotor = t;

    mostrarAnguloRotor(anguloRotorEn(t));

    idCuadroRotor = requestAnimationFrame(cuadroRotor);

}


/* =========================================================
   INICIAR ROTOR
========================================================= */

function iniciarRotor() {

    if (rotorEnMarcha) {

        return;

    }

    rotorEnMarcha = true;

    reanclarRotor(performance.now());

    idCuadroRotor = requestAnimationFrame(cuadroRotor);

}


/* =========================================================
   PAUSAR ROTOR — conserva el ángulo exacto
========================================================= */

function pausarRotor() {

    if (!rotorEnMarcha) {

        return;

    }

    mostrarAnguloRotor(anguloRotorEn(performance.now()));

    rotorEnMarcha = false;

    cancelAnimationFrame(idCuadroRotor);

    idCuadroRotor = null;

}


/* =========================================================
   REINICIAR ROTOR — 0° (el llamador decide si arranca)
========================================================= */

function reiniciarRotor() {

    pausarRotor();

    mostrarAnguloRotor(0);

}


/* =========================================================
   TIPO DE ROTOR (preparado para la Etapa B; sin selector
   visible todavía). Cambio exclusivamente gráfico: conserva
   ángulo, velocidad y estado de pausa.
========================================================= */

function seleccionarRotor(tipo) {

    if (!ROTORES[tipo]) {

        return;

    }

    rotorActivo = tipo;

    for (const [nombre, rotor] of Object.entries(ROTORES)) {

        const g = document.getElementById(rotor.grupo);

        if (nombre === tipo) {

            g.removeAttribute("display");

        }

        else {

            g.setAttribute("display", "none");

        }

    }

    dibujarRotorActivo();

}


/* =========================================================
   PESTAÑA OCULTA

   Al volver a la pestaña, el giro continúa desde el último
   ángulo dibujado (sin saltar el tiempo transcurrido).
========================================================= */

document.addEventListener("visibilitychange", () => {

    if (!document.hidden && rotorEnMarcha) {

        reanclarRotor(performance.now());

    }

});


/* =========================================================
   ARRANQUE DEL ROTOR

   El SVG del generador está integrado directamente dentro
   del index.html. Rotor inicial: polos salientes, 0°,
   girando (igual que la versión anterior).
========================================================= */

seleccionarRotor("salientes");

mostrarAnguloRotor(0);

iniciarRotor();


/* =========================================================
   SELECTOR DE TIPO DE ROTOR (ETAPA B)

   · Conecta los botones de opción con seleccionarRotor().
     El cambio es exclusivamente gráfico e inmediato:
     conserva ángulo, velocidad, sentido y estado de PAUSA.
   · REINICIAR no modifica la selección.
   · Posición: centro del espacio libre bajo el bloque
     GENERADOR SÍNCRONO, entre TRANSFORMADOR DE
     ESTABILIZACIÓN (x ≤ 597) y DETECTOR DE TENSIÓN
     (x ≥ 808), entre el bloque (y = 330) y la línea de
     retroalimentación (y = 545), en unidades del diagrama.
     Si el diagrama se muestra más pequeño que a 1400 px de
     ventana, el recuadro se reduce en la misma proporción.
========================================================= */

const selectorRotor =
    document.getElementById("selectorRotor");

const radiosRotor =
    selectorRotor.querySelectorAll('input[name="tipoRotor"]');

/* Centro superior del recuadro, en unidades del diagrama */
const ANCLA_SELECTOR_ROTOR = { x: 702.5, y: 350 };

/* Escala del diagrama (px por unidad) con ventana de 1400 px */
const ESCALA_REFERENCIA_SELECTOR_ROTOR = 0.723;


radiosRotor.forEach(radio => {

    /* Estado inicial coherente con el rotor activo
       (evita que el navegador restaure otra selección) */
    radio.checked = radio.value === rotorActivo;

    radio.addEventListener("change", () => {

        if (radio.checked) {

            seleccionarRotor(radio.value);

        }

    });

});


function posicionarSelectorRotor() {

    const svg = document.querySelector(".escena > svg");

    const escena = selectorRotor.parentElement;

    const m = svg.getScreenCTM();

    if (!m) {

        return;

    }

    const punto = svg.createSVGPoint();

    punto.x = ANCLA_SELECTOR_ROTOR.x;

    punto.y = ANCLA_SELECTOR_ROTOR.y;

    const p = punto.matrixTransform(m);

    const marco = escena.getBoundingClientRect();

    const escala = Math.min(1, m.a / ESCALA_REFERENCIA_SELECTOR_ROTOR);

    selectorRotor.style.left =
        (p.x - marco.left - escena.clientLeft) + "px";

    selectorRotor.style.top =
        (p.y - marco.top - escena.clientTop) + "px";

    selectorRotor.style.transform =
        "translateX(-50%) scale(" + escala.toFixed(4) + ")";

}


new ResizeObserver(posicionarSelectorRotor)
    .observe(document.querySelector(".escena > svg"));

window.addEventListener("resize", posicionarSelectorRotor);

posicionarSelectorRotor();
