/* =====================================================
   SIMULADOR RVTH
   MODELO DINÁMICO

   Archivo: modelo.js

   ETAPA DE RECONSTRUCCIÓN (DESARROLLO_GOBERNADOR)

   El conjunto se ha reducido a: caracol, distribuidor
   Fink, rodete Francis, palanca de reenvío y
   servomotor. Se retiraron el regulador de Watt, la
   palanca A-B-C, la leva, la válvula piloto y sus
   tuberías. El regulador se reconstruirá hacia atrás
   a partir del servomotor.

   Este archivo contiene:
   - Condición nominal y curva hidráulica F1b
   - Variables de estado
   - Válvula distribuidora de aceite y servomotor
     hidráulico de doble efecto (etapa 3, 16-oct-2026),
     con mando manual del carrete (botonera)
   - Turbina, pérdidas y dinámica de la velocidad
===================================================== */


/* =====================================================
   CONDICIÓN NOMINAL
===================================================== */

const F_NOMINAL = 60;


/* =====================================================
   VELOCIDAD DEL EJE ↔ FRECUENCIA (etapa 10, 17-oct-2026)

   La variable de estado física es `frecuencia`: velocidad
   del eje expresada como frecuencia eléctrica equivalente.
   Relación actual: 60 Hz = 360 rpm (10 pares de polos).
   ÚNICA conversión: la usan el indicador de VELOCIDAD y
   el permiso de cierre del interruptor.
===================================================== */

const RPM_NOMINAL = 360;

function rpmDesdeFrecuencia(f){
    return f * RPM_NOMINAL / F_NOMINAL;
}

function velocidadEjeRpm(){
    return rpmDesdeFrecuencia(frecuencia);
}

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


/* Etapa 10: el primer valor de la tabla F1b (0 %) es
   −0.000002 por redondeo de la caracterización. El
   caudal físico no puede ser negativo: la DINÁMICA usa
   este mínimo en cero (la tabla no cambia). */

function caudalRelativoObjetivo(ap){
    return Math.max(0, caudalRelativoF1b(ap));
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

/*
   frecuencia: velocidad de giro del eje expresada como
   frecuencia eléctrica equivalente (60 Hz = 360 rpm).

   Etapa 10: ESTADO INICIAL DE REPOSO, listo para
   arrancar en vacío (ver establecerEstadoReposo al
   final del archivo): eje detenido, interruptor
   abierto, servomotor cerrado, sin caudal ni potencia.
   POTENCIA_BASE y APERTURA_BASE siguen siendo la
   condición de diseño en marcha (referencia de montaje
   del varillaje), no el estado inicial.
*/

let frecuencia =
0;

let cargaElectrica =
0;

let potenciaMecanica =
0;

/* =====================================================
   NOMBRES Y SIGNOS (etapa 3)

   posicionPiston       [%]  carrera del pistón del
                             servomotor: 0 % = cierre,
                             100 % = apertura (54.5 px
                             en el dibujo). Es la entrada
                             de la tabla F1b.
   carreteDistribuidor  [m]  desplazamiento del carrete
                             de la válvula distribuidora
                             desde su centro:
                             > 0  abre  (S → C1, C2 → R)
                             = 0  neutro (lumbreras
                                  cubiertas)
                             < 0  cierra (S → C2, C1 → R)
                             En el dibujo, x > 0 desplaza
                             el carrete hacia la IZQUIERDA.
   aberturaFink         [%]  abertura efectiva entre
                             directrices (geométrica, la
                             calcula distribuidor.js).

   Cámaras del servomotor:
     C1 = cámara izquierda, lado del vástago, área
          anular. Alimentarla abre (pistón → derecha).
     C2 = cámara derecha, área completa. Alimentarla
          cierra (pistón → izquierda).
   Lumbreras de la distribuidora:
     S = suministro (presión de sistema),
     R = retorno a tanque, C1 y C2 = cámaras.
===================================================== */

let posicionPiston =
0;


/* =====================================================
   MANDO DE LA VÁLVULA PILOTO

   Etapa 4 (17-oct-2026): la botonera movía el carrete
   piloto directamente.
   Etapa 5 (17-oct-2026): la ÚNICA entrada de la piloto
   es el varillaje A–B–C del regulador de Watt
   (carretePilotoVarillaje, más abajo), movido por el
   control provisional de posición del manguito.
   La piloto alimenta al SERVO PILOTO, cuyo vástago b
   mueve el carrete de la distribuidora.
   Etapa 6 (17-oct-2026): realimentación interna del
   servo piloto (hoy punto E de la palanca flotante).
   Etapa 7 (17-oct-2026): realimentación principal por
   leva y seguidor desde el vástago del servomotor
   principal hasta el apoyo móvil B. Letras A–F en
   js/watt_integracion.js.
===================================================== */


/* =====================================================
   ESTADO DE LA SIMULACIÓN

   El modelo corre desde el inicio para que el
   servomotor responda a la botonera. Las gráficas
   solo adquieren datos después de APLICAR
   (simulador.js).
===================================================== */

let simulando =
true;

let pausado =
false;

let ultimoTiempo =
null;


/* =====================================================
   INTERRUPTOR, RED Y TURBINA
===================================================== */

const FRECUENCIA_SIN = 60;

let interruptorCerrado =
false;

let caudalTurbina =
0;


/* =====================================================
   PARÁMETROS DINÁMICOS (sin cambios)
===================================================== */

const CONSTANTE_TURBINA = .48;

const INERCIA = .78;

const AMORTIGUAMIENTO = .80;   // etapa 27: ya no se usa (modelo aislado retirado; ver ejecutarModelo)


/* =====================================================
   PARÁMETROS HIDRÁULICOS — SUPUESTOS PROVISIONALES

   ¡ATENCIÓN! Estos valores NO son mediciones ni un
   dimensionamiento validado. Son el ejemplo del
   cálculo del 16-oct-2026 y se centralizan aquí para
   poder ajustarlos. La escala px → m NO existe: la
   carrera física S es un parámetro independiente de
   los 54.5 px del dibujo.

   Qué calcula el modelo:
   - Caudal por las aristas de control (ecuación de
     orificio, entrada y retorno en serie, misma
     abertura de lumbrera, traslape cero).
   - Velocidad del pistón con el área de la cámara
     que se llena (C1 anular al abrir, C2 completa al
     cerrar) y caudal de retorno con el área de la
     que se vacía.
   - Presiones de C1 y C2 en régimen permanente.
   Qué simplifica:
   - Carga resistente en el vástago: F = 0 (par de
     directrices, rozamiento e inercia del anillo
     desconocidos).
   - Fuente de presión ideal constante (sin bomba ni
     acumulador modelados).
   - Sin fugas, sin compresibilidad, sin pérdidas en
     tuberías; inercia del pistón despreciable.
   - Carrete con posición impuesta por el mando
     (sin dinámica propia).
===================================================== */

const HIDRAULICA = {

    carreraServo:          0.20,    // m   S        (supuesto)
    diametroPiston:        0.25,    // m   D        (supuesto)
    diametroVastago:       0.10,    // m   d        (supuesto)
    presionSuministro:     4.0e6,   // Pa  p_s      (supuesto)
    presionRetorno:        0,       // Pa  p_R      (tanque)
    densidadAceite:        870,     // kg/m³ ρ      (supuesto)
    coeficienteDescarga:   0.61,    //     C_d      (supuesto)
    anchoLumbrera:         0.020,   // m   w por arista (supuesto)
    carreraCarreteMaxima:  0.003,   // m   tope mecánico ± (supuesto)
    cargaApertura:         0,       // N   F que se opone a abrir (no modelada)
    cargaCierre:           0,       // N   F que se opone a cerrar (no modelada)
    tiempoCarreraNominal:  6        // s   objetivo, carrete en dosificación máx.

};


/* Áreas efectivas */

const AREA_C2 =
Math.PI / 4
*
HIDRAULICA.diametroPiston ** 2;            // completa

const AREA_C1 =
Math.PI / 4
*
(
    HIDRAULICA.diametroPiston ** 2
    -
    HIDRAULICA.diametroVastago ** 2
);                                          // anular

const RELACION_AREAS =
AREA_C1 / AREA_C2;                          // φ


/*
   Velocidad del pistón [m/s] para una abertura de
   lumbrera Ao [m²] (régimen permanente):

     Q_in  = A_in·v  = Cd·Ao·√(2(p_s − p_in)/ρ)
     Q_out = A_out·v = Cd·Ao·√(2(p_out − p_R)/ρ)
     p_in·A_in − p_out·A_out = F

   ⇒ v = Cd·Ao·√(2/ρ) · √[(p_s·A_in − p_R·A_out − F)
                          / (A_in³ + A_out³)]
*/

function velocidadPorLumbrera(Ao, Ain, Aout, F){

    const H = HIDRAULICA;

    const motriz =
    H.presionSuministro * Ain
    -
    H.presionRetorno * Aout
    -
    F;

    if(motriz <= 0 || Ao <= 0){
        return 0;
    }

    return (
        H.coeficienteDescarga
        *
        Ao
        *
        Math.sqrt(2 / H.densidadAceite)
        *
        Math.sqrt(motriz / (Ain ** 3 + Aout ** 3))
    );

}


/*
   DOSIFICACIÓN MÁXIMA (topes de carrera del carrete)

   Se calcula por separado para apertura y cierre, de
   modo que con el carrete en su tope el pistón
   recorra la carrera completa en tiempoCarreraNominal
   bajo las condiciones nominales supuestas. Con áreas
   distintas resulta X_AB > X_CI (≈ 1/√φ sin carga).
   No hay otro limitador de velocidad.
*/

function carreteParaTiempoNominal(Ain, Aout, F){

    const vNominal =
    HIDRAULICA.carreraServo
    /
    HIDRAULICA.tiempoCarreraNominal;

    const vPorArea =
    velocidadPorLumbrera(1, Ain, Aout, F);

    return vPorArea > 0
    ?
    vNominal / vPorArea / HIDRAULICA.anchoLumbrera
    :
    HIDRAULICA.carreraCarreteMaxima;

}

const CARRETE_MAX_APERTURA =
Math.min(
    HIDRAULICA.carreraCarreteMaxima,
    carreteParaTiempoNominal(AREA_C1, AREA_C2, HIDRAULICA.cargaApertura)
);

const CARRETE_MAX_CIERRE =
Math.min(
    HIDRAULICA.carreraCarreteMaxima,
    carreteParaTiempoNominal(AREA_C2, AREA_C1, HIDRAULICA.cargaCierre)
);


/* =====================================================
   ESTADO HIDRÁULICO

   modoDistribuidora:
     "apertura" | "cierre" | "neutro"
     | "tope-apertura" | "tope-cierre"
   Presiones en Pa, caudales en m³/s.
   En neutro el aceite queda atrapado y las presiones
   se RETIENEN (no pasan a cero). Valor inicial
   supuesto: equilibrio con F = 0 y p_C2 = p_s/2.
===================================================== */

let carreteDistribuidor =
0;

let modoDistribuidora =
"neutro";

let presionC2 =
HIDRAULICA.presionSuministro / 2;

let presionC1 =
presionC2 * AREA_C2 / AREA_C1;

let caudalSuministro =
0;

let caudalRetorno =
0;

/* %/s, positivo al abrir (nombre conservado) */
let velocidadServoActual =
0;

/* Abertura efectiva del Fink [%] (distribuidor.js) */
let aberturaFink =
null;


/* =====================================================
   VÁLVULA PILOTO Y SERVO PILOTO (etapa 4) —
   SUPUESTOS PROVISIONALES

   Circuito piloto propio a presión reducida p_p
   (fuente ideal). Válvula piloto de 4 vías y carrete
   de traslape cero; servo piloto de doble efecto con
   vástago pasante (áreas iguales), cuyo vástago b es
   el carrete de la distribuidora.

   Signos:
     carretePiloto  > 0 : arriba → S_p → cámara
                          superior del servo piloto,
                          inferior → retorno → b baja
     posicionServoPiloto (b) > 0 : abajo = abre la
                          distribuidora (= carreteDistribuidor)
   Topes del servo piloto: +CARRETE_MAX_APERTURA y
   −CARRETE_MAX_CIERRE (dosificación máxima de la
   distribuidora, conservan los 6 s nominales).

   El ancho de lumbrera de la piloto se calibra para
   que, con la piloto en su tope, b vaya de neutro al
   tope de apertura en tiempoServoPilotoNominal
   (valor didáctico supuesto).

   Simplificaciones: sin fuerzas sobre el carrete de
   la distribuidora (ni de flujo ni de rozamiento),
   sin fugas, sin compresibilidad; carrete piloto con
   posición impuesta por el mando.
===================================================== */

const PILOTO = {

    presionPiloto:            1.5e6,   // Pa  p_p        (supuesto)
    diametroServoPiloto:      0.040,   // m              (supuesto)
    diametroVastagoServoPiloto: 0.012, // m  pasante     (supuesto)
    carreraCarretePilotoMax:  0.0005,  // m  ± tope del carrete piloto (supuesto)
    tiempoServoPilotoNominal: 0.5      // s  neutro → tope de apertura (supuesto)

};

const AREA_SERVO_PILOTO =
Math.PI / 4
*
(
    PILOTO.diametroServoPiloto ** 2
    -
    PILOTO.diametroVastagoServoPiloto ** 2
);


/* Velocidad por orificios en serie (fórmula general,
   la misma de la distribuidora) */

function velocidadOrificios(Ao, Ain, Aout, F, pS, pR){

    const motriz =
    pS * Ain
    -
    pR * Aout
    -
    F;

    if(motriz <= 0 || Ao <= 0){
        return 0;
    }

    return (
        HIDRAULICA.coeficienteDescarga
        *
        Ao
        *
        Math.sqrt(2 / HIDRAULICA.densidadAceite)
        *
        Math.sqrt(motriz / (Ain ** 3 + Aout ** 3))
    );

}


/* Ancho de lumbrera de la piloto (calibrado) */

const ANCHO_LUMBRERA_PILOTO =
(
    CARRETE_MAX_APERTURA
    /
    PILOTO.tiempoServoPilotoNominal
)
/
velocidadOrificios(
    PILOTO.carreraCarretePilotoMax,
    AREA_SERVO_PILOTO,
    AREA_SERVO_PILOTO,
    0,
    PILOTO.presionPiloto,
    0
);


/* Estado del circuito piloto */

let carretePiloto =
0;

let posicionServoPiloto =
0;

let modoPiloto =
"neutro";

let presionServoPilotoSup =
PILOTO.presionPiloto / 2;

let presionServoPilotoInf =
PILOTO.presionPiloto / 2;

let caudalPiloto =
0;


/* Etapa 5 (17-oct-2026): la ÚNICA entrada de la piloto
   es el varillaje A–B–C del regulador de Watt
   (js/watt_integracion.js), en m, + = arriba = abre.
   Lo fija el control provisional de posición del
   manguito; la botonera ya no actúa sobre la piloto. */

let carretePilotoVarillaje =
0;


/* Etapas 6–7 (17-oct-2026): la posición de la piloto
   se recalcula en CADA paso con la geometría del
   varillaje A–F, usando la s del manguito, la b del
   servo piloto (realimentación interna, punto E) y la
   posición del pistón principal (leva, punto B). */

function carretePilotoDesdeMando(){

    if(typeof calcularCarretePilotoVarillaje === "function"){
        calcularCarretePilotoVarillaje(posicionServoPiloto);
    }

    return Math.max(
        -PILOTO.carreraCarretePilotoMax,
        Math.min(PILOTO.carreraCarretePilotoMax, carretePilotoVarillaje)
    );

}


function ejecutarServoPiloto(dt){

    carretePiloto =
    carretePilotoDesdeMando();

    const Ao =
    ANCHO_LUMBRERA_PILOTO
    *
    Math.abs(carretePiloto);


    /* Neutro: lumbreras cubiertas, presiones retenidas */

    if(Ao === 0){

        modoPiloto = "neutro";
        caudalPiloto = 0;
        return;

    }


    const abre =
    carretePiloto > 0;

    const pp =
    PILOTO.presionPiloto;


    /* Tope del servo piloto en el sentido ordenado */

    if(
        (abre && posicionServoPiloto >= CARRETE_MAX_APERTURA)
        ||
        (!abre && posicionServoPiloto <= -CARRETE_MAX_CIERRE)
    ){

        modoPiloto = abre ? "tope-apertura" : "tope-cierre";
        caudalPiloto = 0;

        if(abre){
            presionServoPilotoSup = pp;
            presionServoPilotoInf = 0;
        }else{
            presionServoPilotoInf = pp;
            presionServoPilotoSup = 0;
        }
        return;

    }


    const A =
    AREA_SERVO_PILOTO;

    const v =
    velocidadOrificios(Ao, A, A, 0, pp, 0);      // m/s ≥ 0

    const k =
    HIDRAULICA.densidadAceite / 2
    /
    (HIDRAULICA.coeficienteDescarga * Ao) ** 2;

    const pIn  = pp - k * (A * v) ** 2;
    const pOut = k * (A * v) ** 2;

    if(abre){
        presionServoPilotoSup = pIn;
        presionServoPilotoInf = pOut;
    }else{
        presionServoPilotoInf = pIn;
        presionServoPilotoSup = pOut;
    }

    modoPiloto = abre ? "apertura" : "cierre";

    caudalPiloto = A * v;

    posicionServoPiloto =
    Math.max(
        -CARRETE_MAX_CIERRE,
        Math.min(
            CARRETE_MAX_APERTURA,
            posicionServoPiloto + (abre ? 1 : -1) * v * dt
        )
    );

}


/* =====================================================
   TURBINA: PAR DEPENDIENTE DE LA VELOCIDAD Y PÉRDIDAS

   A 60 Hz el par neto coincide con F1b:
        Pm = (q − q_vacío)/(q_nominal − q_vacío)

   Par hidráulico (nulo a VELOCIDAD_PAR_NULO):
        Th = At · q · (120 − n) / (120 − 60)

   Pérdidas mecánicas (potencia ∝ n²):
        Tp = At · q_vacío · n / 60
===================================================== */

const TURBINA_AT =
1
/
(
    F1B_CAUDAL_NOMINAL
    -
    F1B_CAUDAL_VACIO
);

const VELOCIDAD_PAR_NULO = 120;


function parHidraulico(q, n){

    return (
        TURBINA_AT
        *
        q
        *
        (VELOCIDAD_PAR_NULO - n)
        /
        (VELOCIDAD_PAR_NULO - F_NOMINAL)
    );

}


function parPerdidas(n){

    return (
        TURBINA_AT
        *
        F1B_CAUDAL_VACIO
        *
        n
        /
        F_NOMINAL
    );

}


/* =====================================================
   DISTRIBUIDORA + SERVOMOTOR HIDRÁULICO (un paso)
===================================================== */

function ejecutarServomotorHidraulico(dt){

    const H = HIDRAULICA;

    /* Etapa piloto: el vástago b del servo piloto es
       el carrete de la distribuidora */

    ejecutarServoPiloto(
        dt
    );

    carreteDistribuidor =
    posicionServoPiloto;

    const x =
    carreteDistribuidor;

    const Ao =
    H.anchoLumbrera
    *
    Math.abs(x);

    const rho2 =
    H.densidadAceite / 2;


    /* Neutro: lumbreras cubiertas, sin caudal,
       presiones retenidas */

    if(Ao === 0){

        modoDistribuidora = "neutro";
        velocidadServoActual = 0;
        caudalSuministro = 0;
        caudalRetorno = 0;
        return;

    }


    const abre =
    x > 0;

    const Ain  = abre ? AREA_C1 : AREA_C2;
    const Aout = abre ? AREA_C2 : AREA_C1;
    const F    = abre ? H.cargaApertura : H.cargaCierre;


    /* Tope de carrera alcanzado en el sentido
       ordenado: sin caudal; la cámara de entrada
       queda a p_s y la de salida a p_R */

    if(
        (abre && posicionPiston >= 100)
        ||
        (!abre && posicionPiston <= 0)
    ){

        modoDistribuidora = abre ? "tope-apertura" : "tope-cierre";
        velocidadServoActual = 0;
        caudalSuministro = 0;
        caudalRetorno = 0;

        if(abre){
            presionC1 = H.presionSuministro;
            presionC2 = H.presionRetorno;
        }else{
            presionC2 = H.presionSuministro;
            presionC1 = H.presionRetorno;
        }
        return;

    }


    const v =
    velocidadPorLumbrera(Ao, Ain, Aout, F);      // m/s ≥ 0

    const kOrificio =
    rho2
    /
    (H.coeficienteDescarga * Ao) ** 2;

    const pIn =
    H.presionSuministro
    -
    kOrificio * (Ain * v) ** 2;

    const pOut =
    H.presionRetorno
    +
    kOrificio * (Aout * v) ** 2;

    if(abre){
        presionC1 = pIn;
        presionC2 = pOut;
    }else{
        presionC2 = pIn;
        presionC1 = pOut;
    }

    modoDistribuidora = abre ? "apertura" : "cierre";

    caudalSuministro = Ain * v;
    caudalRetorno = Aout * v;


    /* Integración de la posición del pistón */

    const velocidadPorcentual =
    (abre ? 1 : -1)
    *
    100
    *
    v
    /
    H.carreraServo;                               // %/s

    posicionPiston =
    Math.max(
        0,
        Math.min(
            100,
            posicionPiston + velocidadPorcentual * dt
        )
    );

    velocidadServoActual =
    velocidadPorcentual;

}


/* =====================================================
   MODELO DINÁMICO
===================================================== */

function ejecutarModelo(dt){

    if(
        !simulando
    ){
        return;
    }


    /* =================================================
       DISTRIBUIDORA Y SERVOMOTOR HIDRÁULICO
    ================================================= */

    ejecutarServomotorHidraulico(
        dt
    );


    /* =================================================
       TURBINA: CAUDAL, PAR Y POTENCIA MECÁNICA
    ================================================= */

    caudalTurbina +=
    (
        caudalRelativoObjetivo(posicionPiston)
        -
        caudalTurbina
    )
    *
    CONSTANTE_TURBINA
    *
    dt;


    const parNeto =
    parHidraulico(
        caudalTurbina,
        frecuencia
    )
    -
    parPerdidas(
        frecuencia
    );


    potenciaMecanica =
    parNeto
    *
    frecuencia
    /
    F_NOMINAL;


    /* =================================================
       DINÁMICA DE LA VELOCIDAD (sin regulador)
    ================================================= */

    if(
        interruptorCerrado
    ){

        /* Etapa 27 (20-oct-2026): CONECTADO A RED INFINITA.
           Pe sale del acoplamiento con la red (ángulo δ,
           tensión y amortiguadores: js/sincronizacion.js,
           potenciaElectricaRed). Ya no es una demanda fija:
           cargaElectrica = Pe calculada.
           Par eléctrico = Pe·f_N/f. Se retira el término
           AMORTIGUAMIENTO·(f − 60) del modelo aislado: el
           amortiguamiento respecto a la red está solo en Kd
           (no se duplica); las pérdidas siguen en parNeto. */

        cargaElectrica =
        potenciaElectricaRed();

        frecuencia +=
        (
            parNeto
            -
            cargaElectrica * F_NOMINAL / Math.max(frecuencia, 1)
        )
        /
        INERCIA
        *
        dt;

    }

    else{

        /* Vacío: Pe = 0; par de la turbina, pérdidas
           e inercia. */

        cargaElectrica =
        0;


        frecuencia +=
        parNeto
        /
        INERCIA
        *
        dt;

    }


    frecuencia =
    Math.max(
        0,
        frecuencia
    );

    /* Etapa 27: ángulo δ respecto a la red y tensión del
       generador (js/sincronizacion.js) */

    avanzarRed(
        dt
    );

    /* El registro de gráficas se hace en simulador.js
       con muestreo propio (independiente del paso). */

}


/* =====================================================
   ESTADO DE REPOSO — LISTO PARA ARRANCAR EN VACÍO
   (etapa 10, 17-oct-2026)

   Lo usan la carga de la página y REINICIAR. Fija
   TODAS las variables de estado del modelo de forma
   coherente:
     - interruptor ABIERTO, eje detenido (0 rpm, 0 Hz)
     - servomotor principal en 0 % (Fink CERRADO por su
       geometría validada)
     - caudal de agua, potencias eléctrica y mecánica: 0
     - piloto y distribuidora de aceite en NEUTRO,
       servo piloto centrado (b = 0). Neutro de las
       válvulas ≠ Fink cerrado: las válvulas no ordenan
       movimiento; el Fink está cerrado porque el pistón
       está en su tope de cierre.
   Presiones retenidas iniciales: mismos supuestos que
   antes (p_s/2 en C2 y p_p/2 en el servo piloto).
   El manguito y el varillaje los fija
   watt_integracion.js (MANGUITO_REPOSO).
===================================================== */

function establecerEstadoReposo(){

    interruptorCerrado = false;
    frecuencia = 0;
    cargaElectrica = 0;
    potenciaMecanica = 0;
    caudalTurbina = 0;

    posicionPiston = 0;
    velocidadServoActual = 0;

    carreteDistribuidor = 0;
    modoDistribuidora = "neutro";
    presionC2 = HIDRAULICA.presionSuministro / 2;
    presionC1 = presionC2 * AREA_C2 / AREA_C1;
    caudalSuministro = 0;
    caudalRetorno = 0;

    carretePiloto = 0;
    carretePilotoVarillaje = 0;
    posicionServoPiloto = 0;
    modoPiloto = "neutro";
    presionServoPilotoSup = PILOTO.presionPiloto / 2;
    presionServoPilotoInf = PILOTO.presionPiloto / 2;
    caudalPiloto = 0;

}

establecerEstadoReposo();
