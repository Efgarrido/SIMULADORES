/* =====================================================
   SIMULADOR RVTH
   REGULADOR DE VELOCIDAD

   Archivo: regulador.js

   Contiene:
   - Regulador de Watt
   - Servomotor
   - Leva de retroalimentación
   - Puntos A, B y C
   - Palanca A-B-C
   - Válvula piloto
   - Circuito hidráulico

   MODIFICACIÓN:
   - A, B y C permanecen siempre colineales.
   - Se elimina el límite geométrico ±28 aplicado a C.
===================================================== */


/* =====================================================
   ELEMENTOS SVG — WATT
===================================================== */

const bolaIzq =
document.getElementById("bolaIzq");

const bolaDer =
document.getElementById("bolaDer");

const brazoIzq =
document.getElementById("brazoIzq");

const brazoDer =
document.getElementById("brazoDer");

const brazoInfIzq =
document.getElementById("brazoInfIzq");

const brazoInfDer =
document.getElementById("brazoInfDer");

const manguito =
document.getElementById("manguito");


/* =====================================================
   ELEMENTOS SVG — A-B-C
===================================================== */

const puntoA =
document.getElementById("puntoA");

const textoA =
document.getElementById("textoA");

const puntoB =
document.getElementById("puntoB");

const textoB =
document.getElementById("textoB");

const palancaABC =
document.getElementById("palancaABC");

const puntoC =
document.getElementById("puntoC");

const textoC =
document.getElementById("textoC");


/* =====================================================
   RETROALIMENTACIÓN
===================================================== */

const varillaRetro =
document.getElementById("varillaRetro");

const rodilloRetro =
document.getElementById("rodilloRetro");

const levaRetro =
document.getElementById("levaRetro");


/* =====================================================
   VÁLVULA
===================================================== */

const carrete =
document.getElementById("carrete");

const ejeValvula =
document.getElementById("ejeValvula");

const puertoTrabajoSuperior =
document.getElementById("puertoTrabajoSuperior");

const puertoTrabajoInferior =
document.getElementById("puertoTrabajoInferior");

const retornoSuperior =
document.getElementById("retornoSuperior");

const retornoInferior =
document.getElementById("retornoInferior");

const animEntradaPresion =
document.getElementById("animEntradaPresion");

const animRetornoSuperior =
document.getElementById("animRetornoSuperior");

const animRetornoInferior =
document.getElementById("animRetornoInferior");


/* =====================================================
   TUBERÍAS
===================================================== */

const tuberiaCamaraIzquierda =
document.getElementById("tuberiaCamaraIzquierda");

const tuberiaCamaraDerecha =
document.getElementById("tuberiaCamaraDerecha");

const animSuperiorHaciaServo =
document.getElementById("animSuperiorHaciaServo");

const animSuperiorRetorno =
document.getElementById("animSuperiorRetorno");

const animInferiorHaciaServo =
document.getElementById("animInferiorHaciaServo");

const animInferiorRetorno =
document.getElementById("animInferiorRetorno");


/* =====================================================
   SERVOMOTOR
===================================================== */

const camaraIzquierda =
document.getElementById("camaraIzquierda");

const camaraDerecha =
document.getElementById("camaraDerecha");

const pistonServo =
document.getElementById("pistonServo");

const vastagoServo =
document.getElementById("vastagoServo");


/* =====================================================
   INDICADOR
===================================================== */

const luzAccion =
document.getElementById("luzAccion");

const accionTexto =
document.getElementById("accionTexto");

const accionSubtexto =
document.getElementById("accionSubtexto");


/* =====================================================
   GEOMETRÍA SERVOMOTOR
===================================================== */

const SERVO_X_IZQ = 706;

const SERVO_X_DER = 944;

const PISTON_X_BASE = 800;

const PISTON_ANCHO = 50;


/* =====================================================
   GEOMETRÍA A-B-C
===================================================== */

const A_X = 360;

const B_X = 520;

const B_Y_BASE = 220;

const C_X = 1030;


/* =====================================================
   RECORRIDO VISUAL DEL SERVOMOTOR
===================================================== */

const SERVO_RECORRIDO_TOTAL =
30;

const SERVO_X_POR_PORCENTAJE =
SERVO_RECORRIDO_TOTAL
/
(100 - 45);


/* =====================================================
   LEVA
===================================================== */

const LEVA_X_INICIO = 430;

const LEVA_ANCHO = 180;

const LEVA_Y_BAJA = 505;

const LEVA_DESNIVEL = 22;

const RADIO_RODILLO = 11;


/* =====================================================
   PERFIL DE LEVA
===================================================== */

function perfilLeva(xLocal){

    let t =
    xLocal
    /
    LEVA_ANCHO;

    t =
    Math.max(
        0,
        Math.min(
            1,
            t
        )
    );

    const s =
    3*t*t
    -
    2*t*t*t;

    return (
        LEVA_Y_BAJA
        -
        LEVA_DESNIVEL
        *
        s
    );

}


const X_LOCAL_NEUTRO =
B_X
-
LEVA_X_INICIO;


const Y_RODILLO_NEUTRO =
perfilLeva(
    X_LOCAL_NEUTRO
)
-
RADIO_RODILLO;


/* =====================================================
   OCULTAR FLUJOS HIDRÁULICOS
===================================================== */

function ocultarFlujos(){

    animEntradaPresion.setAttribute(
        "visibility",
        "hidden"
    );

    animRetornoSuperior.setAttribute(
        "visibility",
        "hidden"
    );

    animRetornoInferior.setAttribute(
        "visibility",
        "hidden"
    );

    animSuperiorHaciaServo.setAttribute(
        "visibility",
        "hidden"
    );

    animSuperiorRetorno.setAttribute(
        "visibility",
        "hidden"
    );

    animInferiorHaciaServo.setAttribute(
        "visibility",
        "hidden"
    );

    animInferiorRetorno.setAttribute(
        "visibility",
        "hidden"
    );


    puertoTrabajoSuperior.setAttribute(
        "class",
        "puertoTrabajo"
    );

    puertoTrabajoInferior.setAttribute(
        "class",
        "puertoTrabajo"
    );


    tuberiaCamaraIzquierda.setAttribute(
        "class",
        "tuberiaServoReposo"
    );

    tuberiaCamaraDerecha.setAttribute(
        "class",
        "tuberiaServoReposo"
    );


    retornoSuperior.setAttribute(
        "class",
        "puertoRetorno"
    );

    retornoInferior.setAttribute(
        "class",
        "puertoRetorno"
    );


    camaraIzquierda.setAttribute(
        "class",
        "camaraBase"
    );

    camaraDerecha.setAttribute(
        "class",
        "camaraBase"
    );

}


/* =====================================================
   ACTUALIZAR REGULADOR
===================================================== */

function actualizarRegulador(){

    const desviacion =
    frecuencia
    -
    F_NOMINAL;


    /* =================================================
       SERVOMOTOR
    ================================================= */

    let movimientoServo =
    (
        apertura
        -
        APERTURA_BASE
    )
    *
    SERVO_X_POR_PORCENTAJE;


    movimientoServo =
    Math.max(
        (45 - APERTURA_BASE)
        *
        SERVO_X_POR_PORCENTAJE,

        Math.min(
            (100 - APERTURA_BASE)
            *
            SERVO_X_POR_PORCENTAJE,

            movimientoServo
        )
    );


    /* =================================================
       DISTRIBUIDOR / PUNTO D
    ================================================= */

    const estadoDistribuidor =
    actualizarDistribuidor();


    const Dx =
    estadoDistribuidor.Dx;


    const Dy =
    estadoDistribuidor.Dy;


    /* =================================================
       VÁSTAGO D — PISTÓN
    ================================================= */

    vastagoServo.setAttribute(
        "x1",
        Dx
    );

    vastagoServo.setAttribute(
        "y1",
        Dy
    );

    vastagoServo.setAttribute(
        "x2",
        PISTON_X_BASE
        +
        movimientoServo
    );

    vastagoServo.setAttribute(
        "y2",
        515
    );


    /* =================================================
       REGULADOR DE WATT
    ================================================= */

    const movimientoWatt =
    Math.max(
        -20,
        Math.min(
            20,

            desviacion
            *
            GANANCIA_WATT

            -

            GANANCIA_RESTAURACION
            *
            integralError
        )
    );


    const xIzq =
    295
    -
    movimientoWatt;


    const xDer =
    425
    +
    movimientoWatt;


    const yBolas =
    165
    -
    movimientoWatt
    *
    .65;


    bolaIzq.setAttribute(
        "cx",
        xIzq
    );

    bolaIzq.setAttribute(
        "cy",
        yBolas
    );


    bolaDer.setAttribute(
        "cx",
        xDer
    );

    bolaDer.setAttribute(
        "cy",
        yBolas
    );


    brazoIzq.setAttribute(
        "x1",
        320
    );

    brazoIzq.setAttribute(
        "y1",
        108
    );

    brazoIzq.setAttribute(
        "x2",
        xIzq
    );

    brazoIzq.setAttribute(
        "y2",
        yBolas
    );


    brazoDer.setAttribute(
        "x1",
        400
    );

    brazoDer.setAttribute(
        "y1",
        108
    );

    brazoDer.setAttribute(
        "x2",
        xDer
    );

    brazoDer.setAttribute(
        "y2",
        yBolas
    );


    const centroManguitoY =
    211
    -
    movimientoWatt
    *
    .74;


    manguito.setAttribute(
        "x",
        340
    );


    manguito.setAttribute(
        "y",
        centroManguitoY
        -
        11
    );


    brazoInfIzq.setAttribute(
        "x1",
        xIzq
    );

    brazoInfIzq.setAttribute(
        "y1",
        yBolas
    );

    brazoInfIzq.setAttribute(
        "x2",
        340
    );

    brazoInfIzq.setAttribute(
        "y2",
        centroManguitoY
    );


    brazoInfDer.setAttribute(
        "x1",
        xDer
    );

    brazoInfDer.setAttribute(
        "y1",
        yBolas
    );

    brazoInfDer.setAttribute(
        "x2",
        380
    );

    brazoInfDer.setAttribute(
        "y2",
        centroManguitoY
    );


    /* =================================================
       PUNTO A
    ================================================= */

    const Ax =
    A_X;


    const Ay =
    centroManguitoY
    +
    11;


    puntoA.setAttribute(
        "cx",
        Ax
    );

    puntoA.setAttribute(
        "cy",
        Ay
    );


    textoA.setAttribute(
        "x",
        Ax + 12
    );

    textoA.setAttribute(
        "y",
        Ay + 24
    );


    /* =================================================
       LEVA DE RETROALIMENTACIÓN
    ================================================= */

    levaRetro.style.transform =
    "translateX("
    +
    movimientoServo
    +
    "px)";


    const xLocalLeva =
    B_X
    -
    LEVA_X_INICIO
    -
    movimientoServo;


    const ySuperficieLeva =
    perfilLeva(
        xLocalLeva
    );


    const yRodillo =
    ySuperficieLeva
    -
    RADIO_RODILLO;


    /* =================================================
       PUNTO B

       B está determinado por la retroalimentación.
    ================================================= */

    rodilloRetro.setAttribute(
        "cx",
        B_X
    );

    rodilloRetro.setAttribute(
        "cy",
        yRodillo
    );


    const desplazamientoB =
    yRodillo
    -
    Y_RODILLO_NEUTRO;


    const By =
    B_Y_BASE
    +
    desplazamientoB;


    puntoB.setAttribute(
        "cx",
        B_X
    );

    puntoB.setAttribute(
        "cy",
        By
    );


    textoB.setAttribute(
        "x",
        B_X - 15
    );

    textoB.setAttribute(
        "y",
        By - 20
    );


    varillaRetro.setAttribute(
        "x1",
        B_X
    );

    varillaRetro.setAttribute(
        "y1",
        By
    );

    varillaRetro.setAttribute(
        "x2",
        B_X
    );

    varillaRetro.setAttribute(
        "y2",
        yRodillo
        -
        RADIO_RODILLO
    );


    /* =================================================
       PALANCA A-B-C

       A y B determinan una única recta.

       C se calcula mediante la prolongación exacta
       de esa recta.

       Por construcción:

               A -------- B -------- C

       son siempre colineales.
    ================================================= */

    const pendiente =
    (
        By
        -
        Ay
    )
    /
    (
        B_X
        -
        Ax
    );


    const Cy =
    Ay
    +
    pendiente
    *
    (
        C_X
        -
        Ax
    );


    /* =================================================
       POSICIÓN NEUTRA DE C
    ================================================= */

    if(
        posicionCNeutra
        ===
        null
    ){

        posicionCNeutra =
        Cy;

    }


    /* =================================================
       DESPLAZAMIENTO DEL CARRETE

       IMPORTANTE:

       Ya no existe el límite geométrico ±28.

       C permanece siempre unido a la palanca.
    ================================================= */

    const desplazamientoC =
    Cy
    -
    posicionCNeutra;


    /* =================================================
       PALANCA A-C
    ================================================= */

    palancaABC.setAttribute(
        "x1",
        Ax
    );

    palancaABC.setAttribute(
        "y1",
        Ay
    );

    palancaABC.setAttribute(
        "x2",
        C_X
    );

    palancaABC.setAttribute(
        "y2",
        Cy
    );


    /* =================================================
       PUNTO C
    ================================================= */

    puntoC.setAttribute(
        "cx",
        C_X
    );

    puntoC.setAttribute(
        "cy",
        Cy
    );


    textoC.setAttribute(
        "x",
        C_X - 16
    );

    textoC.setAttribute(
        "y",
        Cy - 18
    );


    /* =================================================
       CARRETE
    ================================================= */

    const desplazamientoCarrete =
    desplazamientoC;


    desplazamientoCarreteActual =
    desplazamientoCarrete;


    carrete.style.transform =
    "translateY("
    +
    desplazamientoCarrete
    +
    "px)";


    ejeValvula.setAttribute(
        "x1",
        C_X
    );

    ejeValvula.setAttribute(
        "y1",
        Cy
    );

    ejeValvula.setAttribute(
        "x2",
        C_X
    );

    ejeValvula.setAttribute(
        "y2",
        324
        +
        desplazamientoCarrete
    );


    /* =================================================
       HIDRÁULICA
    ================================================= */

    ocultarFlujos();


    /* =================================================
       ORDEN DE CIERRE
    ================================================= */

    if(
        desplazamientoCarrete
        >
        UMBRAL_VALVULA
    ){

        animEntradaPresion.setAttribute(
            "visibility",
            "visible"
        );


        puertoTrabajoInferior.setAttribute(
            "class",
            "lineaActivaPresion"
        );


        tuberiaCamaraDerecha.setAttribute(
            "class",
            "tuberiaServoPresion"
        );


        animInferiorHaciaServo.setAttribute(
            "visibility",
            "visible"
        );


        camaraDerecha.setAttribute(
            "class",
            "camaraPresion"
        );


        camaraIzquierda.setAttribute(
            "class",
            "camaraRetorno"
        );


        tuberiaCamaraIzquierda.setAttribute(
            "class",
            "tuberiaServoRetorno"
        );


        puertoTrabajoSuperior.setAttribute(
            "class",
            "lineaActivaRetorno"
        );


        animSuperiorRetorno.setAttribute(
            "visibility",
            "visible"
        );


        retornoSuperior.setAttribute(
            "class",
            "lineaActivaRetorno"
        );


        animRetornoSuperior.setAttribute(
            "visibility",
            "visible"
        );

    }


    /* =================================================
       ORDEN DE APERTURA
    ================================================= */

    else if(
        desplazamientoCarrete
        <
        -UMBRAL_VALVULA
    ){

        animEntradaPresion.setAttribute(
            "visibility",
            "visible"
        );


        puertoTrabajoSuperior.setAttribute(
            "class",
            "lineaActivaPresion"
        );


        tuberiaCamaraIzquierda.setAttribute(
            "class",
            "tuberiaServoPresion"
        );


        animSuperiorHaciaServo.setAttribute(
            "visibility",
            "visible"
        );


        camaraIzquierda.setAttribute(
            "class",
            "camaraPresion"
        );


        camaraDerecha.setAttribute(
            "class",
            "camaraRetorno"
        );


        tuberiaCamaraDerecha.setAttribute(
            "class",
            "tuberiaServoRetorno"
        );


        puertoTrabajoInferior.setAttribute(
            "class",
            "lineaActivaRetorno"
        );


        animInferiorRetorno.setAttribute(
            "visibility",
            "visible"
        );


        retornoInferior.setAttribute(
            "class",
            "lineaActivaRetorno"
        );


        animRetornoInferior.setAttribute(
            "visibility",
            "visible"
        );

    }


    /* =================================================
       CÁMARAS DEL SERVOMOTOR
    ================================================= */

    const xPiston =
    PISTON_X_BASE
    +
    movimientoServo;


    const xPistonDerecha =
    xPiston
    +
    PISTON_ANCHO;


    camaraIzquierda.setAttribute(
        "x",
        SERVO_X_IZQ
    );


    camaraIzquierda.setAttribute(
        "width",
        Math.max(
            6,
            xPiston
            -
            SERVO_X_IZQ
        )
    );


    camaraDerecha.setAttribute(
        "x",
        xPistonDerecha
    );


    camaraDerecha.setAttribute(
        "width",
        Math.max(
            6,
            SERVO_X_DER
            -
            xPistonDerecha
        )
    );


    /* =================================================
       PISTÓN DEL SERVOMOTOR
    ================================================= */

    pistonServo.style.transform =
    "translateX("
    +
    movimientoServo
    +
    "px)";

}