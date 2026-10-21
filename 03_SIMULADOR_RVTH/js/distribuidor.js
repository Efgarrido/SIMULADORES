/* =====================================================
   SIMULADOR RVTH
   DISTRIBUIDOR FINK V8 + RODETE FRANCIS

   Archivo: distribuidor.js

   ETAPA 2A — ACOPLAMIENTO MECÁNICO SERVOMOTOR–DISTRIBUIDOR

   Cadena cinemática (una sola rama continua):

     PISTÓN  (posición dada por regulador.js)
       ↓
     VÁSTAGO           (longitud fija)
       ↓
     PALANCA DE REENVÍO (pivote fijo, brazos a y b)
       ↓
     BIELA DE CONEXIÓN  (longitud fija)
       ↓
     OREJA DEL ANILLO   (radio fijo, solidaria al anillo)
       ↓
     ANILLO DE REGULACIÓN  → giro ψ
       ↓
     20 BIELAS Y PALANCAS   (modelo cinemático V8)
       ↓
     20 DIRECTRICES FINK V4 (modelo cinemático V8)

   El giro ψ del anillo se obtiene exclusivamente de
   la geometría del acoplamiento (intersección de
   circunferencias). No se interpola a partir de la
   apertura.

   Contiene:
   - Núcleo cinemático V8 (copia literal de
     soportes/V8_DESARROLLO/js/distribuidor.js,
     secciones 1 a 3)
   - Cinemática del acoplamiento servomotor–anillo
   - Actualización gráfica del distribuidor V8
   - Intensidad del agua de admisión
   - Giro visual del rodete Francis

   NO contiene:
   - Modelo dinámico
   - Regulador Watt
   - Válvula piloto
   - Servomotor (su posición la calcula regulador.js)
===================================================== */


/* =====================================================
   NÚCLEO CINEMÁTICO FINK V8

   Copia literal de las secciones 1–3 del módulo
   aprobado (CONFIG, geometría del perfil V4 y modelo
   cinemático). Se encapsula para no crear variables
   globales. El bloque CONFIG.animacion se conserva
   tal cual pero no se utiliza: el distribuidor no
   tiene dinámica propia en el simulador principal.
===================================================== */

const FinkV8 = (function(){

"use strict";

// ==========================================================
// 1. CONFIGURACIÓN GEOMÉTRICA
// ==========================================================
//
// Todas las dimensiones están en unidades del SVG.
// El rodete Francis no figura aquí: su geometría original
// se conserva en index.html y solo se lee su radio exterior
// para comprobar holguras.

const CONFIG = {

    perfil: {

        // Elemento <path> con las curvas originales del V4
        idPath: "perfil-fink-v4",

        // Eje de giro en coordenadas propias del perfil:
        // centro de la circunferencia inscrita máxima
        // (zona de mayor espesor, ≈ 41 % de la cuerda
        // desde el borde grueso).
        pivote: { x: 214.3, y: 243.6 },

        // Puntos de muestreo por curva de Bézier
        // (solo para cálculos de holgura).
        puntosPorCurva: 16
    },

    directrices: {

        numero: 20,

        // Escala uniforme del perfil (cuerda 529.3 → 132.3)
        escala: 0.25,

        // Radio de la circunferencia de pivotes
        radioPivotes: 340,

        // Posición angular del pivote k = 0
        anguloPrimerPivote: -90
    },

    palanca: {

        longitud: 60,

        // Dirección de la palanca medida en el sistema
        // del perfil V4: perpendicular a la línea
        // pivote–cola, hacia el lado exterior.
        // La palanca es solidaria del eje de la directriz.
        anguloEnPerfil: -40.994
    },

    biela: {

        longitud: 80
    },

    anillo: {

        // Radio de los pasadores biela–anillo
        radioPasadores: 440,

        // Ancho radial del cuerpo del anillo
        ancho: 24,

        // Posición del pasador k respecto a su pivote,
        // con el anillo en posición de cierre (ψ = 0)
        desfasePasador: 5.230,

        // Giro del anillo desde el cierre hasta la
        // apertura máxima (negativo = antihorario)
        giroApertura: -10.340,

        // Signo del producto vectorial (J − P) × (A − P)
        // que identifica la rama cinemática de montaje
        rama: 1,

        // Indicador de giro (en el sistema del anillo)
        anguloIndicador: -93.77
    },

    holguras: {

        // Mínimos de diseño usados en la verificación
        rodete: 8,
        cierre: 1
    },

    animacion: {

        // Velocidad máxima del mando (% por segundo):
        // recorrido completo en 8 s
        velocidadMaxima: 12.5,

        // Aceleración máxima (% / s²)
        aceleracionMaxima: 40,

        // Estado inicial definido: distribuidor cerrado
        mandoInicial: 0,

        // Paso máximo de integración (s)
        dtMaximo: 0.05
    }
};


// ==========================================================
// UTILIDADES MATEMÁTICAS
// ==========================================================

const GRADOS = 180 / Math.PI;

function rad(g) { return g / GRADOS; }

function deg(r) { return r * GRADOS; }

function cruz(ax, ay, bx, by) { return ax * by - ay * bx; }

function rotar(x, y, a) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { x: c * x - s * y, y: s * x + c * y };
}

function limitar(v, a, b) { return Math.min(b, Math.max(a, v)); }

function congelar(o) {
    Object.values(o).forEach(v => {
        if (v && typeof v === "object") { congelar(v); }
    });
    return Object.freeze(o);
}

congelar(CONFIG);


// ==========================================================
// 2. GEOMETRÍA DEL PERFIL FINK V4
// ==========================================================
//
// Se interpreta el atributo "d" del perfil original
// (comandos absolutos M, L, C, Z) y se muestrea cada
// curva de Bézier para obtener un contorno poligonal.
// Este contorno solo se usa para medir holguras y la
// abertura geométrica; el dibujo usa las curvas originales.

function muestrearPerfil(d, puntosPorCurva) {

    const fichas =
        d.match(/[MLCZmlcz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];

    const puntos = [];
    let i = 0;
    let cmd = null;
    let x = 0;
    let y = 0;

    const num = () => Number(fichas[i++]);

    while (i < fichas.length) {

        if (/[A-Za-z]/.test(fichas[i])) { cmd = fichas[i++]; }

        if (cmd === "M") {
            x = num(); y = num();
            puntos.push({ x, y });
            cmd = "L";
        }
        else if (cmd === "L") {
            x = num(); y = num();
            puntos.push({ x, y });
        }
        else if (cmd === "C") {
            const x1 = num(), y1 = num();
            const x2 = num(), y2 = num();
            const x3 = num(), y3 = num();
            for (let j = 1; j <= puntosPorCurva; j++) {
                const t = j / puntosPorCurva;
                const m = 1 - t;
                puntos.push({
                    x: m*m*m*x + 3*m*m*t*x1 + 3*m*t*t*x2 + t*t*t*x3,
                    y: m*m*m*y + 3*m*m*t*y1 + 3*m*t*t*y2 + t*t*t*y3
                });
            }
            x = x3; y = y3;
        }
        else if (cmd === "Z" || cmd === "z") {
            cmd = null;
        }
        else {
            throw new Error(
                "Comando de trayecto no admitido en el perfil V4: " + cmd
            );
        }
    }

    // Eliminar el punto final si repite el inicial
    const a = puntos[0];
    const b = puntos[puntos.length - 1];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-9) { puntos.pop(); }

    return puntos;
}


// Transformación del perfil para una directriz:
// p_mundo = P + R(rot) · escala · (p − pivote)

function transformarContorno(contornoLocal, pivote, rot) {

    const s = CONFIG.directrices.escala;
    const c = Math.cos(rot);
    const n = Math.sin(rot);

    return contornoLocal.map(p => {
        const lx = s * (p.x - CONFIG.perfil.pivote.x);
        const ly = s * (p.y - CONFIG.perfil.pivote.y);
        return {
            x: pivote.x + c * lx - n * ly,
            y: pivote.y + n * lx + c * ly
        };
    });
}


function puntoEnPoligono(p, poli) {
    let dentro = false;
    for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
        const a = poli[i];
        const b = poli[j];
        if ((a.y > p.y) !== (b.y > p.y) &&
            p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) {
            dentro = !dentro;
        }
    }
    return dentro;
}


function distanciaPuntoSegmento(p, a, b) {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const l2 = abx * abx + aby * aby;
    const t = l2 > 0
        ? limitar(((p.x - a.x) * abx + (p.y - a.y) * aby) / l2, 0, 1)
        : 0;
    return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}


function distanciaPuntosAContorno(puntos, contorno) {
    let minimo = Infinity;
    const n = contorno.length;
    for (const p of puntos) {
        for (let i = 0; i < n; i++) {
            const d = distanciaPuntoSegmento(p, contorno[i], contorno[(i + 1) % n]);
            if (d < minimo) { minimo = d; }
        }
    }
    return minimo;
}


// Holgura mínima entre dos contornos cerrados.
// Devuelve un valor negativo si se penetran.

function holguraEntreContornos(a, b) {
    if (a.some(p => puntoEnPoligono(p, b)) ||
        b.some(p => puntoEnPoligono(p, a))) {
        return -1;
    }
    return Math.min(
        distanciaPuntosAContorno(a, b),
        distanciaPuntosAContorno(b, a)
    );
}


// ==========================================================
// 3. MODELO CINEMÁTICO
// ==========================================================
//
// Variable principal: giro ψ del anillo de regulación
// respecto a la posición de cierre (grados).
//
// Cadena por cada directriz k (cuadrilátero articulado):
//
//   O (centro) ── anillo ── A_k (pasador biela–anillo)
//   A_k ── biela (longitud fija) ── J_k (pasador palanca–biela)
//   J_k ── palanca (longitud fija) ── P_k (eje fijo)
//
// J_k es la intersección de las circunferencias
// (P_k, palanca) y (A_k, biela). La rama se fija con el
// signo de (J − P) × (A − P), que solo puede cambiar al
// atravesar un punto muerto; por eso la solución es
// determinista y reversible (no depende de la historia).

function crearModelo(dPerfil) {

    const D = CONFIG.directrices;
    const N = D.numero;
    const paso = 360 / N;
    const L = CONFIG.palanca.longitud;
    const B = CONFIG.biela.longitud;
    const RA = CONFIG.anillo.radioPasadores;
    const rama = CONFIG.anillo.rama;
    const anguloPalancaPerfil = rad(CONFIG.palanca.anguloEnPerfil);

    const contornoLocal =
        muestrearPerfil(dPerfil, CONFIG.perfil.puntosPorCurva);

    const pivotes = [];
    for (let k = 0; k < N; k++) {
        const a = rad(D.anguloPrimerPivote + k * paso);
        pivotes.push({ x: D.radioPivotes * Math.cos(a), y: D.radioPivotes * Math.sin(a) });
    }


    // Mando normalizado (0–100 %) → giro del anillo (°).
    // Relación lineal: el mando representa la carrera
    // del anillo (equivalente a la carrera del servomotor
    // si la transmisión servomotor–anillo es lineal).

    function giroDesdeMando(mando) {
        return limitar(mando, 0, 100) / 100 * CONFIG.anillo.giroApertura;
    }

    function mandoDesdeGiro(psi) {
        return psi / CONFIG.anillo.giroApertura * 100;
    }


    // Posición angular (°) del pasador k para un giro ψ
    function anguloPasador(k, psi) {
        return D.anguloPrimerPivote + k * paso + CONFIG.anillo.desfasePasador + psi;
    }


    // Resolver un mecanismo individual
    function resolverMecanismo(k, psi) {

        const P = pivotes[k];
        const aA = rad(anguloPasador(k, psi));
        const A = { x: RA * Math.cos(aA), y: RA * Math.sin(aA) };

        const dx = A.x - P.x;
        const dy = A.y - P.y;
        const d = Math.hypot(dx, dy);

        // Existencia de solución real
        if (d > L + B || d < Math.abs(L - B) || d === 0) {
            return { valido: false, k, P, A };
        }

        const a = (L * L - B * B + d * d) / (2 * d);
        const h2 = L * L - a * a;
        const h = Math.sqrt(Math.max(0, h2));
        const bx = P.x + a * dx / d;
        const by = P.y + a * dy / d;
        const nx = -dy / d;
        const ny = dx / d;

        // Seleccionar la rama de montaje
        let J = { x: bx + h * nx, y: by + h * ny };
        if (Math.sign(cruz(J.x - P.x, J.y - P.y, dx, dy)) !== rama) {
            J = { x: bx - h * nx, y: by - h * ny };
        }

        // Ángulo de palanca y giro de la directriz (solidarios)
        const beta = Math.atan2(J.y - P.y, J.x - P.x);
        const rot = beta - anguloPalancaPerfil;

        // Ángulo de transmisión μ (entre palanca y biela, en J)
        const v1x = P.x - J.x, v1y = P.y - J.y;
        const v2x = A.x - J.x, v2y = A.y - J.y;
        const mu = deg(Math.acos(limitar(
            (v1x * v2x + v1y * v2y) / (L * B), -1, 1)));

        // Proximidad a la tangencia de las circunferencias
        // (h → 0 equivale a punto muerto)
        return {
            valido: true,
            k, P, A, J,
            beta: deg(beta),
            rotacion: deg(rot),
            mu,
            margenPuntoMuerto: Math.min(mu, 180 - mu),
            alturaInterseccion: h
        };
    }


    // Contorno transformado de la directriz k
    function contornoDirectriz(mec) {
        return transformarContorno(contornoLocal, mec.P, rad(mec.rotacion));
    }


    // Estado completo para un giro del anillo
    function estadoDesdeGiro(psi, opciones) {

        const conAbertura = !opciones || opciones.abertura !== false;
        const mecanismos = [];
        for (let k = 0; k < N; k++) { mecanismos.push(resolverMecanismo(k, psi)); }

        const valido = mecanismos.every(m => m.valido);
        const m0 = mecanismos[0];

        const estado = {
            valido,
            mando: mandoDesdeGiro(psi),
            giroAnillo: psi,
            mecanismos
        };

        if (valido) {
            estado.anguloDirectriz = m0.rotacion;
            estado.mu = m0.mu;
            estado.margenPuntoMuerto =
                Math.min(...mecanismos.map(m => m.margenPuntoMuerto));
            if (conAbertura) {
                estado.abertura = holguraEntreContornos(
                    contornoDirectriz(mecanismos[0]),
                    contornoDirectriz(mecanismos[1])
                );
            }
        }

        return estado;
    }


    function estadoDesdeMando(mando, opciones) {
        return estadoDesdeGiro(giroDesdeMando(mando), opciones);
    }


    // Valores de referencia de los extremos
    const cierre = estadoDesdeMando(0);
    const apertura = estadoDesdeMando(100);

    return {
        N, paso, pivotes, contornoLocal,
        giroDesdeMando, mandoDesdeGiro, anguloPasador,
        resolverMecanismo, contornoDirectriz,
        estadoDesdeGiro, estadoDesdeMando,
        referencia: {
            rotacionCierre: cierre.anguloDirectriz,
            rotacionApertura: apertura.anguloDirectriz,
            aberturaMaxima: apertura.abertura,
            holguraCierre: cierre.abertura
        }
    };
}


return {
    CONFIG,
    crearModelo,
    limitar
};

})();


/* =====================================================
   UBICACIÓN DEL CONJUNTO FINK V8 (aprobada en etapa 1)

   Debe coincidir con el atributo transform de
   <g id="turbinaHidraulicaV8"> en index.html.
   Origen interno del V8 (0, 0) = eje del rodete.
===================================================== */

const TURBINA_TX = 197;

const TURBINA_TY = 368;

const TURBINA_ESCALA = 0.32;


/* =====================================================
   GEOMETRÍA DEL ACOPLAMIENTO (etapa 2A)

   Coordenadas del SVG principal, salvo que se indique
   "local" (coordenadas internas del V8).
===================================================== */

/* Línea del vástago en el pistón (regulador.js usa y = 515) */
const ACOPLE_VASTAGO_Y = 515;

/* Palanca de reenvío */
const ACOPLE_PIVOTE_X = 320;
const ACOPLE_PIVOTE_Y = 595;
const ACOPLE_BRAZO_A = 80;       // pivote → D (vástago)
const ACOPLE_BRAZO_B = 47.5;     // pivote → G (biela de conexión)

/* Biela de conexión G → oreja */
const ACOPLE_BIELA = 123.0;

/* Oreja solidaria al anillo */
const ACOPLE_RADIO_OREJA_LOCAL = 560.9;

/*
   Calibración (únicos dos parámetros libres):
   longitud del vástago y posición angular de la oreja
   en el sistema del anillo, elegidas para que los
   topes del pistón coincidan con los extremos aprobados
   del V8:  0 % → ψ = 0°   y   100 % → ψ = −10.34°.
*/
const ACOPLE_VASTAGO = 468.3448;
const ACOPLE_ANGULO_OREJA = 95.5249;   // grados, sistema del anillo

/* Ramas de montaje (signo del producto vectorial) */
const ACOPLE_RAMA_D = 1;       // D por encima del pivote
const ACOPLE_RAMA_OREJA = -1;  // oreja en la parte inferior del anillo


/* =====================================================
   ELEMENTOS SVG
===================================================== */

const puntoD =
document.getElementById("puntoD");

const textoD =
document.getElementById("textoD");

const rotor =
document.getElementById("rotor-francis");

const palancaReenvio =
document.getElementById("palanca-reenvio");

const bielaConexion =
document.getElementById("biela-conexion");

const pasadorReenvioG =
document.getElementById("pasador-reenvio-g");


/* =====================================================
   MODELO Y VISTA V8
===================================================== */

const modeloFinkV8 =
FinkV8.crearModelo(
    document
    .getElementById(FinkV8.CONFIG.perfil.idPath)
    .getAttribute("d")
);


const vistaFinkV8 = (function(){

    /* Adaptación de crearVista().dibujar del V8:
       los elementos fijos ya están en index.html,
       aquí solo se actualiza lo que se mueve. */

    const N = modeloFinkV8.N;
    const pad = k => String(k + 1).padStart(2, "0");
    const fmt = v => v.toFixed(3);
    const porId = id => {
        const el = document.getElementById(id);
        if (!el) { throw new Error("Falta el elemento SVG #" + id); }
        return el;
    };

    const elementos = [];
    for (let k = 0; k < N; k++) {
        elementos.push({
            directriz: porId("directriz-" + pad(k)),
            palanca: porId("palanca-" + pad(k)),
            biela: porId("biela-" + pad(k)),
            pasadorPalanca: porId("pasador-palanca-" + pad(k)),
            pasadorAnillo: porId("pasador-anillo-" + pad(k))
        });
    }

    const anillo = porId("anillo-regulacion");
    const admision = porId("admision-agua-region");
    const ref = modeloFinkV8.referencia;
    const D = FinkV8.CONFIG.directrices;
    const px = FinkV8.CONFIG.perfil.pivote.x;
    const py = FinkV8.CONFIG.perfil.pivote.y;

    function dibujar(estado) {

        anillo.setAttribute("transform", `rotate(${fmt(estado.giroAnillo)})`);

        /* Intensidad del azul = abertura geométrica real
           entre directrices (cierre = 0, apertura máx. = 1) */
        const intensidad = FinkV8.limitar(
            (estado.abertura - ref.holguraCierre) /
            (ref.aberturaMaxima - ref.holguraCierre), 0, 1);
        admision.style.setProperty("--intensidad-admision", intensidad.toFixed(4));

        estado.mecanismos.forEach((m, k) => {

            const e = elementos[k];

            e.directriz.setAttribute("transform",
                `translate(${fmt(m.P.x)} ${fmt(m.P.y)}) ` +
                `rotate(${fmt(m.rotacion)}) scale(${D.escala}) ` +
                `translate(${-px} ${-py})`);

            e.palanca.setAttribute("x1", fmt(m.P.x));
            e.palanca.setAttribute("y1", fmt(m.P.y));
            e.palanca.setAttribute("x2", fmt(m.J.x));
            e.palanca.setAttribute("y2", fmt(m.J.y));

            e.biela.setAttribute("x1", fmt(m.J.x));
            e.biela.setAttribute("y1", fmt(m.J.y));
            e.biela.setAttribute("x2", fmt(m.A.x));
            e.biela.setAttribute("y2", fmt(m.A.y));

            e.pasadorPalanca.setAttribute("cx", fmt(m.J.x));
            e.pasadorPalanca.setAttribute("cy", fmt(m.J.y));

            e.pasadorAnillo.setAttribute("cx", fmt(m.A.x));
            e.pasadorAnillo.setAttribute("cy", fmt(m.A.y));
        });

        return intensidad;
    }

    return { dibujar };

})();


/* =====================================================
   INTERSECCIÓN DE DOS CIRCUNFERENCIAS

   Misma construcción que resolverMecanismo() del V8:
   la rama se fija con el signo de (X − C1) × (C2 − C1),
   que solo cambia al atravesar un punto muerto.
===================================================== */

function interseccionCircunferencias(c1, r1, c2, r2, rama){

    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const d = Math.hypot(dx, dy);

    if(d === 0 || d > r1 + r2 || d < Math.abs(r1 - r2)){
        return null;
    }

    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    const bx = c1.x + a * dx / d;
    const by = c1.y + a * dy / d;
    const nx = -dy / d;
    const ny = dx / d;

    let p = { x: bx + h * nx, y: by + h * ny };

    if(Math.sign((p.x - c1.x) * dy - (p.y - c1.y) * dx) !== rama){
        p = { x: bx - h * nx, y: by - h * ny };
    }

    return p;
}


/* =====================================================
   CINEMÁTICA DEL ACOPLAMIENTO

   Entrada: xPiston (extremo del vástago en el pistón).
   Salida: D, G, oreja y giro ψ del anillo.
===================================================== */

function resolverAcoplamiento(xPiston){

    const pivote = { x: ACOPLE_PIVOTE_X, y: ACOPLE_PIVOTE_Y };
    const extremoPiston = { x: xPiston, y: ACOPLE_VASTAGO_Y };

    /* 1. D: |D − pivote| = a  y  |D − pistón| = vástago */
    const D = interseccionCircunferencias(
        pivote, ACOPLE_BRAZO_A,
        extremoPiston, ACOPLE_VASTAGO,
        ACOPLE_RAMA_D
    );

    if(!D){ return null; }

    /* 2. G: punto de la palanca (rígida) a distancia b */
    const G = {
        x: pivote.x + (D.x - pivote.x) * ACOPLE_BRAZO_B / ACOPLE_BRAZO_A,
        y: pivote.y + (D.y - pivote.y) * ACOPLE_BRAZO_B / ACOPLE_BRAZO_A
    };

    /* 3. Oreja: |E − eje| = r_oreja  y  |E − G| = biela */
    const eje = { x: TURBINA_TX, y: TURBINA_TY };

    const E = interseccionCircunferencias(
        eje, TURBINA_ESCALA * ACOPLE_RADIO_OREJA_LOCAL,
        G, ACOPLE_BIELA,
        ACOPLE_RAMA_OREJA
    );

    if(!E){ return null; }

    /* 4. Giro del anillo */
    const psi =
    Math.atan2(E.y - eje.y, E.x - eje.x) * 180 / Math.PI
    -
    ACOPLE_ANGULO_OREJA;

    return { D, G, E, psi };
}


/* =====================================================
   ESTADO VISUAL
===================================================== */

let anguloRotor9A = 0;

let ultimoXPiston = null;

let ultimoEstadoDistribuidor = null;


/* =====================================================
   ACTUALIZAR DISTRIBUIDOR

   Llamada desde regulador.js con la misma posición
   del servomotor que mueve el pistón y la leva.

   Devuelve Dx, Dy (articulación vástago–palanca),
   que regulador.js usa para dibujar el vástago.
===================================================== */

function actualizarDistribuidor(movimientoServo){

    const xPiston =
    PISTON_X_BASE
    +
    movimientoServo;


    /* Sin cambio de posición: no se recalcula */
    if(
        ultimoEstadoDistribuidor !== null
        &&
        xPiston === ultimoXPiston
    ){
        return ultimoEstadoDistribuidor;
    }


    const acople =
    resolverAcoplamiento(
        xPiston
    );


    if(!acople){
        console.error("Acoplamiento servomotor–anillo sin solución geométrica para x =", xPiston);
        return ultimoEstadoDistribuidor;
    }


    const estado =
    modeloFinkV8.estadoDesdeGiro(
        acople.psi
    );


    if(!estado.valido){
        console.error("Distribuidor V8 sin solución geométrica para ψ =", acople.psi);
        return ultimoEstadoDistribuidor;
    }


    const intensidadAgua =
    vistaFinkV8.dibujar(
        estado
    );


    /* Palanca de reenvío, biela de conexión y D */

    palancaReenvio.setAttribute("x1", ACOPLE_PIVOTE_X);
    palancaReenvio.setAttribute("y1", ACOPLE_PIVOTE_Y);
    palancaReenvio.setAttribute("x2", acople.D.x);
    palancaReenvio.setAttribute("y2", acople.D.y);

    pasadorReenvioG.setAttribute("cx", acople.G.x);
    pasadorReenvioG.setAttribute("cy", acople.G.y);

    bielaConexion.setAttribute("x1", acople.G.x);
    bielaConexion.setAttribute("y1", acople.G.y);
    bielaConexion.setAttribute("x2", acople.E.x);
    bielaConexion.setAttribute("y2", acople.E.y);

    puntoD.setAttribute("cx", acople.D.x);
    puntoD.setAttribute("cy", acople.D.y);

    /* Etiqueta D: arriba y ligeramente a la derecha
       del punto (solo posición del texto). */
    textoD.setAttribute("x", acople.D.x + 7);
    textoD.setAttribute("y", acople.D.y - 13);


    ultimoXPiston = xPiston;

    ultimoEstadoDistribuidor = {

        Dx: acople.D.x,
        Dy: acople.D.y,

        G: acople.G,
        oreja: acople.E,

        anguloAnillo: estado.giroAnillo,

        anguloDirectriz:
        estado.anguloDirectriz
        -
        modeloFinkV8.referencia.rotacionCierre,

        abertura: estado.abertura,

        intensidadAgua: intensidadAgua

    };

    return ultimoEstadoDistribuidor;
}


/* =====================================================
   GIRO DEL RODETE FRANCIS (sin cambios)
===================================================== */

function actualizarRotorFrancis(dt){

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
