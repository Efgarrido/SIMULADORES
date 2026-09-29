/* ============================================================
   SIMULADOR DE ARMÓNICOS
   ============================================================ */

"use strict";


/* ============================================================
   CONSTANTES
   ============================================================ */

const SVG_NS = "http://www.w3.org/2000/svg";

const NUMERO_MAXIMO_ARMONICOS = 11;


/* ============================================================
   COLORES DE LOS ARMÓNICOS
   ============================================================ */

const coloresArmonicos = [
    "#ff2020",
    "#ff9900",
    "#e6cc00",
    "#39c939",
    "#17b86b",
    "#00aeb8",
    "#2693e6",
    "#5252dd",
    "#8c4bd6",
    "#c34dc3",
    "#d84c82"
];


/* ============================================================
   ESTADO DEL SIMULADOR
   ============================================================ */

let amplitudes = [
    1.00,
    0.00,
    0.00,
    0.00,
    0.00,
    0.00,
    0.00,
    0.00,
    0.00,
    0.00,
    0.00
];

let frecuenciaFundamental = 60;

let numeroArmonicos = 11;

let tipoFuncion = "seno";


/* ============================================================
   PERÍODO FUNDAMENTAL
   ============================================================ */

function periodoFundamentalMs() {

    return 1000 / frecuenciaFundamental;
}


/* ============================================================
   ESCALAS
   ============================================================ */

let ventanaTiempoComponentes =
    periodoFundamentalMs();

const escalaYComponentes = 1.0;


/*
   Escala vertical de la suma.

   Valor inicial: ±1.0
   Incremento: 0.5
*/

let escalaYSuma = 1.0;

const incrementoEscalaYSuma = 0.5;


/* ============================================================
   ELEMENTOS HTML
   ============================================================ */

const graficaAmplitudes =
    document.getElementById("graficaAmplitudes");

const barrasControlAmplitud =
    document.getElementById("barrasControlAmplitud");

const graficaFrecuencia =
    document.getElementById("graficaFrecuencia");

const barrasArmonicos =
    document.getElementById("barrasArmonicos");

const componentesTiempo =
    document.getElementById("componentesTiempo");

const etiquetasTiempo =
    document.getElementById("etiquetasTiempo");

const etiquetasTiempoSuma =
    document.getElementById("etiquetasTiempoSuma");

const etiquetasAmplitudSuma =
    document.getElementById("etiquetasAmplitudSuma");

const ondaResultante =
    document.getElementById("ondaResultante");

const selectorFrecuencia =
    document.getElementById("frecuenciaFundamental");

const sliderArmonicos =
    document.getElementById("armonicos");

const valorArmonicos =
    document.getElementById("valorArmonicos");

const selectorRepresentacion =
    document.getElementById("representacion");

const botonReiniciar =
    document.getElementById("reiniciar");

const radiosFuncion =
    document.querySelectorAll(
        'input[name="tipoFuncion"]'
    );


/* ============================================================
   CASILLAS A1 ... A11
   ============================================================ */

const camposAmplitud = [];

for (
    let n = 1;
    n <= NUMERO_MAXIMO_ARMONICOS;
    n++
) {

    camposAmplitud.push(
        document.getElementById(`A${n}`)
    );
}


/* ============================================================
   GEOMETRÍA DE LA GRÁFICA DE CONTROL
   ============================================================ */

const geometriaControl = {

    xInicio: 105,

    separacionX: 65,

    ySuperior: 25,

    yCero: 105,

    yInferior: 185,

    amplitudMaxima: 1.0,

    anchoBarra: 34
};


/* ============================================================
   POSICIÓN X DE UN ARMÓNICO
   ============================================================ */

function xControlArmonico(indice) {

    return (
        geometriaControl.xInicio +
        indice *
        geometriaControl.separacionX
    );
}


/* ============================================================
   AMPLITUD -> COORDENADA Y
   ============================================================ */

function amplitudAYControl(amplitud) {

    const pixelesPorUnidad =
        (
            geometriaControl.yCero -
            geometriaControl.ySuperior
        )
        /
        geometriaControl.amplitudMaxima;

    return (
        geometriaControl.yCero -
        amplitud *
        pixelesPorUnidad
    );
}


/* ============================================================
   COORDENADA Y -> AMPLITUD
   ============================================================ */

function yControlAAmplitud(y) {

    const pixelesPorUnidad =
        (
            geometriaControl.yCero -
            geometriaControl.ySuperior
        )
        /
        geometriaControl.amplitudMaxima;

    let amplitud =
        (
            geometriaControl.yCero -
            y
        )
        /
        pixelesPorUnidad;

    amplitud = Math.max(
        -1,
        Math.min(1, amplitud)
    );

    return amplitud;
}


/* ============================================================
   VISIBILIDAD SEGÚN EL NÚMERO DE ARMÓNICOS
   ============================================================ */

function actualizarVisibilidadArmonicos() {

    /*
       Controles numéricos superiores:
       A1 ... A11
    */

    document
        .querySelectorAll(".control-amplitud")
        .forEach(control => {

            const n =
                Number(
                    control.dataset.armonico
                );

            control.style.display =
                n <= numeroArmonicos
                    ? ""
                    : "none";
        });


    /*
       Etiquetas inferiores de la primera gráfica:
       H1 ... H11
    */

    document
        .querySelectorAll(".etiqueta-armonico")
        .forEach(etiqueta => {

            const n =
                Number(
                    etiqueta.dataset.armonico
                );

            etiqueta.style.display =
                n <= numeroArmonicos
                    ? ""
                    : "none";
        });
}


/* ============================================================
   PRIMERA GRÁFICA
   BARRAS DE CONTROL DE AMPLITUD
   ============================================================ */

function dibujarControlesAmplitud() {

    barrasControlAmplitud.innerHTML = "";


    /*
       IMPORTANTE:

       Dibujamos únicamente el número de armónicos
       seleccionado por el usuario.
    */

    for (
        let i = 0;
        i < numeroArmonicos;
        i++
    ) {

        const x =
            xControlArmonico(i);

        const amplitud =
            amplitudes[i];

        const y =
            amplitudAYControl(amplitud);

        const grupo =
            document.createElementNS(
                SVG_NS,
                "g"
            );

        grupo.dataset.indice = i;


        const barra =
            document.createElementNS(
                SVG_NS,
                "rect"
            );

        barra.setAttribute(
            "x",
            x -
            geometriaControl.anchoBarra / 2
        );

        barra.setAttribute(
            "width",
            geometriaControl.anchoBarra
        );


        if (amplitud > 0) {

            barra.setAttribute(
                "y",
                y
            );

            barra.setAttribute(
                "height",
                geometriaControl.yCero - y
            );

        } else if (amplitud < 0) {

            barra.setAttribute(
                "y",
                geometriaControl.yCero
            );

            barra.setAttribute(
                "height",
                y - geometriaControl.yCero
            );

        } else {

            barra.setAttribute(
                "y",
                geometriaControl.yCero - 3
            );

            barra.setAttribute(
                "height",
                6
            );
        }


        barra.setAttribute(
            "fill",
            coloresArmonicos[i]
        );

        barra.setAttribute(
            "stroke",
            "#222222"
        );

        barra.setAttribute(
            "stroke-width",
            "1"
        );

        barra.setAttribute(
            "rx",
            "1"
        );

        barra.classList.add(
            "barra-control"
        );


        const zonaArrastre =
            document.createElementNS(
                SVG_NS,
                "rect"
            );

        zonaArrastre.setAttribute(
            "x",
            x - 24
        );

        zonaArrastre.setAttribute(
            "y",
            geometriaControl.ySuperior
        );

        zonaArrastre.setAttribute(
            "width",
            48
        );

        zonaArrastre.setAttribute(
            "height",
            geometriaControl.yInferior -
            geometriaControl.ySuperior
        );

        zonaArrastre.setAttribute(
            "fill",
            "transparent"
        );

        zonaArrastre.style.cursor =
            "ns-resize";


        grupo.appendChild(barra);

        grupo.appendChild(
            zonaArrastre
        );


        barra.addEventListener(
            "pointerdown",
            iniciarArrastreAmplitud
        );

        zonaArrastre.addEventListener(
            "pointerdown",
            iniciarArrastreAmplitud
        );


        barrasControlAmplitud.appendChild(
            grupo
        );
    }
}


/* ============================================================
   ARRASTRE DE LAS BARRAS
   ============================================================ */

let indiceArrastrado = null;


function iniciarArrastreAmplitud(evento) {

    evento.preventDefault();

    const grupo =
        evento.currentTarget.parentElement;

    indiceArrastrado =
        Number(
            grupo.dataset.indice
        );

    window.addEventListener(
        "pointermove",
        moverAmplitud
    );

    window.addEventListener(
        "pointerup",
        terminarArrastreAmplitud
    );

    moverAmplitud(evento);
}


function moverAmplitud(evento) {

    if (
        indiceArrastrado === null
    ) {
        return;
    }


    const punto =
        graficaAmplitudes.createSVGPoint();

    punto.x =
        evento.clientX;

    punto.y =
        evento.clientY;


    const matriz =
        graficaAmplitudes.getScreenCTM();

    if (!matriz) {
        return;
    }


    const puntoSVG =
        punto.matrixTransform(
            matriz.inverse()
        );


    let nuevaAmplitud =
        yControlAAmplitud(
            puntoSVG.y
        );


    nuevaAmplitud =
        Math.round(
            nuevaAmplitud * 100
        ) / 100;


    amplitudes[
        indiceArrastrado
    ] =
        nuevaAmplitud;


    camposAmplitud[
        indiceArrastrado
    ].value =
        nuevaAmplitud.toFixed(2);


    actualizarTodo();
}


function terminarArrastreAmplitud() {

    indiceArrastrado = null;


    window.removeEventListener(
        "pointermove",
        moverAmplitud
    );


    window.removeEventListener(
        "pointerup",
        terminarArrastreAmplitud
    );
}


/* ============================================================
   FUNCIÓN ARMÓNICA
   ============================================================ */

function evaluarComponente(
    amplitud,
    orden,
    tiempo
) {

    const omega =
        2 *
        Math.PI *
        frecuenciaFundamental;


    const angulo =
        orden *
        omega *
        tiempo;


    if (
        tipoFuncion === "coseno"
    ) {

        return (
            amplitud *
            Math.cos(angulo)
        );
    }


    return (
        amplitud *
        Math.sin(angulo)
    );
}


/* ============================================================
   CREAR PATH SVG
   ============================================================ */

function crearPath(
    datos,
    color,
    grosor
) {

    const path =
        document.createElementNS(
            SVG_NS,
            "path"
        );


    path.setAttribute(
        "d",
        datos
    );


    path.setAttribute(
        "fill",
        "none"
    );


    path.setAttribute(
        "stroke",
        color
    );


    path.setAttribute(
        "stroke-width",
        grosor
    );


    path.setAttribute(
        "vector-effect",
        "non-scaling-stroke"
    );


    return path;
}


/* ============================================================
   ESCALA DE TIEMPO
   ============================================================ */

function dibujarEscalaTiempo(
    grupoEtiquetas
) {

    if (!grupoEtiquetas) {
        return;
    }


    grupoEtiquetas.innerHTML = "";


    const mitadVentana =
        ventanaTiempoComponentes / 2;


    const valores = [

        -mitadVentana,

        -mitadVentana / 2,

        0,

        mitadVentana / 2,

        mitadVentana
    ];


    const posicionesX = [
        70,
        245,
        420,
        595,
        770
    ];


    for (
        let i = 0;
        i < valores.length;
        i++
    ) {

        const texto =
            document.createElementNS(
                SVG_NS,
                "text"
            );


        texto.setAttribute(
            "x",
            posicionesX[i]
        );


        texto.setAttribute(
            "y",
            242
        );


        texto.setAttribute(
            "text-anchor",
            i === 0
                ? "start"
                : i === valores.length - 1
                    ? "end"
                    : "middle"
        );


        texto.setAttribute(
            "class",
            "texto-eje"
        );


        let valor =
            valores[i];


        if (
            Math.abs(valor) <
            0.0001
        ) {

            valor = 0;
        }


        texto.textContent =
            valor === 0
                ? "0"
                : valor.toFixed(2);


        grupoEtiquetas.appendChild(
            texto
        );
    }
}


function dibujarEtiquetasTiempo() {

    dibujarEscalaTiempo(
        etiquetasTiempo
    );
}


function dibujarEtiquetasTiempoSuma() {

    dibujarEscalaTiempo(
        etiquetasTiempoSuma
    );
}


/* ============================================================
   ESCALA VERTICAL DE LA SUMA

   Marcas cada 0.5 unidades.
   ============================================================ */

function dibujarEtiquetasAmplitudSuma() {

    if (!etiquetasAmplitudSuma) {
        return;
    }


    etiquetasAmplitudSuma.innerHTML = "";


    const ySuperior = 25;

    const yInferior = 225;

    const yCentro =
        (
            ySuperior +
            yInferior
        ) / 2;

    const alturaMedia =
        (
            yInferior -
            ySuperior
        ) / 2;


    /*
       Ejemplos:

       ±1.0:
        1.0
        0.5
        0
       -0.5
       -1.0

       ±2.0:
        2.0
        1.5
        1.0
        0.5
        0
       -0.5
       -1.0
       -1.5
       -2.0
    */

    for (
        let valor = escalaYSuma;
        valor >=
        -escalaYSuma - 0.001;
        valor -= 0.5
    ) {

        const y =
            yCentro -
            (
                valor /
                escalaYSuma
            ) *
            alturaMedia;


        const texto =
            document.createElementNS(
                SVG_NS,
                "text"
            );


        texto.setAttribute(
            "x",
            62
        );


        texto.setAttribute(
            "y",
            y + 4
        );


        texto.setAttribute(
            "text-anchor",
            "end"
        );


        texto.setAttribute(
            "class",
            "texto-eje"
        );


        const valorNormalizado =
            Math.abs(valor) <
            0.001
                ? 0
                : valor;


        texto.textContent =
            valorNormalizado === 0
                ? "0"
                : valorNormalizado.toFixed(1);


        etiquetasAmplitudSuma.appendChild(
            texto
        );
    }
}


/* ============================================================
   SEGUNDA GRÁFICA
   ARMÓNICOS EN EL DOMINIO DEL TIEMPO
   ============================================================ */

function dibujarComponentesTiempo() {

    componentesTiempo.innerHTML = "";


    dibujarEtiquetasTiempo();


    const xInicio = 70;

    const xFin = 770;

    const yCentro = 125;

    const ancho =
        xFin - xInicio;

    const alturaDisponible = 100;

    const mitadVentana =
        ventanaTiempoComponentes / 2;

    const muestras = 1200;


    for (
        let n = 1;
        n <= numeroArmonicos;
        n++
    ) {

        const amplitud =
            amplitudes[n - 1];


        if (
            Math.abs(amplitud) <
            0.0001
        ) {

            continue;
        }


        let datos = "";


        for (
            let i = 0;
            i <= muestras;
            i++
        ) {

            const fraccion =
                i / muestras;


            const tiempoMs =
                -mitadVentana +
                fraccion *
                ventanaTiempoComponentes;


            const tiempo =
                tiempoMs / 1000;


            const valor =
                evaluarComponente(
                    amplitud,
                    n,
                    tiempo
                );


            const x =
                xInicio +
                fraccion *
                ancho;


            const y =
                yCentro -
                (
                    valor /
                    escalaYComponentes
                ) *
                alturaDisponible;


            if (
                i === 0
            ) {

                datos =
                    `M ${x} ${y}`;

            } else {

                datos +=
                    ` L ${x} ${y}`;
            }
        }


        const path =
            crearPath(
                datos,
                coloresArmonicos[n - 1],
                n === 1 ? 2 : 1.5
            );


        componentesTiempo.appendChild(
            path
        );
    }
}


/* ============================================================
   TERCERA GRÁFICA
   DOMINIO DE LA FRECUENCIA
   ============================================================ */

function dibujarDominioFrecuencia() {

    barrasArmonicos.innerHTML = "";


    const xInicio = 105;

    const separacionX = 65;

    const yBase = 185;

    const ySuperior = 45;

    const alturaMaxima =
        yBase - ySuperior;


    const referenciasY = [

        {
            valor: 1.0,
            y: ySuperior
        },

        {
            valor: 0.5,
            y:
                yBase -
                alturaMaxima * 0.5
        },

        {
            valor: 0.0,
            y: yBase
        }
    ];


    referenciasY.forEach(
        referencia => {

            const texto =
                document.createElementNS(
                    SVG_NS,
                    "text"
                );


            texto.setAttribute(
                "x",
                62
            );


            texto.setAttribute(
                "y",
                referencia.y + 4
            );


            texto.setAttribute(
                "text-anchor",
                "end"
            );


            texto.setAttribute(
                "font-size",
                "10"
            );


            texto.setAttribute(
                "fill",
                "#555555"
            );


            texto.textContent =
                referencia.valor.toFixed(1);


            barrasArmonicos.appendChild(
                texto
            );
        }
    );


    for (
        let i = 0;
        i < numeroArmonicos;
        i++
    ) {

        const amplitud =
            amplitudes[i];


        const magnitud =
            Math.abs(amplitud);


        const altura =
            magnitud *
            alturaMaxima;


        const x =
            xInicio +
            i *
            separacionX;


        if (
            magnitud > 0.0001
        ) {

            const linea =
                document.createElementNS(
                    SVG_NS,
                    "line"
                );


            linea.setAttribute(
                "x1",
                x
            );


            linea.setAttribute(
                "x2",
                x
            );


            linea.setAttribute(
                "y1",
                yBase
            );


            linea.setAttribute(
                "y2",
                yBase - altura
            );


            linea.setAttribute(
                "stroke",
                coloresArmonicos[i]
            );


            linea.setAttribute(
                "stroke-width",
                "4"
            );


            linea.setAttribute(
                "stroke-linecap",
                "butt"
            );


            linea.setAttribute(
                "vector-effect",
                "non-scaling-stroke"
            );


            barrasArmonicos.appendChild(
                linea
            );


            const marca =
                document.createElementNS(
                    SVG_NS,
                    "line"
                );


            marca.setAttribute(
                "x1",
                x - 5
            );


            marca.setAttribute(
                "x2",
                x + 5
            );


            marca.setAttribute(
                "y1",
                yBase - altura
            );


            marca.setAttribute(
                "y2",
                yBase - altura
            );


            marca.setAttribute(
                "stroke",
                coloresArmonicos[i]
            );


            marca.setAttribute(
                "stroke-width",
                "2"
            );


            marca.setAttribute(
                "vector-effect",
                "non-scaling-stroke"
            );


            barrasArmonicos.appendChild(
                marca
            );
        }


        const textoFrecuencia =
            document.createElementNS(
                SVG_NS,
                "text"
            );


        textoFrecuencia.setAttribute(
            "x",
            x
        );


        textoFrecuencia.setAttribute(
            "y",
            205
        );


        textoFrecuencia.setAttribute(
            "text-anchor",
            "middle"
        );


        textoFrecuencia.setAttribute(
            "font-size",
            "10"
        );


        textoFrecuencia.setAttribute(
            "fill",
            "#555555"
        );


        textoFrecuencia.textContent =
            (
                (i + 1) *
                frecuenciaFundamental
            );


        barrasArmonicos.appendChild(
            textoFrecuencia
        );
    }
}


/* ============================================================
   CUARTA GRÁFICA
   SUMA DE ARMÓNICOS
   ============================================================ */

function dibujarSuma() {

    dibujarEtiquetasAmplitudSuma();

    dibujarEtiquetasTiempoSuma();


    const xInicio = 70;

    const xFin = 770;

    const yCentro = 125;

    const ancho =
        xFin - xInicio;

    const alturaDisponible = 100;

    const mitadVentana =
        ventanaTiempoComponentes / 2;

    const muestras = 1200;


    let datos = "";


    for (
        let i = 0;
        i <= muestras;
        i++
    ) {

        const fraccion =
            i / muestras;


        const tiempoMs =
            -mitadVentana +
            fraccion *
            ventanaTiempoComponentes;


        const tiempo =
            tiempoMs / 1000;


        let suma = 0;


        for (
            let n = 1;
            n <= numeroArmonicos;
            n++
        ) {

            suma +=
                evaluarComponente(
                    amplitudes[n - 1],
                    n,
                    tiempo
                );
        }


        const x =
            xInicio +
            fraccion *
            ancho;


        const y =
            yCentro -
            (
                suma /
                escalaYSuma
            ) *
            alturaDisponible;


        if (
            i === 0
        ) {

            datos =
                `M ${x} ${y}`;

        } else {

            datos +=
                ` L ${x} ${y}`;
        }
    }


    ondaResultante.setAttribute(
        "d",
        datos
    );
}


/* ============================================================
   ACTUALIZACIÓN GENERAL
   ============================================================ */

function actualizarTodo() {

    actualizarVisibilidadArmonicos();

    dibujarControlesAmplitud();

    dibujarComponentesTiempo();

    dibujarDominioFrecuencia();

    dibujarSuma();
}


/* ============================================================
   MODIFICACIÓN DIRECTA A1 ... A11
   ============================================================ */

camposAmplitud.forEach(
    (campo, indice) => {

        campo.addEventListener(
            "input",
            () => {

                let valor =
                    parseFloat(
                        campo.value
                    );


                if (
                    Number.isNaN(valor)
                ) {

                    return;
                }


                valor =
                    Math.max(
                        -1,
                        Math.min(
                            1,
                            valor
                        )
                    );


                amplitudes[indice] =
                    valor;


                actualizarTodo();
            }
        );


        campo.addEventListener(
            "change",
            () => {

                campo.value =
                    amplitudes[indice]
                        .toFixed(2);
            }
        );
    }
);


/* ============================================================
   FRECUENCIA FUNDAMENTAL
   ============================================================ */

selectorFrecuencia.addEventListener(
    "change",
    () => {

        frecuenciaFundamental =
            Number(
                selectorFrecuencia.value
            );


        ventanaTiempoComponentes =
            periodoFundamentalMs();


        actualizarTodo();
    }
);


/* ============================================================
   NÚMERO DE ARMÓNICOS
   ============================================================ */

sliderArmonicos.addEventListener(
    "input",
    () => {

        numeroArmonicos =
            Number(
                sliderArmonicos.value
            );


        valorArmonicos.textContent =
            numeroArmonicos;


        actualizarTodo();
    }
);


/* ============================================================
   SENOS / COSENOS
   ============================================================ */

radiosFuncion.forEach(
    radio => {

        radio.addEventListener(
            "change",
            () => {

                if (
                    radio.checked
                ) {

                    tipoFuncion =
                        radio.value;


                    actualizarTodo();
                }
            }
        );
    }
);


/* ============================================================
   ESCALA HORIZONTAL COMÚN
   ============================================================ */

document
    .getElementById("tiempoXMas")
    .addEventListener(
        "click",
        () => {

            const incremento90 =
                periodoFundamentalMs() / 4;


            ventanaTiempoComponentes =
                Math.max(
                    incremento90,
                    ventanaTiempoComponentes -
                    incremento90
                );


            dibujarComponentesTiempo();

            dibujarSuma();
        }
    );


document
    .getElementById("tiempoXMenos")
    .addEventListener(
        "click",
        () => {

            const incremento90 =
                periodoFundamentalMs() / 4;


            ventanaTiempoComponentes =
                Math.min(
                    periodoFundamentalMs() * 8,
                    ventanaTiempoComponentes +
                    incremento90
                );


            dibujarComponentesTiempo();

            dibujarSuma();
        }
    );


/* ============================================================
   ESCALA VERTICAL
   SUMA DE ARMÓNICOS

   Incrementos de 0.5
   ============================================================ */

document
    .getElementById("sumaYMas")
    .addEventListener(
        "click",
        () => {

            escalaYSuma +=
                incrementoEscalaYSuma;


            dibujarSuma();
        }
    );


document
    .getElementById("sumaYMenos")
    .addEventListener(
        "click",
        () => {

            escalaYSuma =
                Math.max(
                    0.5,
                    escalaYSuma -
                    incrementoEscalaYSuma
                );


            dibujarSuma();
        }
    );


/* ============================================================
   REPRESENTACIÓN
   ============================================================ */

selectorRepresentacion.addEventListener(
    "change",
    () => {

        const paneles =
            document.querySelectorAll(
                ".panel-grafica"
            );


        /*
           La primera gráfica de amplitudes
           permanece siempre visible.
        */

        paneles[0].style.display =
            "";


        if (
            selectorRepresentacion.value ===
            "ambos"
        ) {

            paneles[1].style.display =
                "";

            paneles[2].style.display =
                "";

            paneles[3].style.display =
                "";

        } else if (
            selectorRepresentacion.value ===
            "tiempo"
        ) {

            paneles[1].style.display =
                "";

            paneles[2].style.display =
                "none";

            paneles[3].style.display =
                "";

        } else if (
            selectorRepresentacion.value ===
            "frecuencia"
        ) {

            paneles[1].style.display =
                "none";

            paneles[2].style.display =
                "";

            paneles[3].style.display =
                "none";
        }
    }
);


/* ============================================================
   REINICIAR
   ============================================================ */

botonReiniciar.addEventListener(
    "click",
    () => {

        amplitudes = [
            1,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        ];


        frecuenciaFundamental = 60;

        numeroArmonicos = 11;

        tipoFuncion = "seno";


        ventanaTiempoComponentes =
            periodoFundamentalMs();


        /*
           Escala inicial de la suma:
           ±1.0
        */

        escalaYSuma = 1.0;


        selectorFrecuencia.value =
            "60";


        sliderArmonicos.value =
            "11";


        valorArmonicos.textContent =
            "11";


        selectorRepresentacion.value =
            "ambos";


        radiosFuncion.forEach(
            radio => {

                radio.checked =
                    radio.value ===
                    "seno";
            }
        );


        camposAmplitud.forEach(
            (campo, indice) => {

                campo.value =
                    amplitudes[indice]
                        .toFixed(2);
            }
        );


        document
            .querySelectorAll(
                ".panel-grafica"
            )
            .forEach(
                panel => {

                    panel.style.display =
                        "";
                }
            );


        actualizarTodo();
    }
);


/* ============================================================
   INICIALIZACIÓN
   ============================================================ */

camposAmplitud.forEach(
    (campo, indice) => {

        campo.value =
            amplitudes[indice]
                .toFixed(2);
    }
);


ventanaTiempoComponentes =
    periodoFundamentalMs();


actualizarTodo();