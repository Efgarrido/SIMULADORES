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

/* Etapa F4-B1 — acoplamiento físico AVR – generador – red.
   V   : tensión terminal FÍSICA (solución algebraica máquina + red).
   Q   : potencia reactiva generada QG (misma solución).
   Vm  : tensión MEDIDA por el transductor (TV·dVm/dt = V − Vm); es la
         que usa el comparador: e = Vref − Vm.
   rotorModelo       : rotor cuyas ecuaciones se resuelven ("liso" |
                       "salientes"); los dos selectores lo comparten.
   estadoElectrico   : resultado de la última llamada a resolverMaquinaRed().
   ultimoEstadoValido: última solución CONVERGIDA y ADMISIBLE; es el
                       estado representado por indicadores, curva y
                       diagrama fasorial (identificado como retenido si
                       la última llamada no tuvo solución). */
let Vm = 1.0;

let rotorModelo = "salientes";

let estadoElectrico = null;

let ultimoEstadoValido = null;

// Flujo visual V1: longitud proporcional a If; velocidad fija.
const gruposFlujoDegradadoExcitacion = [
    ["flujoDegradadoExcitacion", "conductorExcitacion", false],
    ["flujoDegradadoRetornoExcitacion", "trayectoriaFlujoRetornoExcitacion", true]
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

// Modelo lineal anterior (hasta F3): Q = KQI·(If − 1),
// Vnatural = 1 + KV·(If − 1) − KL·Qcarga. Desde F4-B1 YA NO SE USA:
// V y QG salen de resolverMaquinaRed(). Se conserva solo como
// referencia documental (KL coincide con Xe = 0.10 pu de la red).
const KQI = 2.0;

const KL = 0.10;

const KV = 0.20;

// F4-B1: constante de tiempo del TRANSDUCTOR de tensión
// (TV·dVm/dt = V − Vm). Antes era la dinámica de V.
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

// F4-E2 — Límite DIDÁCTICO de calentamiento de cabezales (solo rotor
// cilíndrico, curva nominal Vnom = 1.000 pu). Alternativa P2 de F4-E1:
//     Q_cab(P) = a + b·P + c·P² = Q_J + c·(P − P_J)² ,  P ∈ [0, P_J]
//     (permitido: Q ≥ Q_cab)
// Coeficientes obtenidos de tres condiciones geométricas, sin redondeos:
//   1. Q_cab(0) = −0.7312 (ordenada conservada);
//   2. Q_cab(P_J) = Q_J: unión con el estator a FP 0.95 adelantado
//      (P_J² + Q_J² = 1);
//   3. dQ_cab/dP = 0 en P_J (vértice en J: curva monótona).
// La transición T con la estabilidad NO es una constante: resulta de la
// intersección de esta curva con el límite de estabilidad calculado.
// Ajuste empírico con fines didácticos; no procede de datos de un fabricante.
const Q0CabezalVisual = -0.7312;                                       // Q_cab(0)

const CABEZAL_J = Object.freeze({ P: 0.95, Q: -Math.sqrt(1 - 0.95 * 0.95) });

const CABEZAL_COEF = (() => {
    const a = Q0CabezalVisual;
    const { P: PJ, Q: QJ } = CABEZAL_J;
    const c = (a - QJ) / (PJ * PJ);
    return Object.freeze({ a, b: -2 * c * PJ, c });
})();

// Pendiente de la recta anterior (Q = −0.7312 + 0.50·P). Desde F4-D10 ya no se usa.
const mCabezalVisual = 0.50;

// Límites didácticos adoptados para esta turbina; no son valores universales.
const PminTurbina = 0.10;
const PmaxTurbina = 1.00;

// Extremo visual (en P) de la recta de estabilidad angular y de la
// continuación de la recta de cabezales. Conserva la geometría que
// tenían esas curvas cuando PmaxTurbina valía 1.05; no interviene
// en la validación del punto de operación.
const PextremoCurvasVisual = 1.05;

// Ángulo de la recta de estabilidad anterior (70°). Desde F4-C ya no se
// usa: el límite de estabilidad se calcula con la característica P–δ.
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

    // F4-B1: PG (= PL) cambia la solución algebraica de inmediato,
    // también en PAUSA (no avanza el tiempo: If, Vm, x y z no cambian).
    resolverEstadoElectrico();

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

    Vm = 1.0;

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

    // F4-B1: punto nominal (PG = 0.8, QL = 0, If = 1 ⇒ V = 1, QG = 0)
    // con el rotor seleccionado; se descarta el estado retenido.
    ultimoEstadoValido = null;

    // F4-C3: sin estado permitido retenido hasta evaluar el nominal.
    ultimoEstadoPermitido = null;

    resolverEstadoElectrico();

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
       COMPARADOR — ERROR DE TENSIÓN (F4-B1)
       e = Vref − Vm   (Vm: salida del transductor, paso anterior)
       El AVR ya no actúa sobre V directamente: la mide con
       retardo TV. Vi = e − Vst se calcula más abajo, sin cambios.
    --------------------------------------------------------- */

    error =
    Vref - Vm;



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



    /* ---------------------------------------------------------
       F4-B1 — GENERADOR + RED (solución algebraica)
       Ef = kf·If  →  resolverMaquinaRed()  →  V, QG, Ia, δ …
       Solo si hay solución estacionaria admisible se actualizan
       V y Q; si no, se retienen los del último estado válido.
    --------------------------------------------------------- */

    resolverEstadoElectrico();


    /* ---------------------------------------------------------
       TRANSDUCTOR DE TENSIÓN   TV·dVm/dt = V − Vm
       Sin solución estacionaria no hay V que medir: la medición
       se RETIENE (el AVR sigue operando con ese valor y la
       pantalla lo indica).
    --------------------------------------------------------- */

    if(estadoElectricoVigente()){

        Vm +=
        ((V - Vm) / TV) * dt;

    }


    actualizarPantalla();

}



/* =========================================================
   FACTOR DE POTENCIA
========================================================= */

function calcularFP(Pg = P, Qg = Q){

    const S =
    Math.sqrt(
        Pg * Pg +
        Qg * Qg
    );

    if(S === 0){

        return 1;

    }

    return Pg / S;

}



/* =========================================================
   LÍMITE DE CALENTAMIENTO DE CABEZALES
========================================================= */

/* F4-D10/F4-E2: ÚNICA función de la frontera de cabezales; la usan el
   trazado (actualizarCurvaCapacidad), la evaluación (evaluarLimitesPQ) y,
   a través de ella, las advertencias y la frontera efectiva. */
function limiteCabezalVisual(Pcap){
    return CABEZAL_COEF.a + CABEZAL_COEF.b * Pcap + CABEZAL_COEF.c * Pcap * Pcap;
}

/* Dominio de aplicación: 0 ≤ P ≤ P_J. Más allá de J la curva no se
   prolonga (allí domina el estator). */
function cabezalAplica(Pcap){
    return Pcap >= 0 && Pcap <= CABEZAL_J.P;
}

function limiteCabezal(Pcap){

    return Q0Cabezal + mCabezal * Pcap;

}



/* =========================================================
   VERIFICACIÓN DE LA CURVA DE CAPACIDAD
   F4-C: estaDentroCurvaCapacidad() y evaluarLimitesPQ() están en el
   módulo "CURVA DE CAPACIDAD Y EVALUACIÓN OPERATIVA ÚNICA".
========================================================= */



/* =========================================================
   PANTALLA
========================================================= */

function actualizarPantalla(){


    /* F4-B1: estado REPRESENTADO = última solución válida del modelo
       integrado (PG, QG, V). Si la última llamada no tuvo solución,
       se muestra ese estado retenido (identificado en el recuadro de
       estado) y no se mezcla con la PG pedida aún no resuelta. */
    const PGr =
    ultimoEstadoValido ? ultimoEstadoValido.PG : P;

    const fp =
    calcularFP(PGr, Q);


    const qPorcentaje =
    Q * 100;

    // Panel CARGA (J-1): la carga se representa con la demanda reactiva
    // efectivamente aplicada (Qcarga), no con la Q generada.
    const qCargaPorcentaje =
    Qcarga * 100;

    actualizarHaloCarga(qPorcentaje);
    actualizarSimboloCarga(Math.abs(Qcarga) < 0.001 ? 0 : qCargaPorcentaje);


    const pPorcentaje =
    PGr * 100;


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
        PGr,
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

    // F4-C: la curva se traza para el rotor y la V del estado
    // representado; el color del punto, la leyenda única del AVR y la
    // retención del diagrama fasorial salen de UNA sola evaluación
    // (evaluarOperacion, dentro de actualizarAdvertencias).
    actualizarCurvaCapacidad();

    actualizarAdvertencias();



    /* =====================================================
       ESTADO DEL AVR
    ===================================================== */

    // Etapa 3C: la condición se evalúa respecto a Vref
    // (e = Vref − Vm desde F4-B1, tolerancia 0.003 pu). Describe la condición
    // de la tensión, no el movimiento instantáneo de la excitatriz.
    // F4-B1: se evalúa con la tensión MEDIDA (la que ve el
    // comparador), igual que el error e mostrado en el diagrama.
    const eEstado =
    Vref - Vm;

    if(estadoElectrico && !estadoElectricoVigente()){

        // F4-B1: sin solución estacionaria. No se afirma ninguna
        // pérdida de sincronismo: solo que las ecuaciones de régimen
        // permanente no tienen solución con los valores actuales.
        // (En AUTO el AVR sigue actuando con la medición Vm retenida.)
        estado.textContent =
        "SIN SOLUCIÓN ESTACIONARIA — ÚLTIMO ESTADO VÁLIDO RETENIDO";

        estado.style.background =
        "#f4cccc";

        estado.style.borderColor =
        "#b85450";

    }

    else if(modo.value === "manual"){

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


    // Diagrama fasorial: representa los fasores de la solución integrada (F4-B1).
    actualizarDiagramaFasorial();

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
   LÍMITES DE LA TURBINA (verticales, sin cambios)
   F4-C: estator, excitación, cabezales y estabilidad se trazan en
   actualizarCurvaCapacidad() con el rotor y la V del modelo.
========================================================= */

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

generarLimitesTurbina();

// F4-C: las demás fronteras se trazan con actualizarCurvaCapacidad().

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

    // Corte transversal: mismo ángulo, mismo ciclo de animación.
    actualizarRotorCorte(anguloRotor);

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



/* =========================================================
   SELECTOR DE VISTA — AVR / DIAGRAMA FASORIAL
   Cambio exclusivamente visual: solo alterna una clase CSS.
   No reinicia la simulación, no toca variables del modelo,
   ni el modo AUTO/MANUAL, el rotor, su ángulo o la PAUSA, y
   no crea ciclos de animación adicionales.
========================================================= */

const contenedorPrincipal =
    document.querySelector(".contenedor");

function seleccionarVista(vista) {

    if (vista === "fasorial" &&
        !contenedorPrincipal.classList.contains("modo-fasorial")) {

        // Altura actual de la vista AVR, para conservarla.
        contenedorPrincipal.style.setProperty(
            "--altura-vista-avr",
            contenedorPrincipal.getBoundingClientRect().height + "px"
        );

    }

    contenedorPrincipal.classList.toggle(
        "modo-fasorial",
        vista === "fasorial"
    );

    if (vista === "avr") {

        // El diagrama vuelve a tener tamaño: recolocar el selector
        // de rotor sobre su ancla.
        posicionarSelectorRotor();

    }

}

document
    .querySelectorAll('input[name="vistaSimulador"]')
    .forEach(radio => {

        radio.addEventListener("change", () => {

            if (radio.checked) {

                seleccionarVista(radio.value);

            }

        });

    });

seleccionarVista(
    document.querySelector('input[name="vistaSimulador"]:checked').value
);



/* =========================================================
   CORTE TRANSVERSAL — SELECTOR DE ROTOR
   Exclusivamente gráfico e independiente del selector de
   rotor de la vista AVR: solo muestra la imagen elegida.
   Sin rotación por ahora.
========================================================= */

const marcosCorte = {
    salientes: document.getElementById("marcoCorteSalientes"),
    liso: document.getElementById("marcoCorteLiso")
};

function seleccionarRotorCorte(tipo) {

    for (const [nombre, marco] of Object.entries(marcosCorte)) {

        marco.hidden = nombre !== tipo;

    }

}

document
    .querySelectorAll('input[name="rotorCorte"]')
    .forEach(radio => {

        radio.addEventListener("change", () => {

            if (radio.checked) {

                seleccionarRotorCorte(radio.value);

            }

        });

    });

seleccionarRotorCorte(
    document.querySelector('input[name="rotorCorte"]:checked').value
);



/* =========================================================
   CORTE TRANSVERSAL — GIRO DEL ROTOR (Etapa F2-B)
   Gira los dos discos (ambos tipos de rotor) con el ángulo del
   generador longitudinal. Se llama desde mostrarAnguloRotor(),
   que es el único lugar donde cambia anguloRotor, por lo que
   respeta PAUSA, REINICIAR y no usa un ciclo de animación propio.
   rotate(−θ): giro antihorario, consistente con el generador
   longitudinal (corrección de sentido, Etapa F2-B). anguloRotor
   no se modifica; solo cambia el signo de la representación.
   Función declarada (no const) porque mostrarAnguloRotor() se
   ejecuta antes de llegar a esta parte del archivo.
========================================================= */

function actualizarRotorCorte(angulo) {

    // Modo ANÁLISIS (Etapa F3-D): el disco conserva el ángulo capturado.
    if (actualizarRotorCorte.congelado) {

        return;

    }

    if (!actualizarRotorCorte.discos) {

        actualizarRotorCorte.discos =
            document.querySelectorAll(".disco-rotor-corte");

    }

    const giro = "rotate(" + (-angulo).toFixed(3) + "deg)";

    actualizarRotorCorte.discos.forEach(disco => {

        disco.style.transform = giro;

    });

}

actualizarRotorCorte(anguloRotor);



/* =========================================================
   DIAGRAMA FASORIAL (Etapa F3-B)

   Postproceso cuasiestático del AVR: toma PG (P), QG (Q) y V
   del modelo existente y calcula los fasores de régimen
   permanente del generador síncrono. No modifica ninguna
   variable ni ecuación del AVR y no tiene ciclo propio: se
   actualiza desde actualizarPantalla() (cada paso, deslizador
   de P, modo, REINICIAR) y al cambiar de vista o de rotor.

   Convenciones (informes F3-A y F3-A1):
     · Operación como generador, corriente saliendo.
     · V = V∠0° (referencia), ángulos positivos antihorarios.
     · S = P + jQ = V·Ia*  →  Ia = (P − jQ)/V,  φ = atan2(Q, P).
     · Magnitudes en pu, equivalente monofásico equilibrado.

   Rotor liso:        Ef = V + Ra·Ia + jXs·Ia,      δ = arg(Ef)
   Polos salientes:   EQ = V + (Ra + jXq)·Ia,       δ = arg(EQ)
                      q = e^{jδ},  d = e^{j(δ−90°)} = −j·q
                      Id = Re(Ia·d*),  Iq = Re(Ia·q*)   (escalares)
                      Id⃗ = Id·d,  Iq⃗ = Iq·q              (vectores)
                      Ef = EQ + j(Xd − Xq)·Id⃗

   Los parámetros son supuestos didácticos, independientes de
   los del AVR y de la curva de capacidad.
========================================================= */

const PARAMETROS_FASORIALES = Object.freeze({
    liso:      Object.freeze({ Ra: 0.005, Xs: 1.50 }),
    salientes: Object.freeze({ Ra: 0.005, Xd: 1.00, Xq: 0.65 })
});

/* Umbral de magnitud nula (pu): por debajo, un ángulo no está
   definido y su arco no se dibuja. */
const EPS_FASORIAL = 1e-9;


/* ---------- Aritmética compleja mínima ---------- */

const Cx = {
    de:     (re, im) => ({ re, im }),
    suma:   (a, b) => ({ re: a.re + b.re, im: a.im + b.im }),
    resta:  (a, b) => ({ re: a.re - b.re, im: a.im - b.im }),
    escala: (a, k) => ({ re: a.re * k, im: a.im * k }),
    // j·X·a
    jX:     (a, X) => ({ re: -X * a.im, im: X * a.re }),
    abs:    a => Math.hypot(a.re, a.im),
    arg:    a => Math.atan2(a.im, a.re),
    expJ:   t => ({ re: Math.cos(t), im: Math.sin(t) }),
    // Re(a·b*)
    proy:   (a, b) => a.re * b.re + a.im * b.im
};

function normalizarAngulo(t) {

    return Math.atan2(Math.sin(t), Math.cos(t));

}

/* Datos comunes a ambos rotores: corriente, φ y FP. */
function calcularCorrienteFasorial(P, Q, V) {

    const Ia = Cx.de(P / V, -Q / V);

    const S = Math.hypot(P, Q);

    return {
        P, Q, V,
        Vf: Cx.de(V, 0),
        Ia,
        magIa: Cx.abs(Ia),
        phi: Math.atan2(Q, P),
        fp: S > EPS_FASORIAL ? P / S : 1,
        caracter: Q > 0.001 ? "atrasado" : (Q < -0.001 ? "adelantado" : "unitario")
    };

}


/* ---------- Rotor liso ---------- */

function calcularFasoresLiso(P, Q, V, par) {

    const r = calcularCorrienteFasorial(P, Q, V);

    r.tipo = "liso";
    r.par = par;

    r.RaIa = Cx.escala(r.Ia, par.Ra);

    r.jXsIa = Cx.jX(r.Ia, par.Xs);

    r.A = Cx.suma(r.Vf, r.RaIa);                 // V + Ra·Ia

    r.Ef = Cx.suma(r.A, r.jXsIa);                // poligonal

    r.magEf = Cx.abs(r.Ef);

    r.delta = Cx.arg(r.Ef);

    // Forma cerrada independiente (F3-A1, sección 2): cierre de la poligonal.
    const EfCerrada = Cx.de(
        V + (par.Ra * P + par.Xs * Q) / V,
        (par.Xs * P - par.Ra * Q) / V
    );

    r.residuoCierre = Cx.abs(Cx.resta(r.Ef, EfCerrada));

    r.Pcu = par.Ra * r.magIa * r.magIa;

    return r;

}


/* ---------- Rotor de polos salientes ---------- */

function calcularFasoresSalientes(P, Q, V, par, deltaPrevio) {

    const r = calcularCorrienteFasorial(P, Q, V);

    r.tipo = "salientes";
    r.par = par;

    r.RaIa = Cx.escala(r.Ia, par.Ra);

    r.A = Cx.suma(r.Vf, r.RaIa);                 // V + Ra·Ia

    r.jXqIa = Cx.jX(r.Ia, par.Xq);

    r.EQ = Cx.suma(r.A, r.jXqIa);                // EQ = V + (Ra + jXq)·Ia

    r.magEQ = Cx.abs(r.EQ);

    // Si EQ fuera nulo el eje q no estaría definido: se conserva
    // la última orientación válida (sin NaN ni saltos).
    r.qIndefinido = !(r.magEQ > EPS_FASORIAL);

    r.delta = r.qIndefinido
        ? (Number.isFinite(deltaPrevio) ? deltaPrevio : 0)
        : Cx.arg(r.EQ);

    r.q = Cx.expJ(r.delta);

    r.d = Cx.de(r.q.im, -r.q.re);                // d = −j·q  (δ − 90°)

    r.Id = Cx.proy(r.Ia, r.d);                   // escalares con signo
    r.Iq = Cx.proy(r.Ia, r.q);

    r.IdV = Cx.escala(r.d, r.Id);                // vectores
    r.IqV = Cx.escala(r.q, r.Iq);

    r.jXdXqId = Cx.jX(r.IdV, par.Xd - par.Xq);

    r.Ef = Cx.suma(r.EQ, r.jXdXqId);

    // Ef sobre el eje q, con signo: |EQ| + (Xd − Xq)·Id.
    r.EfEje = Cx.proy(r.EQ, r.q) + (par.Xd - par.Xq) * r.Id;

    r.magEf = Cx.abs(r.Ef);

    // Construcción alternativa: (V + Ra·Ia) + jXq·Iq⃗ + jXd·Id⃗.
    r.jXqIq = Cx.jX(r.IqV, par.Xq);
    r.jXdId = Cx.jX(r.IdV, par.Xd);
    r.B = Cx.suma(r.A, r.jXqIq);
    r.EfAlt = Cx.suma(r.B, r.jXdId);

    r.psi = normalizarAngulo(r.delta + r.phi);

    r.residuoIa = Cx.abs(Cx.resta(Cx.suma(r.IdV, r.IqV), r.Ia));
    r.residuoEf = Cx.abs(Cx.resta(r.EfAlt, r.Ef));
    r.residuoEje = Cx.abs(Cx.resta(r.Ef, Cx.escala(r.q, r.EfEje)));
    r.residuoOrtogonal = Math.abs(Cx.proy(r.d, r.q));

    r.Pcu = par.Ra * r.magIa * r.magIa;

    return r;

}

/* Selector de modelo (también usado en las pruebas). */
function calcularFasores(tipo, P, Q, V, par, deltaPrevio) {

    return tipo === "liso"
        ? calcularFasoresLiso(P, Q, V, par || PARAMETROS_FASORIALES.liso)
        : calcularFasoresSalientes(P, Q, V, par || PARAMETROS_FASORIALES.salientes, deltaPrevio);

}


/* =========================================================
   MODELO ELÉCTRICO INTEGRADO — GENERADOR + RED (Etapa F4-B1)

   Cadena:  Vref → comparador (Vm) → AVR → excitatriz → If
            → Ef = kf·If → GENERADOR + RED → V, QG, Ia, δ
            → transductor (TV) → Vm → realimentación.

   RED (supuestos didácticos):
     Barra infinita Vinf = 1.0 pu a través de Xe = 0.10 pu, Re = 0.
     Carga local en bornes: PL = PG ⇒ Pred = PG − PL = 0.
     Con Pred = 0 y Re = 0 el ángulo de Vinf respecto de V es 0 y
         Qred = (V² − V·Vinf)/Xe ,     QG = QL + Qred .
     (Sustituye a Vnatural = 1 + KV·(If − 1) − KL·Qcarga.)

   EXCITACIÓN:  Ef = kf·If, sin saturación.  kf se calcula aquí, a
     precisión completa, en el punto de referencia PG = 0.8,
     QG = 0, V = 1 (If = 1):  liso ≈ 1.5646, salientes ≈ 1.2594.
     Cambiar de rotor conserva ese punto nominal.

   GENERADOR: ecuaciones de F3-A1 (las mismas de calcularFasores):
     liso       Ef = |V + (Ra + jXs)·Ia|
     salientes  EQ = V + (Ra + jXq)·Ia ,  Ef = |EQ| + (Xd − Xq)·Id
     con Ia = (PG − jQG)/V.

   INCÓGNITA ESCALAR: V.  F(V) = Ef_calc(PG, QL + Qred(V), V) − kf·If.

   RAMAS (análisis F4-B1, ver informe):
     · V < Vinf/2: lado invertido de la característica de la red
       (∂Qred/∂V = (2V − Vinf)/Xe < 0). No es régimen de operación.
     · En V > Vinf/2 aparecen, cuando hay solución, una raíz con
       dEf/dV < 0 (rama inversa: más excitación ⇒ menos tensión) y
       una con dEf/dV > 0. La RAMA DE OPERACIÓN es la de dEf/dV > 0:
       es la única en la que el AVR actúa en el sentido correcto, y
       en ella el coeficiente de sincronización del sistema completo
       (máquina + carga + red) resultó positivo en todas las pruebas.
     · No se elige por cercanía al estado anterior ni con δ < 90°.
     · Si en V > Vinf/2 no existe raíz con dEf/dV > 0 (F > 0 en todo
       el intervalo): SIN_SOLUCION_ESTACIONARIA.

   BÚSQUEDA ACOTADA: barrido de V ∈ [Vinf/2, 3] (paso 0.01),
   refinamiento del mínimo por sección áurea (detecta el par de
   raíces aunque caiga dentro de una sola celda) y bisección.
========================================================= */

const PARAMETROS_RED = Object.freeze({ Vinf: 1.0, Xe: 0.10, Re: 0.0 });

const REFERENCIA_EXCITACION = Object.freeze({ PG: 0.8, QG: 0.0, V: 1.0, If: 1.0 });

const BUSQUEDA_V = Object.freeze({
    min: PARAMETROS_RED.Vinf / 2,   // frontera de la rama invertida de la red
    max: 3.0,                      // F(3) > 0 en todo el rango de controles
    pasos: 250
});

/* Tolerancia de residuos para declarar la solución CONVERGIDA (pu). */
const TOL_RESIDUO_MAQUINA_RED = 1e-9;

/* Ef escalar (pu) de las ecuaciones F3-A1, sin crear objetos (se
   evalúa unas 300 veces por paso). Idéntico a calcularFasores():
   liso → |Ef|;  salientes → Ef sobre el eje q, con signo. */
function efEscalarMaquina(tipo, PG, QG, V, par) {

    const iRe = PG / V;
    const iIm = -QG / V;

    if (tipo === "liso") {

        return Math.hypot(V + par.Ra * iRe - par.Xs * iIm,
                          par.Ra * iIm + par.Xs * iRe);

    }

    const eRe = V + par.Ra * iRe - par.Xq * iIm;
    const eIm = par.Ra * iIm + par.Xq * iRe;
    const m = Math.hypot(eRe, eIm);

    if (!(m > EPS_FASORIAL)) {

        return m;                     // eje q indefinido: Id no aporta

    }

    // d = −j·q,  Id = Re(Ia·d*)
    const Id = iRe * (eIm / m) - iIm * (eRe / m);

    return m + (par.Xd - par.Xq) * Id;

}

/* kf = Ef en el punto de referencia (If = 1), a precisión completa. */
const KF_EXCITACION = Object.freeze({
    liso: efEscalarMaquina("liso", REFERENCIA_EXCITACION.PG, REFERENCIA_EXCITACION.QG,
        REFERENCIA_EXCITACION.V, PARAMETROS_FASORIALES.liso) / REFERENCIA_EXCITACION.If,
    salientes: efEscalarMaquina("salientes", REFERENCIA_EXCITACION.PG, REFERENCIA_EXCITACION.QG,
        REFERENCIA_EXCITACION.V, PARAMETROS_FASORIALES.salientes) / REFERENCIA_EXCITACION.If
});

/* Potencia reactiva que la barra terminal entrega a la red (Pred = 0, Re = 0). */
function qRedTerminal(V, red) {

    return (V * V - V * red.Vinf) / red.Xe;

}

/* Coeficiente de sincronización de la máquina a V y Ef constantes
   (Ra despreciada), pu/rad: liso V·Ef·cosδ/Xs; salientes con el
   término de reluctancia. Información para F4-B2. */
function coeficienteSincronizacionMaquina(tipo, Ef, V, delta, par) {

    const Xd = tipo === "liso" ? par.Xs : par.Xd;
    const Xq = tipo === "liso" ? par.Xs : par.Xq;

    return V * Ef * Math.cos(delta) / Xd +
           V * V * (1 / Xq - 1 / Xd) * Math.cos(2 * delta);

}

/* δ (rad) en el que dP/dδ = 0 a V y Ef constantes. liso: 90°.
   salientes: raíz en (0, 90°) de Ef·c/Xd + V(1/Xq − 1/Xd)(2c² − 1) = 0. */
function deltaMaximoTeorico(tipo, Ef, V, par) {

    if (tipo === "liso") {

        return Math.PI / 2;

    }

    const k = V * (1 / par.Xq - 1 / par.Xd);
    const b = Ef / par.Xd;

    if (!(k > 0)) {

        return Math.PI / 2;

    }

    const c = (-b + Math.sqrt(b * b + 8 * k * k)) / (4 * k);

    return Math.acos(Math.max(-1, Math.min(1, c)));

}

/* ---------------------------------------------------------
   resolverMaquinaRed(If, PG, QL, rotor[, parametros])

   Entradas : If (pu), PG (pu, = PL), QL (pu, carga local aplicada),
              rotor "liso" | "salientes"; parametros opcionales
              { maquina, red, kf, deltaPrevio }.
   Salidas  : objeto con
     convergencia      "CONVERGIDO" | "SIN_SOLUCION_ESTACIONARIA" |
                       "NO_CONVERGIDO" | "ENTRADAS_NO_VALIDAS"
     admisible, estadoAdmisibilidad ("ADMISIBLE" | "NO_ADMISIBLE" |
                       "SIN_SOLUCION"), motivo
     rama              "OPERACION" (dEf/dV > 0) o null
     V, QG, Ia (|Ia|), Ef, delta (rad), Id, Iq, Qred, Pred, PL, QL, PG
     fasores           objeto de calcularFasores() en la solución:
                       es la ÚNICA fuente del diagrama fasorial
     residuos          { generador, balanceP, balanceQ, red }
     dEfdV, EfMinExistencia, IfMinExistencia (excitación mínima con
     solución a estos PG, QL), coefSincronizacion, deltaMax, iteraciones
   Sin solución, las magnitudes eléctricas valen null (nunca NaN).
--------------------------------------------------------- */
function resolverMaquinaRed(IfEnt, PG, QL, tipo, parametros) {

    const opc = parametros || {};
    const par = opc.maquina || PARAMETROS_FASORIALES[tipo];
    const red = opc.red || PARAMETROS_RED;
    const kf = opc.kf !== undefined ? opc.kf : KF_EXCITACION[tipo];

    const PL = PG;                      // supuesto de la etapa
    const Pred = PG - PL;               // = 0

    const r = {
        tipo, If: IfEnt, PG, PL, QL, kf,
        Ef: Number.isFinite(IfEnt) && Number.isFinite(kf) ? kf * IfEnt : null,
        convergencia: null, admisible: false, estadoAdmisibilidad: null, motivo: "",
        rama: null,
        V: null, QG: null, Ia: null, delta: null, Id: null, Iq: null,
        Qred: null, Pred: null, fasores: null,
        residuos: null, dEfdV: null,
        EfMinExistencia: null, IfMinExistencia: null, VEfMin: null,
        coefSincronizacion: null, deltaMax: null,
        iteraciones: 0
    };

    if (!par || !(tipo === "liso" || tipo === "salientes") ||
        ![IfEnt, PG, QL, kf].every(Number.isFinite)) {

        r.convergencia = "ENTRADAS_NO_VALIDAS";
        r.estadoAdmisibilidad = "NO_ADMISIBLE";
        r.motivo = "Entradas no válidas.";
        return r;

    }

    const Ef = r.Ef;

    let evaluaciones = 0;

    const F = Vx => {

        evaluaciones++;
        return efEscalarMaquina(tipo, PG, QL + qRedTerminal(Vx, red), Vx, par) - Ef;

    };

    /* 1. Barrido acotado */
    const a = BUSQUEDA_V.min;
    const b = BUSQUEDA_V.max;
    const n = BUSQUEDA_V.pasos;
    const h = (b - a) / n;

    const fs = new Array(n + 1);
    let kMin = 0;
    const subidas = [];                 // celdas con F de − a + (dEf/dV > 0)

    for (let k = 0; k <= n; k++) {

        fs[k] = F(a + k * h);

        if (fs[k] < fs[kMin]) {

            kMin = k;

        }

        if (k > 0 && fs[k - 1] < 0 && fs[k] >= 0) {

            subidas.push(k);

        }

    }

    /* 2. Mínimo de Ef_calc (sección áurea alrededor del mínimo del
          barrido): excitación mínima con solución y detección de un
          par de raíces dentro de una misma celda. */
    let lo = a + Math.max(0, kMin - 1) * h;
    let hi = a + Math.min(n, kMin + 1) * h;
    const g = (Math.sqrt(5) - 1) / 2;
    let x1 = hi - g * (hi - lo);
    let x2 = lo + g * (hi - lo);
    let f1 = F(x1);
    let f2 = F(x2);

    for (let i = 0; i < 60 && hi - lo > 1e-12; i++) {

        if (f1 <= f2) {

            hi = x2; x2 = x1; f2 = f1;
            x1 = hi - g * (hi - lo); f1 = F(x1);

        }

        else {

            lo = x1; x1 = x2; f1 = f2;
            x2 = lo + g * (hi - lo); f2 = F(x2);

        }

    }

    let VminF = f1 <= f2 ? x1 : x2;
    let fMin = Math.min(f1, f2);

    if (fs[kMin] < fMin) {

        VminF = a + kMin * h;
        fMin = fs[kMin];

    }

    r.VEfMin = VminF;
    r.EfMinExistencia = fMin + Ef;
    r.IfMinExistencia = r.EfMinExistencia / kf;

    /* 3. Horquilla de la raíz de operación */
    let izq = null;
    let der = null;

    if (subidas.length >= 1) {

        // Con los parámetros actuales hay como máximo una (verificado
        // en 36 162 combinaciones por rotor). Si hubiera más, se toma
        // la de mayor V y se informa en el motivo.
        const k = subidas[subidas.length - 1];
        izq = a + (k - 1) * h;
        der = a + k * h;

        if (subidas.length > 1) {

            r.motivo = "Varias raíces con dEf/dV > 0; se tomó la de mayor V.";

        }

    }

    else if (fMin <= 0 && VminF < b) {

        // Par de raíces dentro de una celda del barrido.
        izq = VminF;
        der = a + Math.min(n, kMin + 1) * h;

        if (!(F(der) >= 0)) {

            izq = null;

        }

    }

    if (izq === null) {

        r.convergencia = "SIN_SOLUCION_ESTACIONARIA";
        r.estadoAdmisibilidad = "SIN_SOLUCION";
        r.motivo = "Ef = " + Ef.toFixed(3) + " pu es menor que el mínimo necesario (" +
            r.EfMinExistencia.toFixed(3) + " pu) para PG = " + PG.toFixed(3) +
            " pu y QL = " + QL.toFixed(3) + " pu.";
        r.iteraciones = evaluaciones;
        return r;

    }

    /* 4. Bisección (F(izq) < 0 ≤ F(der)) */
    let fIzq = F(izq);

    for (let i = 0; i < 200 && der - izq > 4e-16 * der; i++) {

        const m = 0.5 * (izq + der);
        const fm = F(m);

        if (fm < 0) {

            izq = m; fIzq = fm;

        }

        else {

            der = m;

        }

    }

    const fDer = F(der);
    const Vsol = Math.abs(fIzq) < Math.abs(fDer) ? izq : der;

    /* 5. Clasificación de la rama */
    const dv = 1e-6;
    r.dEfdV = (F(Vsol + dv) - F(Vsol - dv)) / (2 * dv);
    r.rama = r.dEfdV > 0 ? "OPERACION" : null;

    /* 6. Magnitudes en la solución (una sola evaluación fasorial) */
    const Qred = qRedTerminal(Vsol, red);
    const QG = QL + Qred;

    const fas = calcularFasores(tipo, PG, QG, Vsol, par, opc.deltaPrevio);

    // Ejes d, q también en el rotor liso (q en la dirección de Ef).
    let Id = fas.Id;
    let Iq = fas.Iq;

    if (tipo === "liso") {

        const q = fas.magEf > EPS_FASORIAL ? Cx.escala(fas.Ef, 1 / fas.magEf) : Cx.de(1, 0);
        const d = Cx.de(q.im, -q.re);
        Id = Cx.proy(fas.Ia, d);
        Iq = Cx.proy(fas.Ia, q);

    }

    // Red, calculada por fasores (independiente de la fórmula de Qred):
    // Ired = (V − Vinf)/(Re + jXe),  Sred = V·Ired*
    const Zr = Cx.de(red.Re, red.Xe);
    const dV = Cx.de(Vsol - red.Vinf, 0);
    const den = Zr.re * Zr.re + Zr.im * Zr.im;
    const Ired = Cx.de((dV.re * Zr.re + dV.im * Zr.im) / den,
                       (dV.im * Zr.re - dV.re * Zr.im) / den);
    const SredRe = Vsol * Ired.re;
    const SredIm = -Vsol * Ired.im;

    // Potencia en bornes del generador, desde la corriente fasorial.
    const SgRe = Vsol * fas.Ia.re;
    const SgIm = -Vsol * fas.Ia.im;

    const EfModelo = tipo === "liso" ? fas.magEf : fas.EfEje;

    r.residuos = {
        generador: Math.max(Math.abs(EfModelo - Ef),
            tipo === "liso" ? fas.residuoCierre : Math.max(fas.residuoEf, fas.residuoIa)),
        balanceP: Math.abs(SgRe - PL - SredRe),
        balanceQ: Math.abs(SgIm - QL - SredIm),
        red: Math.max(Math.abs(SredIm - Qred), Math.abs(SredRe - Pred))
    };

    r.V = Vsol;
    r.QG = QG;
    r.Qred = SredIm;
    r.Pred = SredRe;
    r.Ia = fas.magIa;
    r.delta = fas.delta;
    r.Id = Id;
    r.Iq = Iq;
    r.fasores = fas;
    r.coefSincronizacion = coeficienteSincronizacionMaquina(tipo, Ef, Vsol, fas.delta, par);
    r.deltaMax = deltaMaximoTeorico(tipo, Ef, Vsol, par);
    r.iteraciones = evaluaciones;

    const residuoMax = Math.max(r.residuos.generador, r.residuos.balanceP,
                                r.residuos.balanceQ, r.residuos.red);

    const finitos = [Vsol, QG, fas.magIa, fas.delta, Id, Iq, SredRe, SredIm, residuoMax]
        .every(Number.isFinite);

    if (!finitos || !(residuoMax < TOL_RESIDUO_MAQUINA_RED)) {

        r.convergencia = "NO_CONVERGIDO";
        r.estadoAdmisibilidad = "NO_ADMISIBLE";
        r.motivo = "Residuo " + (finitos ? residuoMax.toExponential(2) : "no finito") + ".";
        return r;

    }

    r.convergencia = "CONVERGIDO";

    const motivos = [];

    if (r.rama !== "OPERACION") motivos.push("dEf/dV ≤ 0");
    if (!(Vsol > BUSQUEDA_V.min && Vsol < BUSQUEDA_V.max)) motivos.push("V fuera del intervalo");
    if (tipo === "salientes" && (fas.qIndefinido || !(fas.EfEje > 0))) motivos.push("eje q indefinido o Ef ≤ 0");

    r.admisible = motivos.length === 0;
    r.estadoAdmisibilidad = r.admisible ? "ADMISIBLE" : "NO_ADMISIBLE";

    if (motivos.length) {

        r.motivo = (r.motivo ? r.motivo + " " : "") + motivos.join("; ") + ".";

    }

    return r;

}


/* ---------------------------------------------------------
   ENLACE CON EL SIMULADOR
--------------------------------------------------------- */

/* Resuelve con el estado actual (If, P = PG, Qcarga = QL, rotor).
   Solo una solución CONVERGIDA y ADMISIBLE actualiza V, Q y el
   estado representado; en otro caso se retienen (sin inventar
   valores) y estadoElectrico indica el motivo. */
function resolverEstadoElectrico() {

    const previo = ultimoEstadoValido && ultimoEstadoValido.tipo === rotorModelo
        ? ultimoEstadoValido.delta
        : undefined;

    const s = resolverMaquinaRed(If, P, Qcarga, rotorModelo, { deltaPrevio: previo });

    estadoElectrico = s;

    if (s.convergencia === "CONVERGIDO" && s.admisible) {

        ultimoEstadoValido = s;
        V = s.V;
        Q = s.QG;

    }

    return s;

}

/* ¿El estado representado corresponde a la última resolución? */
function estadoElectricoVigente() {

    return estadoElectrico !== null && estadoElectrico === ultimoEstadoValido;

}

/* Selector de rotor ÚNICO para el modelo: los dos selectores de la
   interfaz (vista AVR: "salientes" | "cilindrico"; corte transversal:
   "salientes" | "liso") se mantienen sincronizados. Cambia las
   ecuaciones de inmediato, también en PAUSA (sin avanzar el tiempo). */
function establecerRotorModelo(tipo) {

    if (tipo !== "liso" && tipo !== "salientes") {

        return;

    }

    const valorAVR = tipo === "liso" ? "cilindrico" : "salientes";

    document.querySelectorAll('input[name="tipoRotor"]').forEach(radio => {

        radio.checked = radio.value === valorAVR;

    });

    document.querySelectorAll('input[name="rotorCorte"]').forEach(radio => {

        radio.checked = radio.value === tipo;

    });

    seleccionarRotor(valorAVR);
    seleccionarRotorCorte(tipo);

    if (tipo === rotorModelo && estadoElectrico) {

        return;

    }

    rotorModelo = tipo;

    resolverEstadoElectrico();

    actualizarPantalla();

}

document.querySelectorAll('input[name="tipoRotor"]').forEach(radio => {

    radio.addEventListener("change", () => {

        if (radio.checked) {

            establecerRotorModelo(radio.value === "cilindrico" ? "liso" : "salientes");

        }

    });

});

document.querySelectorAll('input[name="rotorCorte"]').forEach(radio => {

    radio.addEventListener("change", () => {

        if (radio.checked) {

            establecerRotorModelo(radio.value === "liso" ? "liso" : "salientes");

        }

    });

});

/* Estado inicial: rotor del selector del corte (por omisión, polos
   salientes, igual que el rotor animado) y punto nominal. */
(function inicializarModeloElectrico() {

    const radio = document.querySelector('input[name="rotorCorte"]:checked');

    rotorModelo = radio && radio.value === "liso" ? "liso" : "salientes";

    establecerRotorModelo(rotorModelo);

})();


/* =========================================================
   CURVA DE CAPACIDAD Y EVALUACIÓN OPERATIVA ÚNICA (Etapa F4-C)

   Sustituye a la curva fija (V = 1, rotor liso, Emax = 2) y al
   panel de varias advertencias de F4-B2.

   F4-C1 — LÍMITES, con el MISMO modelo de F4-B1 (sin modelo aparte):
     · Forma directa  (P, Q, V) → Ef, δ : efEscalarMaquina / calcularFasores.
     · Forma inversa  (Ef, δ, V) → P, Q : las mismas ecuaciones F3-A1 en
       ejes d-q, con Ra:
           Ef = vq + Ra·Iq + Xd·Id ,   0 = vd + Ra·Id − Xq·Iq ,
           vd = V·sen δ ,  vq = V·cos δ ,  Ia = Id·d + Iq·q ,
           P + jQ = V·Ia*      (rotor liso: Xd = Xq = Xs).
     F4-C6: la curva y la evaluación usan la tensión NOMINAL Vnom = 1.000 pu
     (curva nominal fija por rotor); el punto usa (PG, QG) reales:
     1. Estator:      |Ia| ≤ Ia,max = 1.0 pu  ⇔  P² + Q² ≤ (V·Ia,max)².
     2. Excitación:   If ≤ If,max = 1.50 ⇒ Ef ≤ Ef,max = kf·If,max
                      (liso 2.347 pu; salientes 1.889 pu). Frontera:
                      lugar de Ef = Ef,max (círculo en liso; con Xd ≠ Xq
                      en salientes). Es la excitación DISPONIBLE, no un
                      límite térmico de campo validado.
     3. Cabezales:    curva didáctica Q ≥ a + b·P + c·P² (F4-E2), P ≤ P_J,
                      conservada SOLO para el rotor liso (para el que se
                      trazó la curva original). Sin fundamento para
                      polos salientes: allí no se aplica ni se dibuja.
                      No depende de V (no hay modelo térmico).
     4. Estabilidad:  característica P–δ de cada rotor a Ef y V
                      constantes. Límite teórico: δmax con dP/dδ = 0.
                      Margen práctico adoptado (construcción clásica del
                      límite práctico de estabilidad): reserva de potencia
                      Pmax(Ef, V) − PG ≥ ΔP y δ < δmax, con ΔP didáctico
                      por rotor (F4-E2): 0.05 pu cilíndrico, 0.20 pu
                      polos salientes. No se usa δ < 90° ni el factor 70/90. Es distinto de la ausencia de
                      solución estacionaria del conjunto máquina–red.
     5. Turbina:      Pmin = 0.10 ≤ PG ≤ Pmax = 1.00 (sin cambios).

   F4-C2 — UNA evaluación (evaluarOperacion) decide: color del punto,
   leyenda única del AVR, retención y leyenda del diagrama fasorial.
========================================================= */

const IA_MAX_ESTATOR = SmaxCapacidad / VCapacidad;              // 1.00 pu

/* F4-C6: curva de capacidad NOMINAL fija, calculada con Vnom = 1.000 pu
   (referencia equivalente a la curva de un fabricante). La geometría y
   la evaluación de límites usan Vnom; el punto (PG, QG) y todo el
   cálculo eléctrico y fasorial usan los valores REALES del modelo. */
const VNOM_CURVA = VCapacidad;                                   // 1.000 pu

/* F4-E2: margen didáctico de estabilidad por tipo de rotor (pu de Snom).
   Ajuste empírico; no modifica las ecuaciones de potencia. */
const MARGEN_ESTABILIDAD_P = Object.freeze({ liso: 0.05, salientes: 0.20 });

function margenEstabilidad(tipo) {

    return MARGEN_ESTABILIDAD_P[tipo];

}

const TOL_IF_ALCANZADO = 5e-4;                                  // If se muestra como 1.500

const TOL_LIMITE = 1e-9;

const COLOR_PUNTO = Object.freeze({ verde: "#1f9d55", rojo: "#d32f2f" });

const LEYENDA_FASORIAL_RETENCION = " — SE MUESTRAN LOS ÚLTIMOS FASORES VÁLIDOS";

/* Prioridad (F4-C2): la ausencia de solución es la condición actual y no
   se le asigna una causa; después, el orden establecido. */
const LEYENDAS_OPERACION = Object.freeze({
    sinSolucion: "SIN SOLUCIÓN ESTACIONARIA",
    estabilidad: "LÍMITE DE ESTABILIDAD ANGULAR SUPERADO",
    estator: "LÍMITE DE CORRIENTE DEL ESTATOR SUPERADO",
    excitacion: "LÍMITE DE EXCITACIÓN DEL ROTOR ALCANZADO",
    cabezales: "LÍMITE DE CALENTAMIENTO DE CABEZALES SUPERADO",
    turbina: "LÍMITE DE POTENCIA DE TURBINA ALCANZADO",
    normal: "OPERACIÓN DENTRO DE LÍMITES"
});


/* ---------- Modelo inverso (mismas ecuaciones F3-A1) ---------- */

function reactanciasRotor(tipo, par) {

    return tipo === "liso" ? { Xd: par.Xs, Xq: par.Xs } : { Xd: par.Xd, Xq: par.Xq };

}

/* (Ef, δ, V) → P, Q en bornes. δ: ángulo del eje q (de Ef) respecto de V. */
function potenciaDesdeEf(tipo, Ef, delta, V, par) {

    const { Xd, Xq } = reactanciasRotor(tipo, par);
    const Ra = par.Ra;
    const s = Math.sin(delta);
    const c = Math.cos(delta);
    const b1 = Ef - V * c;               // Ef − vq
    const b2 = -V * s;                   // −vd
    const det = -Xd * Xq - Ra * Ra;
    const Id = (-Xq * b1 - Ra * b2) / det;
    const Iq = (Xd * b2 - Ra * b1) / det;
    // Ia = Id·d + Iq·q,  d = (sen δ, −cos δ),  q = (cos δ, sen δ)
    const iRe = Id * s + Iq * c;
    const iIm = -Id * c + Iq * s;

    return { P: V * iRe, Q: -V * iIm };

}

/* Ef (escalar sobre q) y δ del punto (P, Q, V): forma directa F3-A1. */
function estadoMaquinaPQ(tipo, P, Q, V, par) {

    const Ef = efEscalarMaquina(tipo, P, Q, V, par);
    const iRe = P / V;
    const iIm = -Q / V;
    const X = tipo === "liso" ? par.Xs : par.Xq;
    // liso: δ = arg Ef ; salientes: δ = arg EQ (en liso, Ef = EQ)
    const delta = Math.atan2(par.Ra * iIm + X * iRe, V + par.Ra * iRe - X * iIm);

    return { Ef, delta };

}

/* Característica P–δ a Ef y V constantes: máximo (límite teórico). */
function potenciaMaximaEstacionaria(tipo, Ef, V, par) {

    const g = (Math.sqrt(5) - 1) / 2;
    let a = 0, b = Math.PI;
    let x1 = b - g * (b - a), x2 = a + g * (b - a);
    let f1 = potenciaDesdeEf(tipo, Ef, x1, V, par).P;
    let f2 = potenciaDesdeEf(tipo, Ef, x2, V, par).P;

    for (let i = 0; i < 70; i++) {

        if (f1 >= f2) { b = x2; x2 = x1; f2 = f1; x1 = b - g * (b - a); f1 = potenciaDesdeEf(tipo, Ef, x1, V, par).P; }
        else          { a = x1; x1 = x2; f1 = f2; x2 = a + g * (b - a); f2 = potenciaDesdeEf(tipo, Ef, x2, V, par).P; }

    }

    const deltaMax = 0.5 * (a + b);

    return { Pmax: potenciaDesdeEf(tipo, Ef, deltaMax, V, par).P, deltaMax };

}

/* Comprobación de los cuatro límites del plano P–Q en un punto (P, Q)
   a la tensión V. Es la MISMA prueba que se usa para trazar la curva. */
function evaluarLimitesPQ(tipo, P, Q, V) {

    const par = PARAMETROS_FASORIALES[tipo];
    const m = estadoMaquinaPQ(tipo, P, Q, V, par);
    const EfMax = KF_EXCITACION[tipo] * IF_MAX;
    const pm = m.Ef > 0 ? potenciaMaximaEstacionaria(tipo, m.Ef, V, par) : null;

    const S = Math.hypot(P, Q);

    return {
        estator: S <= V * IA_MAX_ESTATOR + TOL_LIMITE,
        rotor: m.Ef <= EfMax + TOL_LIMITE,
        // Frontera de excitación alcanzada (misma tolerancia que If = 1.500)
        rotorAlcanzado: m.Ef >= EfMax - KF_EXCITACION[tipo] * TOL_IF_ALCANZADO,
        cabezales: tipo !== "liso" || !cabezalAplica(P) || Q >= limiteCabezalVisual(P) - TOL_LIMITE,
        estabilidad: !!pm && m.delta < pm.deltaMax &&
            pm.Pmax - P >= margenEstabilidad(tipo) - TOL_LIMITE,
        S, Smax: V * IA_MAX_ESTATOR, Ef: m.Ef, EfMax, delta: m.delta,
        Pmax: pm ? pm.Pmax : null, deltaMax: pm ? pm.deltaMax : null
    };

}

/* Compatibilidad: verificación del punto en la curva nominal vigente. */
function estaDentroCurvaCapacidad(Pcap, Qcap) {

    const tipo = ultimoEstadoValido ? ultimoEstadoValido.tipo : rotorModelo;
    const c = evaluarLimitesPQ(tipo, Pcap, Qcap, VNOM_CURVA);

    return c.estator && c.rotor && c.cabezales && c.estabilidad;

}


/* ---------- F4-C1/C6: trazado de la curva NOMINAL (Vnom) del rotor seleccionado ---------- */

const curvaDibujada = { tipo: null, V: null };

/* Muestrea una curva paramétrica y la separa en tramos efectivos
   (sólidos) y de referencia (discontinuos); las transiciones se
   refinan por bisección del parámetro. */
function trazarTramos(curva, t0, t1, n, efectivo) {

    const pts = [];
    let tAnt = t0, eAnt = null, pAnt = null;
    const tramos = [];
    let actual = null;

    const empezar = (p, e) => { actual = { efectivo: e, puntos: [p] }; tramos.push(actual); };

    for (let i = 0; i <= n; i++) {

        const t = t0 + (t1 - t0) * i / n;
        const p = curva(t);

        if (!p) { actual = null; eAnt = null; continue; }

        const e = efectivo(p);

        if (eAnt === null || !actual) { empezar(p, e); }

        else if (e !== eAnt) {

            let a = tAnt, b = t;

            for (let k = 0; k < 30; k++) {

                const m = 0.5 * (a + b);
                const pm = curva(m);
                if (pm && efectivo(pm) === eAnt) a = m; else b = m;

            }

            const pc = curva(0.5 * (a + b)) || p;
            actual.puntos.push(pc);
            empezar(pc, e);
            actual.puntos.push(p);

        }

        else { actual.puntos.push(p); }

        tAnt = t; eAnt = e; pAnt = p;

    }

    const aTexto = (lista) => lista.filter(tr => tr.puntos.length > 1).map(tr =>
        tr.puntos.map((p, i) => {
            const s = convertirASVGCapacidad(p.P, p.Q);
            return (i ? "L " : "M ") + s.x.toFixed(2) + " " + s.y.toFixed(2);
        }).join(" ")).join(" ");

    const obstaculos = [];

    for (const tr of tramos) {

        for (const p of tr.puntos) {

            const q = convertirASVGCapacidad(p.P, p.Q);
            obstaculos.push({ x: q.x, y: q.y, peso: tr.efectivo ? 3 : 1 });

        }

    }

    return {
        solido: aTexto(tramos.filter(t => t.efectivo)),
        referencia: aTexto(tramos.filter(t => !t.efectivo)),
        obstaculos
    };

}

/* Posiciones candidatas (coordenadas del viewBox 250 × 220, línea
   base, alineación izquierda). La primera es la posición original;
   se elige la de menor penalización: puntos de curva dentro del
   recuadro del texto (tramos sólidos pesan más) y superposición con
   las etiquetas fijas. */
const CANDIDATOS_ETIQUETAS_CURVA = Object.freeze({
    etiquetaRotor: [[50, 40], [48, 58], [48, 68], [56, 30], [60, 80]],
    etiquetaEstabilidad: [[58, 180], [58, 170], [100, 196], [118, 186], [62, 160], [70, 150], [130, 172]],
    etiquetaPminTurbina: [[48, 200], [48, 190], [48, 208], [60, 186]]
});

function colocarEtiquetasCurva(obstaculos) {

    const svg = document.getElementById("graficaCapacidad");
    const pto = { x: +puntoOperacion.getAttribute("cx"), y: +puntoOperacion.getAttribute("cy") };

    for (const [clase, candidatos] of Object.entries(CANDIDATOS_ETIQUETAS_CURVA)) {

        const t = svg.querySelector("text." + clase);

        if (!t) continue;

        // Resto de textos (incluidas las etiquetas móviles ya colocadas).
        const fijas = [...svg.querySelectorAll("text")]
            .filter(o => o !== t && getComputedStyle(o).display !== "none")
            .map(o => o.getBBox());

        t.setAttribute("x", candidatos[0][0]);
        t.setAttribute("y", candidatos[0][1]);
        const b0 = t.getBBox();
        const dx = b0.x - candidatos[0][0], dy = b0.y - candidatos[0][1];
        let mejor = null;

        candidatos.forEach(([x, y], i) => {

            const r = { x: x + dx - 1, y: y + dy - 1, w: b0.width + 2, h: b0.height + 2 };
            let pen = i * 0.01;

            for (const o of obstaculos) {
                if (o.x >= r.x && o.x <= r.x + r.w && o.y >= r.y && o.y <= r.y + r.h) pen += o.peso;
            }

            for (const f of fijas) {
                if (!(f.x > r.x + r.w || f.x + f.width < r.x || f.y > r.y + r.h || f.y + f.height < r.y)) pen += 50;
            }

            if (r.x + r.w > 248 || r.y < 0 || r.y + r.h > 219) pen += 100;

            if (!mejor || pen < mejor.pen) mejor = { x, y, pen };

        });

        t.setAttribute("x", mejor.x);
        t.setAttribute("y", mejor.y);

    }

}

function actualizarCurvaCapacidad(forzar) {

    if (!actualizarCurvaCapacidad.listo) {

        return;

    }

    const tipo = ultimoEstadoValido ? ultimoEstadoValido.tipo : rotorModelo;
    // F4-C6: geometría fija; solo cambia con el tipo de rotor.
    const V = VNOM_CURVA;

    if (!forzar && curvaDibujada.tipo === tipo && curvaDibujada.V === V) {

        return;

    }

    curvaDibujada.tipo = tipo;
    curvaDibujada.V = V;

    const par = PARAMETROS_FASORIALES[tipo];
    const EfMax = KF_EXCITACION[tipo] * IF_MAX;
    const Smax = V * IA_MAX_ESTATOR;
    const QMIN_VISTA = -1.15, QMAX_VISTA = 1.15;
    const PMAX_VISTA = 1.55;           // antes del rótulo "P (pu)" (x ≥ 205)
    const lim = p => evaluarLimitesPQ(tipo, p.P, p.Q, V);
    const poner = (id, d) => document.getElementById(id).setAttribute("d", d || "M 0 0");

    // 1. Estator: P² + Q² = (V·Ia,max)², P ≥ 0
    const est = trazarTramos(t => ({ P: Smax * Math.cos(t), Q: Smax * Math.sin(t) }),
        Math.PI / 2, -Math.PI / 2, 360,
        p => { const c = lim(p); return c.rotor && c.cabezales && c.estabilidad; });
    poner("curvaEstator", est.solido);
    poner("curvaEstatorReferencia", est.referencia);

    // 2. Excitación disponible: lugar de Ef = Ef,max (δ de 0 a 180°)
    const rot = trazarTramos(t => {
            const p = potenciaDesdeEf(tipo, EfMax, t, V, par);
            return p.P >= -1e-9 && p.P <= PMAX_VISTA && p.Q >= QMIN_VISTA && p.Q <= QMAX_VISTA ? p : null;
        }, 0, Math.PI, 360,
        p => { const c = lim(p); return c.estator && c.cabezales && c.estabilidad; });
    poner("curvaRotor", rot.solido);
    poner("curvaRotorReferencia", rot.referencia);

    // 3. Cabezales (solo rotor liso)
    const conCabezal = tipo === "liso";

    if (conCabezal) {

        const cab = trazarTramos(t => ({ P: t, Q: limiteCabezalVisual(t) }), 0, CABEZAL_J.P, 200,
            p => { const c = lim(p); return c.estator && c.rotor && c.estabilidad; });
        poner("curvaCabezal", cab.solido);
        poner("curvaCabezalReferencia", cab.referencia);

    }

    for (const id of ["curvaCabezal", "curvaCabezalReferencia"]) {

        document.getElementById(id).style.display = conCabezal ? "" : "none";

    }

    const etiquetaCabezal = document.querySelector("#graficaCapacidad .etiquetaCabezal");

    if (etiquetaCabezal) {

        etiquetaCabezal.style.display = conCabezal ? "" : "none";

    }

    // 4. Estabilidad práctica: Pmax(Ef, V) − P = margen, recorrida en Ef
    const Pmax0 = potenciaMaximaEstacionaria(tipo, 1e-9, V, par).Pmax;
    let EfIni = 0;

    const margenP = margenEstabilidad(tipo);

    if (Pmax0 < margenP) {

        let a = 0, b = 5;
        for (let k = 0; k < 60; k++) {
            const m = 0.5 * (a + b);
            if (potenciaMaximaEstacionaria(tipo, m, V, par).Pmax < margenP) a = m; else b = m;
        }
        EfIni = b;

    }

    const puntosEstab = [];

    for (let i = 0; i <= 160; i++) {

        const Ef = EfIni + (4.0 - EfIni) * i / 160;
        const pm = potenciaMaximaEstacionaria(tipo, Ef, V, par);
        const Pobj = pm.Pmax - margenP;
        let a = 0, b = pm.deltaMax;

        for (let k = 0; k < 60; k++) {
            const m = 0.5 * (a + b);
            if (potenciaDesdeEf(tipo, Ef, m, V, par).P < Pobj) a = m; else b = m;
        }

        const p = potenciaDesdeEf(tipo, Ef, 0.5 * (a + b), V, par);

        if (p.Q > QMAX_VISTA || p.P > PMAX_VISTA) break;

        if (p.Q >= QMIN_VISTA - 0.2) puntosEstab.push(p);

    }

    poner("curvaEstabilidadAngular", puntosEstab.map((p, i) => {
        const s = convertirASVGCapacidad(p.P, p.Q);
        return (i ? "L " : "M ") + s.x.toFixed(2) + " " + s.y.toFixed(2);
    }).join(" "));

    // Etiquetas móviles: rotor y estabilidad (las demás conservan su sitio).
    const obstaculos = [...est.obstaculos, ...rot.obstaculos,
        ...(conCabezal ? [] : []),
        ...puntosEstab.map(p => { const q = convertirASVGCapacidad(p.P, p.Q); return { x: q.x, y: q.y, peso: 2 }; })];

    if (conCabezal) {

        const cab2 = trazarTramos(t => ({ P: t, Q: limiteCabezalVisual(t) }), 0, CABEZAL_J.P, 100, () => false);
        obstaculos.push(...cab2.obstaculos);

    }

    for (const Pt of [PminTurbina, PmaxTurbina]) {

        for (let q = -1; q <= 1.0001; q += 0.02) {

            const s = convertirASVGCapacidad(Pt, q);
            obstaculos.push({ x: s.x, y: s.y, peso: 1 });

        }

    }

    colocarEtiquetasCurva(obstaculos);

    // Título de la frontera de excitación (sin cambio visual)
    const tituloRotor = document.getElementById("curvaRotor").querySelector("title") ||
        document.getElementById("curvaRotor").appendChild(document.createElementNS("http://www.w3.org/2000/svg", "title"));
    tituloRotor.textContent = "Excitación disponible: If,max = " + IF_MAX.toFixed(2) + " pu ⇒ Ef,max = " +
        EfMax.toFixed(3) + " pu (" + (tipo === "liso" ? "rotor liso" : "polos salientes") +
        ", V = " + V.toFixed(3) + " pu). No es un límite térmico de campo validado.";

    const textoSmax = document.getElementById("textoSmaxCurva");

    if (textoSmax) {

        textoSmax.textContent = "Smax = " + (VNOM_CURVA * IA_MAX_ESTATOR).toFixed(3) + " pu";

    }

}


/* ---------- F4-C2: evaluación operativa única ---------- */

let evaluacionOperativa = null;

let ultimoEstadoPermitido = null;

function evaluarOperacion() {

    const ev = ultimoEstadoValido;
    const causas = [];
    const agregar = (id, nivel, detalle) => causas.push({ id, nivel, texto: LEYENDAS_OPERACION[id], detalle });

    const sinSolucion = estadoElectrico !== null && !estadoElectricoVigente();

    if (sinSolucion) {

        const ee = estadoElectrico;
        agregar("sinSolucion", "rojo",
            "No existe régimen permanente con If = " + If.toFixed(3) + " pu, PG = " + P.toFixed(3) +
            " pu y QL = " + Qcarga.toFixed(3) + " pu" +
            (ee && Number.isFinite(ee.IfMinExistencia) ? " (If mínima ≈ " + ee.IfMinExistencia.toFixed(3) + " pu)" : "") +
            ". No se atribuye a un límite concreto ni implica una pérdida de sincronismo simulada.");

    }

    let datos = null;

    if (ev) {

        /* F4-C6: el punto (PG, QG) REAL se evalúa con las MISMAS fronteras
           nominales (Vnom) que dibuja la curva: evaluarLimitesPQ(…, VNOM_CURVA).
           No se usan Ia, If, Ef ni δ del estado real para decidir límites. */
        const c = evaluarLimitesPQ(ev.tipo, ev.PG, ev.QG, VNOM_CURVA);
        const margen = c.Pmax === null ? null : c.Pmax - ev.PG;

        datos = { nominal: c, margen, Vnom: VNOM_CURVA };

        if (!c.estabilidad) {

            agregar("estabilidad", "rojo",
                "Curva nominal (V = " + VNOM_CURVA.toFixed(3) + " pu): reserva Pmax − PG = " +
                (margen === null ? "—" : margen.toFixed(3)) + " pu < " + margenEstabilidad(ev.tipo).toFixed(2) +
                " pu (Ef nominal del punto = " + c.Ef.toFixed(3) + " pu, δ = " + (c.delta * 180 / Math.PI).toFixed(1) +
                "°" + (c.deltaMax === null ? "" : ", δmax = " + (c.deltaMax * 180 / Math.PI).toFixed(1) + "°") + ").");

        }

        if (!c.estator) {

            agregar("estator", "rojo", "Curva nominal: S = √(PG² + QG²) = " + c.S.toFixed(3) + " pu > Smax = " +
                c.Smax.toFixed(3) + " pu (Ia,max = " + IA_MAX_ESTATOR.toFixed(2) + " pu a Vnom).");

        }

        if (c.rotorAlcanzado) {

            agregar("excitacion", "ambar", "Curva nominal: Ef necesaria a Vnom = " + c.Ef.toFixed(3) + " pu ≥ Ef,max = kf·If,max = " +
                c.EfMax.toFixed(3) + " pu. Excitación disponible; no es un límite térmico validado.");

        }

        if (!c.cabezales) {

            agregar("cabezales", "rojo", "QG = " + ev.QG.toFixed(3) + " pu < " + limiteCabezalVisual(ev.PG).toFixed(3) +
                " pu (curva didáctica de referencia, rotor cilíndrico).");

        }

        if (ev.PG < PminTurbina - TOL_LIMITE || ev.PG > PmaxTurbina + TOL_LIMITE) {

            agregar("turbina", "rojo", "PG = " + ev.PG.toFixed(3) + " pu fuera de [" + PminTurbina.toFixed(2) +
                ", " + PmaxTurbina.toFixed(2) + "] pu.");

        }

        else if (Math.abs(ev.PG - PminTurbina) <= TOL_LIMITE || Math.abs(ev.PG - PmaxTurbina) <= TOL_LIMITE) {

            agregar("turbina", "ambar", "PG = " + ev.PG.toFixed(3) + " pu en el límite de la turbina.");

        }

    }

    const admisible = !!ev && causas.length === 0;

    evaluacionOperativa = {
        admisible,
        principal: causas[0] || null,
        causas,
        estado: ev,
        datos
    };

    if (admisible) {

        ultimoEstadoPermitido = ev;

    }

    return evaluacionOperativa;

}


/* ---------- Recuadro del AVR: UNA sola advertencia ---------- */

const panelAdvertencias = document.getElementById("panelAdvertencias");

const listaAdvertencias = document.getElementById("listaAdvertencias");

let claveAdvertencias = "";

function actualizarAdvertencias() {

    if (!actualizarAdvertencias.listo) {

        return;

    }

    const e = evaluarOperacion();

    puntoOperacion.style.fill = e.admisible ? COLOR_PUNTO.verde : COLOR_PUNTO.rojo;

    const a = e.admisible || !e.principal
        ? { id: "normal", nivel: "verde", texto: LEYENDAS_OPERACION.normal, detalle: "Ningún límite aplicado está alcanzado ni superado." }
        : e.principal;

    // Diagnóstico completo en la descripción emergente.
    const diagnostico = e.causas.length > 1
        ? a.detalle + "  ·  Diagnóstico completo: " + e.causas.map(c => c.texto).join(" | ")
        : a.detalle;

    const clave = a.id + ":" + a.nivel;

    if (clave !== claveAdvertencias) {

        claveAdvertencias = clave;
        listaAdvertencias.textContent = "";
        const li = document.createElement("li");
        li.className = "advertencia adv-" + a.nivel;
        li.textContent = a.texto;
        listaAdvertencias.appendChild(li);
        posicionarPanelAdvertencias();

    }

    const li = listaAdvertencias.firstElementChild;

    if (li && li.title !== diagnostico) {

        li.title = diagnostico;

    }

    if (estado.textContent !== actualizarAdvertencias.textoEstado) {

        actualizarAdvertencias.textoEstado = estado.textContent;
        posicionarPanelAdvertencias();

    }

}


/* Posición: espacio libre inferior izquierdo de la escena, a la
   altura del recuadro de estado. Zonas libres medidas en el
   viewBox (1250 × 650) del diagrama:
     A: x ≤ 395, y ≥ 512  (bajo el AMPLIFICADOR)
     B: x ≤ 575, y ≥ 552  (bajo la línea de realimentación y = 545,
                           antes del texto "Error de tensión")
     C: bajo el diagrama, si la escena es más alta que el SVG
        (resoluciones estrechas).
   Si una zona alcanza horizontalmente al recuadro de estado, su
   borde inferior se sube por encima de él. Se elige la primera
   zona donde cabe el contenido completo (B, A, C); si ninguna
   basta, la de mayor altura con recorte. */
const ZONAS_ADVERTENCIAS = Object.freeze([
    { xMax: 575, yMin: 552 },
    { xMax: 395, yMin: 512 },
    { xMax: null, yMin: 650 }
]);

function posicionarPanelAdvertencias() {

    const panel = panelAdvertencias;
    const escena = panel.parentElement;
    const svg = document.querySelector(".escena > svg");

    if (!svg || escena.clientWidth === 0) {

        return;

    }

    const m = svg.getScreenCTM();

    if (!m) {

        return;

    }

    const marco = escena.getBoundingClientRect();

    const rel = (x, y) => {

        const p = svg.createSVGPoint();
        p.x = x; p.y = y;
        const q = p.matrixTransform(m);
        return { x: q.x - marco.left - escena.clientLeft, y: q.y - marco.top - escena.clientTop };

    };

    const IZQ = 18;
    const ABAJO = 4;
    const SEP = 8;

    const H = escena.clientHeight;
    const estadoIzq = estado.offsetLeft;
    const estadoSup = estado.offsetTop;

    const candidatos = ZONAS_ADVERTENCIAS.map(z => {

        let derecha = z.xMax === null ? estadoIzq - SEP : Math.min(rel(z.xMax, 0).x, escena.clientWidth - SEP);
        let inferior = H - ABAJO;

        if (derecha > estadoIzq - SEP) {

            inferior = estadoSup - SEP;

        }

        return { ancho: Math.floor(derecha - IZQ), superior: rel(0, z.yMin).y + 4, inferior };

    }).filter(c => c.ancho >= 140 && c.inferior - c.superior > 20);

    panel.style.maxHeight = "none";

    // Restituir todas las advertencias (pudieron ocultarse antes).
    const items = [...listaAdvertencias.children].filter(li => !li.classList.contains("adv-mas"));
    listaAdvertencias.querySelectorAll(".adv-mas").forEach(li => li.remove());
    items.forEach(li => { li.hidden = false; });

    const cabe = c => {

        panel.style.width = c.ancho + "px";
        return panel.offsetHeight <= c.inferior - c.superior;

    };

    let elegido = null;

    // 1º tamaño normal, 2º compacto (sin cambiar colores ni orden).
    for (const compacto of [false, true]) {

        panel.classList.toggle("compacto", compacto);
        elegido = candidatos.find(cabe) || null;

        if (elegido) {

            break;

        }

    }

    if (!elegido && candidatos.length) {

        // Último recurso: zona más alta; se muestran las advertencias de
        // mayor prioridad (el orden ya es por prioridad) y "+N" con el
        // resto en su descripción emergente. Nunca se superpone.
        elegido = candidatos.reduce((a, b) => (b.inferior - b.superior > a.inferior - a.superior ? b : a));
        panel.style.width = elegido.ancho + "px";

        const mas = document.createElement("li");
        mas.className = "advertencia adv-mas";
        listaAdvertencias.appendChild(mas);

        let visibles = items.length;

        do {

            visibles--;
            items.forEach((li, i) => { li.hidden = i >= visibles; });
            const ocultas = items.slice(visibles);
            mas.textContent = "+" + ocultas.length + " MÁS";
            mas.className = "advertencia adv-mas adv-" +
                (ocultas.some(li => li.classList.contains("adv-rojo")) ? "rojo" : "ambar");
            mas.title = ocultas.map(li => li.textContent).join(" · ");

        } while (visibles > 1 && panel.offsetHeight > elegido.inferior - elegido.superior);

        panel.style.maxHeight = Math.floor(elegido.inferior - elegido.superior) + "px";

    }

    if (!elegido) {

        return;

    }

    panel.style.left = IZQ + "px";
    panel.style.bottom = "auto";
    panel.style.top = Math.round(elegido.inferior - panel.offsetHeight) + "px";

}

new ResizeObserver(posicionarPanelAdvertencias)
    .observe(panelAdvertencias.parentElement);

window.addEventListener("resize", posicionarPanelAdvertencias);

actualizarAdvertencias.listo = true;

actualizarCurvaCapacidad.listo = true;

actualizarCurvaCapacidad(true);

actualizarPantalla();


/* =========================================================
   DIAGRAMA FASORIAL — REPRESENTACIÓN SVG (Etapa F3-C)

   Escala gráfica FIJA y común a ambos modelos: 150 unidades del
   viewBox por pu. La ventana del plano se ajusta a los extremos
   realmente alcanzables por el AVR (incluidos transitorios y
   modo MANUAL: 0 ≤ P ≤ 1, −1 ≤ Q ≤ 1, 0.8 ≤ V ≤ 1.2), medidos
   por simulación:  Re ∈ [−1.075, 2.506] pu,  Im ∈ [−1.218, 1.881] pu,
   más una holgura:  Re ∈ [−1.12, 2.56] pu,  Im ∈ [−1.26, 1.92] pu.
   Margen interior de 8 unidades. El SVG conserva proporciones al
   cambiar el tamaño (preserveAspectRatio por omisión: xMidYMid meet).
   Coordenadas SVG: X = X0 + k·Re,  Y = Y0 − k·Im.

   Las etiquetas se colocan sin mover los vectores: para cada una
   se evalúan posiciones candidatas alrededor de su punto de
   referencia y se elige la de menor penalización (fuera del
   recuadro, superposición con otras etiquetas, cruce con vectores,
   arcos y ejes, distancia). Si queda alejada, una línea guía la une
   con su vector. Una pequeña preferencia por la posición anterior
   evita saltos durante la animación.
========================================================= */

const DiagramaFasorial = (() => {

    const NS = "http://www.w3.org/2000/svg";

    const K = 150;                                   // unidades / pu
    const MARGEN = 8;
    const RE_MIN = -1.12, RE_MAX = 2.56;
    const IM_MIN = -1.26, IM_MAX = 1.92;
    const X0 = MARGEN - RE_MIN * K;                  // 176
    const Y0 = MARGEN + IM_MAX * K;                  // 296
    const ANCHO = MARGEN * 2 + (RE_MAX - RE_MIN) * K;   // 568
    const ALTO = MARGEN * 2 + (IM_MAX - IM_MIN) * K;    // 493

    const FUENTE = 16;            // etiquetas de vectores (unidades)
    const FUENTE_SUB = 12;

    const COLORES = {
        V: "#1f4e79", Ia: "#c62828", RaIa: "#6d4c41", jX: "#2e7d32",
        Ef: "#6a1b9a", EQ: "#9c4dcc", jXdXq: "#ef6c00", Id: "#ad1457",
        Iq: "#00838f", jXdId: "#827717", jXqIq: "#0277bd", eje: "#78909c",
        ang: "#455a64"
    };

    /* Vectores de cada modelo (orden = orden de dibujo).
       prio: prioridad de colocación de la etiqueta (menor = antes). */
    const VECTORES = {
        liso: [
            { id: "V",     ini: "O",  fin: "Vf",  color: COLORES.V,    ancho: 3,   etiqueta: "V",          origen: true, valor: "Vf",    prio: 2 },
            { id: "Ia",    ini: "O",  fin: "Ia",  color: COLORES.Ia,   ancho: 2.5, etiqueta: "I{a}",       origen: true, valor: "Ia",    prio: 3 },
            { id: "RaIa",  ini: "Vf", fin: "A",   color: COLORES.RaIa, ancho: 2.5, etiqueta: "R{a}·I{a}",  guia: true,   valor: "RaIa",  prio: 11 },
            { id: "jXsIa", ini: "A",  fin: "Ef",  color: COLORES.jX,   ancho: 2.5, etiqueta: "jX{s}·I{a}",               valor: "jXsIa", prio: 5 },
            { id: "Ef",    ini: "O",  fin: "Ef",  color: COLORES.Ef,   ancho: 3.5, etiqueta: "E{f}",       origen: true, valor: "Ef",    prio: 1 }
        ],
        salientes: [
            { id: "Id",      ini: "O",  fin: "IdV",   color: COLORES.Id,    ancho: 2,   trazo: "6 4", etiqueta: "I{d}",  origen: true, valor: "IdV",   prio: 7 },
            { id: "Iq",      ini: "O",  fin: "IqV",   color: COLORES.Iq,    ancho: 2,   trazo: "6 4", etiqueta: "I{q}",  origen: true, valor: "IqV",   prio: 8 },
            { id: "V",       ini: "O",  fin: "Vf",    color: COLORES.V,     ancho: 3,   etiqueta: "V",            origen: true, valor: "Vf",      prio: 2 },
            { id: "Ia",      ini: "O",  fin: "Ia",    color: COLORES.Ia,    ancho: 2.5, etiqueta: "I{a}",         origen: true, valor: "Ia",      prio: 3 },
            { id: "EQ",      ini: "O",  fin: "EQ",    color: COLORES.EQ,    ancho: 2.5, trazo: "8 5", etiqueta: "E{Q}", origen: true, valor: "EQ", prio: 4 },
            { id: "jXqIq",   ini: "A",  fin: "B",     color: COLORES.jXqIq, ancho: 2,   trazo: "4 3", etiqueta: "jX{q}·I{q}",  valor: "jXqIq",   prio: 10 },
            { id: "jXdId",   ini: "B",  fin: "EfAlt", color: COLORES.jXdId, ancho: 2,   trazo: "4 3", etiqueta: "jX{d}·I{d}",  valor: "jXdId",   prio: 9 },
            { id: "RaIa",    ini: "Vf", fin: "A",     color: COLORES.RaIa,  ancho: 2.5, etiqueta: "R{a}·I{a}",    guia: true,   valor: "RaIa",    prio: 11 },
            { id: "jXqIa",   ini: "A",  fin: "EQ",    color: COLORES.jX,    ancho: 2.5, etiqueta: "jX{q}·I{a}",                 valor: "jXqIa",   prio: 5 },
            { id: "jXdXqId", ini: "EQ", fin: "Ef",    color: COLORES.jXdXq, ancho: 2.5, etiqueta: "j(X{d}−X{q})·I{d}",          valor: "jXdXqId", prio: 6 },
            { id: "Ef",      ini: "O",  fin: "Ef",    color: COLORES.Ef,    ancho: 3.5, etiqueta: "E{f}",         origen: true, valor: "Ef",      prio: 1 }
        ]
    };

    /* Radios distintos para que los arcos no se superpongan entre
       sí (ψ comparte región con φ y δ). */
    const ARCOS = {
        phi:   { color: COLORES.Ia,  radio: 0.38, simbolo: "φ", prio: 13 },
        delta: { color: COLORES.Ef,  radio: 0.60, simbolo: "δ", prio: 12 },
        psi:   { color: COLORES.ang, radio: 0.25, simbolo: "ψ", prio: 14 }
    };

    const svg = document.getElementById("svgDiagramaFasorial");
    const area = document.getElementById("areaDiagramaFasorial");
    const tituloModelo = document.getElementById("tituloModeloFasorial");
    const aviso = document.getElementById("avisoFasorial");
    const textoParametros = document.getElementById("parametrosFasoriales");
    const textoEntradas = document.getElementById("entradasFasoriales");

    const casillas = {
        liso: document.getElementById("casillasFasorialLiso"),
        salientes: document.getElementById("casillasFasorialSalientes")
    };

    const ind = {
        magIa: document.getElementById("fasMagIa"),
        magEf: document.getElementById("fasMagEf"),
        phi: document.getElementById("fasPhi"),
        delta: document.getElementById("fasDelta"),
        fp: document.getElementById("fasFP"),
        Id: document.getElementById("fasId"),
        Iq: document.getElementById("fasIq"),
        magEQ: document.getElementById("fasMagEQ")
    };

    let tipoActual = null;
    let ultimo = null;          // { tipo, estado, vigente, version }  (F4-B1)
    let version = 0;            // cambia con las casillas
    let deltaPrevio = 0;
    let resultado = null;

    /* Posición anterior de cada etiqueta (desplazamiento respecto
       de su punto de referencia), para dar estabilidad. */
    const memoriaEtiquetas = {};

    /* ---------- Utilidades SVG ---------- */

    function crear(padre, etiqueta, atributos) {

        const el = document.createElementNS(NS, etiqueta);

        for (const [k, v] of Object.entries(atributos || {})) {

            el.setAttribute(k, v);

        }

        padre.appendChild(el);

        return el;

    }

    const aX = re => X0 + K * re;
    const aY = im => Y0 - K * im;
    const punto = z => ({ x: aX(z.re), y: aY(z.im) });

    /* Texto con subíndices: "jX{s}·I{a}". */
    function escribirTexto(el, texto) {

        while (el.firstChild) {

            el.removeChild(el.firstChild);

        }

        const partes = texto.split(/(\{[^}]*\})/).filter(Boolean);

        let sub = false;

        for (const parte of partes) {

            const esSub = parte.startsWith("{");

            const t = crear(el, "tspan");

            t.textContent = esSub ? parte.slice(1, -1) : parte;

            if (esSub !== sub) {

                t.setAttribute("dy", esSub ? "4" : "-4");

            }

            if (esSub) {

                t.setAttribute("font-size", String(FUENTE_SUB));

            }

            sub = esSub;

        }

        if (sub) {

            crear(el, "tspan", { dy: "-4" }).textContent = "​";

        }

    }

    /* Ancho aproximado del texto en negrita (Arial), sin medir el
       DOM: funciona también con la ventana oculta. */
    function anchoTexto(texto) {

        let w = 0;

        texto.split(/(\{[^}]*\})/).filter(Boolean).forEach(p => {

            const s = p.startsWith("{") ? p.slice(1, -1) : p;

            const f = p.startsWith("{") ? FUENTE_SUB : FUENTE;

            for (const ch of s) {

                w += f * ("·()|".includes(ch) ? 0.34 : (ch === "j" ? 0.3 : 0.63));

            }

        });

        return w;

    }

    /* ---------- Construcción única de los elementos ---------- */

    const capas = {};
    const elementos = { liso: {}, salientes: {} };
    const fijos = [];               // rectángulos de textos fijos

    function rectTexto(x, y, w, h, ancla) {

        const x0 = ancla === "end" ? x - w : (ancla === "middle" ? x - w / 2 : x);

        return { x: x0 + w / 2, y: y - h / 2 + 3, w, h };

    }

    function construir() {

        svg.setAttribute("viewBox", "0 0 " + ANCHO + " " + ALTO.toFixed(1));

        const defs = crear(svg, "defs");

        const clip = crear(defs, "clipPath", { id: "recorteFasorial" });

        crear(clip, "rect", { x: 0, y: 0, width: ANCHO, height: ALTO });

        /* Cuadrícula de 0.5 pu y ejes de referencia */
        const cuadricula = crear(svg, "g", { "clip-path": "url(#recorteFasorial)" });

        for (let re = -1.0; re <= RE_MAX + 1e-9; re += 0.5) {

            if (Math.abs(re) < 1e-9) continue;

            crear(cuadricula, "line", {
                x1: aX(re), y1: 0, x2: aX(re), y2: ALTO,
                stroke: "#eef1f3", "stroke-width": 1
            });

        }

        for (let im = -1.0; im <= IM_MAX + 1e-9; im += 0.5) {

            if (Math.abs(im) < 1e-9) continue;

            crear(cuadricula, "line", {
                x1: 0, y1: aY(im), x2: ANCHO, y2: aY(im),
                stroke: "#eef1f3", "stroke-width": 1
            });

        }

        crear(cuadricula, "line", {
            x1: 0, y1: Y0, x2: ANCHO, y2: Y0, stroke: "#90a4ae", "stroke-width": 1.2
        });

        crear(cuadricula, "line", {
            x1: X0, y1: 0, x2: X0, y2: ALTO, stroke: "#90a4ae", "stroke-width": 1.2
        });

        for (let re = -1.0; re <= 2.5 + 1e-9; re += 0.5) {

            if (Math.abs(re) < 1e-9) continue;

            crear(cuadricula, "line", {
                x1: aX(re), y1: Y0 - 3, x2: aX(re), y2: Y0 + 3,
                stroke: "#90a4ae", "stroke-width": 1
            });

        }

        /* Rótulos fijos (registrados como obstáculos) */
        const tRe = crear(svg, "text", {
            class: "fas-texto-eje", x: ANCHO - MARGEN, y: Y0 + 15, "text-anchor": "end"
        });
        tRe.textContent = "Re · referencia V = V∠0°";
        fijos.push(rectTexto(ANCHO - MARGEN, Y0 + 15, 150, 15, "end"));

        const tIm = crear(svg, "text", {
            class: "fas-texto-eje", x: X0 + 6, y: MARGEN + 10
        });
        tIm.textContent = "Im";
        fijos.push(rectTexto(X0 + 6, MARGEN + 10, 18, 15, "start"));

        /* Barra de escala (fija) */
        const yb = ALTO - MARGEN - 2, xb = ANCHO - MARGEN - 0.5 * K;

        crear(svg, "path", {
            d: `M${xb} ${yb - 5} V${yb} H${xb + 0.5 * K} V${yb - 5}`,
            fill: "none", stroke: "#78909c", "stroke-width": 1.2
        });

        const tEsc = crear(svg, "text", {
            class: "fas-texto-eje", x: ANCHO - MARGEN, y: yb - 8, "text-anchor": "end"
        });
        tEsc.textContent = "0.5 pu · escala fija";
        fijos.push(rectTexto(ANCHO - MARGEN, yb - 8, 118, 15, "end"));
        fijos.push({ x: xb + 0.25 * K, y: yb - 2.5, w: 0.5 * K, h: 7 });

        capas.ejes = crear(svg, "g", { "clip-path": "url(#recorteFasorial)" });
        capas.arcos = crear(svg, "g");
        capas.vectores = crear(svg, "g");
        capas.guias = crear(svg, "g");
        capas.etiquetas = crear(svg, "g");

        const nuevaEtiqueta = (color, texto, ancho) => {

            const guia = crear(capas.guias, "line", {
                class: "fas-guia", stroke: color, display: "none"
            });

            const t = crear(capas.etiquetas, "text", {
                class: "fas-texto", fill: color, display: "none",
                "text-anchor": "middle", "dominant-baseline": "middle"
            });

            escribirTexto(t, texto);

            return { texto: t, guia, w: ancho + 6, h: FUENTE + 4 };

        };

        /* Ejes d y q (solo polos salientes) */
        for (const ejeId of ["ejeD", "ejeQ"]) {

            const g = crear(capas.ejes, "g", { display: "none" });

            const linea = crear(g, "line", {
                stroke: COLORES.eje, "stroke-width": 1.2, "stroke-dasharray": "10 4 2 4"
            });

            const simbolo = ejeId === "ejeD" ? "d" : "q";

            const e = nuevaEtiqueta(COLORES.eje, simbolo, anchoTexto(simbolo));

            elementos.salientes[ejeId] = Object.assign({ g, linea, prio: ejeId === "ejeQ" ? 15 : 16 }, e);

        }

        /* Arcos (por modelo): arco, marcas extremas y punta */
        for (const tipo of ["liso", "salientes"]) {

            for (const [arcoId, def] of Object.entries(ARCOS)) {

                if (tipo === "liso" && arcoId === "psi") continue;

                const g = crear(capas.arcos, "g", { display: "none" });

                const camino = crear(g, "path", {
                    fill: "none", stroke: def.color, "stroke-width": 1.6
                });

                const marcas = crear(g, "path", {
                    fill: "none", stroke: def.color, "stroke-width": 1.2
                });

                const punta = crear(g, "polygon", { fill: def.color });

                const e = nuevaEtiqueta(def.color, def.simbolo, anchoTexto(def.simbolo));

                elementos[tipo][arcoId] = Object.assign({ g, camino, marcas, punta, def }, e);

            }

        }

        /* Vectores (por modelo) */
        for (const tipo of ["liso", "salientes"]) {

            for (const def of VECTORES[tipo]) {

                const g = crear(capas.vectores, "g", { display: "none" });

                const titulo = crear(g, "title");

                const linea = crear(g, "line", {
                    stroke: def.color, "stroke-width": def.ancho,
                    "stroke-linecap": "round"
                });

                if (def.trazo) {

                    linea.setAttribute("stroke-dasharray", def.trazo);

                }

                const punta = crear(g, "polygon", { fill: def.color });

                const e = nuevaEtiqueta(def.color, def.etiqueta, anchoTexto(def.etiqueta));

                elementos[tipo][def.id] = Object.assign({ g, titulo, linea, punta, def }, e);

            }

        }

    }

    /* ---------- Geometría de la colocación de etiquetas ---------- */

    /* ¿Corta el segmento s al rectángulo r (centro x, y; w, h)?
       (Liang–Barsky) */
    function cruza(s, r) {

        const x0 = r.x - r.w / 2, x1 = r.x + r.w / 2;
        const y0 = r.y - r.h / 2, y1 = r.y + r.h / 2;

        const dx = s.x2 - s.x1, dy = s.y2 - s.y1;

        const p = [-dx, dx, -dy, dy];
        const q = [s.x1 - x0, x1 - s.x1, s.y1 - y0, y1 - s.y1];

        let t0 = 0, t1 = 1;

        for (let i = 0; i < 4; i++) {

            if (p[i] === 0) {

                if (q[i] < 0) return false;

            }

            else {

                const t = q[i] / p[i];

                if (p[i] < 0) {

                    if (t > t1) return false;
                    if (t > t0) t0 = t;

                }

                else {

                    if (t < t0) return false;
                    if (t < t1) t1 = t;

                }

            }

        }

        return true;

    }

    function solape(a, b) {

        const sx = (a.w + b.w) / 2 - Math.abs(a.x - b.x);
        const sy = (a.h + b.h) / 2 - Math.abs(a.y - b.y);

        return sx > 0 && sy > 0 ? sx * sy : 0;

    }

    function puntuar(e, c, puestos, segmentos) {

        const r = { x: c.x, y: c.y, w: e.w, h: e.h };

        let s = 0;

        // Fuera del recuadro del SVG
        const fuera =
            Math.max(0, MARGEN - (r.x - r.w / 2)) + Math.max(0, (r.x + r.w / 2) - (ANCHO - MARGEN)) +
            Math.max(0, MARGEN - (r.y - r.h / 2)) + Math.max(0, (r.y + r.h / 2) - (ALTO - MARGEN));

        s += fuera * 400;

        // Superposición con etiquetas ya colocadas y rótulos fijos
        for (const p of puestos) {

            const a = solape(r, p);

            if (a > 0) s += 600 + 8 * a;

        }

        // Cruce con vectores, arcos y ejes (rectángulo con holgura)
        const rh = { x: r.x, y: r.y, w: r.w + 4, h: r.h + 2 };

        for (const sg of segmentos) {

            if (cruza(sg, rh)) s += 140 * sg.peso;

        }

        // Distancia a la posición preferida
        s += 0.9 * Math.hypot(c.x - e.pref.x, c.y - e.pref.y);

        return s;

    }

    function candidatos(e) {

        const lista = [{ x: e.pref.x, y: e.pref.y }];

        const prev = memoriaEtiquetas[e.clave];

        if (prev) {

            lista.push({ x: e.ancla.x + prev.dx, y: e.ancla.y + prev.dy, anterior: true });

        }

        for (const extra of [0, 8, 18, 30, 46, 64]) {

            for (let k = 0; k < 24; k++) {

                const t = k * Math.PI / 12;

                const ux = Math.cos(t), uy = Math.sin(t);

                const d = 4 + (Math.abs(ux) * e.w + Math.abs(uy) * e.h) / 2 + extra;

                lista.push({ x: e.ancla.x + ux * d, y: e.ancla.y + uy * d });

            }

        }

        return lista;

    }

    function colocarEtiquetas(etiquetas, segmentos) {

        const puestos = fijos.slice();

        etiquetas.sort((a, b) => a.prio - b.prio);

        for (const e of etiquetas) {

            /* Ancho real del texto: se mide una vez, la primera vez
               que la ventana es visible (con la vista oculta se usa
               la estimación). */
            if (!e.el.medido) {

                e.el.texto.removeAttribute("display");
                e.el.texto.setAttribute("x", "0");
                e.el.texto.setAttribute("y", "0");

                const bb = e.el.texto.getBBox();

                if (bb.width > 0) {

                    // Tamaño real y desfase del centro (subíndices).
                    e.el.w = bb.width + 6;
                    e.el.h = bb.height + 2;
                    e.el.cx = bb.x + bb.width / 2;
                    e.el.cy = bb.y + bb.height / 2;
                    e.el.medido = true;

                }

                e.w = e.el.w;
                e.h = e.el.h;

            }

            let mejor = null, ms = Infinity, anterior = null, sa = Infinity;

            for (const c of candidatos(e)) {

                const s = puntuar(e, c, puestos, segmentos);

                if (c.anterior) {

                    anterior = c;
                    sa = s;

                }

                if (s < ms) {

                    ms = s;
                    mejor = c;

                }

            }

            /* Histéresis: se conserva la posición anterior mientras
               siga libre (sin superposición, sin salir del recuadro y
               sin cruzar vectores ni arcos) y no sea claramente peor
               que la mejor. */
            if (anterior && sa < 110 && sa <= ms + 70) {

                mejor = anterior;

            }

            e.x = mejor.x;
            e.y = mejor.y;

            memoriaEtiquetas[e.clave] = { dx: e.x - e.ancla.x, dy: e.y - e.ancla.y };

            puestos.push({ x: e.x, y: e.y, w: e.w, h: e.h });

            e.el.texto.setAttribute("x", (e.x - (e.el.cx || 0)).toFixed(1));
            e.el.texto.setAttribute("y", (e.y - (e.el.cy || 0)).toFixed(1));
            e.el.texto.removeAttribute("display");

            /* Línea guía si la etiqueta queda separada de su vector */
            const bx = Math.max(e.x - e.w / 2, Math.min(e.x + e.w / 2, e.ancla.x));
            const by = Math.max(e.y - e.h / 2, Math.min(e.y + e.h / 2, e.ancla.y));

            const dist = Math.hypot(bx - e.ancla.x, by - e.ancla.y);

            if (e.siempreGuia || dist > e.distGuia) {

                e.el.guia.setAttribute("x1", e.ancla.x.toFixed(1));
                e.el.guia.setAttribute("y1", e.ancla.y.toFixed(1));
                e.el.guia.setAttribute("x2", bx.toFixed(1));
                e.el.guia.setAttribute("y2", by.toFixed(1));
                e.el.guia.removeAttribute("display");

            }

        }

    }

    /* ---------- Dibujo ---------- */

    function visibles(tipo) {

        const v = {};

        casillas[tipo]
            .querySelectorAll("input[data-elemento]")
            .forEach(c => { v[c.dataset.elemento] = c.checked; });

        return v;

    }

    function formatoNumero(x, dec, conSigno) {

        let t = Math.abs(x).toFixed(dec);

        if (Number(t) === 0) {

            return (0).toFixed(dec);

        }

        return (x < 0 ? "−" : (conSigno ? "+" : "")) + t;

    }

    const grados = t => t * 180 / Math.PI;

    function formatoPolar(z) {

        return formatoNumero(Cx.abs(z), 4) + " pu ∠ " +
            formatoNumero(grados(Cx.arg(z)), 2, true) + "°";

    }

    function dibujarVector(el, a, b, etiquetas, segmentos, tipo) {

        const p1 = punto(a), p2 = punto(b);

        const dx = p2.x - p1.x, dy = p2.y - p1.y;

        const L = Math.hypot(dx, dy);

        if (!(L > 1e-6)) {

            return;

        }

        const ux = dx / L, uy = dy / L;

        // Punta proporcional a la longitud: un vector corto (Ra·Ia)
        // no se exagera.
        const h = Math.min(12, 0.45 * L), w = h * 0.42;

        el.linea.setAttribute("x1", p1.x.toFixed(2));
        el.linea.setAttribute("y1", p1.y.toFixed(2));
        el.linea.setAttribute("x2", (p2.x - ux * h * 0.7).toFixed(2));
        el.linea.setAttribute("y2", (p2.y - uy * h * 0.7).toFixed(2));

        const bx = p2.x - ux * h, by = p2.y - uy * h;

        el.punta.setAttribute("points",
            p2.x.toFixed(2) + "," + p2.y.toFixed(2) + " " +
            (bx - uy * w).toFixed(2) + "," + (by + ux * w).toFixed(2) + " " +
            (bx + uy * w).toFixed(2) + "," + (by - ux * w).toFixed(2));

        el.g.removeAttribute("display");

        segmentos.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, peso: 1 });

        /* Punto de referencia y posición preferida de la etiqueta */
        let ancla, pref, distGuia = 16, siempreGuia = false;

        if (el.def.guia) {

            // Ra·Ia: longitud real (≈ 0.6 unidades); etiqueta separada
            // con línea guía, por debajo del eje real.
            ancla = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            pref = { x: ancla.x + 30, y: ancla.y + 34 };
            siempreGuia = true;

        }

        else if (el.def.origen) {

            // Más allá de la punta, en la prolongación del vector.
            ancla = p2;

            const d = 5 + (Math.abs(ux) * el.w + Math.abs(uy) * el.h) / 2;

            pref = { x: p2.x + ux * d, y: p2.y + uy * d };

        }

        else {

            // Punto medio, hacia el lado exterior (lejos del origen).
            let nx = -uy, ny = ux;

            ancla = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

            if (nx * (ancla.x - X0) + ny * (ancla.y - Y0) < 0) {

                nx = -nx; ny = -ny;

            }

            const d = 5 + (Math.abs(nx) * el.w + Math.abs(ny) * el.h) / 2;

            pref = { x: ancla.x + nx * d, y: ancla.y + ny * d };

            // Vector corto: la etiqueta puede requerir guía.
            distGuia = Math.max(12, L / 2);

        }

        etiquetas.push({
            el, clave: tipo + "@" + el.def.id, prio: el.def.prio,
            ancla, pref, w: el.w, h: el.h, distGuia, siempreGuia
        });

    }

    function dibujarArco(el, t1, t2, etiquetas, segmentos, tipo, arcoId) {

        // Arco desde el ángulo t1 hasta t2 (radianes, antihorario
        // positivo), centrado en el origen.
        const dt = normalizarAngulo(t2 - t1);

        const r = el.def.radio * K;

        if (Math.abs(dt) < 1e-4) {

            return;

        }

        const pt = t => ({ x: X0 + r * Math.cos(t), y: Y0 - r * Math.sin(t) });

        const a = pt(t1), b = pt(t1 + dt);

        // En pantalla (y hacia abajo) el giro antihorario es sweep = 0.
        const barrido = dt > 0 ? 0 : 1;

        el.camino.setAttribute("d",
            "M" + a.x.toFixed(2) + " " + a.y.toFixed(2) +
            " A" + r.toFixed(2) + " " + r.toFixed(2) + " 0 0 " + barrido + " " +
            b.x.toFixed(2) + " " + b.y.toFixed(2));

        const longitud = Math.abs(dt) * r;

        /* Marcas radiales en los extremos: hacen visible un ángulo
           pequeño sin alterar su valor. */
        const marca = t => {

            const c = Math.cos(t), s = -Math.sin(t);

            return "M" + (X0 + c * (r - 5)).toFixed(2) + " " + (Y0 + s * (r - 5)).toFixed(2) +
                " L" + (X0 + c * (r + 5)).toFixed(2) + " " + (Y0 + s * (r + 5)).toFixed(2);

        };

        el.marcas.setAttribute("d", longitud < 30 ? marca(t1) + " " + marca(t1 + dt) : "");

        /* Punta de flecha que indica el sentido (signo) del ángulo */
        if (longitud > 16) {

            const te = t1 + dt;

            const sg = dt > 0 ? 1 : -1;

            // Tangente en pantalla en el sentido del recorrido
            const tx = -Math.sin(te) * sg, ty = -Math.cos(te) * sg;

            const h = 7, w = 3;

            const bx = b.x - tx * h, by = b.y - ty * h;

            el.punta.setAttribute("points",
                b.x.toFixed(2) + "," + b.y.toFixed(2) + " " +
                (bx - ty * w).toFixed(2) + "," + (by + tx * w).toFixed(2) + " " +
                (bx + ty * w).toFixed(2) + "," + (by - tx * w).toFixed(2));

        }

        else {

            el.punta.setAttribute("points", "");

        }

        el.g.removeAttribute("display");

        // El arco como obstáculo (poligonal de 8 tramos)
        let prev = a;

        for (let i = 1; i <= 8; i++) {

            const p = pt(t1 + dt * i / 8);

            segmentos.push({ x1: prev.x, y1: prev.y, x2: p.x, y2: p.y, peso: 0.7 });

            prev = p;

        }

        const tm = t1 + dt / 2;

        const ux = Math.cos(tm), uy = -Math.sin(tm);

        const ancla = pt(tm);

        const d = 4 + (Math.abs(ux) * el.w + Math.abs(uy) * el.h) / 2;

        etiquetas.push({
            el, clave: tipo + "@" + arcoId, prio: el.def.prio,
            ancla, pref: { x: ancla.x + ux * d, y: ancla.y + uy * d },
            w: el.w, h: el.h, distGuia: 10, siempreGuia: false
        });

    }

    /* Ejes d y q: rectas por el origen, recortadas al plano. */
    function dibujarEje(el, t, etiquetas, segmentos, clave) {

        const R = 5 * K;

        const x1 = X0 - R * Math.cos(t), y1 = Y0 + R * Math.sin(t);
        const x2 = X0 + R * Math.cos(t), y2 = Y0 - R * Math.sin(t);

        el.linea.setAttribute("x1", x1.toFixed(2));
        el.linea.setAttribute("y1", y1.toFixed(2));
        el.linea.setAttribute("x2", x2.toFixed(2));
        el.linea.setAttribute("y2", y2.toFixed(2));

        el.g.removeAttribute("display");

        segmentos.push({ x1, y1, x2, y2, peso: 0.35 });

        // Referencia de la etiqueta: extremo positivo, dentro del recuadro.
        const cx = Math.cos(t), sy = -Math.sin(t);
        const xmin = MARGEN + 14, xmax = ANCHO - MARGEN - 14;
        const ymin = MARGEN + 14, ymax = ALTO - MARGEN - 14;

        let s = Infinity;

        if (cx > 1e-9) s = Math.min(s, (xmax - X0) / cx);
        if (cx < -1e-9) s = Math.min(s, (xmin - X0) / cx);
        if (sy > 1e-9) s = Math.min(s, (ymax - Y0) / sy);
        if (sy < -1e-9) s = Math.min(s, (ymin - Y0) / sy);

        const ancla = { x: X0 + cx * s, y: Y0 + sy * s };

        etiquetas.push({
            el, clave, prio: el.prio, ancla,
            pref: { x: ancla.x - sy * 12, y: ancla.y + cx * 12 },
            w: el.w, h: el.h, distGuia: 1e9, siempreGuia: false
        });

    }

    function ocultarModelo(tipo) {

        for (const el of Object.values(elementos[tipo])) {

            el.g.setAttribute("display", "none");
            el.texto.setAttribute("display", "none");
            el.guia.setAttribute("display", "none");

        }

    }

    function dibujar(r) {

        const tipo = r.tipo;

        const vis = visibles(tipo);

        ocultarModelo(tipo === "liso" ? "salientes" : "liso");

        ocultarModelo(tipo);

        const puntos = Object.assign({ O: Cx.de(0, 0) }, r);

        const etiquetas = [];

        // Ejes de referencia como obstáculos leves
        const segmentos = [
            { x1: 0, y1: Y0, x2: ANCHO, y2: Y0, peso: 0.3 },
            { x1: X0, y1: 0, x2: X0, y2: ALTO, peso: 0.3 }
        ];

        if (tipo === "salientes") {

            if (vis.ejeD) dibujarEje(elementos.salientes.ejeD, r.delta - Math.PI / 2, etiquetas, segmentos, "ejeD");
            if (vis.ejeQ) dibujarEje(elementos.salientes.ejeQ, r.delta, etiquetas, segmentos, "ejeQ");

        }

        for (const def of VECTORES[tipo]) {

            if (!vis[def.id]) continue;

            const el = elementos[tipo][def.id];

            el.titulo.textContent =
                el.def.etiqueta.replace(/[{}]/g, "") + " = " + formatoPolar(r[def.valor]);

            dibujarVector(el, puntos[def.ini], puntos[def.fin], etiquetas, segmentos, tipo);

        }

        // φ: de Ia a V (0°); δ: de V a Ef (o al eje q); ψ: de Ia al eje q.
        if (vis.phi && r.magIa > EPS_FASORIAL) {

            dibujarArco(elementos[tipo].phi, -r.phi, 0, etiquetas, segmentos, tipo, "phi");

        }

        const definidoDelta = tipo === "liso" ? r.magEf > EPS_FASORIAL : !r.qIndefinido;

        if (vis.delta && definidoDelta) {

            dibujarArco(elementos[tipo].delta, 0, r.delta, etiquetas, segmentos, tipo, "delta");

        }

        if (tipo === "salientes" && vis.psi && r.magIa > EPS_FASORIAL && !r.qIndefinido) {

            dibujarArco(elementos.salientes.psi, -r.phi, r.delta, etiquetas, segmentos, tipo, "psi");

        }

        colocarEtiquetas(etiquetas, segmentos);

    }

    function mostrarIndicadores(r) {

        ind.magIa.textContent = formatoNumero(r.magIa, 3) + " pu";
        ind.magEf.textContent = formatoNumero(r.magEf, 3) + " pu";
        ind.phi.textContent = formatoNumero(grados(r.phi), 2, true) + "°";
        ind.delta.textContent = formatoNumero(grados(r.delta), 2, true) + "°";
        ind.fp.textContent = formatoNumero(r.fp, 3) + " " + r.caracter;

        if (r.tipo === "salientes") {

            ind.Id.textContent = formatoNumero(r.Id, 3, true) + " pu";
            ind.Iq.textContent = formatoNumero(r.Iq, 3, true) + " pu";
            ind.magEQ.textContent = formatoNumero(r.magEQ, 3) + " pu";

        }

        let textoAviso = "";

        if (r.tipo === "salientes" && r.qIndefinido) {

            textoAviso = "EQ ≈ 0: eje q indefinido; se conserva la última orientación.";

        }

        else if (r.tipo === "salientes" && r.EfEje < 0) {

            textoAviso = "Ef queda opuesto al eje q (excitación negativa): punto sin significado físico.";

        }

        aviso.hidden = textoAviso === "";
        aviso.textContent = textoAviso;

        textoEntradas.textContent =
            "Entradas: PG = " + formatoNumero(r.P, 3) +
            " pu · QG = " + formatoNumero(r.Q, 3, true) +
            " pu · V = " + formatoNumero(r.V, 3) + " pu.";

    }

    function mostrarModelo(tipo) {

        const par = PARAMETROS_FASORIALES[tipo];

        tituloModelo.textContent =
            tipo === "liso" ? "ROTOR CILÍNDRICO" : "ROTOR DE POLOS SALIENTES";

        casillas.liso.hidden = tipo !== "liso";
        casillas.salientes.hidden = tipo !== "salientes";

        area.classList.toggle("modelo-liso", tipo === "liso");

        textoParametros.textContent = tipo === "liso"
            ? "Parámetros eléctricos supuestos: Ra = " + par.Ra.toFixed(3) + " pu · Xs = " + par.Xs.toFixed(2) + " pu."
            : "Parámetros eléctricos supuestos: Ra = " + par.Ra.toFixed(3) + " pu · Xd = " + par.Xd.toFixed(2) +
              " pu · Xq = " + par.Xq.toFixed(2) + " pu.";

    }

    /* ---------- Interfaz pública ---------- */

    function actualizar(forzar) {

        const radio = document.querySelector('input[name="rotorCorte"]:checked');

        const tipo = radio && radio.value === "liso" ? "liso" : "salientes";

        if (tipo !== tipoActual) {

            tipoActual = tipo;
            mostrarModelo(tipo);
            forzar = true;

        }

        // Solo se dibuja con la vista fasorial visible; al entrar en
        // ella se fuerza la actualización.
        if (!contenedorPrincipal.classList.contains("modo-fasorial") && !forzar) {

            return;

        }

        /* F4-B1: el diagrama NO resuelve nada (representa fasores de la
           solución integrada).
           F4-C3: con la evaluación operativa única (evaluarOperacion):
             · admisible (punto verde) → estado actual;
             · no admisible (punto rojo) → se CONGELA solo la representación
               en el último estado PERMITIDO (ultimoEstadoPermitido) y se
               muestra una sola leyenda con la misma causa que en el AVR.
           El AVR, el modelo y la animación mecánica siguen. */
        const evo = evaluacionOperativa;
        const permitido = !!(evo && evo.admisible);
        const est = permitido ? ultimoEstadoValido : ultimoEstadoPermitido;
        const leyenda = permitido || !evo || !evo.principal
            ? ""
            : evo.principal.texto + LEYENDA_FASORIAL_RETENCION;
        const nivelLeyenda = evo && evo.principal ? evo.principal.nivel : "";

        const ponerAviso = (texto, nivel) => {

            aviso.hidden = texto === "";
            aviso.textContent = texto;
            aviso.parentElement.classList.toggle("con-retencion", texto !== "");
            aviso.classList.toggle("aviso-rojo", nivel === "rojo");
            aviso.classList.toggle("aviso-ambar", nivel === "ambar");

        };

        if (!est || est.tipo !== tipo || !est.fasores) {

            // Aún no existe un estado permitido de este rotor que retener.
            ocultarModelo("liso");
            ocultarModelo("salientes");
            resultado = null;
            ultimo = null;

            for (const el of Object.values(ind)) {

                el.textContent = "—";

            }

            ponerAviso((evo && evo.principal ? evo.principal.texto : LEYENDAS_OPERACION.sinSolucion) +
                " — SIN FASORES VÁLIDOS PREVIOS DE ESTE ROTOR", nivelLeyenda || "rojo");
            textoEntradas.textContent = "";

            return;

        }

        if (!forzar && ultimo && ultimo.tipo === tipo && ultimo.estado === est &&
            ultimo.leyenda === leyenda && ultimo.version === version) {

            return;

        }

        resultado = est.fasores;

        if (tipo === "salientes") {

            deltaPrevio = resultado.delta;

        }

        ultimo = { tipo, estado: est, leyenda, version };

        dibujar(resultado);

        mostrarIndicadores(resultado);

        if (leyenda) {

            ponerAviso(leyenda, nivelLeyenda);

        }

        else {

            aviso.classList.remove("aviso-rojo", "aviso-ambar");
            aviso.parentElement.classList.remove("con-retencion");

        }

    }

    construir();

    /* Casillas: funcionan con la animación y en PAUSA (no tocan
       el modelo; solo vuelven a dibujar). */
    for (const fs of Object.values(casillas)) {

        fs.addEventListener("change", () => {

            version++;
            actualizar(true);

        });

    }

    return {
        actualizar,
        get resultado() { return resultado; },
        escala: K,
        ventana: { RE_MIN, RE_MAX, IM_MIN, IM_MAX, X0, Y0, ANCHO, ALTO }
    };

})();


/* Enlace con el ciclo existente: actualizarPantalla() llama a
   esta función en cada paso (ver final de actualizarPantalla).
   Declarada como función para que exista antes de que se
   inicialice el módulo; no hace nada hasta entonces. */
function actualizarDiagramaFasorial(forzar) {

    if (!actualizarDiagramaFasorial.listo) {

        return;

    }

    DiagramaFasorial.actualizar(forzar);

    // Etapa F3-F2: δ en el corte transversal (solo en modo ANÁLISIS).
    actualizarDeltaCorte();

}

actualizarDiagramaFasorial.listo = true;

/* Cambio de rotor del corte y cambio de vista: oyentes
   adicionales (no alteran los existentes). */
document
    .querySelectorAll('input[name="rotorCorte"], input[name="vistaSimulador"]')
    .forEach(radio => {

        radio.addEventListener("change", () => {

            if (radio.checked) {

                actualizarDiagramaFasorial(true);

            }

        });

    });

actualizarDiagramaFasorial(true);



/* =========================================================
   CORTE TRANSVERSAL — MODO DE ANÁLISIS ESPACIAL (Etapa F3-D)

   ROTACIÓN:  DINÁMICO  → el disco gira con anguloRotor (F2-B).
              ANÁLISIS  → el disco queda inmóvil en el ángulo visual
                          capturado y se superponen los ejes d y q.

   La congelación es exclusivamente visual: no se toca anguloRotor,
   la velocidad, el ciclo requestAnimationFrame, el AVR ni PAUSA.
   actualizarRotorCorte() deja de aplicar el giro mientras
   actualizarRotorCorte.congelado es verdadero; al volver a
   DINÁMICO se aplica de inmediato el ángulo actual (una sola
   transformación rotate, sin acumulación).

   Geometría verificada en los dos SVG (viewBox 1200 × 650, centro
   del rotor en (600, 325), 2 polos → grados eléctricos = mecánicos):
     · Con anguloRotor = 0: polo N abajo (y > 325), polo S arriba.
     · Devanado de campo: conductores "entra" (×) a la izquierda y
       "sale" (•) a la derecha del núcleo → el campo en el centro
       apunta hacia abajo: flujo de S a N.
     · Giro visual rotate(−θ) en pantalla = antihorario.
   Por tanto, en coordenadas matemáticas (antihorario positivo):
     eje d (S → N):  θd = θ − 90°
     eje q:          θq = θd + 90° = θ      (q = j·d, convención F3-A1:
                                             q adelantado 90° a d en el
                                             sentido de giro)
========================================================= */

const AnalisisCorte = (() => {

    const NS = "http://www.w3.org/2000/svg";

    const CX = 600, CY = 325;          // centro del rotor (viewBox)
    const R_EJE = 226;                 // hasta el estator (r = 184–235)

    const COLOR_D = "#c62828";
    const COLOR_Q = "#1565c0";
    const COLOR_PSI = "#e65100";        // eje ψV y arco δ (Etapa F3-F2)

    const marco = document.getElementById("marcoEjesCorte");
    const svg = document.getElementById("svgEjesCorte");

    let modo = "dinamico";
    let anguloCongelado = 0;

    function crear(padre, etiqueta, atributos, texto) {

        const el = document.createElementNS(NS, etiqueta);

        for (const [k, v] of Object.entries(atributos || {})) {

            el.setAttribute(k, v);

        }

        if (texto !== undefined) {

            el.textContent = texto;

        }

        padre.appendChild(el);

        return el;

    }

    /* ---------- Construcción de la capa ---------- */

    const ejes = {};

    function construirEje(id, color, simbolo, rotulo) {

        const g = crear(svg, "g");

        // Halo blanco para contraste sobre el hierro y el devanado
        const halo = crear(g, "line", {
            stroke: "#ffffff", "stroke-width": 9, "stroke-linecap": "round", opacity: 0.85
        });

        const linea = crear(g, "line", {
            stroke: color, "stroke-width": 4, "stroke-dasharray": "22 8 4 8",
            "stroke-linecap": "butt"
        });

        const punta = crear(g, "polygon", {
            fill: color, stroke: "#ffffff", "stroke-width": 2, "paint-order": "stroke"
        });

        const texto = crear(g, "text", {
            "font-size": 34, "font-weight": "bold", fill: color,
            stroke: "#ffffff", "stroke-width": 6, "paint-order": "stroke",
            "stroke-linejoin": "round",
            "text-anchor": "middle", "dominant-baseline": "middle"
        }, simbolo);

        crear(g, "title", {}, rotulo);

        ejes[id] = { halo, linea, punta, texto };

    }

    construirEje("d", COLOR_D, "d", "Eje directo d: eje magnético del rotor, de S a N (flujo de campo)");
    construirEje("q", COLOR_Q, "q", "Eje en cuadratura q: 90° eléctricos adelante de d en el sentido de giro");

    // Centro geométrico del rotor
    const centroRotor = crear(svg, "circle", {
        cx: CX, cy: CY, r: 6, fill: "#263238", stroke: "#ffffff", "stroke-width": 2
    });

    // Leyenda (zona libre superior izquierda del dibujo)
    const leyenda = crear(svg, "g", {
        "font-size": 17, fill: "#263238"
    });

    crear(leyenda, "rect", {
        x: 14, y: 14, width: 318, height: 176, rx: 6,
        fill: "#ffffff", "fill-opacity": 0.92, stroke: "#b0bec5"
    });

    crear(leyenda, "text", { x: 26, y: 40, "font-weight": "bold", fill: "#16324f" },
        "ANÁLISIS — rotor inmóvil");

    const textoAngulo = crear(leyenda, "text", { x: 26, y: 64 }, "");

    const lineaD = crear(leyenda, "text", { x: 26, y: 90 });
    crear(lineaD, "tspan", { "font-weight": "bold", fill: COLOR_D }, "d");
    crear(lineaD, "tspan", {}, ": eje magnético S → N (flujo)");

    const lineaQ = crear(leyenda, "text", { x: 26, y: 114 });
    crear(lineaQ, "tspan", { "font-weight": "bold", fill: COLOR_Q }, "q");
    crear(lineaQ, "tspan", {}, ": d + 90° eléctricos");

    // Etapa F3-F2: eje de flujo equivalente asociado a V y δ
    const lineaPsi = crear(leyenda, "text", { x: 26, y: 138 });
    crear(lineaPsi, "tspan", { "font-weight": "bold", fill: COLOR_PSI }, "ψ");
    crear(lineaPsi, "tspan", { "font-weight": "bold", fill: COLOR_PSI, "font-size": 12, dy: 4 }, "V");
    crear(lineaPsi, "tspan", { dy: -4 }, ": flujo equivalente asociado a V");

    const lineaDelta = crear(leyenda, "text", { x: 26, y: 162 });
    crear(lineaDelta, "tspan", { "font-weight": "bold", fill: COLOR_PSI }, "δ");
    crear(lineaDelta, "tspan", {}, ": de ψ");
    crear(lineaDelta, "tspan", { "font-size": 12, dy: 4 }, "V");
    crear(lineaDelta, "tspan", { dy: -4 }, " a d (ángulo eléctrico)");

    crear(leyenda, "text", { x: 26, y: 182, "font-size": 13, fill: "#607d8b" },
        "2 polos: grados eléctricos = mecánicos");

    /* ---------- Ángulo de carga δ (Etapa F3-F2) ----------
       Eje de flujo equivalente asociado a V:  θψV = θr − 90° − δ
       Arco δ: de θψV a θd = θr − 90°, sentido antihorario para δ > 0.
       δ procede del resultado ya calculado por DiagramaFasorial para
       el rotor seleccionado; aquí no se calcula nada eléctrico.
       El eje ψV llega solo al entrehierro (r = 176) para no cubrir
       los conductores del estator (r ≈ 202). */

    const R_PSI = 176;
    const R_ARCO = 66;
    const R_ETIQUETA = 100;

    const grupoDelta = document.createElementNS(NS, "g");
    svg.insertBefore(grupoDelta, centroRotor);

    const psi = {
        halo: crear(grupoDelta, "line", {
            stroke: "#ffffff", "stroke-width": 8, "stroke-linecap": "round", opacity: 0.85
        }),
        linea: crear(grupoDelta, "line", {
            stroke: COLOR_PSI, "stroke-width": 3.5, "stroke-dasharray": "12 6",
            "stroke-linecap": "butt"
        }),
        punta: crear(grupoDelta, "polygon", {
            fill: COLOR_PSI, stroke: "#ffffff", "stroke-width": 2, "paint-order": "stroke"
        }),
        texto: crear(grupoDelta, "text", {
            "font-size": 26, "font-weight": "bold", fill: COLOR_PSI,
            stroke: "#ffffff", "stroke-width": 5, "paint-order": "stroke",
            "stroke-linejoin": "round", "text-anchor": "middle", "dominant-baseline": "middle"
        })
    };

    crear(psi.texto, "tspan", {}, "ψ");
    crear(psi.texto, "tspan", { "font-size": 17, dy: 7 }, "V");

    crear(grupoDelta, "title", {},
        "Eje de flujo equivalente asociado a V (θr − 90° − δ). Referencia espacial " +
        "equivalente del modelo fasorial; no es una medición del flujo del entrehierro.");

    const arco = {
        halo: crear(grupoDelta, "path", {
            fill: "none", stroke: "#ffffff", "stroke-width": 7, opacity: 0.85
        }),
        linea: crear(grupoDelta, "path", {
            fill: "none", stroke: COLOR_PSI, "stroke-width": 3
        }),
        punta: crear(grupoDelta, "polygon", { fill: COLOR_PSI })
    };

    const etiquetaDelta = crear(grupoDelta, "g");

    const fondoDelta = crear(etiquetaDelta, "rect", {
        rx: 5, fill: "#ffffff", "fill-opacity": 0.92,
        stroke: COLOR_PSI, "stroke-width": 1.5
    });

    const textoDelta = crear(etiquetaDelta, "text", {
        "font-size": 24, "font-weight": "bold", fill: COLOR_PSI,
        "text-anchor": "middle", "dominant-baseline": "middle"
    }, "");

    let deltaMostrado = null;

    /* δ vigente del rotor seleccionado (grados) o null si no es válido */
    function deltaVigente() {

        if (typeof DiagramaFasorial === "undefined") {

            return null;

        }

        const r = DiagramaFasorial.resultado;

        const radio = document.querySelector('input[name="rotorCorte"]:checked');

        const tipo = radio && radio.value === "liso" ? "liso" : "salientes";

        if (!r || r.tipo !== tipo || !Number.isFinite(r.delta)) {

            return null;

        }

        // Ángulo no definido: Ef nulo (liso) o eje q indefinido (salientes)
        if (tipo === "liso" ? !(r.magEf > EPS_FASORIAL) : r.qIndefinido) {

            return null;

        }

        return r.delta * 180 / Math.PI;

    }

    function punto(angGrados, radio) {

        const t = angGrados * Math.PI / 180;

        return { x: CX + radio * Math.cos(t), y: CY - radio * Math.sin(t) };

    }

    function dibujarDelta() {

        const delta = modo === "analisis" ? deltaVigente() : null;

        if (delta === null) {

            grupoDelta.setAttribute("display", "none");
            deltaMostrado = null;
            return;

        }

        const thetaD = anguloCongelado - 90;          // θd
        const thetaPsi = thetaD - delta;              // θψV = θr − 90° − δ

        /* Eje ψV completo por el centro, flecha en el extremo positivo */
        const a = punto(thetaPsi + 180, R_PSI), b = punto(thetaPsi, R_PSI);

        const ux = (b.x - a.x) / (2 * R_PSI), uy = (b.y - a.y) / (2 * R_PSI);

        for (const l of [psi.halo, psi.linea]) {

            l.setAttribute("x1", a.x.toFixed(2));
            l.setAttribute("y1", a.y.toFixed(2));
            l.setAttribute("x2", (b.x - ux * 12).toFixed(2));
            l.setAttribute("y2", (b.y - uy * 12).toFixed(2));

        }

        const h = 22, w = 9, bx = b.x - ux * h, by = b.y - uy * h;

        psi.punta.setAttribute("points",
            b.x.toFixed(2) + "," + b.y.toFixed(2) + " " +
            (bx - uy * w).toFixed(2) + "," + (by + ux * w).toFixed(2) + " " +
            (bx + uy * w).toFixed(2) + "," + (by - ux * w).toFixed(2));


        /* Arco δ: de θψV a θd (antihorario si δ > 0) */
        const p1 = punto(thetaPsi, R_ARCO), p2 = punto(thetaD, R_ARCO);

        const grande = Math.abs(delta) > 180 ? 1 : 0;
        const barrido = delta >= 0 ? 0 : 1;       // y de pantalla hacia abajo

        const d = "M" + p1.x.toFixed(2) + " " + p1.y.toFixed(2) +
            " A" + R_ARCO + " " + R_ARCO + " 0 " + grande + " " + barrido + " " +
            p2.x.toFixed(2) + " " + p2.y.toFixed(2);

        arco.halo.setAttribute("d", d);
        arco.linea.setAttribute("d", d);

        // Punta del arco en θd, tangente en el sentido del recorrido
        if (Math.abs(delta) * Math.PI / 180 * R_ARCO > 18) {

            const t = thetaD * Math.PI / 180, sg = delta >= 0 ? 1 : -1;

            const tx = -Math.sin(t) * sg, ty = -Math.cos(t) * sg;

            const hh = 13, ww = 5.5, cx = p2.x - tx * hh, cy = p2.y - ty * hh;

            arco.punta.setAttribute("points",
                p2.x.toFixed(2) + "," + p2.y.toFixed(2) + " " +
                (cx - ty * ww).toFixed(2) + "," + (cy + tx * ww).toFixed(2) + " " +
                (cx + ty * ww).toFixed(2) + "," + (cy - tx * ww).toFixed(2));

        }

        else {

            arco.punta.setAttribute("points", "");

        }

        /* Etiqueta numérica en la bisectriz del arco */
        const texto = "δ = " + (delta < 0 ? "−" : "") + Math.abs(delta).toFixed(2) + "°";

        textoDelta.textContent = texto;

        const e = punto(thetaD - delta / 2, R_ETIQUETA);

        const ancho = 16 + texto.length * 12.8, alto = 33;

        textoDelta.setAttribute("x", e.x.toFixed(2));
        textoDelta.setAttribute("y", (e.y + 1).toFixed(2));

        fondoDelta.setAttribute("x", (e.x - ancho / 2).toFixed(2));
        fondoDelta.setAttribute("y", (e.y - alto / 2).toFixed(2));
        fondoDelta.setAttribute("width", ancho.toFixed(2));
        fondoDelta.setAttribute("height", alto);

        /* Rótulo ψV junto al eje, del lado opuesto al eje d, en la
           primera posición que no toque el recuadro de δ (≈ 34 × 30). */
        const lado = delta >= 0 ? -1 : 1;
        const libre = c =>
            Math.abs(c.x - e.x) > ancho / 2 + 20 || Math.abs(c.y - e.y) > alto / 2 + 18;

        let tl = null;

        for (const [radio, desvio] of [[160, 8], [160, 14], [140, 12], [160, 22], [128, 20], [160, 32], [160, -22], [160, -32], [128, -30]]) {

            const c = punto(thetaPsi + lado * desvio, radio);

            if (libre(c)) {

                tl = c;
                break;

            }

        }

        if (!tl) {

            tl = punto(thetaPsi + lado * 8, 160);

        }

        psi.texto.setAttribute("x", tl.x.toFixed(2));
        psi.texto.setAttribute("y", tl.y.toFixed(2));

        grupoDelta.removeAttribute("display");

        deltaMostrado = delta;

    }

    /* ---------- Dibujo de los ejes para un ángulo θ ---------- */

    function dibujarEje(e, angMat) {

        // Dirección en pantalla (y hacia abajo)
        const ux = Math.cos(angMat), uy = -Math.sin(angMat);

        const x1 = CX - R_EJE * ux, y1 = CY - R_EJE * uy;
        const x2 = CX + R_EJE * ux, y2 = CY + R_EJE * uy;

        for (const l of [e.halo, e.linea]) {

            l.setAttribute("x1", x1.toFixed(2));
            l.setAttribute("y1", y1.toFixed(2));
            l.setAttribute("x2", (x2 - ux * 14).toFixed(2));
            l.setAttribute("y2", (y2 - uy * 14).toFixed(2));

        }

        // Punta en el extremo positivo
        const h = 26, w = 10;
        const bx = x2 - ux * h, by = y2 - uy * h;

        e.punta.setAttribute("points",
            x2.toFixed(2) + "," + y2.toFixed(2) + " " +
            (bx - uy * w).toFixed(2) + "," + (by + ux * w).toFixed(2) + " " +
            (bx + uy * w).toFixed(2) + "," + (by - ux * w).toFixed(2));

        // Rótulo junto a la punta, desplazado a la izquierda del eje
        // (siempre vertical, legible)
        const lx = x2 - ux * 8 - uy * 30, ly = y2 - uy * 8 + ux * 30;

        e.texto.setAttribute("x", lx.toFixed(2));
        e.texto.setAttribute("y", ly.toFixed(2));

    }

    function dibujarEjes(theta) {

        const t = theta * Math.PI / 180;

        dibujarEje(ejes.d, t - Math.PI / 2);     // d: θ − 90°  (S → N)
        dibujarEje(ejes.q, t);                   // q: θ

        const tn = ((theta % 360) + 360) % 360;

        textoAngulo.textContent =
            "Posición capturada θ = " + tn.toFixed(1) + "°";

    }

    /* ---------- Modos ---------- */

    function aplicarDiscos(theta) {

        // Una sola transformación absoluta (sin acumulación).
        const giro = "rotate(" + (-theta).toFixed(3) + "deg)";

        document.querySelectorAll(".disco-rotor-corte").forEach(disco => {

            disco.style.transform = giro;

        });

    }

    function congelar(theta) {

        anguloCongelado = theta;

        actualizarRotorCorte.congelado = true;

        aplicarDiscos(theta);

        dibujarEjes(theta);

        dibujarDelta();

        marco.hidden = false;

    }

    function seleccionarModo(nuevo) {

        modo = nuevo === "analisis" ? "analisis" : "dinamico";

        if (modo === "analisis") {

            // Ángulo visual actual del rotor (el último dibujado).
            congelar(anguloRotor);

        }

        else {

            actualizarRotorCorte.congelado = false;

            marco.hidden = true;

            dibujarDelta();          // modo DINÁMICO: oculta δ y ψV

            // Recupera de inmediato el ángulo real de la animación.
            actualizarRotorCorte(anguloRotor);

        }

    }

    document
        .querySelectorAll('input[name="modoCorte"]')
        .forEach(radio => {

            radio.addEventListener("change", () => {

                if (radio.checked) {

                    seleccionarModo(radio.value);

                }

            });

        });

    /* REINICIAR: conserva el modo; en ANÁLISIS el ángulo congelado
       pasa a la posición inicial de 0° (este oyente se ejecuta
       después del de REINICIAR existente). */
    document
        .getElementById("reiniciar")
        .addEventListener("click", () => {

            if (modo === "analisis") {

                congelar(0);

            }

        });

    seleccionarModo(
        document.querySelector('input[name="modoCorte"]:checked').value
    );

    return {
        get modo() { return modo; },
        get anguloCongelado() { return anguloCongelado; },
        get deltaMostrado() { return deltaMostrado; },
        seleccionarModo,
        dibujarDelta
    };

})();


/* Enlace (Etapa F3-F2): actualizarDiagramaFasorial() llama a esta
   función tras cada actualización del diagrama; así el arco δ y el
   eje ψV siguen al δ vigente sin mover el rotor congelado. Declarada
   como función porque se invoca antes de que exista AnalisisCorte. */
function actualizarDeltaCorte() {

    if (!actualizarDeltaCorte.listo) {

        return;

    }

    AnalisisCorte.dibujarDelta();

}

actualizarDeltaCorte.listo = true;

AnalisisCorte.dibujarDelta();



/* =========================================================
   PANEL DESPLEGABLE — REFERENCIA DE VARIABLES (Etapa F3-E)

   Mismo comportamiento que el panel lateral de procedimientos de
   la caldera pirotubular (cambiarMenuLateral): clase "abierto",
   aria-expanded, aria-hidden, inert y gestión del foco. Aquí el
   botón de activación abre y cierra; × cierra; Escape cierra.
   El contenido muestra solo las filas del rotor seleccionado en
   el corte transversal. No toca el simulador ni el diagrama.
========================================================= */

(() => {

    const panel = document.getElementById("panelReferenciaVariables");
    const boton = document.getElementById("btnReferenciaVariables");
    const cerrar = document.getElementById("btnCerrarReferenciaVariables");
    const nombreRotor = document.getElementById("refRotorSeleccionado");

    function cambiarPanel(abierto) {

        panel.classList.toggle("abierto", abierto);

        boton.setAttribute("aria-expanded", String(abierto));

        // Devolver el foco antes de ocultar el panel a ayudas técnicas.
        if (!abierto && panel.contains(document.activeElement)) {

            boton.focus();

        }

        panel.setAttribute("aria-hidden", String(!abierto));
        panel.inert = !abierto;

        if (abierto) {

            cerrar.focus();

        }

    }

    function mostrarRotor() {

        const radio = document.querySelector('input[name="rotorCorte"]:checked');

        const tipo = radio && radio.value === "liso" ? "liso" : "salientes";

        panel.querySelectorAll("tr[data-rotor]").forEach(fila => {

            fila.hidden = fila.dataset.rotor !== tipo;

        });

        nombreRotor.textContent =
            tipo === "liso" ? "ROTOR CILÍNDRICO" : "ROTOR DE POLOS SALIENTES";

    }

    boton.addEventListener("click", () => {

        cambiarPanel(!panel.classList.contains("abierto"));

    });

    cerrar.addEventListener("click", () => cambiarPanel(false));

    panel.addEventListener("keydown", ev => {

        if (ev.key === "Escape") {

            cambiarPanel(false);

        }

    });

    // El estado abierto/cerrado se conserva al cambiar de rotor.
    document
        .querySelectorAll('input[name="rotorCorte"]')
        .forEach(radio => radio.addEventListener("change", mostrarRotor));

    mostrarRotor();

    cambiarPanel(false);

})();
