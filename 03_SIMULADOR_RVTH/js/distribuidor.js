/* =====================================================
   SIMULADOR RVTH
   DISTRIBUIDOR FINK + RODETE FRANCIS

   Archivo: distribuidor.js

   Contiene exclusivamente:
   - Geometría del conjunto Fink
   - Cinemática rígida V7
   - Movimiento del anillo
   - Movimiento de las 24 directrices
   - Posición del punto D
   - Giro visual del rodete Francis

   NO contiene:
   - Modelo dinámico
   - Regulador Watt
   - Válvula piloto
   - Servomotor
===================================================== */


/* =====================================================
   ELEMENTOS SVG
===================================================== */

const anilloRegulacion =
document.getElementById("anillo-regulacion");


const directrices9A =
Array.from(
    document.querySelectorAll(
        "#distribuidor-fink .directriz9A"
    )
);


const palancaPrueba9A =
document.getElementById("palanca-prueba");


const bielaPrueba9A =
document.getElementById("biela-prueba");


const pasadorPalanca9A =
document.getElementById("pasador-palanca");


const pasadorAnillo9A =
document.getElementById("pasador-anillo");


const puntoD =
document.getElementById("puntoD");


const textoD =
document.getElementById("textoD");


const rotor =
document.getElementById("rotor-francis");


/* =====================================================
   POSICIÓN DEL CONJUNTO FINK–FRANCIS

   Se conserva exactamente la posición aceptada
   en la versión 9B6.
===================================================== */

const TURBINA_TX = 40;

const TURBINA_TY = 200;

const TURBINA_ESCALA = 0.42;


/* =====================================================
   GEOMETRÍA FINK V7
===================================================== */

const FINK_CX = 350;

const FINK_CY = 350;


const FINK_PIVOTE_X = 350;

const FINK_PIVOTE_Y = 3;


const FINK_RADIO_ANILLO = 372;


/*
   Radio desde el centro del distribuidor
   hasta el centro del orificio de la oreja
   donde se encuentra el punto D.
*/

const FINK_RADIO_OREJA = 394;


const FINK_LONGITUD_PALANCA = 45;


const FINK_ANGULO_INICIAL_PALANCA =
107.5;


const FINK_ANGULO_INICIAL_PASADOR =
-96;


const FINK_LONGITUD_BIELA =
70.5894;


/* =====================================================
   ESTADO VISUAL DEL RODETE FRANCIS
===================================================== */

let anguloRotor9A = 0;


/* =====================================================
   ACTUALIZAR DISTRIBUIDOR FINK
===================================================== */

function actualizarDistribuidor(){

    /*
       CINEMÁTICA ORIGINAL V7

       100 % apertura =   0°
         0 % apertura = -12°

       Esta relación se conserva exactamente
       de la versión 9B6.
    */

    const anguloAnillo9A =
    -12
    *
    (
        1
        -
        apertura / 100
    );


    /* =================================================
       POSICIÓN DEL PASADOR DEL ANILLO
    ================================================= */

    const anguloPasador9A =
    (
        FINK_ANGULO_INICIAL_PASADOR
        +
        anguloAnillo9A
    )
    *
    Math.PI
    /
    180;


    const pinX =
    FINK_CX
    +
    FINK_RADIO_ANILLO
    *
    Math.cos(
        anguloPasador9A
    );


    const pinY =
    FINK_CY
    +
    FINK_RADIO_ANILLO
    *
    Math.sin(
        anguloPasador9A
    );


    /* =================================================
       INTERSECCIÓN DE LOS DOS ESLABONES

       Círculo 1:
       pivote de la directriz.

       Círculo 2:
       pasador del anillo.
    ================================================= */

    const dxPin =
    pinX
    -
    FINK_PIVOTE_X;


    const dyPin =
    pinY
    -
    FINK_PIVOTE_Y;


    const distancia =
    Math.hypot(
        dxPin,
        dyPin
    );


    const aInter =
    (
        FINK_LONGITUD_PALANCA ** 2

        -

        FINK_LONGITUD_BIELA ** 2

        +

        distancia ** 2
    )
    /
    (
        2
        *
        distancia
    );


    const hInter =
    Math.sqrt(
        Math.max(
            0,
            FINK_LONGITUD_PALANCA ** 2
            -
            aInter ** 2
        )
    );


    const xm =
    FINK_PIVOTE_X
    +
    aInter
    *
    dxPin
    /
    distancia;


    const ym =
    FINK_PIVOTE_Y
    +
    aInter
    *
    dyPin
    /
    distancia;


    const rx =
    -dyPin
    *
    hInter
    /
    distancia;


    const ry =
    dxPin
    *
    hInter
    /
    distancia;


    const c1 = {

        x:
        xm + rx,

        y:
        ym + ry

    };


    const c2 = {

        x:
        xm - rx,

        y:
        ym - ry

    };


    /* =================================================
       SELECCIÓN DE LA RAMA CORRECTA

       Se utiliza la posición inicial de la palanca
       como referencia, exactamente como en 9B6.
    ================================================= */

    const objetivoX =
    FINK_PIVOTE_X
    +
    FINK_LONGITUD_PALANCA
    *
    Math.cos(
        FINK_ANGULO_INICIAL_PALANCA
        *
        Math.PI
        /
        180
    );


    const objetivoY =
    FINK_PIVOTE_Y
    +
    FINK_LONGITUD_PALANCA
    *
    Math.sin(
        FINK_ANGULO_INICIAL_PALANCA
        *
        Math.PI
        /
        180
    );


    const d1 =
    Math.hypot(
        c1.x - objetivoX,
        c1.y - objetivoY
    );


    const d2 =
    Math.hypot(
        c2.x - objetivoX,
        c2.y - objetivoY
    );


    const extremo =
    d1 <= d2
    ?
    c1
    :
    c2;


    /* =================================================
       ÁNGULO DE LAS DIRECTRICES
    ================================================= */

    const anguloPalanca =
    Math.atan2(
        extremo.y - FINK_PIVOTE_Y,
        extremo.x - FINK_PIVOTE_X
    )
    *
    180
    /
    Math.PI;


    let anguloDirectriz =
    anguloPalanca
    -
    FINK_ANGULO_INICIAL_PALANCA;


    /*
       Evita pequeños residuos numéricos
       alrededor de 0°.
    */

    if(
        Math.abs(
            anguloDirectriz
        )
        <
        0.0001
    ){

        anguloDirectriz =
        0;

    }


    /* =================================================
       24 DIRECTRICES
    ================================================= */

    directrices9A.forEach(
    function(alabe){

        alabe.setAttribute(
            "transform",

            `translate(350 3)
             rotate(${anguloDirectriz})
             scale(0.23)
             translate(-350 -180)`
        );

    });


    /* =================================================
       ANILLO DE REGULACIÓN
    ================================================= */

    anilloRegulacion.setAttribute(
        "transform",
        `rotate(${anguloAnillo9A} 350 350)`
    );


    /* =================================================
       MECANISMO MAESTRO

       Las otras 23 copias están generadas mediante
       <use> en el SVG.
    ================================================= */

    palancaPrueba9A.setAttribute(
        "x2",
        extremo.x
    );


    palancaPrueba9A.setAttribute(
        "y2",
        extremo.y
    );


    bielaPrueba9A.setAttribute(
        "x1",
        extremo.x
    );


    bielaPrueba9A.setAttribute(
        "y1",
        extremo.y
    );


    bielaPrueba9A.setAttribute(
        "x2",
        pinX
    );


    bielaPrueba9A.setAttribute(
        "y2",
        pinY
    );


    pasadorPalanca9A.setAttribute(
        "cx",
        extremo.x
    );


    pasadorPalanca9A.setAttribute(
        "cy",
        extremo.y
    );


    pasadorAnillo9A.setAttribute(
        "cx",
        pinX
    );


    pasadorAnillo9A.setAttribute(
        "cy",
        pinY
    );


    /* =================================================
       PUNTO D

       D coincide con el perno de la oreja
       solidaria al anillo.
    ================================================= */

    const anguloAcople =
    (
        90
        +
        anguloAnillo9A
    )
    *
    Math.PI
    /
    180;


    const acopleLocalX =
    FINK_CX
    +
    FINK_RADIO_OREJA
    *
    Math.cos(
        anguloAcople
    );


    const acopleLocalY =
    FINK_CY
    +
    FINK_RADIO_OREJA
    *
    Math.sin(
        anguloAcople
    );


    /*
       Conversión desde las coordenadas internas
       del conjunto Fink a las coordenadas del SVG
       principal.
    */

    const Dx =
    TURBINA_TX
    +
    TURBINA_ESCALA
    *
    acopleLocalX;


    const Dy =
    TURBINA_TY
    +
    TURBINA_ESCALA
    *
    acopleLocalY;


    puntoD.setAttribute(
        "cx",
        Dx
    );


    puntoD.setAttribute(
        "cy",
        Dy
    );


    textoD.setAttribute(
        "x",
        Dx - 15
    );


    textoD.setAttribute(
        "y",
        Dy + 29
    );


    /*
       Se regresan las coordenadas de D porque
       regulador.js las necesitará posteriormente
       para dibujar el vástago del servomotor.

       Esto evita que regulador.js tenga que repetir
       los cálculos geométricos del distribuidor.
    */

    return {

        Dx:
        Dx,

        Dy:
        Dy,

        anguloAnillo:
        anguloAnillo9A,

        anguloDirectriz:
        anguloDirectriz

    };

}


/* =====================================================
   GIRO DEL RODETE FRANCIS
===================================================== */

function actualizarRotorFrancis(dt){

    /*
       Se conserva el sentido de giro aceptado
       en 9B6.

       La velocidad visual depende de la frecuencia.
    */

    const velocidadVisualNominal =
    200;


    anguloRotor9A -=
    velocidadVisualNominal
    *
    (
        frecuencia
        /
        F_NOMINAL
    )
    *
    dt;


    if(
        anguloRotor9A
        <=
        -360
    ){

        anguloRotor9A +=
        360;

    }


    rotor.setAttribute(
        "transform",
        `rotate(${anguloRotor9A} 350 350)`
    );

}