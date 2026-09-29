/* ============================================================
   SIMULADOR DE SECUENCIA DE FASES
   VERSIÓN 7

   - Ondas senoidales matemáticas
   - Rotación de fasores
   - Cursor temporal
   - Puntos instantáneos
   - Secuencia ABC / ACB
   - Ángulos instantáneos A, B y C
   - Control de velocidad de giro
   - Pausa / Continuar
   - Reiniciar
   ============================================================ */


/* ============================================================
   ELEMENTOS SVG
   ============================================================ */

const ondaA = document.getElementById("ondaA");
const ondaB = document.getElementById("ondaB");
const ondaC = document.getElementById("ondaC");

const fasorA = document.getElementById("fasorA");
const fasorB = document.getElementById("fasorB");
const fasorC = document.getElementById("fasorC");

const etiquetaA = document.getElementById("etiquetaA");
const etiquetaB = document.getElementById("etiquetaB");
const etiquetaC = document.getElementById("etiquetaC");

const cursorTiempo = document.getElementById("cursorTiempo");

const puntoA = document.getElementById("puntoA");
const puntoB = document.getElementById("puntoB");
const puntoC = document.getElementById("puntoC");


/* ============================================================
   CONTROLES
   ============================================================ */

const secuenciaABC =
    document.getElementById("secuenciaABC");

const secuenciaACB =
    document.getElementById("secuenciaACB");

const velocidadGiro =
    document.getElementById("velocidadGiro");

const valorVelocidad =
    document.getElementById("valorVelocidad");

const btnPausa =
    document.getElementById("btnPausa");

const btnReiniciar =
    document.getElementById("btnReiniciar");


/* ============================================================
   INDICADORES ANGULARES
   ============================================================ */

const anguloA =
    document.getElementById("anguloA");

const anguloB =
    document.getElementById("anguloB");

const anguloC =
    document.getElementById("anguloC");


/* ============================================================
   GEOMETRÍA DE LA GRÁFICA
   ============================================================ */

const xInicio = 470;
const xFin = 900;

const yCentro = 220;

const amplitud = 135;

const ancho =
    xFin - xInicio;


/* ============================================================
   ESTADO DEL SIMULADOR
   ============================================================ */

let secuencia = "ABC";


/*
   Desfases matemáticos utilizados
   para generar las senoides.
*/

let faseA = 0;

let faseB =
    2 * Math.PI / 3;

let faseC =
    -2 * Math.PI / 3;


/*
   Ángulo instantáneo de referencia.

   La fase A es la referencia.
*/

let angulo = 0;


/*
   Estado de animación
*/

let pausado = false;


/*
   Referencia temporal
*/

let tiempoAnterior =
    performance.now();


/* ============================================================
   VELOCIDAD VISUAL DE ROTACIÓN

   Se expresa en grados por segundo.

   Valor inicial = 30 °/s

   No representa directamente
   una frecuencia eléctrica de 60 Hz.
   ============================================================ */

let velocidadVisual = 30;


/* ============================================================
   NORMALIZAR ÁNGULO

   Convierte cualquier ángulo al intervalo:

   0° <= ángulo < 360°
   ============================================================ */

function normalizarAngulo(grados) {

    return (
        (grados % 360) + 360
    ) % 360;
}


/* ============================================================
   GENERAR UNA SENOIDE
   ============================================================ */

function crearSenoide(fase) {

    let d = "";

    const puntos = 360;


    for (
        let i = 0;
        i <= puntos;
        i++
    ) {

        const proporcion =
            i / puntos;


        const theta =
            proporcion *
            2 *
            Math.PI;


        const x =
            xInicio +
            proporcion *
            ancho;


        const y =
            yCentro -
            amplitud *
            Math.sin(
                theta + fase
            );


        if (i === 0) {

            d +=
                `M ${x.toFixed(2)} ${y.toFixed(2)}`;

        } else {

            d +=
                ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
        }
    }


    return d;
}


/* ============================================================
   DIBUJAR LAS TRES ONDAS
   ============================================================ */

function dibujarOndas() {

    ondaA.setAttribute(
        "d",
        crearSenoide(faseA)
    );


    ondaB.setAttribute(
        "d",
        crearSenoide(faseB)
    );


    ondaC.setAttribute(
        "d",
        crearSenoide(faseC)
    );
}


/* ============================================================
   ACTUALIZAR INDICADOR ANGULAR INSTANTÁNEO
   ============================================================ */

function actualizarAngulosInstantaneos() {

    /*
       Fase A = referencia instantánea
    */

    const a =
        normalizarAngulo(
            angulo
        );


    let b;
    let c;


    /*
       SECUENCIA ABC

       A = θ
       B = θ + 120°
       C = θ + 240°
    */

    if (secuencia === "ABC") {

        b =
            normalizarAngulo(
                angulo + 120
            );

        c =
            normalizarAngulo(
                angulo + 240
            );

    }


    /*
       SECUENCIA ACB

       A = θ
       C = θ + 120°
       B = θ + 240°
    */

    else {

        b =
            normalizarAngulo(
                angulo + 240
            );

        c =
            normalizarAngulo(
                angulo + 120
            );
    }


    /*
       Mostrar grados enteros
    */

    anguloA.textContent =
        `${Math.round(a) % 360}°`;

    anguloB.textContent =
        `${Math.round(b) % 360}°`;

    anguloC.textContent =
        `${Math.round(c) % 360}°`;
}


/* ============================================================
   CONFIGURAR SECUENCIA
   ============================================================ */

function configurarSecuencia() {

    /*
       SECUENCIA ABC
    */

    if (secuencia === "ABC") {

        faseA = 0;

        faseB =
            2 * Math.PI / 3;

        faseC =
            -2 * Math.PI / 3;
    }


    /*
       SECUENCIA ACB
    */

    else {

        faseA = 0;

        faseB =
            -2 * Math.PI / 3;

        faseC =
            2 * Math.PI / 3;
    }


    /*
       Redibujar las ondas
    */

    dibujarOndas();


    /*
       Actualizar fasores
    */

    actualizarFasores();


    /*
       Actualizar cursor y puntos
    */

    actualizarGrafica(
        angulo
    );


    /*
       Actualizar indicador angular
    */

    actualizarAngulosInstantaneos();
}


/* ============================================================
   SELECTOR ABC
   ============================================================ */

secuenciaABC.addEventListener(
    "change",
    function () {

        if (this.checked) {

            secuencia = "ABC";

            configurarSecuencia();
        }
    }
);


/* ============================================================
   SELECTOR ACB
   ============================================================ */

secuenciaACB.addEventListener(
    "change",
    function () {

        if (this.checked) {

            secuencia = "ACB";

            configurarSecuencia();
        }
    }
);


/* ============================================================
   CONTROL DE VELOCIDAD
   ============================================================ */

velocidadGiro.addEventListener(
    "input",
    function () {

        /*
           Leer la velocidad seleccionada
           en el slider.
        */

        velocidadVisual =
            Number(this.value);


        /*
           Actualizar indicador.
        */

        valorVelocidad.textContent =
            `${velocidadVisual} °/s`;
    }
);


/* ============================================================
   POSICIÓN DE LAS ETIQUETAS A, B Y C
   ============================================================ */

const radioEtiqueta = 158;


function posicionEtiqueta(
    elemento,
    grados
) {

    const rad =
        grados *
        Math.PI /
        180;


    const x =
        220 +
        radioEtiqueta *
        Math.cos(rad);


    const y =
        220 -
        radioEtiqueta *
        Math.sin(rad);


    elemento.setAttribute(
        "x",
        x.toFixed(2)
    );


    elemento.setAttribute(
        "y",
        y.toFixed(2)
    );
}


/* ============================================================
   ACTUALIZAR FASORES
   ============================================================ */

function actualizarFasores() {

    let posicionB;
    let posicionC;


    /*
       ABC
    */

    if (secuencia === "ABC") {

        posicionB =
            angulo + 120;

        posicionC =
            angulo + 240;
    }


    /*
       ACB
    */

    else {

        posicionB =
            angulo + 240;

        posicionC =
            angulo + 120;
    }


    /*
       FASOR A

       Su posición original en el SVG
       es 0°.
    */

    fasorA.setAttribute(
        "transform",
        `rotate(${-angulo} 220 220)`
    );


    /*
       FASOR B

       Su posición original dibujada
       en el SVG es +120°.
    */

    const rotacionB =
        -(posicionB - 120);


    fasorB.setAttribute(
        "transform",
        `rotate(${rotacionB} 220 220)`
    );


    /*
       FASOR C

       Su posición original dibujada
       en el SVG es -120°,
       equivalente a +240°.
    */

    const posicionCEquivalente =
        posicionC > 180
            ? posicionC - 360
            : posicionC;


    const rotacionC =
        -(posicionCEquivalente + 120);


    fasorC.setAttribute(
        "transform",
        `rotate(${rotacionC} 220 220)`
    );


    /*
       Mover las etiquetas
    */

    posicionEtiqueta(
        etiquetaA,
        angulo
    );


    posicionEtiqueta(
        etiquetaB,
        posicionB
    );


    posicionEtiqueta(
        etiquetaC,
        posicionC
    );
}


/* ============================================================
   ACTUALIZAR CURSOR Y PUNTOS INSTANTÁNEOS
   ============================================================ */

function actualizarGrafica(grados) {

    /*
       Posición horizontal del cursor
    */

    const proporcion =
        grados / 360;


    const x =
        xInicio +
        proporcion *
        ancho;


    /*
       Convertir el ángulo a radianes
    */

    const theta =
        grados *
        Math.PI /
        180;


    /*
       Valores instantáneos
    */

    const valorA =
        Math.sin(
            theta + faseA
        );


    const valorB =
        Math.sin(
            theta + faseB
        );


    const valorC =
        Math.sin(
            theta + faseC
        );


    /*
       Posiciones verticales
    */

    const yA =
        yCentro -
        amplitud *
        valorA;


    const yB =
        yCentro -
        amplitud *
        valorB;


    const yC =
        yCentro -
        amplitud *
        valorC;


    /* --------------------------------------------------------
       CURSOR
       -------------------------------------------------------- */

    cursorTiempo.setAttribute(
        "x1",
        x
    );

    cursorTiempo.setAttribute(
        "x2",
        x
    );


    /* --------------------------------------------------------
       PUNTO A
       -------------------------------------------------------- */

    puntoA.setAttribute(
        "cx",
        x
    );

    puntoA.setAttribute(
        "cy",
        yA
    );


    /* --------------------------------------------------------
       PUNTO B
       -------------------------------------------------------- */

    puntoB.setAttribute(
        "cx",
        x
    );

    puntoB.setAttribute(
        "cy",
        yB
    );


    /* --------------------------------------------------------
       PUNTO C
       -------------------------------------------------------- */

    puntoC.setAttribute(
        "cx",
        x
    );

    puntoC.setAttribute(
        "cy",
        yC
    );
}


/* ============================================================
   BOTÓN PAUSA / CONTINUAR
   ============================================================ */

btnPausa.addEventListener(
    "click",
    function () {

        pausado =
            !pausado;


        /*
           PAUSAR
        */

        if (pausado) {

            btnPausa.textContent =
                "CONTINUAR";
        }


        /*
           CONTINUAR
        */

        else {

            btnPausa.textContent =
                "PAUSA";


            /*
               Evitar salto temporal
               al reanudar.
            */

            tiempoAnterior =
                performance.now();
        }
    }
);


/* ============================================================
   BOTÓN REINICIAR
   ============================================================ */

btnReiniciar.addEventListener(
    "click",
    function () {

        /*
           Ángulo inicial
        */

        angulo = 0;


        /*
           Secuencia inicial ABC
        */

        secuencia = "ABC";


        secuenciaABC.checked =
            true;


        secuenciaACB.checked =
            false;


        /*
           Velocidad inicial
        */

        velocidadVisual = 30;

        velocidadGiro.value = 30;

        valorVelocidad.textContent =
            "30 °/s";


        /*
           Reanudar animación
        */

        pausado = false;


        btnPausa.textContent =
            "PAUSA";


        /*
           Restaurar simulador
        */

        configurarSecuencia();


        /*
           Estado angular inicial:

           A =   0°
           B = 120°
           C = 240°
        */

        actualizarAngulosInstantaneos();


        /*
           Nueva referencia temporal
        */

        tiempoAnterior =
            performance.now();
    }
);


/* ============================================================
   BUCLE PRINCIPAL DE ANIMACIÓN
   ============================================================ */

function animar(tiempoActual) {

    /*
       Tiempo transcurrido
       en segundos.
    */

    const dt =
        (
            tiempoActual -
            tiempoAnterior
        ) /
        1000;


    tiempoAnterior =
        tiempoActual;


    /*
       Solamente avanzar
       si NO está pausado.
    */

    if (!pausado) {

        /*
           Avanzar ángulo según
           la velocidad seleccionada.
        */

        angulo +=
            velocidadVisual *
            dt;


        /*
           Mantener el ángulo
           entre 0° y 360°.
        */

        angulo =
            normalizarAngulo(
                angulo
            );


        /*
           Actualizar fasores
        */

        actualizarFasores();


        /*
           Actualizar cursor
           y puntos
        */

        actualizarGrafica(
            angulo
        );


        /*
           Actualizar los tres
           ángulos instantáneos
        */

        actualizarAngulosInstantaneos();
    }


    /*
       Solicitar siguiente cuadro
    */

    requestAnimationFrame(
        animar
    );
}


/* ============================================================
   ESTADO INICIAL
   ============================================================ */

velocidadGiro.value =
    velocidadVisual;

valorVelocidad.textContent =
    `${velocidadVisual} °/s`;

configurarSecuencia();

actualizarFasores();

actualizarGrafica(0);

actualizarAngulosInstantaneos();


/* ============================================================
   INICIAR ANIMACIÓN
   ============================================================ */

requestAnimationFrame(
    animar
);