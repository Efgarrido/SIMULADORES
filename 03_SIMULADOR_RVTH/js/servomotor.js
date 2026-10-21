/* =====================================================
   SIMULADOR RVTH
   SERVOMOTOR HIDRÁULICO

   Archivo: servomotor.js

   ETAPA DE RECONSTRUCCIÓN (DESARROLLO_GOBERNADOR)

   Sustituye a regulador.js. Contiene exclusivamente:
   - Geometría del servomotor
   - Dibujo del pistón, cámaras y vástago
   - Llamada al distribuidor Fink (punto D)
   - Dibujo de la válvula distribuidora, conductos y
     colores del código Vickers (etapa 3). El cálculo
     hidráulico está en modelo.js.

   El regulador de Watt, la palanca A-B-C, la leva y la
   válvula piloto se retiraron en esta etapa.
===================================================== */


/* =====================================================
   ELEMENTOS SVG
===================================================== */

const camaraIzquierda =
document.getElementById("camaraIzquierda");

const camaraDerecha =
document.getElementById("camaraDerecha");

const pistonServo =
document.getElementById("pistonServo");

const vastagoServo =
document.getElementById("vastagoServo");

const luzAccion =
document.getElementById("luzAccion");

const accionTexto =
document.getElementById("accionTexto");

const accionSubtexto =
document.getElementById("accionSubtexto");

const accionPresiones =
document.getElementById("accionPresiones");


/* =====================================================
   GEOMETRÍA DEL SERVOMOTOR (px del SVG)

   Cilindro interior: x = 706 … 944.
   Pistón de 50 px; su cara izquierda está en
   PISTON_X_BASE cuando el mando vale
   SERVO_APERTURA_REFERENCIA (75 %).
   Escala: 30/55 px por % de mando → 0 % en x = 759.1,
   100 % en x = 813.6 (topes del mando).
===================================================== */

const SERVO_X_IZQ = 706;

const SERVO_X_DER = 944;

const PISTON_X_BASE = 800;

const PISTON_ANCHO = 50;

const SERVO_APERTURA_REFERENCIA = 75;

const SERVO_X_POR_PORCENTAJE =
30
/
55;

const VASTAGO_Y = 515;


/* Pivote trasero del servomotor (extremo derecho).
   El cuerpo gira alrededor de P; el vástago queda
   siempre en el eje del cilindro. */

const SERVO_PIVOTE_X = 968;

const SERVO_PIVOTE_Y = 515;

const cuerpoServomotor =
document.getElementById("servomotor-cuerpo");


/* Ángulo actual del eje del cilindro (grados) */

let anguloServomotor =
0;


/* =====================================================
   ACTUALIZAR SERVOMOTOR
===================================================== */

function actualizarServomotor(){

    const movimientoServo =
    (
        posicionPiston
        -
        SERVO_APERTURA_REFERENCIA
    )
    *
    SERVO_X_POR_PORCENTAJE;


    /* Distribuidor y punto D */

    const estadoDistribuidor =
    actualizarDistribuidor(
        movimientoServo
    );


    if(
        estadoDistribuidor
    ){

        const ref =
        modeloFinkV8.referencia;

        aberturaFink =
        100
        *
        (estadoDistribuidor.abertura - ref.holguraCierre)
        /
        (ref.aberturaMaxima - ref.holguraCierre);

    }


    const xPiston =
    PISTON_X_BASE
    +
    movimientoServo;


    const xPistonDerecha =
    xPiston
    +
    PISTON_ANCHO;


    /* Giro del cuerpo alrededor del pivote P para que
       su eje pase por D. El vástago se dibuja dentro
       del grupo, en coordenadas del cilindro. */

    if(
        estadoDistribuidor
    ){

        const dx =
        SERVO_PIVOTE_X - estadoDistribuidor.Dx;

        const dy =
        SERVO_PIVOTE_Y - estadoDistribuidor.Dy;

        anguloServomotor =
        Math.atan2(dy, dx)
        *
        180
        /
        Math.PI;


        cuerpoServomotor.setAttribute(
            "transform",
            "rotate("
            +
            anguloServomotor
            +
            " "
            +
            SERVO_PIVOTE_X
            +
            " "
            +
            SERVO_PIVOTE_Y
            +
            ")"
        );


        /* D en coordenadas del cilindro: sobre su eje,
           a la distancia real P–D */

        vastagoServo.setAttribute(
            "x1",
            SERVO_PIVOTE_X
            -
            Math.hypot(dx, dy)
        );

        vastagoServo.setAttribute(
            "y1",
            SERVO_PIVOTE_Y
        );

    }

    vastagoServo.setAttribute(
        "x2",
        xPiston
    );

    vastagoServo.setAttribute(
        "y2",
        VASTAGO_Y
    );


    /* Cámaras */

    camaraIzquierda.setAttribute(
        "x",
        SERVO_X_IZQ
    );

    camaraIzquierda.setAttribute(
        "width",
        Math.max(
            6,
            xPiston - SERVO_X_IZQ
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
            SERVO_X_DER - xPistonDerecha
        )
    );


    /* Colores Vickers según el estado hidráulico
       (modelo.js), no según el signo de la velocidad */

    const colores =
    coloresCircuito();

    camaraIzquierda.setAttribute(
        "class",
        "camara " + colores.C1.clase
    );

    camaraDerecha.setAttribute(
        "class",
        "camara " + colores.C2.clase
    );


    actualizarCircuitoAceite(
        colores
    );


    /* Pistón */

    pistonServo.style.transform =
    "translateX("
    +
    movimientoServo
    +
    "px)";

}


/* =====================================================
   CIRCUITO DE ACEITE — VÁLVULA DISTRIBUIDORA (etapa 3)

   Coordenadas locales del grupo #conjunto-mecanico.
   DISTRIBUIDORA VERTICAL (16-oct-2026), como en el
   esquema de referencia: cuerpo x 800 … 850,
   y 250 … 412; vástago de accionamiento por arriba
   (punto b, futura conexión al servo piloto).

   Corte interno (escala DIDÁCTICA del carrete),
   lumbreras de arriba abajo:
     R2 263–275 (izq.), C2 297–313 (der.),
     S 331–339 (izq.), C1 357–373 (der.),
     R1 390–402 (izq.)
     resaltes de 16 px sobre C2 y C1 en neutro
     (traslape cero).
   Desplazamiento dibujado (positivo = HACIA ABAJO):
     d = 16 px · carreteDistribuidor / CARRETE_MAX_APERTURA
   (16 px = tope de apertura; el tope de cierre queda
   en 14.7 px porque su dosificación es menor).
     d > 0, carrete ABAJO:  S → C1 (ranura central) y
                            C2 → R2 (ranura superior)
     d < 0, carrete ARRIBA: S → C2 y C1 → R1
     d = 0: C1 y C2 cubiertas por los resaltes.

   CONVENCIÓN VISUAL (código Vickers de referencia)
   El color indica la función o la categoría de
   presión del aceite; la circulación se indica aparte:
     - Flechas: solo cuando hay caudal, en su sentido.
     - Rayado en la cámara: no circula aceite; la
       cámara conserva la presión indicada en su
       manómetro.
   Color de cada cámara/conducto:
     rojo       conectado a S o retenido a ≈ p_s
                (presión de sistema / funcionamiento)
     amarillo   cámara que se llena a través de la
                arista de control (flujo controlado)
     azul       cámara que se vacía hacia tanque y su
                línea (flujo de retorno; puede tener
                contrapresión, ver manómetro)
     anaranjado sin circulación, presión intermedia
                entre retorno y p_s: presión de carga
                (la que sostiene el pistón)
     blanco     sin circulación y a presión de tanque
                (fluido inactivo)
   No se usan verde (succión/drenaje) ni morado
   (intensificación): no están representados.
===================================================== */

const VALVULA_PX_TOPE = 16;

const BORDE_SUP_RANURA = 258;
const BORDE_INF_RANURA = 404;
const RESALTE_C2_Y = 297;     // borde superior del resalte sobre C2
const RESALTE_C1_Y = 357;     // borde superior del resalte sobre C1
const RESALTE_ALTO = 16;

/* Etapa 8: la distribuidora se dibuja reflejada y
   trasladada (index.html, x' = 1845 − x, y' = y + 55);
   las constantes de arriba siguen en las coordenadas
   del dibujo original (grupo reflejado). Salidas a las
   cámaras en coordenadas globales: */
const DIST_CARA_X = 995;      // cara izquierda del cuerpo
const DIST_Y_C2 = 360;        // centro de la lumbrera C2
const DIST_Y_C1 = 420;        // centro de la lumbrera C1
const PUENTE_R = 9;           // radio del puente de cruce

/* Tomas de las cámaras (coordenadas del cilindro sin girar) */
const TOMA_C1 = { x: 730, y: 449 };
const TOMA_C2 = { x: 920, y: 449 };

/* Límites de categoría de presión (fracción de p_s) */
const FRACCION_PRESION_SISTEMA = 0.98;
const FRACCION_PRESION_TANQUE = 0.02;


const porIdCircuito = id => document.getElementById(id);

const elCircuito = {
    grupoCarrete:  porIdCircuito("carrete-distribuidora"),
    ranuraR1:      porIdCircuito("ranura-r1"),
    ranuraS:       porIdCircuito("ranura-s"),
    ranuraR2:      porIdCircuito("ranura-r2"),
    canalC1:       porIdCircuito("canal-c1"),
    canalC2:       porIdCircuito("canal-c2"),
    canalR1:       porIdCircuito("canal-r1"),
    canalR2:       porIdCircuito("canal-r2"),
    tuboS:         porIdCircuito("tubo-s"),
    tuboR1:        porIdCircuito("tubo-r1"),
    tuboR2:        porIdCircuito("tubo-r2"),
    tuboC1:        porIdCircuito("tubo-c1"),
    tuboC2:        porIdCircuito("tubo-c2"),
    bordeC1:       porIdCircuito("tubo-c1-borde"),
    bordeC2:       porIdCircuito("tubo-c2-borde"),
    sinCircC1:     porIdCircuito("sinCirculacionC1"),
    sinCircC2:     porIdCircuito("sinCirculacionC2"),
    manometroC1:   porIdCircuito("manometro-c1"),
    manometroC2:   porIdCircuito("manometro-c2"),
    textoFink:     porIdCircuito("textoAberturaFink")
};


/* Categoría Vickers de una cámara SIN circulación */

function categoriaPresionEstatica(p){

    const ps = HIDRAULICA.presionSuministro;

    if(p >= FRACCION_PRESION_SISTEMA * ps){
        return "vk-presion";
    }

    if(p <= HIDRAULICA.presionRetorno + FRACCION_PRESION_TANQUE * ps){
        return "vk-inactivo";
    }

    return "vk-carga";

}


/*
   Estado de cada conducto: color + circulación.
   circula = true solo con caudal real.
*/

/* =====================================================
   UMBRAL VISUAL DE CIRCULACIÓN (etapa 6, 17-oct-2026)

   Con la realimentación interna, la piloto y la
   distribuidora vuelven a neutro de forma asintótica
   (traslape cero): quedan caudales residuales del orden
   de 10⁻⁶ del nominal. Solo para el DIBUJO, un caudal
   menor que UMBRAL_CAUDAL_VISIBLE × caudal nominal se
   representa como "sin circulación" (colores por
   presión, rayado, sin flechas). El modelo no cambia:
   sigue integrando ese caudal.
===================================================== */

const UMBRAL_CAUDAL_VISIBLE = 0.001;

function modoVisibleDistribuidora(){

    const nominal =
    AREA_C2 * HIDRAULICA.carreraServo / HIDRAULICA.tiempoCarreraNominal;

    if(
        (modoDistribuidora === "apertura" || modoDistribuidora === "cierre")
        &&
        caudalSuministro < UMBRAL_CAUDAL_VISIBLE * nominal
    ){
        return "neutro";
    }

    return modoDistribuidora;

}

function modoVisiblePiloto(){

    const nominal =
    AREA_SERVO_PILOTO * CARRETE_MAX_APERTURA / PILOTO.tiempoServoPilotoNominal;

    if(
        (modoPiloto === "apertura" || modoPiloto === "cierre")
        &&
        caudalPiloto < UMBRAL_CAUDAL_VISIBLE * nominal
    ){
        return "neutro";
    }

    return modoPiloto;

}


function coloresCircuito(){

    const quieta = p => ({ clase: categoriaPresionEstatica(p), circula: false });

    switch(modoVisibleDistribuidora()){

        case "apertura":
            return {
                S:  { clase: "vk-presion",    circula: true },
                C1: { clase: "vk-controlado", circula: true },
                C2: { clase: "vk-retorno",    circula: true },
                R1: { clase: "vk-inactivo",   circula: false },
                R2: { clase: "vk-retorno",    circula: true }
            };

        case "cierre":
            return {
                S:  { clase: "vk-presion",    circula: true },
                C1: { clase: "vk-retorno",    circula: true },
                C2: { clase: "vk-controlado", circula: true },
                R1: { clase: "vk-retorno",    circula: true },
                R2: { clase: "vk-inactivo",   circula: false }
            };

        default:
            /* neutro y topes: no circula aceite; color por
               la presión que conserva cada cámara */
            return {
                S:  { clase: "vk-presion",  circula: false },
                C1: quieta(presionC1),
                C2: quieta(presionC2),
                R1: { clase: "vk-inactivo", circula: false },
                R2: { clase: "vk-inactivo", circula: false }
            };
    }

}


/* Punto del cilindro girado alrededor del pivote P */

function puntoCilindroGirado(p){

    const a =
    anguloServomotor * Math.PI / 180;

    const dx = p.x - SERVO_PIVOTE_X;
    const dy = p.y - SERVO_PIVOTE_Y;

    return {
        x: SERVO_PIVOTE_X + dx * Math.cos(a) - dy * Math.sin(a),
        y: SERVO_PIVOTE_Y + dx * Math.sin(a) + dy * Math.cos(a)
    };

}


function fijarClase(el, base, clase){

    if(el){
        el.setAttribute("class", base + " " + clase);
    }

}


/* Flecha: visible solo si hay caudal; ángulo en
   grados (0 = hacia abajo, 90 = izquierda,
   180 = arriba, −90 = derecha) */

function fijarFlecha(id, visible, x, y, angulo){

    const el =
    document.getElementById("flecha-" + id);

    if(!el){
        return;
    }

    el.style.display =
    visible ? "inline" : "none";

    if(visible){
        el.setAttribute(
            "transform",
            "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ") rotate(" + angulo + ")"
        );
    }

}


/* Desplazamiento dibujado del carrete (px, + = hacia abajo = abrir) */

function desplazamientoCarretePx(){

    return (
        VALVULA_PX_TOPE
        *
        carreteDistribuidor
        /
        CARRETE_MAX_APERTURA
    );

}


function actualizarCircuitoAceite(colores){

    const e = elCircuito;

    if(!e.grupoCarrete){
        return;
    }


    /* Carrete vertical (d > 0: hacia abajo = abrir) */

    const d =
    desplazamientoCarretePx();

    e.grupoCarrete.setAttribute(
        "transform",
        "translate(0 " + d.toFixed(3) + ")"
    );


    /* Ranuras del carrete: se desplazan con él
       (R2 arriba, S entre resaltes, R1 abajo) */

    const r2Inf = RESALTE_C2_Y + d;
    const sSup  = RESALTE_C2_Y + RESALTE_ALTO + d;
    const sInf  = RESALTE_C1_Y + d;
    const r1Sup = RESALTE_C1_Y + RESALTE_ALTO + d;

    e.ranuraR2.setAttribute("y", BORDE_SUP_RANURA);
    e.ranuraR2.setAttribute("height", Math.max(0, r2Inf - BORDE_SUP_RANURA));
    e.ranuraS.setAttribute("y", sSup);
    e.ranuraS.setAttribute("height", Math.max(0, sInf - sSup));
    e.ranuraR1.setAttribute("y", r1Sup);
    e.ranuraR1.setAttribute("height", Math.max(0, BORDE_INF_RANURA - r1Sup));


    /* Colores */

    fijarClase(e.ranuraR1, "fluido", colores.R1.clase);
    fijarClase(e.ranuraS,  "fluido", colores.S.clase);
    fijarClase(e.ranuraR2, "fluido", colores.R2.clase);

    fijarClase(e.canalC1, "fluido", colores.C1.clase);
    fijarClase(e.canalC2, "fluido", colores.C2.clase);
    fijarClase(e.canalR1, "fluido", colores.R1.clase);
    fijarClase(e.canalR2, "fluido", colores.R2.clase);

    fijarClase(e.tuboS,  "tubo", colores.S.clase);
    fijarClase(e.tuboR1, "tubo", colores.R1.clase);
    fijarClase(e.tuboR2, "tubo", colores.R2.clase);
    fijarClase(e.tuboC1, "tubo", colores.C1.clase);
    fijarClase(e.tuboC2, "tubo", colores.C2.clase);


    /* Rayado "sin circulación" sobre cada cámara */

    e.sinCircC1.setAttribute("x", camaraIzquierda.getAttribute("x"));
    e.sinCircC1.setAttribute("width", camaraIzquierda.getAttribute("width"));
    e.sinCircC2.setAttribute("x", camaraDerecha.getAttribute("x"));
    e.sinCircC2.setAttribute("width", camaraDerecha.getAttribute("width"));

    e.sinCircC1.style.display = colores.C1.circula ? "none" : "inline";
    e.sinCircC2.style.display = colores.C2.circula ? "none" : "inline";


    /* Manómetros */

    e.manometroC1.textContent =
    "C1 anular · " + (presionC1 / 1e6).toFixed(2) + " MPa";

    e.manometroC2.textContent =
    "C2 completa · " + (presionC2 / 1e6).toFixed(2) + " MPa";


    /* Abertura geométrica del Fink */

    if(e.textoFink && aberturaFink !== null){
        e.textoFink.textContent =
        "Abertura geométrica del Fink (%): " + Math.max(0, aberturaFink).toFixed(1);
    }


    /* Conductos a las cámaras: el último tramo llega a
       la toma del cilindro, que gira con él */

    const t1 = puntoCilindroGirado(TOMA_C1);
    const t2 = puntoCilindroGirado(TOMA_C2);

    /* Etapa 8: distribuidora reflejada a la derecha
       del servomotor (cara izquierda en x = 995).
       C2 sale a y = 360 y baja a su toma; C1 sale a
       y = 420 y salta sobre el tramo vertical de C2
       con un puente (cruce SIN conexión). */

    const xC2 = t2.x.toFixed(2);

    const d1 =
    "M" + DIST_CARA_X + " " + DIST_Y_C1 +
    " L" + (t2.x + PUENTE_R).toFixed(2) + " " + DIST_Y_C1 +
    " A" + PUENTE_R + " " + PUENTE_R + " 0 0 0 " + (t2.x - PUENTE_R).toFixed(2) + " " + DIST_Y_C1 +
    " L" + t1.x.toFixed(2) + " " + DIST_Y_C1 +
    " L" + t1.x.toFixed(2) + " " + t1.y.toFixed(2);

    const d2 =
    "M" + DIST_CARA_X + " " + DIST_Y_C2 +
    " L" + xC2 + " " + DIST_Y_C2 +
    " L" + xC2 + " " + t2.y.toFixed(2);

    e.tuboC1.setAttribute("d", d1);
    e.bordeC1.setAttribute("d", d1);
    e.tuboC2.setAttribute("d", d2);
    e.bordeC2.setAttribute("d", d2);


    /* Flechas de circulación (sentido del caudal) */

    const abre   = modoVisibleDistribuidora() === "apertura";
    const cierra = modoVisibleDistribuidora() === "cierre";
    const fluye  = abre || cierra;

    const ABAJO = 0, ARRIBA = 180, IZQ = 90, DER = -90;

    fijarFlecha("s",    fluye, 772, 335, DER);
    fijarFlecha("s-v",  fluye, 807, 335, DER);

    fijarFlecha("r1",   cierra, 781, 396, IZQ);
    fijarFlecha("r1-v", cierra, 807, 396, IZQ);

    fijarFlecha("r2",   abre, 781, 269, IZQ);
    fijarFlecha("r2-v", abre, 807, 269, IZQ);

    /* c1-v y c2-v están dentro del grupo reflejado
       (coordenadas y sentidos de la etapa 7, el reflejo
       los invierte); las de los conductos, sin reflejo */

    fijarFlecha("c1-v", fluye, 844, 365, abre ? DER : IZQ);
    fijarFlecha("c1-t", fluye, 960, DIST_Y_C1, abre ? IZQ : DER);
    fijarFlecha("c1-c", fluye, 820, DIST_Y_C1, abre ? IZQ : DER);

    fijarFlecha("c2-v", fluye, 844, 305, abre ? IZQ : DER);
    fijarFlecha("c2-t", fluye, 960, DIST_Y_C2, abre ? DER : IZQ);
    fijarFlecha("c2-c", fluye, t2.x, 384, abre ? ARRIBA : ABAJO);


    /* Etapa 4: válvula piloto y servo piloto */

    actualizarCircuitoPiloto(
        d
    );

}


/* =====================================================
   ETAPA 4 — VÁLVULA PILOTO Y SERVO PILOTO (dibujo)

   Escalas DIDÁCTICAS:
     carrete piloto: ±10 px = ±carreraCarretePilotoMax
                     (positivo = ARRIBA = abre)
     pistón del servo piloto: mismo desplazamiento que
                     el carrete de la distribuidora
                     (16 px = tope de apertura, abajo)
   Colores (misma convención Vickers):
     anaranjado  suministro piloto p_p (presión piloto)
                 y cámaras sin circulación con presión
     amarillo    cámara del servo piloto que se llena
     azul        cámara que se vacía y su retorno
     blanco      sin circulación y a presión de tanque
   Flechas solo con caudal; rayado = sin circulación.
===================================================== */

const PILOTO_PX_TOPE = 10;

const elPiloto = {
    carrete:     document.getElementById("carrete-piloto"),
    piston:      document.getElementById("piston-servopiloto"),
    ranuraRpu:   document.getElementById("ranura-rpu"),
    ranuraSp:    document.getElementById("ranura-sp"),
    ranuraRpl:   document.getElementById("ranura-rpl"),
    canalRpu:    document.getElementById("canal-rpu"),
    canalSp:     document.getElementById("canal-sp"),
    canalRpl:    document.getElementById("canal-rpl"),
    canalAp:     document.getElementById("canal-ap"),
    canalBp:     document.getElementById("canal-bp"),
    tuboSp:      document.getElementById("tubo-sp"),
    tuboRpu:     document.getElementById("tubo-rpu"),
    tuboRpl:     document.getElementById("tubo-rpl"),
    tuboAp:      document.getElementById("tubo-ap"),
    tuboBp:      document.getElementById("tubo-bp"),
    camSup:      document.getElementById("camaraSPsup"),
    camInf:      document.getElementById("camaraSPinf"),
    sinCircSup:  document.getElementById("sinCirculacionSPsup"),
    sinCircInf:  document.getElementById("sinCirculacionSPinf"),
    manometro:   document.getElementById("manometro-sp"),
    lecturaB:    document.getElementById("lecturaB")
};


function coloresPiloto(){

    const pp = PILOTO.presionPiloto;

    const quieta = p => ({
        clase: p > FRACCION_PRESION_TANQUE * pp ? "vk-carga" : "vk-inactivo",
        circula: false
    });

    switch(modoVisiblePiloto()){

        case "apertura":
            return {
                Sp:  { clase: "vk-carga",      circula: true },
                Sup: { clase: "vk-controlado", circula: true },
                Inf: { clase: "vk-retorno",    circula: true },
                Rpu: { clase: "vk-inactivo",   circula: false },
                Rpl: { clase: "vk-retorno",    circula: true }
            };

        case "cierre":
            return {
                Sp:  { clase: "vk-carga",      circula: true },
                Sup: { clase: "vk-retorno",    circula: true },
                Inf: { clase: "vk-controlado", circula: true },
                Rpu: { clase: "vk-retorno",    circula: true },
                Rpl: { clase: "vk-inactivo",   circula: false }
            };

        default:
            return {
                Sp:  { clase: "vk-carga",    circula: false },
                Sup: quieta(presionServoPilotoSup),
                Inf: quieta(presionServoPilotoInf),
                Rpu: { clase: "vk-inactivo", circula: false },
                Rpl: { clase: "vk-inactivo", circula: false }
            };
    }

}


function actualizarCircuitoPiloto(dServo){

    const e = elPiloto;

    if(!e.carrete){
        return;
    }

    const c = coloresPiloto();


    /* Carrete piloto (+ = arriba) */

    const ep =
    PILOTO_PX_TOPE
    *
    carretePiloto
    /
    PILOTO.carreraCarretePilotoMax;

    e.carrete.setAttribute(
        "transform",
        "translate(0 " + (-ep).toFixed(3) + ")"
    );

    e.ranuraRpu.setAttribute("y", 112);
    e.ranuraRpu.setAttribute("height", Math.max(0, 128 - ep - 112));
    e.ranuraSp.setAttribute("y", 138 - ep);
    e.ranuraSp.setAttribute("height", 26);
    e.ranuraRpl.setAttribute("y", 174 - ep);
    e.ranuraRpl.setAttribute("height", Math.max(0, 196 - (174 - ep)));


    /* Pistón del servo piloto (+ = abajo) */

    e.piston.setAttribute(
        "transform",
        "translate(0 " + dServo.toFixed(3) + ")"
    );

    e.camSup.setAttribute("height", Math.max(0, 148 + dServo - 126));
    e.camInf.setAttribute("y", 158 + dServo);
    e.camInf.setAttribute("height", Math.max(0, 180 - (158 + dServo)));

    e.sinCircSup.setAttribute("height", e.camSup.getAttribute("height"));
    e.sinCircInf.setAttribute("y", e.camInf.getAttribute("y"));
    e.sinCircInf.setAttribute("height", e.camInf.getAttribute("height"));


    /* Colores */

    fijarClase(e.ranuraRpu, "fluido", c.Rpu.clase);
    fijarClase(e.ranuraSp,  "fluido", c.Sp.clase);
    fijarClase(e.ranuraRpl, "fluido", c.Rpl.clase);
    fijarClase(e.canalRpu,  "fluido", c.Rpu.clase);
    fijarClase(e.canalSp,   "fluido", c.Sp.clase);
    fijarClase(e.canalRpl,  "fluido", c.Rpl.clase);
    fijarClase(e.canalAp,   "fluido", c.Sup.clase);
    fijarClase(e.canalBp,   "fluido", c.Inf.clase);
    fijarClase(e.tuboSp,  "tuboPiloto", c.Sp.clase);
    fijarClase(e.tuboRpu, "tuboPiloto", c.Rpu.clase);
    fijarClase(e.tuboRpl, "tuboPiloto", c.Rpl.clase);
    fijarClase(e.tuboAp,  "tuboPiloto", c.Sup.clase);
    fijarClase(e.tuboBp,  "tuboPiloto", c.Inf.clase);
    fijarClase(e.camSup, "camara", c.Sup.clase);
    fijarClase(e.camInf, "camara", c.Inf.clase);

    e.sinCircSup.style.display = c.Sup.circula ? "none" : "inline";
    e.sinCircInf.style.display = c.Inf.circula ? "none" : "inline";


    /* Lecturas */

    e.manometro.textContent =
    "sup " + (presionServoPilotoSup / 1e6).toFixed(2) +
    " · inf " + (presionServoPilotoInf / 1e6).toFixed(2) + " MPa";

    const bmm = posicionServoPiloto * 1000;

    e.lecturaB.textContent =
    "b = " + (bmm >= 0 ? "+" : "−") + Math.abs(bmm).toFixed(2) + " mm";


    /* Flechas (escala reducida) */

    const abre   = modoVisiblePiloto() === "apertura";
    const cierra = modoVisiblePiloto() === "cierre";
    const fluye  = abre || cierra;

    const flecha = (id, vis, x, y, ang) => {
        const el = document.getElementById("flecha-" + id);
        if(!el){ return; }
        el.style.display = vis ? "inline" : "none";
        if(vis){
            el.setAttribute("transform",
                "translate(" + x + " " + y + ") rotate(" + ang + ") scale(0.7)");
        }
    };

    flecha("sp",  fluye,  706, 151, -90);
    flecha("ap",  fluye,  777, 133, abre ? -90 : 90);
    flecha("bp",  fluye,  777, 169, abre ? 90 : -90);
    flecha("rpu", cierra, 720, 115.5, 90);
    flecha("rpl", abre,   720, 191, 90);

}
