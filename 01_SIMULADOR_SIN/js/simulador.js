"use strict";


/* =========================================================
   ELEMENTOS DE CONTROL
========================================================= */

const pmSlider =
    document.getElementById("pmSlider");

const loadSlider =
    document.getElementById("loadSlider");

const jSlider =
    document.getElementById("jSlider");


const breakerBtn =
    document.getElementById("breakerBtn");

const pauseBtn =
    document.getElementById("pauseBtn");

const resetBtn =
    document.getElementById("resetBtn");


/* =========================================================
   VARIABLES DE ESTADO
========================================================= */

let breakerClosed = true;

let paused = false;

let omega = 1.0;

let angle = 0;


/* =========================================================
   CONSTANTES
========================================================= */

const nominalFrequency = 60.0;

const dt = 0.02;

const dynamicScale = 4.0;

const lossCoefficient = 0.015;


/* =========================================================
   INTERRUPTOR
========================================================= */

breakerBtn.addEventListener(
    "click",
    () => {

        breakerClosed =
            !breakerClosed;


        if (breakerClosed) {

            breakerBtn.textContent =
                "Interruptor CERRADO";

            breakerBtn.className =
                "boton-simulador success";


            document.getElementById(
                "breakerBlade"
            ).setAttribute(
                "x2",
                "1040"
            );

            document.getElementById(
                "breakerBlade"
            ).setAttribute(
                "y2",
                "230"
            );

        }

        else {

            breakerBtn.textContent =
                "Interruptor ABIERTO";

            breakerBtn.className =
                "boton-simulador danger";


            document.getElementById(
                "breakerBlade"
            ).setAttribute(
                "x2",
                "1035"
            );

            document.getElementById(
                "breakerBlade"
            ).setAttribute(
                "y2",
                "202"
            );


            /* ---------------------------------------------
               Al abrir el interruptor:

               Pe = 0
               selector de carga = 0 %

               Pm permanece sin cambio.
            --------------------------------------------- */

            loadSlider.value = 0;

        }

    }
);


/* =========================================================
   PAUSA
========================================================= */

pauseBtn.addEventListener(
    "click",
    () => {

        paused =
            !paused;


        pauseBtn.textContent =
            paused
                ? "CONTINUAR"
                : "PAUSA";

    }
);


/* =========================================================
   REINICIO
========================================================= */

resetBtn.addEventListener(
    "click",
    () => {

        /* Valores iniciales */

        pmSlider.value = 50;

        loadSlider.value = 50;

        jSlider.value = 80;


        /* Estado dinámico */

        omega = 1.0;

        angle = 0;


        /* Pausa */

        paused = false;

        pauseBtn.textContent =
            "PAUSA";


        /* Interruptor */

        breakerClosed = true;

        breakerBtn.textContent =
            "Interruptor CERRADO";

        breakerBtn.className =
            "boton-simulador success";


        document.getElementById(
            "breakerBlade"
        ).setAttribute(
            "x2",
            "1040"
        );

        document.getElementById(
            "breakerBlade"
        ).setAttribute(
            "y2",
            "230"
        );

    }
);


/* =========================================================
   SIMULACIÓN
========================================================= */

function simulate() {


    /* -----------------------------------------------------
       POTENCIA MECÁNICA
    ----------------------------------------------------- */

    const pm =
        Number(
            pmSlider.value
        ) / 100;


    /* -----------------------------------------------------
       CARGA ELÉCTRICA
    ----------------------------------------------------- */

    const load =
        Number(
            loadSlider.value
        ) / 100;

    /* =====================================================
   CHORRO DE AGUA SEGÚN POTENCIA MECÁNICA
===================================================== */

const waterJet =
    document.getElementById("waterJet");


if (pm <= 0) {

    /* Pm = 0 → desaparece completamente el chorro */

    waterJet.setAttribute(
        "height",
        "0"
    );

    waterJet.setAttribute(
        "y",
        "230"
    );

}

else {

    /*
       El chorro varía entre 3 y 18 px.
       Siempre permanece centrado en y = 230.
    */

    const jetMinHeight = 3;
    const jetMaxHeight = 18;

    const jetHeight =
        jetMinHeight
        +
        (jetMaxHeight - jetMinHeight) * pm;


    waterJet.setAttribute(
        "height",
        jetHeight.toFixed(1)
    );


    waterJet.setAttribute(
        "y",
        (
            230 -
            jetHeight / 2
        ).toFixed(1)
    );

}
        
    /* -----------------------------------------------------
       INERCIA EQUIVALENTE
    ----------------------------------------------------- */

    const J =
        Number(
            jSlider.value
        );


    /* -----------------------------------------------------
       POTENCIA ELÉCTRICA
    ----------------------------------------------------- */

    const pe =
        breakerClosed
            ? load
            : 0;


    /* -----------------------------------------------------
       VELOCIDAD SEGURA PARA CÁLCULO DE PAR
    ----------------------------------------------------- */

    const safeOmega =
        Math.max(
            omega,
            0.20
        );


    /* -----------------------------------------------------
       PARES

       P = T · omega

       T = P / omega
    ----------------------------------------------------- */

    const Tm =
        pm / safeOmega;


    const Te =
        pe / safeOmega;


    /* -----------------------------------------------------
       PÉRDIDAS MECÁNICAS

       Se hacen explícitas cuando Pm = 0.
    ----------------------------------------------------- */

    const Tloss =

        pm === 0

            ? lossCoefficient * omega

            : 0;


    /* =====================================================
       ECUACIÓN DINÁMICA

       J · dω/dt = Tm − Te − Tloss
    ===================================================== */

    if (!paused) {

        const domega =

            dynamicScale
            *
            (
                Tm
                -
                Te
                -
                Tloss
            )
            /
            J;


        omega +=
            domega * dt;


        /* LÍMITES DIDÁCTICOS */

        omega =
            Math.max(
                0.0,
                Math.min(
                    1.30,
                    omega
                )
            );


        /* ÁNGULO VISUAL COMÚN */

        angle +=
            7.5 * omega;


        if (angle >= 360) {

            angle -= 360;

        }

    }


    /* =====================================================
       VARIABLES DERIVADAS
    ===================================================== */

    const frequency =

        breakerClosed

            ? nominalFrequency * omega

            : 0;


    const speedPct =
        omega * 100;


    const deltaP =
        (pm - pe) * 100;


    const deltaT =
        Tm - Te - Tloss;


    const ekPct =
        omega * omega * 100;


    /* =====================================================
       ACTUALIZAR INSTRUMENTOS
    ===================================================== */

    document.getElementById(
        "freq"
    ).textContent =
        frequency.toFixed(2);


    document.getElementById(
        "speed"
    ).textContent =
        speedPct.toFixed(1);


    document.getElementById(
        "pm"
    ).textContent =
        (pm * 100).toFixed(1);


    document.getElementById(
        "pe"
    ).textContent =
        (pe * 100).toFixed(1);


    document.getElementById(
        "tm"
    ).textContent =
        Tm.toFixed(3);


    document.getElementById(
        "te"
    ).textContent =
        Te.toFixed(3);


    document.getElementById(
        "dp"
    ).textContent =
        deltaP.toFixed(1);


    document.getElementById(
        "dt"
    ).textContent =
        deltaT.toFixed(3);


    document.getElementById(
        "ek"
    ).textContent =
        ekPct.toFixed(1);


    /* =====================================================
       ANIMACIÓN DE TURBINA
    ===================================================== */

    document.getElementById(
        "turbineRotor"
    ).setAttribute(

        "transform",

        `
        translate(330 230)
        rotate(${angle})
        `

    );


    /* =====================================================
       ANIMACIÓN DEL GENERADOR

       Utiliza exactamente el mismo ángulo que la turbina.
    ===================================================== */

    document.getElementById("genRotor").setAttribute(
    "transform",
    `rotate(${angle} 600 325)`
);

document.getElementById("flujo-polos").setAttribute(
    "transform",
    `rotate(${angle} 600 325)`
);


/* =====================================================
   REPRESENTACIÓN DE LA CARGA
   LUMINOSIDAD CONTINUA DEL FOCO
===================================================== */

const bulbGlass =
    document.getElementById("bulbGlass");

const bulbFilament =
    document.getElementById("bulbFilament");

const bulbGlow =
    document.getElementById("bulbGlow");


/* =====================================================
   NIVEL DE LUMINOSIDAD

   Depende de la potencia eléctrica real Pe.
   Con interruptor abierto siempre vale cero.
===================================================== */

const lightLevel =
    breakerClosed
        ? pe
        : 0;


/* Curva visual para aumentar el contraste */

const visualLevel =
    Math.pow(lightLevel, 1.25);


/* =====================================================
   COLOR DEL BULBO
===================================================== */

/*
   Apagado:
   aproximadamente gris claro

   Encendido:
   amarillo progresivamente más intenso
*/

const r =
    Math.round(
        235 + 20 * visualLevel
    );

const g =
    Math.round(
        235 + 20 * visualLevel
    );

const b =
    Math.round(
        235 - 175 * visualLevel
    );


bulbGlass.setAttribute(
    "fill",
    `rgb(${r}, ${g}, ${b})`
);


/* =====================================================
   FILAMENTO
===================================================== */

if (lightLevel <= 0.001) {

    bulbFilament.setAttribute(
        "stroke",
        "#777777"
    );

    bulbFilament.setAttribute(
        "stroke-width",
        "2"
    );

}

else {

    const filamentR = 210;

    const filamentG =
        Math.round(
            90 + 150 * visualLevel
        );

    const filamentB =
        Math.round(
            20 + 40 * visualLevel
        );


    bulbFilament.setAttribute(
        "stroke",
        `rgb(${filamentR}, ${filamentG}, ${filamentB})`
    );


    bulbFilament.setAttribute(
        "stroke-width",
        (
            2 +
            2.5 * visualLevel
        ).toFixed(2)
    );

}


/* =====================================================
   HALO LUMINOSO
===================================================== */

/*
   El halo aparece progresivamente.
   A carga cero desaparece completamente.
*/

const glowOpacity =
    0.42 * visualLevel;


bulbGlow.setAttribute(
    "opacity",
    glowOpacity.toFixed(3)
);


/*
   El halo también aumenta ligeramente de tamaño
   conforme aumenta Pe.
*/

const glowRadius =
    48 +
    12 * visualLevel;


bulbGlow.setAttribute(
    "r",
    glowRadius.toFixed(1)
);


    /* =====================================================
       ESTADO DEL SISTEMA
    ===================================================== */

    let status = "";


    if (
        Math.abs(deltaT) < 0.002
    ) {

        status =
            "EQUILIBRIO — VELOCIDAD CONSTANTE";

    }


    else if (
        deltaT > 0
    ) {

        status =
            "Tₘ > Tₑ + Tₚ — EL CONJUNTO ACELERA";

    }


    else {

        status =
            "Tₘ < Tₑ + Tₚ — EL CONJUNTO DESACELERA";

    }


    if (paused) {

        status +=
            " · SIMULACIÓN EN PAUSA";

    }


    document.getElementById(
        "status"
    ).textContent =
        status;


    /* =====================================================
       SIGUIENTE CUADRO
    ===================================================== */

    requestAnimationFrame(
        simulate
    );

}


/* =========================================================
   INICIO
========================================================= */

simulate();