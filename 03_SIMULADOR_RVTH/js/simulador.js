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
   - Gráfica completa de velocidad desde t = 0
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

const velocidadTxt =
document.getElementById("velocidad");


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

/* Gráfica de frecuencia — historial completo */

const graficaFrecuencia =
document.getElementById("graficaFrecuencia");

const ctxFrecuencia =
graficaFrecuencia.getContext("2d");


/* Gráfica de velocidad — respuesta completa */

const graficaVelocidad =
document.getElementById("graficaVelocidad");

const ctxVelocidad =
graficaVelocidad.getContext("2d");


/* Gráfica de apertura geométrica del distribuidor */

const graficaApertura =
document.getElementById("graficaApertura");

const ctxApertura =
graficaApertura.getContext("2d");


/* =====================================================
   HISTORIALES
===================================================== */

/* Historial compartido: conserva cada muestra desde t = 0. */
let historialGrafica = [];


let tiempoSimulacion = 0;


/* =====================================================
   ADQUISICIÓN DE GRÁFICAS (etapa 3)

   - No se registra nada antes de APLICAR.
   - APLICAR inicia una adquisición nueva en t = 0.
   - PAUSA detiene modelo y adquisición.
   - REINICIAR limpia y deja esperando otro APLICAR.
   - Muestreo cada PERIODO_MUESTREO de tiempo
     simulado, independiente del paso de integración
     y de la frecuencia de pantalla.
   - Las tres gráficas conservan todas las muestras desde t = 0.
===================================================== */

const PERIODO_MUESTREO = 0.05;      // s

let adquiriendo = false;

let proximaMuestra = 0;


function minimoMaximo(valores){

    let minimo = Infinity;
    let maximo = -Infinity;

    for(let i = 0; i < valores.length; i++){
        const v = valores[i];
        if(v < minimo){ minimo = v; }
        if(v > maximo){ maximo = v; }
    }

    return { minimo, maximo };

}


/* =====================================================
   LIMPIAR GRÁFICAS
===================================================== */

function limpiarGraficas(){

    historialGrafica = [];

    tiempoSimulacion = 0;

    proximaMuestra = 0;


    dibujarGraficas();

}


/* =====================================================
   REGISTRAR DATOS
===================================================== */

function registrarGraficas(dt){

    /* Llamada tras cada paso de integración.
       Solo registra durante una adquisición. */

    if(
        !adquiriendo
    ){
        return;
    }


    tiempoSimulacion +=
    dt;


    if(
        tiempoSimulacion + 1e-9
        <
        proximaMuestra
    ){
        return;
    }

    proximaMuestra +=
    PERIODO_MUESTREO;

    tomarMuestra();

}


function tomarMuestra(){

    actualizarServomotor();

    const punto = {

        tiempo:
        tiempoSimulacion,

        frecuencia:
        frecuencia,

        velocidad: velocidadEjeRpm(),

        apertura: ultimoEstadoDistribuidor
            ? ultimoEstadoDistribuidor.intensidadAgua * 100 : 0

    };


    historialGrafica.push(punto);

}


function limiteTiempoGraficas(){
    return Math.max(10, Math.ceil((tiempoSimulacion - 1e-9) / 10) * 10);
}


/* =====================================================
   DIBUJAR UNA GRÁFICA DESDE t = 0
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


    const extremos =
    minimoMaximo(
        valores
    );

    let minimo =
    extremos.minimo;


    let maximo =
    extremos.maximo;


    if (variable === "frecuencia") {
        const margen = Math.max((maximo - minimo) * 0.1, 0.1);
        minimo -= margen;
        maximo += margen;
    } else {
        minimo = 0;
        maximo = variable === "velocidad" ? 400 : 100;
    }


    const tiempoInicio = 0;
    const tiempoFinal = limiteTiempoGraficas();


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


    // Tres etiquetas como máximo, con espacio reservado incluso en tiempos largos.
    const divisiones = String(tiempoFinal).length > 10 ? 1 : 2;
    for (let i = 0; i <= divisiones; i++) {
        ctx.textAlign = i === 0 ? "left" : i === divisiones ? "right" : "center";
        ctx.fillText(
            String(tiempoFinal * i / divisiones),
            margenIzq + ancho * i / divisiones,
            margenSup + alto + 3,
            ancho / divisiones - 8
        );
    }
    ctx.textAlign = "center";


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
   DIBUJAR LAS TRES GRÁFICAS
===================================================== */

function dibujarGraficas(){

    /* Frecuencia — historial completo */

    dibujarGrafica(
        graficaFrecuencia,
        ctxFrecuencia,
        "frecuencia",
        F_NOMINAL,
        "Frecuencia [Hz]"
    );


    /* Velocidad — desde t = 0 */

    dibujarGrafica(
        graficaVelocidad,
        ctxVelocidad,
        "velocidad",
        360,
        "Velocidad [rpm]"
    );


    /* Apertura — historial completo */

    dibujarGrafica(
        graficaApertura,
        ctxApertura,
        "apertura",
        0,
        "Apertura [%]"
    );

}


/* =====================================================
   CONTROL — SELECTOR DE CARGA
===================================================== */

sliderCarga.addEventListener(
"input",
function(){

    /* Etapa 13: bloqueado hasta APLICAR */

    if(
        !simulando
    ){
        sliderCarga.value = 0;
        valorCarga.innerText = "0";
        return;
    }

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

/* Etapa 27 (20-oct-2026): ΔPe queda SIN EFECTO. Con la unidad
   conectada a una red infinita, Pe no es una demanda que se
   imponga: resulta del acoplamiento con la red y del balance
   mecánico, y el operador la ajusta con + / − (M1, ajuste del
   resorte). Con el interruptor abierto Pe = 0. Se deshabilita
   para que no existan dos órdenes de potencia contradictorias
   (reservado para una futura operación en isla). */

sliderCarga.disabled = true;
sliderCarga.title =
"Sin efecto en conexión a red: la potencia la ajustan + / − (M1)";


/* =====================================================
   GOBERNADOR DE CARGA (etapa 12, 18-oct-2026)

   Se ELIMINA el mando provisional que imponía la
   posición s del manguito (botones − / +, referencia y
   reposo forzado en MANGUITO_REPOSO). Ahora s sale de
   la ecuación dinámica del regulador con resorte, con
   la velocidad real del eje. Los botones LENTO / RÁPIDO
   (motor del tornillo de ajuste de la precarga) y los
   indicadores del panel están en
   js/watt_resorte_integracion.js.
===================================================== */


/* =====================================================
   INTERRUPTOR DEL GENERADOR (52G)
   Etapa 27 (20-oct-2026): se ELIMINA el permiso de cierre
   por banda de velocidad (358–362 rpm) y la conexión con
   una demanda fija (POTENCIA_BASE + ΔPe). El 52G solo lo
   cierra el sincronizador 25A con la verificación 25
   (js/sincronizacion.js: cerrarContactos52G al tocar los
   contactos). El botón del RVTH:
     - cerrado → ABRE (siempre permitido; decisión del
       operador, bloquea un nuevo cierre automático hasta
       rearmar el 25A);
     - abierto → NO cierra: muestra el motivo (aviso
       transitorio). Ningún botón salta las comprobaciones.
   Con el interruptor cerrado, Pe resulta del acoplamiento
   con la red (modelo.js / sincronizacion.js).
===================================================== */

const botonInterruptor = document.getElementById("interruptorGenerador");
const estadoInterruptorTxt = document.getElementById("estadoInterruptor");
const avisoInterruptorTxt = document.getElementById("avisoInterruptor");

let mostrarRechazoInterruptor = false;

/* Etapa 11: sin leyendas permanentes bajo el botón.
   El rechazo de cierre se muestra en un aviso
   TRANSITORIO (AVISO_RECHAZO_MS) y luego desaparece. */
const AVISO_RECHAZO_MS = 3000;
let textoRechazoInterruptor = "";
let temporizadorAvisoInterruptor = null;

/* Datos para lectura y pruebas (no se dibujan). */
function estadoDatosInterruptor(){
    return {
        rpm: velocidadEjeRpm(),
        cerrado: interruptorCerrado,
        faseSincronizacion: estadoSinc.fase,
        potenciaElectrica: cargaElectrica
    };
}

function actualizarInterruptor(){
    estadoInterruptorTxt.textContent = interruptorCerrado
        ? "52G CERRADO" : "52G ABIERTO";
    botonInterruptor.setAttribute("aria-pressed", String(interruptorCerrado));
    botonInterruptor.className = "boton-simulador " + (interruptorCerrado ? "success" : "danger");
    botonInterruptor.setAttribute("aria-label", interruptorCerrado
        ? "Interruptor cerrado. Pulsar para abrir"
        : "Interruptor abierto. El cierre lo realiza el sincronizador 25A");
    botonInterruptor.title = interruptorCerrado
        ? "Abrir interruptor del generador (52G)"
        : "Cierre solo por el sincronizador 25A (verificación 25)";
    // Dos representaciones del mismo interruptor: un único estado y mando.
    const boton52G = document.getElementById("sincInterruptor52G");
    if(boton52G){
        boton52G.textContent = estadoInterruptorTxt.textContent;
        boton52G.className = botonInterruptor.className;
        boton52G.setAttribute("aria-pressed", String(interruptorCerrado));
        boton52G.setAttribute("aria-label", botonInterruptor.getAttribute("aria-label"));
        boton52G.title = botonInterruptor.title;
        boton52G.disabled = botonInterruptor.disabled;
    }
    const rechazado = !interruptorCerrado && mostrarRechazoInterruptor;
    avisoInterruptorTxt.classList.toggle("rechazado", rechazado);
    avisoInterruptorTxt.textContent = rechazado ? textoRechazoInterruptor : "";
}

function avisarRechazoInterruptor(texto){
    mostrarRechazoInterruptor = true;
    textoRechazoInterruptor = texto;
    if(temporizadorAvisoInterruptor !== null){
        clearTimeout(temporizadorAvisoInterruptor);
    }
    temporizadorAvisoInterruptor = setTimeout(function(){
        mostrarRechazoInterruptor = false;
        temporizadorAvisoInterruptor = null;
        actualizarInterruptor();
    }, AVISO_RECHAZO_MS);
    actualizarInterruptor();
}

/* Orden del operador (botón del RVTH o ensayo de rechazo) */
function cambiarInterruptor(cerrar){
    /* Etapa 13: el interruptor no opera hasta APLICAR */
    if(!simulando){
        actualizarInterruptor();
        return false;
    }
    if(cerrar){
        if(!interruptorCerrado){
            avisarRechazoInterruptor(motivoRechazoCierreOperador());
        }
        return false;
    }
    if(!interruptorCerrado){
        actualizarInterruptor();
        return false;
    }
    interruptorCerrado = false;
    cargaElectrica = 0;
    mostrarRechazoInterruptor = false;
    aperturaInterruptorOperador();
    actualizarInterruptor();
    return true;
}

/* Cierre de contactos ordenado por el 25A (única vía) */
function cerrarContactos52G(){
    interruptorCerrado = true;
    mostrarRechazoInterruptor = false;
    actualizarInterruptor();
}

botonInterruptor.addEventListener("click", function(){
    cambiarInterruptor(!interruptorCerrado);
    actualizarVisual();
});


/* =====================================================
   ENSAYO DE RECHAZO (copia experimental)
===================================================== */

const ENSAYO_RECHAZO = (function(){

    try{
        return (
            new URLSearchParams(
                window.location.search
            ).get("ensayo")
            ===
            "rechazo"
        );
    }catch(e){
        return false;
    }

})();


/* =====================================================
   BOTÓN APLICAR
===================================================== */

document
.getElementById("aplicar")
.addEventListener(
"click",
function(){

    /*
       Copia experimental: con ?ensayo=rechazo en la
       dirección, APLICAR abre el interruptor del
       generador (rechazo total de carga).
    */

    if(
        ENSAYO_RECHAZO
    ){

        cambiarInterruptor(false);

    }

    /* Etapa 27: APLICAR ya no aplica ΔPe (con red infinita
       Pe resulta del acoplamiento; la carga se ajusta con
       + / − mediante M1). */


    simulando =
    true;


    pausado =
    false;


    ultimoTiempo =
    null;


    /* Etapa 13: se habilitan los mandos y comienza el
       avance conjunto desde las condiciones actuales
       (las iniciales, si se viene de reposo) */

    acumuladorIntegracion =
    0;

    fijarBloqueoOperacion(
        false
    );


    /* Adquisición nueva desde t = 0 */

    limpiarGraficas();

    adquiriendo =
    true;

    tomarMuestra();

    proximaMuestra =
    PERIODO_MUESTREO;

    dibujarGraficas();

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

    /* Etapa 13: PAUSA bloqueada hasta APLICAR */

    if(
        !simulando
    ){
        return;
    }

    pausado =
    !pausado;

    /* Etapa 12: la pausa detiene también el motor del
       ajuste del resorte (el regulador y la hidráulica
       se detienen porque no se integra el paso). */

    detenerMotorAjuste();

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

    /* Etapa 10: REINICIAR deja el conjunto en REPOSO,
       listo para arrancar en vacío (modelo.js:
       establecerEstadoReposo); potencia eléctrica 0
       (interruptor abierto). */

    establecerEstadoReposo();

    /* Etapa 27: red, excitación, sincronizador, órdenes
       pendientes, temporizadores y registro */
    reiniciarSincronizacion();
    mostrarRechazoInterruptor = false;


    /* Etapa 13: REINICIAR detiene la simulación y la
       deja bloqueada hasta otro APLICAR (no arranca
       sola) */

    simulando =
    false;


    pausado =
    false;


    ultimoTiempo =
    null;


    /* Etapa 12: regulador en su reposo físico (s = 0,
       tope inferior), ajuste en su posición inicial y
       motor parado. No se fuerza s = 63.02 mm. */

    reiniciarGobernador();

    /* Etapa 13: ángulos de las animaciones de giro (solo
       visuales) también a su estado inicial */

    anguloRotor9A = 0;
    animadorWatt.estado.fase = 0;
    actualizarRotorFrancis(0);

    fijarBloqueoOperacion(
        true
    );

    actualizarInterruptor();


    /* Gráficas limpias, esperando APLICAR */

    adquiriendo =
    false;

    acumuladorIntegracion =
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
        graficaVelocidad,
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
        "ACELERA";

    }

    else if(
        diferencia
        <
        -.01
    ){

        balanceSigno.innerText =
        "<";


        balanceEstado.innerText =
        "DESACELERA";

    }

    else{

        balanceSigno.innerText =
        "=";


        balanceEstado.innerText =
        "EQUILIBRIO";

    }


    /* =================================================
       ESTADO DE LA DISTRIBUIDORA Y DEL SERVOMOTOR
       (etapa 3: según el estado hidráulico calculado
       en modelo.js, no según el signo de la velocidad)
    ================================================= */

    const MPa = p => (p / 1e6).toFixed(2);

    const Lmin = q => (q * 60000).toFixed(1);

    const mm = x => (Math.abs(x) * 1000).toFixed(2);


    const presiones =
    "C1 " + MPa(presionC1) + " · C2 " + MPa(presionC2) + " MPa";


    if(
        !simulando
    ){

        accionTexto.textContent =
        "UNIDAD PARADA";

        accionSubtexto.textContent =
        "Simulación detenida · pulse APLICAR para iniciar";

        accionPresiones.textContent =
        "pistón " + posicionPiston.toFixed(1) + " % · " + presiones;

        return;

    }


    if(
        pausado
    ){

        accionTexto.textContent =
        "SIMULACIÓN EN PAUSA";

        accionSubtexto.textContent =
        "Modelo y adquisición detenidos";

        accionPresiones.textContent =
        "pistón " + posicionPiston.toFixed(1) + " % · " + presiones;

        return;

    }


    switch(modoDistribuidora){

        case "apertura":

            luzAccion.classList.add("luzActiva");

            accionTexto.textContent =
            "DISTRIBUIDORA: APERTURA";

            accionSubtexto.textContent =
            "S→C1 · C2→R2 · " + Lmin(caudalSuministro) + " L/min";

            accionPresiones.textContent =
            "b " + mm(carreteDistribuidor) + " mm · " + presiones;

            return;


        case "cierre":

            luzAccion.classList.add("luzActiva");

            accionTexto.textContent =
            "DISTRIBUIDORA: CIERRE";

            accionSubtexto.textContent =
            "S→C2 · C1→R1 · " + Lmin(caudalSuministro) + " L/min";

            accionPresiones.textContent =
            "b " + mm(carreteDistribuidor) + " mm · " + presiones;

            return;


        case "tope-apertura":

            accionTexto.textContent =
            "TOPE DE APERTURA 100 %";

            accionSubtexto.textContent =
            "Carrete abierto, sin circulación";

            accionPresiones.textContent =
            "C1 a p_s, C2 a retorno · " + presiones;

            return;


        case "tope-cierre":

            accionTexto.textContent =
            "TOPE DE CIERRE 0 %";

            accionSubtexto.textContent =
            "Carrete abierto, sin circulación";

            accionPresiones.textContent =
            "C2 a p_s, C1 a retorno · " + presiones;

            return;


        default:

            accionTexto.textContent =
            "DISTRIBUIDORA EN NEUTRO";

            accionSubtexto.textContent =
            "C1 y C2 bloqueadas · sin circulación";

            accionPresiones.textContent =
            "pistón " + posicionPiston.toFixed(1) + " % · " + presiones;

    }

}


/* =====================================================
   ACTUALIZACIÓN VISUAL
===================================================== */

function actualizarVisual(){

    actualizarInterruptor();

    velocidadTxt.innerText =
    velocidadEjeRpm().toFixed(1);


    frecuenciaTxt.innerText =
    frecuencia.toFixed(2);




    /* Etapa 22 (19-oct-2026): convención de presentación.
       Con el interruptor abierto se indica 0.0 %; cerrado,
       la potencia mecánica calculada. El cálculo interno de
       potenciaMecanica, la aceleración, las pérdidas y el
       balance físico no cambian. */

    pmBalance.innerText = interruptorCerrado
        ? (potenciaMecanica * 100).toFixed(1)
        : "0.0";


    peBalance.innerText =
    (
        cargaElectrica
        *
        100
    ).toFixed(1);


    /*
       servomotor.js actualiza también el distribuidor
       Fink (actualizarDistribuidor) y el circuito de
       aceite.
    */

    actualizarServomotor();

    // Apertura geométrica del distribuidor Fink (%).
    if (ultimoEstadoDistribuidor) {
        aperturaTxt.innerText =
            (ultimoEstadoDistribuidor.intensidadAgua * 100).toFixed(1);
    }


    actualizarTexto();


    dibujarGraficas();

    /* Etapa 27: ventana del sincronoscopio (solo lectura) */
    mostrarSincronizacion();

}


/* =====================================================
   LOOP PRINCIPAL
===================================================== */

const PASO_INTEGRACION = 0.005;     // s (paso fijo)

let acumuladorIntegracion = 0;


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


    /*
       Tiempo simulado = tiempo real, con PASO FIJO de
       integración (etapa 3). El tiempo real de cada
       cuadro se acumula y se integra en pasos de
       PASO_INTEGRACION; el resto pasa al cuadro
       siguiente. Tope de 0.25 s por cuadro para no
       saltar al volver de otra pestaña. Las gráficas
       se muestrean aparte (registrarGraficas), así que
       la duración representada no depende de la
       frecuencia de pantalla ni del paso.
    */

    dt =
    Math.max(
        0,
        Math.min(
            dt,
            .25
        )
    );


    /* =================================================
       MODELO DINÁMICO Y ADQUISICIÓN
    ================================================= */

    if(
        simulando
        &&
        !pausado
    ){

        acumuladorIntegracion +=
        dt;

        while(
            acumuladorIntegracion
            >=
            PASO_INTEGRACION
        ){

            /* Etapa 12: regulador con resorte en el MISMO
               paso fijo (subpasos internos de 1 ms), con
               la velocidad actual del eje; después la
               hidráulica y la turbina. */

            avanzarGobernador(
                PASO_INTEGRACION
            );

            ejecutarModelo(
                PASO_INTEGRACION
            );

            /* Etapa 27: excitación, 25A, cierre y toma inicial */
            avanzarSincronizacion(
                PASO_INTEGRACION
            );

            registrarGraficas(
                PASO_INTEGRACION
            );

            acumuladorIntegracion -=
            PASO_INTEGRACION;

        }

    }


    /* =================================================
       RODETE FRANCIS
    ================================================= */

    if(
        simulando
        &&
        !pausado
    ){

        actualizarRotorFrancis(
            dt
        );

    }


    /* =================================================
       REGULADOR DE WATT: giro visual (un solo bucle)
       y dibujo del varillaje A–B–C
    ================================================= */

    actualizarRegulador(
        dt,
        simulando && !pausado
    );


    /* =================================================
       INTERFAZ Y MECANISMOS
    ================================================= */

    actualizarVisual();

    mostrarGobernador();


    requestAnimationFrame(
        animar
    );

}


/* =====================================================
   INICIO
===================================================== */

/* =====================================================
   ETAPA 13 (18-oct-2026): REPOSO INICIAL Y BLOQUEO
   HASTA APLICAR

   La bandera `simulando` (modelo.js) es el bloqueo:
     false → no se integra la física (gobernador,
             hidráulica, turbina), no avanzan las
             animaciones de giro y los mandos de operación
             no actúan (SUBIR, BAJAR, interruptor,
             perturbación de carga y PAUSA). Solo
             APLICAR y REINICIAR están disponibles.
     true  → funcionamiento normal (lo activa APLICAR).
   El bloqueo está en las funciones de operación
   (cambiarInterruptor, PAUSA, deslizador de carga,
   motor del ajuste y avance del gobernador), no solo
   en el aspecto de los botones.
===================================================== */

function fijarBloqueoOperacion(bloquear){

    [
        "gobernadorLento",
        "gobernadorRapido",
        "interruptorGenerador",
        "sincInterruptor52G",
        "pausa"
    ].forEach(function(id){
        const el = document.getElementById(id);
        if(el){ el.disabled = bloquear; }
    });

    if(bloquear){
        detenerMotorAjuste();
    }

    document.body.classList.toggle(
        "operacion-bloqueada",
        bloquear
    );

}


/* Estado inicial: reposo completo y bloqueado */

simulando =
false;

pausado =
false;

fijarBloqueoOperacion(
    true
);

limpiarGraficas();

actualizarBotonesOperacion();

actualizarInterruptor();

actualizarVisual();

ajustarTamanoGraficas();

requestAnimationFrame(
    animar
);
