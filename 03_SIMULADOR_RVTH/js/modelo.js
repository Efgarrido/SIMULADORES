/* =====================================================
   SIMULADOR RVTH
   MODELO DINÁMICO

   Archivo: modelo.js

   Este archivo contiene exclusivamente:
   - Condición nominal
   - Variables de estado
   - Parámetros dinámicos
   - Modelo físico de la unidad
===================================================== */


/* =====================================================
   CONDICIÓN NOMINAL
===================================================== */

const F_NOMINAL = 60;

const POTENCIA_BASE = 0.80;

const APERTURA_BASE = 75;

const GANANCIA_POTENCIA_APERTURA = 0.01;


/* =====================================================
   ESTADO DEL SISTEMA
===================================================== */

let frecuencia =
F_NOMINAL;

let cargaElectrica =
POTENCIA_BASE;

let potenciaMecanica =
POTENCIA_BASE;

let apertura =
APERTURA_BASE;

let integralError =
0;


/* =====================================================
   ESTADO DE LA SIMULACIÓN
===================================================== */

let simulando =
false;

let pausado =
false;

let ultimoTiempo =
null;


/* =====================================================
   VARIABLES COMPARTIDAS CON EL REGULADOR
===================================================== */

/*
   Estas variables pertenecen físicamente al regulador,
   pero forman parte del estado que utiliza el modelo
   dinámico.

   Más adelante regulador.js actualizará sus valores.
*/

let posicionCNeutra =
null;

let desplazamientoCarreteActual =
0;


/* =====================================================
   PARÁMETROS DINÁMICOS

   Valores conservados exactamente de la versión 9B6.
===================================================== */

const GANANCIA_WATT = 75;

const GANANCIA_RESTAURACION = 3;

const VELOCIDAD_SERVO = .30;

const CONSTANTE_TURBINA = .48;

const INERCIA = .78;

const AMORTIGUAMIENTO = .80;

const UMBRAL_VALVULA = .5;

const LIMITE_INTEGRAL = 5;


/* =====================================================
   MODELO DINÁMICO
===================================================== */

function ejecutarModelo(dt){

    /*
       Si todavía no se ha aplicado una perturbación,
       el modelo permanece en su condición inicial.
    */

    if(
        !simulando
    ){
        return;
    }


    /* =================================================
       ERROR DE FRECUENCIA
    ================================================= */

    const errorFrecuencia =
    F_NOMINAL
    -
    frecuencia;


    /* =================================================
       ACCIÓN INTEGRAL DEL REGULADOR
    ================================================= */

    integralError +=
    errorFrecuencia
    *
    dt;


    integralError =
    Math.max(
        -LIMITE_INTEGRAL,
        Math.min(
            LIMITE_INTEGRAL,
            integralError
        )
    );


    /* =================================================
       ACCIÓN DE LA VÁLVULA PILOTO
    ================================================= */

    let accionCarrete =
    0;


    /*
       Existe una pequeña zona muerta alrededor
       de la posición neutra de la válvula.
    */

    if(
        Math.abs(
            desplazamientoCarreteActual
        )
        >
        UMBRAL_VALVULA
    ){

        accionCarrete =
        desplazamientoCarreteActual
        -
        Math.sign(
            desplazamientoCarreteActual
        )
        *
        UMBRAL_VALVULA;

    }


    /* =================================================
       MOVIMIENTO DEL SERVOMOTOR / DISTRIBUIDOR
    ================================================= */

    apertura +=
    (-accionCarrete)
    *
    VELOCIDAD_SERVO
    *
    dt;


    /*
       Límite físico de apertura del distribuidor.
       Se conserva exactamente el rango 0–100 %
       utilizado en 9B6.
    */

    apertura =
    Math.max(
        0,
        Math.min(
            100,
            apertura
        )
    );


    /* =================================================
       POTENCIA MECÁNICA DE LA TURBINA
    ================================================= */

    let pmObjetivo =
    POTENCIA_BASE
    +
    GANANCIA_POTENCIA_APERTURA
    *
    (
        apertura
        -
        APERTURA_BASE
    );


    pmObjetivo =
    Math.max(
        0,
        Math.min(
            1.10,
            pmObjetivo
        )
    );


    /*
       Respuesta de primer orden de la turbina.
    */

    potenciaMecanica +=
    (
        pmObjetivo
        -
        potenciaMecanica
    )
    *
    CONSTANTE_TURBINA
    *
    dt;


    /* =================================================
       BALANCE DE POTENCIA
    ================================================= */

    const desequilibrio =
    potenciaMecanica
    -
    cargaElectrica;


    /* =================================================
       DINÁMICA DE FRECUENCIA

       Representación simplificada de:

                 J · dω/dt = Tm - Te

       incorporando el amortiguamiento del sistema.
    ================================================= */

    frecuencia +=
    (
        desequilibrio
        /
        INERCIA

        -

        AMORTIGUAMIENTO
        *
        (
            frecuencia
            -
            F_NOMINAL
        )
    )
    *
    dt;


    /* =================================================
       LÍMITES NUMÉRICOS DE FRECUENCIA
    ================================================= */

    frecuencia =
    Math.max(
        58.5,
        Math.min(
            61.5,
            frecuencia
        )
    );


    /* =================================================
       REGISTRO PARA GRÁFICAS

       Esta función estará definida posteriormente
       en simulador.js.

       La comprobación evita errores mientras hacemos
       la migración archivo por archivo.
    ================================================= */

    if(
        typeof registrarGraficas
        ===
        "function"
    ){

        registrarGraficas(
            dt
        );

    }

}