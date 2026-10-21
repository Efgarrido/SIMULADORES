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


/* =====================================================
   MODELO HIDRÁULICO F1b
   APERTURA → CAUDAL → POTENCIA MECÁNICA

   Hipótesis: salto constante (h = 1 p.u.), régimen
   próximo a la velocidad nominal, caudal proporcional
   al área de paso entre directrices.

   1. Caudal relativo (0 = cierre, 1 = apertura máxima):

        q(ap) = (a0(ap) − a0,cierre) / (a0,máx − a0,cierre)

      a0 = abertura geométrica entre directrices del
      distribuidor Fink V8 (estadoDesdeGiro), obtenida a
      través del acoplamiento servomotor–anillo de la
      etapa 2A. a0,cierre = 1.0056 u; a0,máx = 53.9667 u.
      Tabla cada 0.5 % de apertura (0 … 100 %),
      interpolación lineal.

   2. Potencia mecánica objetivo (modelo de turbina
      tipo IEEE con caudal de vacío):

        Pm,obj = h · At · (q − q_vacío)
        At     = 1 / (q_nominal − q_vacío)
        q_vacío   = 0.10
        q_nominal = q(82.5 %)   →  Pm,obj = 1.00

      El rendimiento queda implícito:
        η/η_nominal = [(q − q_vacío)/q] · [q_nominal/(q_nominal − q_vacío)]

   3. Se conservan el límite 0 ≤ Pm,obj ≤ 1.10 y la
      respuesta de primer orden (CONSTANTE_TURBINA).

   4. La apertura inicial se calcula con este modelo
      para Pm = POTENCIA_BASE (≈ 60.07 %).
===================================================== */

const F1B_PASO_TABLA = 0.5;

const F1B_CAUDAL_RELATIVO = [
    -0.000002, 0.008033, 0.016028, 0.024001, 0.031934, 0.039888, 0.047800, 0.055669, 0.063495, 0.071286,
    0.079116, 0.086902, 0.094645, 0.102344, 0.110008, 0.117675, 0.125299, 0.132913, 0.140484, 0.148010,
    0.155491, 0.162935, 0.170418, 0.177858, 0.185254, 0.192604, 0.199912, 0.207247, 0.214540, 0.221800,
    0.229018, 0.236190, 0.243316, 0.250397, 0.257509, 0.264595, 0.271634, 0.278627, 0.285574, 0.292529,
    0.299472, 0.306374, 0.313246, 0.320071, 0.326850, 0.333581, 0.340266, 0.346979, 0.353684, 0.360343,
    0.366954, 0.373518, 0.380037, 0.386562, 0.393046, 0.399503, 0.405946, 0.412342, 0.418690, 0.424991,
    0.431246, 0.437519, 0.443793, 0.450019, 0.456198, 0.462329, 0.468413, 0.474471, 0.480484, 0.486474,
    0.492479, 0.498440, 0.504355, 0.510222, 0.516042, 0.521837, 0.527648, 0.533420, 0.539151, 0.544848,
    0.550499, 0.556102, 0.561659, 0.567171, 0.572687, 0.578212, 0.583692, 0.589127, 0.594515, 0.599856,
    0.605166, 0.610459, 0.615706, 0.620929, 0.626147, 0.631321, 0.636449, 0.641531, 0.646568, 0.651575,
    0.656594, 0.661594, 0.666546, 0.671422, 0.676254, 0.681075, 0.685857, 0.690595, 0.695288, 0.699936,
    0.704544, 0.709150, 0.713759, 0.718334, 0.722865, 0.727352, 0.731796, 0.736198, 0.740581, 0.744932,
    0.749241, 0.753540, 0.757825, 0.762068, 0.766268, 0.770427, 0.774543, 0.778622, 0.782694, 0.786765,
    0.790810, 0.794813, 0.798775, 0.802696, 0.806577, 0.810422, 0.814234, 0.818007, 0.821760, 0.825510,
    0.829239, 0.832929, 0.836580, 0.840191, 0.843764, 0.847299, 0.850813, 0.854322, 0.857817, 0.861275,
    0.864697, 0.868086, 0.871437, 0.874751, 0.878028, 0.881268, 0.884472, 0.887655, 0.890830, 0.893995,
    0.897130, 0.900229, 0.903293, 0.906321, 0.909314, 0.912272, 0.915201, 0.918120, 0.921022, 0.923892,
    0.926728, 0.929545, 0.932332, 0.935086, 0.937807, 0.940494, 0.943148, 0.945769, 0.948358, 0.950928,
    0.953485, 0.956029, 0.958559, 0.961074, 0.963560, 0.966015, 0.968442, 0.970855, 0.973253, 0.975635,
    0.977999, 0.980333, 0.982636, 0.984909, 0.987151, 0.989362, 0.991543, 0.993694, 0.995815, 0.997916,
    1.000000
];

const F1B_CAUDAL_VACIO = 0.10;

const F1B_APERTURA_NOMINAL = 82.5;


function caudalRelativoF1b(ap){

    const x =
    Math.max(
        0,
        Math.min(
            100,
            ap
        )
    );

    const i =
    Math.min(
        F1B_CAUDAL_RELATIVO.length - 2,
        Math.floor(x / F1B_PASO_TABLA)
    );

    const f =
    (x - i * F1B_PASO_TABLA)
    /
    F1B_PASO_TABLA;

    return (
        F1B_CAUDAL_RELATIVO[i]
        +
        (
            F1B_CAUDAL_RELATIVO[i + 1]
            -
            F1B_CAUDAL_RELATIVO[i]
        )
        *
        f
    );

}


const F1B_CAUDAL_NOMINAL =
caudalRelativoF1b(
    F1B_APERTURA_NOMINAL
);


/* Potencia objetivo sin limitar (p.u.) */

function potenciaTurbinaF1b(ap){

    return (
        caudalRelativoF1b(ap)
        -
        F1B_CAUDAL_VACIO
    )
    /
    (
        F1B_CAUDAL_NOMINAL
        -
        F1B_CAUDAL_VACIO
    );

}


/* Apertura que produce una potencia dada
   (bisección; la característica es monótona) */

function aperturaDesdePotenciaF1b(potencia){

    let a = 0;
    let b = 100;

    for(let k = 0; k < 60; k++){

        const m = (a + b) / 2;

        if(potenciaTurbinaF1b(m) < potencia){
            a = m;
        }else{
            b = m;
        }

    }

    return (a + b) / 2;

}


/* Apertura inicial de equilibrio (Pm = 80 %) */

const APERTURA_BASE =
aperturaDesdePotenciaF1b(
    POTENCIA_BASE
);


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

/*
   Calibración dinámica: ALTERNATIVA B aprobada
   (auditoría dinámica). Únicos cambios:
   GANANCIA_WATT 75 → 55 y VELOCIDAD_SERVO 0.30 → 0.18.
*/

const GANANCIA_WATT = 55;

const GANANCIA_RESTAURACION = 3;

const VELOCIDAD_SERVO = .18;

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

    /*
       Modelo hidráulico F1b:
       apertura → caudal → potencia mecánica.
    */

    let pmObjetivo =
    potenciaTurbinaF1b(
        apertura
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