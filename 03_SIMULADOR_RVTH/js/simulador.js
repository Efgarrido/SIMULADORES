/* =====================================================
   SIMULADOR RVTH
   CONTROL GENERAL DEL SIMULADOR

   Archivo: simulador.js

   Interfaz migrada a la plantilla maestra
   (controles superiores, gráficas a la izquierda,
   conjunto mecánico a la derecha, indicadores abajo).
   Botones de operación: APLICAR, PAUSA, REINICIAR
   (estándar del simulador AVR).

   Responsabilidades:
   - Elementos generales de la interfaz
   - Gráficas
   - Gráfica completa de frecuencia desde t = 0
   - Controles
   - Textos e indicadores
   - Loop principal
   - Coordinación de los demás módulos
===================================================== */


/* =====================================================
   ELEMENTOS GENERALES
===================================================== */

const sliderCarga =
document.getElementById("carga");

const valorCarga =
document.getElementById("valorCarga");

const frecuenciaTxt =
document.getElementById("frecuencia");

const aperturaTxt =
document.getElementById("apertura");

const pmBalance =
document.getElementById("pmBalance");

const peBalance =
document.getElementById("peBalance");

const balanceSigno =
document.getElementById("balanceSigno");

const balanceEstado =
document.getElementById("balanceEstado");



/*
   La franja explicativa inferior (#estado, #explicacion)
   se eliminó en la migración a la plantilla maestra.
   El estado de la válvula se sigue mostrando en el
   recuadro del SVG (#accionTexto, #accionSubtexto).
*/


/* =====================================================
   GRÁFICAS
===================================================== */

/* Gráfica de frecuencia — ventana móvil */

const graficaFrecuencia =
document.getElementById("graficaFrecuencia");

const ctxFrecuencia =
graficaFrecuencia.getContext("2d");


/* Gráfica de frecuencia — respuesta completa */

const graficaFrecuenciaCompleta =
document.getElementById("graficaFrecuenciaCompleta");

const ctxFrecuenciaCompleta =
graficaFrecuenciaCompleta.getContext("2d");


/* Gráfica de apertura */

const graficaApertura =
document.getElementById("graficaApertura");

const ctxApertura =
graficaApertura.getContext("2d");


/* =====================================================
   HISTORIALES
===================================================== */

/*
   historialGrafica:
   utilizado por las gráficas móviles actuales.
*/

let historialGrafica = [];


/*
   historialCompleto:
   conserva todos los datos desde t = 0.

   Aquí nunca se elimina el primer punto.
*/

let historialCompleto = [];


let tiempoSimulacion = 0;


/* =====================================================
   LIMPIAR GRÁFICAS
===================================================== */

function limpiarGraficas(){

    historialGrafica = [];

    historialCompleto = [];

    tiempoSimulacion = 0;


    historialGrafica.push({

        tiempo:0,
        frecuencia:frecuencia,
        apertura:apertura

    });


    historialCompleto.push({

        tiempo:0,
        frecuencia:frecuencia,
        apertura:apertura

    });


    dibujarGraficas();

}


/* =====================================================
   REGISTRAR DATOS
===================================================== */

function registrarGraficas(dt){

    tiempoSimulacion +=
    dt;


    const nuevoPunto = {

        tiempo:
        tiempoSimulacion,

        frecuencia:
        frecuencia,

        apertura:
        apertura

    };


    /* =================================================
       HISTORIAL DE VENTANA MÓVIL
    ================================================= */

    historialGrafica.push({

        tiempo:
        nuevoPunto.tiempo,

        frecuencia:
        nuevoPunto.frecuencia,

        apertura:
        nuevoPunto.apertura

    });


    /*
       La gráfica actual conserva su comportamiento:
       después de 1200 puntos elimina los más antiguos.
    */

    if(
        historialGrafica.length
        >
        1200
    ){

        historialGrafica.shift();

    }


    /* =================================================
       HISTORIAL COMPLETO

       Aquí NO utilizamos shift().

       El instante t = 0 permanece siempre.
    ================================================= */

    historialCompleto.push({

        tiempo:
        nuevoPunto.tiempo,

        frecuencia:
        nuevoPunto.frecuencia,

        apertura:
        nuevoPunto.apertura

    });

}


/* =====================================================
   DIBUJAR UNA GRÁFICA MÓVIL
===================================================== */

function dibujarGrafica(
    canvas,
    ctx,
    variable,
    referencia,
    unidad
){

    const W =
    canvas.width;

    const H =
    canvas.height;


    ctx.clearRect(
        0,
        0,
        W,
        H
    );


    ctx.fillStyle =
    "#ffffff";


    ctx.fillRect(
        0,
        0,
        W,
        H
    );


    const margenIzq = 38;

    const margenDer = 8;

    const margenSup = 10;

    const margenInf = 27;


    const ancho =
    W
    -
    margenIzq
    -
    margenDer;


    const alto =
    H
    -
    margenSup
    -
    margenInf;


    let valores =
    historialGrafica.map(
        p => p[variable]
    );


    if(
        valores.length
        ===
        0
    ){

        valores =
        [referencia];

    }


    let minimo =
    Math.min(
        ...valores
    );


    let maximo =
    Math.max(
        ...valores
    );


    /* =================================================
       ESCALA FRECUENCIA
    ================================================= */

    if(
        variable
        ===
        "frecuencia"
    ){

        minimo =
        Math.min(
            minimo,
            F_NOMINAL
        )
        -
        .10;


        maximo =
        Math.max(
            maximo,
            F_NOMINAL
        )
        +
        .10;


        if(
            maximo
            -
            minimo
            <
            .4
        ){

            minimo =
            59.8;

            maximo =
            60.2;

        }

    }


    /* =================================================
       ESCALA APERTURA
    ================================================= */

    else{

        minimo =
        Math.min(
            minimo,
            APERTURA_BASE
        )
        -
        3;


        maximo =
        Math.max(
            maximo,
            APERTURA_BASE
        )
        +
        3;


        minimo =
        Math.max(
            0,
            minimo
        );


        maximo =
        Math.min(
            100,
            maximo
        );


        if(
            maximo
            -
            minimo
            <
            10
        ){

            minimo =
            APERTURA_BASE
            -
            5;


            maximo =
            APERTURA_BASE
            +
            5;

        }

    }


    /* =================================================
       ESCALA DE TIEMPO — VENTANA MÓVIL
    ================================================= */

    let tiempoInicio =
    historialGrafica.length
    ?
    historialGrafica[0].tiempo
    :
    0;


    let tiempoFinal =
    historialGrafica.length
    ?
    historialGrafica[
        historialGrafica.length - 1
    ].tiempo
    :
    10;


    if(
        tiempoFinal
        -
        tiempoInicio
        <
        10
    ){

        tiempoFinal =
        tiempoInicio
        +
        10;

    }


    function xGrafica(t){

        return (
            margenIzq
            +
            (
                (t - tiempoInicio)
                /
                (
                    tiempoFinal
                    -
                    tiempoInicio
                )
            )
            *
            ancho
        );

    }


    function yGrafica(v){

        return (
            margenSup
            +
            (
                (maximo - v)
                /
                (
                    maximo
                    -
                    minimo
                )
            )
            *
            alto
        );

    }


    /* =================================================
       CUADRÍCULA
    ================================================= */

    ctx.strokeStyle =
    "#e0e6eb";

    ctx.lineWidth =
    1;


    for(
        let i = 0;
        i <= 4;
        i++
    ){

        const y =
        margenSup
        +
        alto * i / 4;


        ctx.beginPath();

        ctx.moveTo(
            margenIzq,
            y
        );

        ctx.lineTo(
            margenIzq + ancho,
            y
        );

        ctx.stroke();

    }


    for(
        let i = 0;
        i <= 4;
        i++
    ){

        const x =
        margenIzq
        +
        ancho * i / 4;


        ctx.beginPath();

        ctx.moveTo(
            x,
            margenSup
        );

        ctx.lineTo(
            x,
            margenSup + alto
        );

        ctx.stroke();

    }


    /* =================================================
       EJES
    ================================================= */

    ctx.strokeStyle =
    "#596872";

    ctx.lineWidth =
    1.2;


    ctx.beginPath();

    ctx.moveTo(
        margenIzq,
        margenSup
    );

    ctx.lineTo(
        margenIzq,
        margenSup + alto
    );

    ctx.lineTo(
        margenIzq + ancho,
        margenSup + alto
    );

    ctx.stroke();


    /* =================================================
       LÍNEA DE REFERENCIA
    ================================================= */

    if(
        referencia >= minimo
        &&
        referencia <= maximo
    ){

        const yRef =
        yGrafica(
            referencia
        );


        ctx.save();

        ctx.setLineDash(
            [5,4]
        );

        ctx.strokeStyle =
        "#929da4";


        ctx.beginPath();

        ctx.moveTo(
            margenIzq,
            yRef
        );

        ctx.lineTo(
            margenIzq + ancho,
            yRef
        );

        ctx.stroke();

        ctx.restore();

    }


    /* =================================================
       CURVA
    ================================================= */

    if(
        historialGrafica.length
        >
        0
    ){

        ctx.strokeStyle =
        variable
        ===
        "frecuencia"
        ?
        "#1684ce"
        :
        "#e67e22";


        ctx.lineWidth =
        2.2;


        ctx.beginPath();


        historialGrafica.forEach(
        function(
            punto,
            index
        ){

            const x =
            xGrafica(
                punto.tiempo
            );


            const y =
            yGrafica(
                punto[variable]
            );


            if(
                index
                ===
                0
            ){

                ctx.moveTo(
                    x,
                    y
                );

            }

            else{

                ctx.lineTo(
                    x,
                    y
                );

            }

        });


        ctx.stroke();

    }


    /* =================================================
       ETIQUETAS
    ================================================= */

    ctx.fillStyle =
    "#263640";

    ctx.font =
    "9px Arial";

    ctx.textAlign =
    "right";

    ctx.textBaseline =
    "middle";


    const decimales =
    variable
    ===
    "frecuencia"
    ?
    1
    :
    0;


    ctx.fillText(
        maximo.toFixed(
            decimales
        ),
        margenIzq - 4,
        margenSup
    );


    ctx.fillText(
        (
            (
                maximo
                +
                minimo
            )
            /
            2
        ).toFixed(
            decimales
        ),
        margenIzq - 4,
        margenSup + alto / 2
    );


    ctx.fillText(
        minimo.toFixed(
            decimales
        ),
        margenIzq - 4,
        margenSup + alto
    );


    ctx.textAlign =
    "center";

    ctx.textBaseline =
    "top";


    ctx.fillText(
        tiempoInicio.toFixed(0),
        margenIzq,
        margenSup + alto + 3
    );


    ctx.fillText(
        (
            (
                tiempoInicio
                +
                tiempoFinal
            )
            /
            2
        ).toFixed(0),

        margenIzq + ancho / 2,
        margenSup + alto + 3
    );


    ctx.fillText(
        tiempoFinal.toFixed(0),
        margenIzq + ancho,
        margenSup + alto + 3
    );


    ctx.fillText(
        "Tiempo [s]",
        margenIzq + ancho / 2,
        H - 11
    );


    ctx.save();

    /*
       Etiqueta vertical junto al borde izquierdo
       (x = 2) para no encimarse con los valores
       del eje.
    */

    ctx.translate(
        2,
        margenSup + alto / 2
    );


    ctx.rotate(
        -Math.PI / 2
    );


    ctx.textAlign =
    "center";

    ctx.textBaseline =
    "top";


    ctx.fillText(
        unidad,
        0,
        0
    );


    ctx.restore();

}


/* =====================================================
   GRÁFICA DE FRECUENCIA — RESPUESTA COMPLETA

   Esta gráfica conserva siempre t = 0.
===================================================== */

function dibujarGraficaFrecuenciaCompleta(){

    const canvas =
    graficaFrecuenciaCompleta;

    const ctx =
    ctxFrecuenciaCompleta;


    const W =
    canvas.width;

    const H =
    canvas.height;


    ctx.clearRect(
        0,
        0,
        W,
        H
    );


    ctx.fillStyle =
    "#ffffff";


    ctx.fillRect(
        0,
        0,
        W,
        H
    );


    const margenIzq = 38;

    const margenDer = 8;

    const margenSup = 10;

    const margenInf = 27;


    const ancho =
    W
    -
    margenIzq
    -
    margenDer;


    const alto =
    H
    -
    margenSup
    -
    margenInf;


    /* =================================================
       ESCALA VERTICAL

       Se calcula con TODA la respuesta.

       Así podemos ver perturbaciones pequeñas
       y también ±20 % sin recortar la curva.
    ================================================= */

    let valores =
    historialCompleto.map(
        p => p.frecuencia
    );


    if(
        valores.length
        ===
        0
    ){

        valores =
        [F_NOMINAL];

    }


    let minimo =
    Math.min(
        ...valores,
        F_NOMINAL
    )
    -
    .10;


    let maximo =
    Math.max(
        ...valores,
        F_NOMINAL
    )
    +
    .10;


    if(
        maximo
        -
        minimo
        <
        .4
    ){

        minimo =
        59.8;

        maximo =
        60.2;

    }


    /* =================================================
       ESCALA DE TIEMPO

       AQUÍ ESTÁ LA DIFERENCIA FUNDAMENTAL:

       tiempoInicio siempre permanece en 0.
    ================================================= */

    const tiempoInicio =
    0;


    let tiempoFinal =
    tiempoSimulacion;


    if(
        tiempoFinal
        <
        10
    ){

        tiempoFinal =
        10;

    }


    function xGrafica(t){

        return (
            margenIzq
            +
            (
                t
                /
                tiempoFinal
            )
            *
            ancho
        );

    }


    function yGrafica(v){

        return (
            margenSup
            +
            (
                (maximo - v)
                /
                (
                    maximo
                    -
                    minimo
                )
            )
            *
            alto
        );

    }


    /* =================================================
       CUADRÍCULA
    ================================================= */

    ctx.strokeStyle =
    "#e0e6eb";

    ctx.lineWidth =
    1;


    for(
        let i = 0;
        i <= 4;
        i++
    ){

        const y =
        margenSup
        +
        alto * i / 4;


        ctx.beginPath();

        ctx.moveTo(
            margenIzq,
            y
        );

        ctx.lineTo(
            margenIzq + ancho,
            y
        );

        ctx.stroke();

    }


    for(
        let i = 0;
        i <= 4;
        i++
    ){

        const x =
        margenIzq
        +
        ancho * i / 4;


        ctx.beginPath();

        ctx.moveTo(
            x,
            margenSup
        );

        ctx.lineTo(
            x,
            margenSup + alto
        );

        ctx.stroke();

    }


    /* =================================================
       EJES
    ================================================= */

    ctx.strokeStyle =
    "#596872";

    ctx.lineWidth =
    1.2;


    ctx.beginPath();

    ctx.moveTo(
        margenIzq,
        margenSup
    );

    ctx.lineTo(
        margenIzq,
        margenSup + alto
    );

    ctx.lineTo(
        margenIzq + ancho,
        margenSup + alto
    );

    ctx.stroke();


    /* =================================================
       REFERENCIA 60 Hz
    ================================================= */

    const yReferencia =
    yGrafica(
        F_NOMINAL
    );


    ctx.save();


    ctx.setLineDash(
        [5,4]
    );


    ctx.strokeStyle =
    "#929da4";


    ctx.beginPath();

    ctx.moveTo(
        margenIzq,
        yReferencia
    );

    ctx.lineTo(
        margenIzq + ancho,
        yReferencia
    );

    ctx.stroke();


    ctx.restore();


    /* =================================================
       CURVA COMPLETA
    ================================================= */

    if(
        historialCompleto.length
        >
        0
    ){

        ctx.strokeStyle =
        "#1684ce";


        ctx.lineWidth =
        2.2;


        ctx.beginPath();


        historialCompleto.forEach(
        function(
            punto,
            index
        ){

            const x =
            xGrafica(
                punto.tiempo
            );


            const y =
            yGrafica(
                punto.frecuencia
            );


            if(
                index
                ===
                0
            ){

                ctx.moveTo(
                    x,
                    y
                );

            }

            else{

                ctx.lineTo(
                    x,
                    y
                );

            }

        });


        ctx.stroke();

    }


    /* =================================================
       ETIQUETAS DEL EJE Y
    ================================================= */

    ctx.fillStyle =
    "#263640";


    ctx.font =
    "9px Arial";


    ctx.textAlign =
    "right";


    ctx.textBaseline =
    "middle";


    ctx.fillText(
        maximo.toFixed(1),
        margenIzq - 4,
        margenSup
    );


    ctx.fillText(
        (
            (
                maximo
                +
                minimo
            )
            /
            2
        ).toFixed(1),

        margenIzq - 4,
        margenSup + alto / 2
    );


    ctx.fillText(
        minimo.toFixed(1),
        margenIzq - 4,
        margenSup + alto
    );


    /* =================================================
       ETIQUETAS DEL EJE X
    ================================================= */

    ctx.textAlign =
    "center";


    ctx.textBaseline =
    "top";


    /*
       El primer valor SIEMPRE será cero.
    */

    ctx.fillText(
        "0",
        margenIzq,
        margenSup + alto + 3
    );


    ctx.fillText(
        (
            tiempoFinal
            /
            2
        ).toFixed(0),

        margenIzq + ancho / 2,
        margenSup + alto + 3
    );


    ctx.fillText(
        tiempoFinal.toFixed(0),

        margenIzq + ancho,
        margenSup + alto + 3
    );


    ctx.fillText(
        "Tiempo [s]",
        margenIzq + ancho / 2,
        H - 11
    );


    /* =================================================
       ETIQUETA VERTICAL
    ================================================= */

    ctx.save();

    /*
       Etiqueta vertical junto al borde izquierdo
       (x = 2) para no encimarse con los valores
       del eje.
    */

    ctx.translate(
        2,
        margenSup + alto / 2
    );


    ctx.rotate(
        -Math.PI / 2
    );


    ctx.textAlign =
    "center";


    ctx.textBaseline =
    "top";


    ctx.fillText(
        "Frecuencia [Hz]",
        0,
        0
    );


    ctx.restore();

}


/* =====================================================
   DIBUJAR LAS TRES GRÁFICAS
===================================================== */

function dibujarGraficas(){

    /* Frecuencia — ventana móvil */

    dibujarGrafica(
        graficaFrecuencia,
        ctxFrecuencia,
        "frecuencia",
        F_NOMINAL,
        "Frecuencia [Hz]"
    );


    /* Frecuencia — desde t = 0 */

    dibujarGraficaFrecuenciaCompleta();


    /* Apertura — ventana móvil */

    dibujarGrafica(
        graficaApertura,
        ctxApertura,
        "apertura",
        APERTURA_BASE,
        "Apertura [%]"
    );

}


/* =====================================================
   CONTROL — SELECTOR DE CARGA
===================================================== */

sliderCarga.addEventListener(
"input",
function(){

    const valor =
    Number(
        sliderCarga.value
    );


    valorCarga.innerText =
    valor > 0
    ?
    "+"
    +
    valor
    :
    valor;

});


/* =====================================================
   BOTÓN APLICAR
===================================================== */

document
.getElementById("aplicar")
.addEventListener(
"click",
function(){

    const variacion =
    Number(
        sliderCarga.value
    )
    /
    100;


    cargaElectrica =
    POTENCIA_BASE
    +
    variacion;


    simulando =
    true;


    pausado =
    false;


    ultimoTiempo =
    null;


    limpiarGraficas();

    actualizarBotonesOperacion();

});


/* =====================================================
   BOTÓN PAUSA
===================================================== */

document
.getElementById("pausa")
.addEventListener(
"click",
function(){

    pausado =
    !pausado;

    actualizarBotonesOperacion();

});


/* =====================================================
   BOTÓN REINICIAR
===================================================== */

document
.getElementById("reiniciar")
.addEventListener(
"click",
function(){

    frecuencia =
    F_NOMINAL;


    cargaElectrica =
    POTENCIA_BASE;


    potenciaMecanica =
    POTENCIA_BASE;


    apertura =
    APERTURA_BASE;


    integralError =
    0;


    simulando =
    false;


    pausado =
    false;


    ultimoTiempo =
    null;


    posicionCNeutra =
    null;


    desplazamientoCarreteActual =
    0;


    sliderCarga.value =
    0;


    valorCarga.innerText =
    "0";


    limpiarGraficas();

    actualizarBotonesOperacion();

    actualizarVisual();

});


/* =====================================================
   ESTADO DEL BOTÓN PAUSA

   Igual que en el simulador AVR:
   el texto alterna entre PAUSA y CONTINUAR.
===================================================== */

const botonPausa =
document.getElementById("pausa");


function actualizarBotonesOperacion(){

    botonPausa.textContent =
    pausado
    ?
    "CONTINUAR"
    :
    "PAUSA";

}


/* =====================================================
   TAMAÑO DE LAS GRÁFICAS

   La resolución interna de cada canvas se ajusta al
   tamaño con que se muestra. Las funciones de dibujo
   leen canvas.width y canvas.height, por lo que
   escalas, datos e historial no cambian.
===================================================== */

function ajustarTamanoGraficas(){

    [
        graficaFrecuencia,
        graficaFrecuenciaCompleta,
        graficaApertura
    ]
    .forEach(
        function(canvas){

            const ancho =
            Math.max(
                1,
                Math.round(
                    canvas.clientWidth
                )
            );

            const alto =
            Math.max(
                1,
                Math.round(
                    canvas.clientHeight
                )
            );

            if(
                canvas.width !== ancho
                ||
                canvas.height !== alto
            ){
                canvas.width = ancho;
                canvas.height = alto;
            }

        }
    );

    dibujarGraficas();

}


window.addEventListener(
    "resize",
    ajustarTamanoGraficas
);


/* =====================================================
   TEXTOS E INDICADORES
===================================================== */

function actualizarTexto(){

    const diferencia =
    potenciaMecanica
    -
    cargaElectrica;


    luzAccion
    .classList
    .remove(
        "luzActiva"
    );


    /* =================================================
       BALANCE DE POTENCIA
    ================================================= */

    if(
        diferencia
        >
        .01
    ){

        balanceSigno.innerText =
        ">";


        balanceEstado.innerText =
        "ACELERACIÓN";

    }

    else if(
        diferencia
        <
        -.01
    ){

        balanceSigno.innerText =
        "<";


        balanceEstado.innerText =
        "DESACELERACIÓN";

    }

    else{

        balanceSigno.innerText =
        "=";


        balanceEstado.innerText =
        "EQUILIBRIO";

    }


    /* =================================================
       VÁLVULA EN ZONA NEUTRA
    ================================================= */

    if(
        Math.abs(
            desplazamientoCarreteActual
        )
        <=
        UMBRAL_VALVULA
    ){

        if(
            Math.abs(
                diferencia
            )
            <
            .006

            &&

            Math.abs(
                frecuencia
                -
                F_NOMINAL
            )
            <
            .015
        ){





            accionTexto.textContent =
            "SISTEMA ESTABLE";


            accionSubtexto.textContent =
            "Ambos puertos cerrados";

        }

        else{





            accionTexto.textContent =
            "VÁLVULA CENTRADA";


            accionSubtexto.textContent =
            "Servomotor detenido";

        }


        return;

    }


    /* =================================================
       ORDEN DE CIERRE
    ================================================= */

    if(
        desplazamientoCarreteActual
        >
        UMBRAL_VALVULA
    ){

        luzAccion
        .classList
        .add(
            "luzActiva"
        );


        accionTexto.textContent =
        "ORDEN DE CIERRE";


        accionSubtexto.textContent =
        "Presión en cámara derecha";





    }


    /* =================================================
       ORDEN DE APERTURA
    ================================================= */

    else if(
        desplazamientoCarreteActual
        <
        -UMBRAL_VALVULA
    ){

        luzAccion
        .classList
        .add(
            "luzActiva"
        );


        accionTexto.textContent =
        "ORDEN DE APERTURA";


        accionSubtexto.textContent =
        "Presión en cámara izquierda";





    }

}


/* =====================================================
   ACTUALIZACIÓN VISUAL
===================================================== */

function actualizarVisual(){

    frecuenciaTxt.innerText =
    frecuencia.toFixed(2);


    aperturaTxt.innerText =
    apertura.toFixed(1);


    pmBalance.innerText =
    (
        potenciaMecanica
        *
        100
    ).toFixed(1);


    peBalance.innerText =
    (
        cargaElectrica
        *
        100
    ).toFixed(1);


    /*
       regulador.js actualiza también el
       distribuidor mediante actualizarDistribuidor().
    */

    actualizarRegulador();


    actualizarTexto();


    dibujarGraficas();

}


/* =====================================================
   LOOP PRINCIPAL
===================================================== */

function animar(tiempo){

    if(
        ultimoTiempo
        ===
        null
    ){

        ultimoTiempo =
        tiempo;

    }


    let dt =
    (
        tiempo
        -
        ultimoTiempo
    )
    /
    1000;


    ultimoTiempo =
    tiempo;


    dt =
    Math.min(
        dt,
        .04
    );


    /* =================================================
       MODELO DINÁMICO
    ================================================= */

    if(
        simulando
        &&
        !pausado
    ){

        ejecutarModelo(
            dt
        );

    }


    /* =================================================
       RODETE FRANCIS
    ================================================= */

    if(
        !pausado
    ){

        actualizarRotorFrancis(
            dt
        );

    }


    /* =================================================
       INTERFAZ Y MECANISMOS
    ================================================= */

    actualizarVisual();


    requestAnimationFrame(
        animar
    );

}


/* =====================================================
   INICIO
===================================================== */

limpiarGraficas();

actualizarBotonesOperacion();

actualizarVisual();

ajustarTamanoGraficas();

requestAnimationFrame(
    animar
);