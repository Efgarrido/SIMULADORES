/* =====================================================
   SIMULADOR RVTH
   REGULADOR DE WATT, VARILLAJE A–B–C–D–E Y
   REALIMENTACIONES (servo piloto y servomotor principal)

   Archivo: watt_integracion.js
   Etapa 5 (17-oct-2026): Watt y palanca de entrada.
   Etapa 6 (17-oct-2026): realimentación interna del
   servo piloto.
   Etapa 7 (17-oct-2026): realimentación principal por
   leva; B pasa a ser un apoyo MÓVIL; letras A–F.
   Etapa 8 (17-oct-2026): REORGANIZACIÓN INTEGRAL.
     - Watt a la izquierda, sobre la turbina.
     - Piloto y servo piloto 195 px a la derecha y 40 px
       más abajo; distribuidora reflejada a la derecha
       del servomotor principal (dibujo en index.html).
     - Se ELIMINA el balancín oscilante: seguidor DIRECTO
       de rodillo, guiado verticalmente, y varilla V–B.
     - Leva rediseñada (rampa parabólica, ver § 3).
   Etapa 9 (17-oct-2026): A EN EL COLLAR DEL WATT.
     - Se eliminan la horquilla larga y la biela Q–A: A es
       un pasador en una oreja corta del collar (no gira)
       y entra en una RANURA del extremo de la palanca
       A–B–C (B es el pivote; la ranura absorbe el
       acortamiento A–B, < 0.1 px).
     - Watt desplazado a la derecha (eje x = 358), sobre la
       turbina; libera la zona izquierda para el gobernador
       y el limitador.
     - Palancas a la altura del collar (y = 138.75); piloto
       y servo piloto 28.75 px más abajo.
     - Elevación neta de la leva reducida a 3.09 px para
       conservar el margen de la piloto (ver § 4).

   ETAPA CINEMÁTICA. La elevación s del manguito es una
   variable de mando provisional; NO se calcula a partir
   de las RPM.

   NOMENCLATURA (puntos de articulación)
     A  unión de la palanca de entrada con la varilla
        que viene del collar del Watt
     B  APOYO MÓVIL de la palanca de entrada (corredera
        vertical fija), unido por la varilla V–B al
        seguidor de la leva
     C  articulación entre la palanca de entrada y la
        palanca flotante
     D  conexión a la válvula piloto (biela D–K)
     E  realimentación interna del servo piloto
        (biela E–R al vástago superior del servo piloto)
     F  rodillo del seguidor guiado apoyado en la leva
        (rotulo-f; r.seg.rodillo)
     G  unión del vástago del servomotor principal con
        el reenvío del Fink (rótulo visible en distribuidor.js)
   Los rótulos visibles no renombran la geometría interna:
   G corresponde a acople.D y a los elementos puntoD/textoD;
   acople.G es otro punto interno de la palanca de reenvío.
   b (minúscula) es el desplazamiento del servo piloto.

   1. REGULADOR DE WATT
      Módulo de soportes sin cambios (js/watt/), misma
      escala 0.25 px/mm y mismo giro visual. Origen
      (eje, pasadores superiores) en (358, 32) del grupo
      #conjunto-mecanico. Su base (y = 199.5) queda sobre
      el contorno de la turbina.

   2. DISPOSICIÓN ARTICULADA (px locales, referencia)
        A (371.25, 138.75)  B (625, 138.75)  C (908, 138.75)
        D (943, 138.75)     E (1020, 138.75)
        K: pomo de la piloto, eje x = 943, y0 = 157.75
        R: vástago superior del servo piloto, x = 1020,
           y0 = 170.75
      a) Palanca de entrada A–B–C (rígida, recta, pivote
         en B, ranura en A):
           A = pasador del collar (x fija, y del collar)
           C = B + BC·(B − A)/|B − A|,  BC = 283
           μ = AC/AB = 536.75/253.75 = 2.115 en la
           referencia (provisional)
      b) Palanca flotante C–D–E (sin cambios):
           D = C + λ·(E − C), λ = 35/112 = 0.3125
      c) Realimentación principal (directa):
           vástago → leva solidaria → rodillo r = 5 px →
           seguidor guiado en vertical (eje x = 625) →
           pasador V → varilla V–B (longitud fija) → B
           (corredera vertical fija, mismo eje).
         La guía fija del seguidor absorbe la reacción
         lateral de la leva. El contacto se mantiene por
         un resorte de compresión entre la guía y el
         collar del seguidor, más el peso del varillaje.
         SIMPLIFICACIÓN: las fuerzas no se modelan; solo
         se comprueba la geometría (cierre por fuerza
         supuesto).

      Grados de libertad: s fija A (pasador del collar en
      la ranura); la
      posición del pistón fija la leva (traslación y
      giro del cilindro), el rodillo, V y B; b fija E.
      Sin restricciones redundantes.

      Sentidos (realimentación negativa en ambos lazos):
        collar ↑ → A ↑ → C ↓ → D ↓ → piloto ↓ (cierre)
          lazo interno: servo piloto ↑ → E ↑ → D ↑
          lazo principal: pistón ← (cierra) → la leva se
            desplaza a la izquierda, el rodillo sube por
            la rampa → V ↑ → B ↑ → C ↑ → D ↑ (abre)
        Con el collar quieto, el pistón se detiene donde
        B compensa a A (piloto y distribuidora en neutro).

   3. LEVA (provisional)
      Rampa ASCENDENTE hacia la derecha, solidaria al
      vástago: se traslada con el pistón y gira con el
      cilindro articulado (hasta −0.84° en 0 %).
      Con el seguidor directo, el giro del cilindro baja
      la leva ≈ 5 px bajo el rodillo (x = 625) al ir de
      70 % a 0 %; una rampa RECTA compatible con el
      recorrido de la piloto (≈ 4 px) daría
      realimentación POSITIVA cerca del cierre. Adaptación
      mínima: perfil PARABÓLICO, h(u) = c0 + c1·(u − uc)
      + c2·(u − uc)², cuya curvatura compensa el giro;
      la elevación neta del rodillo resulta casi lineal
      con la posición del pistón (≈ 3.09 px de 0 a 100 %).
      El contacto se calcula con la orientación real del
      cilindro y el radio del rodillo (curva paralela).

   4. RELACIONES (la palanca no está a escala)
        collar 0.25 px/mm · piloto 20 px/mm ·
        servo piloto 16 px = 1.926 mm
      Topes: en el intervalo útil del manguito, para
      cualquier b y cualquier posición del pistón,
      |x_piloto| < 0.5 mm (verificado numéricamente).
===================================================== */


/* =====================================================
   PARÁMETROS DEL MONTAJE (gráficos, en px locales)
===================================================== */

const WATT_ESCALA = 0.25;                  // px por mm del módulo (gráfica)

const WATT_VELOCIDAD_VISUAL =              // 90 rpm de animación a velocidad nominal del eje
RW.GEOMETRIA.giro.velocidadVisualInicial;  // misma escala visual que Francis: 25 % (etapa 22; antes 1:10)

const MANGUITO_REFERENCIA = 49;            // mm, posición de montaje

const VARILLAJE = {

    xA: 371.25,                // A: pasador en la oreja del collar (referencia)                // A: pasador en la oreja del collar (referencia)
    xB: 625,                   // B: eje de su corredera vertical (= eje del seguidor)
    xC: 908,                   // C
    yPalanca: 138.75,             // altura de las palancas en la referencia
    lambdaD: 35 / 112,         // D en la palanca flotante C–D–E
    largoCE: 112,              // C–E
    xK: 943,                   // eje del vástago de la piloto
    yK0: 157.75,                  // pasador K con la piloto en neutro
    xR: 1020,                  // eje del servo piloto (= eje de la distribuidora)
    yR0: 170.75,                  // pasador R (vástago superior) con b = 0
    pxPorMmPiloto: 20,         // escala didáctica del carrete piloto
    pxTopeServoPiloto: 16,     // 16 px = CARRETE_MAX_APERTURA
    oreja: 13.25               // eje del Watt → pasador A (oreja del collar)

};

VARILLAJE.largoAB = VARILLAJE.xB - VARILLAJE.xA;   // solo referencia (A desliza en la ranura)
VARILLAJE.largoBC = VARILLAJE.xC - VARILLAJE.xB;
VARILLAJE.largoAC = VARILLAJE.xC - VARILLAJE.xA;
VARILLAJE.mu      = VARILLAJE.largoAC / VARILLAJE.largoAB;

/* Eje del Watt (A queda en la oreja de su collar) */

const WATT_ORIGEN = {
    x: 358,
    y: 32
};

/* Leva y seguidor directo.
   Coordenadas u de la leva: marco del cilindro SIN girar
   con movimientoServo = 0 (pistón en 75 %). */

const LEVA = {
    xSeguidor: 625,        // eje vertical del seguidor (guía fija)
    yBase: 512.5,          // cara superior del vástago (vástago de 5 px)
    radioRodillo: 5,
    uIzq: 604,             // extremos útiles de la leva
    uDer: 676,
    uc: 638.5,             // centro de la parábola
    c0: 6.2001,            // altura en uc [px] (mínimo del perfil ≈ 5 px)
    c1: 0.125419,          // pendiente en uc (sube a la derecha)
    c2: 0.0032767,         // curvatura [1/px] (compensa el giro)
    vastagoSeguidor: 80,   // centro del rodillo → pasador V
    collar: 9,             // centro del rodillo → collar del resorte
    guiaSup: 428,          // guía fija del seguidor (y)
    guiaInf: 446
};

function alturaLeva(u){
    const d = u - LEVA.uc;
    return LEVA.c0 + LEVA.c1 * d + LEVA.c2 * d * d;
}

function pendienteLeva(u){
    return LEVA.c1 + 2 * LEVA.c2 * (u - LEVA.uc);
}

function xPistonDesdePosicion(p){
    return PISTON_X_BASE + (p - SERVO_APERTURA_REFERENCIA) * SERVO_X_POR_PORCENTAJE;
}


/* Ángulo del cilindro articulado para una posición del
   pistón (misma cinemática que servomotor.js) */

function anguloCilindro(p){

    const ac =
    resolverAcoplamiento(
        xPistonDesdePosicion(p)
    );

    if(!ac){ return 0; }

    return Math.atan2(
        SERVO_PIVOTE_Y - ac.D.y,
        SERVO_PIVOTE_X - ac.D.x
    ) * 180 / Math.PI;

}

function girarCilindro(pt, anguloGrados){

    const a = anguloGrados * Math.PI / 180;
    const dx = pt.x - SERVO_PIVOTE_X;
    const dy = pt.y - SERVO_PIVOTE_Y;

    return {
        x: SERVO_PIVOTE_X + dx * Math.cos(a) - dy * Math.sin(a),
        y: SERVO_PIVOTE_Y + dx * Math.sin(a) + dy * Math.cos(a)
    };

}


/* Punto del perfil (u) y centro del rodillo tangente en
   él, en coordenadas globales, para la posición p */

function puntoLeva(u, p, a){

    const dxp = xPistonDesdePosicion(p) - PISTON_X_BASE;
    const h = alturaLeva(u);
    const m = pendienteLeva(u);
    const L = Math.hypot(1, m);

    /* Normal exterior (hacia arriba) del perfil
       y = yBase − h(u): (−h', −1)/L */

    const q = { x: u + dxp, y: LEVA.yBase - h };
    const c = {
        x: q.x - LEVA.radioRodillo * m / L,
        y: q.y - LEVA.radioRodillo / L
    };

    return {
        contacto: girarCilindro(q, a),
        centro: girarCilindro(c, a)
    };

}


/* Seguidor directo: el centro del rodillo está sobre el
   eje x = xSeguidor y sobre la curva paralela al perfil
   (distancia rr). Se busca u por bisección (x del centro
   crece con u). */

function resolverSeguidor(p){

    const a = anguloCilindro(p);

    let lo = LEVA.uIzq - 30;
    let hi = LEVA.uDer + 30;

    for(let k = 0; k < 48; k++){

        const m = (lo + hi) / 2;

        if(puntoLeva(m, p, a).centro.x < LEVA.xSeguidor){ lo = m; }else{ hi = m; }

    }

    const u = (lo + hi) / 2;
    const r = puntoLeva(u, p, a);

    const rodillo = { x: LEVA.xSeguidor, y: r.centro.y };

    return {
        u,
        angulo: a,
        rodillo,
        contacto: r.contacto,
        dentroPerfil: u >= LEVA.uIzq && u <= LEVA.uDer,
        anguloPresion: Math.atan(Math.abs(pendienteLeva(u))) * 180 / Math.PI + Math.abs(a),
        V: { x: LEVA.xSeguidor, y: rodillo.y - LEVA.vastagoSeguidor }
    };

}


/* Collar del Watt en coordenadas locales */

function puntoSalidaWatt(s){

    const yMm =
    RW.Cinematica.LIMITES.yPMin
    +
    s
    +
    RW.GEOMETRIA.salida.dyDesdePivote;

    return {
        x: WATT_ORIGEN.x + WATT_ESCALA * RW.GEOMETRIA.salida.x,
        y: WATT_ORIGEN.y - WATT_ESCALA * yMm
    };

}


/* Longitudes FIJAS de las bielas (montaje en la referencia) */

VARILLAJE.bielaQA = 0;   // PROPUESTA: sin biela Q–A (A en el collar)

VARILLAJE.bielaDK =
VARILLAJE.yK0 - VARILLAJE.yPalanca;

VARILLAJE.bielaER =
VARILLAJE.yR0 - VARILLAJE.yPalanca;

VARILLAJE.varillaVB =
resolverSeguidor(APERTURA_BASE).V.y - VARILLAJE.yPalanca;


/* =====================================================
   CINEMÁTICA COMPLETA DEL VARILLAJE
===================================================== */

function interseccionWatt(c1, r1, c2, r2, elegir){

    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const d = Math.hypot(dx, dy);

    if(!(d > 0) || d > r1 + r2 || d < Math.abs(r1 - r2)){
        return null;
    }

    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    const mx = c1.x + a * dx / d;
    const my = c1.y + a * dy / d;

    const p1 = { x: mx - h * dy / d, y: my + h * dx / d };
    const p2 = { x: mx + h * dy / d, y: my - h * dx / d };

    return elegir(p1, p2) ? p1 : p2;

}


/* s [mm], b [m] (+ abajo = abre), p [%] posición del
   pistón principal. Devuelve null si no hay solución. */

function resolverVarillaje(s, b, p, sinLimitador, yL1Forzada, yd){

    const V = VARILLAJE;

    /* Realimentación principal: leva → seguidor → V */

    const seg = resolverSeguidor(p);

    if(!seg){ return null; }

    /* B en su corredera vertical (x fija), a varillaVB
       de V, por encima */

    const dxB = V.xB - seg.V.x;

    if(Math.abs(dxB) > V.varillaVB){ return null; }

    /* Etapa 19: yd = desplazamiento del émbolo receptor del
       amortiguador de compensación respecto a su cilindro, que
       va intercalado en la varilla V–B (0 en régimen permanente
       y en todos los cálculos estáticos del montaje). */

    const B = {
        x: V.xB,
        y: seg.V.y - Math.sqrt(V.varillaVB ** 2 - dxB ** 2) + (yd || 0)
    };

    /* A: a bielaQA de Q (collar) y a largoAB de B,
       a la izquierda de B y por encima de Q */

    const salida = puntoSalidaWatt(s);

    /* PROPUESTA: A es un pasador fijo a la oreja del
       collar (solo se mueve en vertical con s) y entra en
       una RANURA del extremo de la palanca; B es el pivote
       de la palanca. C queda a largoBC de B en la recta A–B. */

    const A = { x: V.xA, y: salida.y };
    const Q = A;

    const dAB = Math.hypot(B.x - A.x, B.y - A.y);

    const Cent = {
        x: B.x + V.largoBC * (B.x - A.x) / dAB,
        y: B.y + V.largoBC * (B.y - A.y) / dAB
    };

    /* Etapa 16: LIMITADOR DE APERTURA (selección de mínimo en C).
       El empujador de la palanca limitadora L1–L2–L3 solo puede
       empujar C hacia el cierre (y SVG mayor). La palanca flotante
       toma C_sal = el más cerrado de C_ent (regulador) y H
       (limitador). Ver LIMITADOR más abajo. */

    let C = Cent, lim = null;

    if(!sinLimitador){
        lim = yL1Forzada !== undefined
            ? geometriaLimitador(B, yL1Forzada)
            : puntoEmpujadorLimitador(B, limiteAperturaPct);
        if(lim.H.y > Cent.y){
            C = { x: lim.H.x, y: lim.H.y };   // C_sal llevado por el empujador
        }
    }

    /* Realimentación interna: R en el vástago superior
       del servo piloto; E a largoCE de C y a bielaER de R */

    const R = {
        x: V.xR,
        y: V.yR0 + V.pxTopeServoPiloto * b / CARRETE_MAX_APERTURA
    };

    const E = interseccionWatt(
        C, V.largoCE, R, V.bielaER,
        (p1, p2) => p1.y < p2.y
    );

    if(!E){ return null; }

    const D = {
        x: C.x + V.lambdaD * (E.x - C.x),
        y: C.y + V.lambdaD * (E.y - C.y)
    };

    const dxK = V.xK - D.x;

    if(Math.abs(dxK) > V.bielaDK){ return null; }

    const K = {
        x: V.xK,
        y: D.y + Math.sqrt(V.bielaDK ** 2 - dxK ** 2)
    };

    const carreteMm =
    (V.yK0 - K.y) / V.pxPorMmPiloto;

    return {
        s, b, p, salida, Q, A, B, C, D, E, R, K, seg, yd: yd || 0,
        Cent, lim, limitando: C !== Cent,
        carretePilotoM: carreteMm / 1000
    };

}


/* Posición del pistón en equilibrio (piloto centrada con
   b = 0) para una s dada: bisección (relación monótona) */

function pistonEquilibrio(s){

    let lo = 0, hi = 100;

    const xp = p => {
        const r = resolverVarillaje(s, 0, p, true);   // geometría base (sin limitador)
        return r ? r.carretePilotoM : NaN;
    };

    const s0 = xp(0), s1 = xp(100);

    if(s0 > 0 && s1 > 0){ return 100; }
    if(s0 < 0 && s1 < 0){ return 0; }

    for(let k = 0; k < 70; k++){

        const m = (lo + hi) / 2;

        if((xp(m) > 0) === (s0 > 0)){ lo = m; }else{ hi = m; }

    }

    return (lo + hi) / 2;

}


/* Intervalo útil del manguito: s para la que el pistón
   en equilibrio llega a 100 % (s mínima) o a 0 % (s
   máxima) */

function buscarSParaPiston(pObjetivo){

    let lo = RW.Cinematica.LIMITES.sMin;
    let hi = RW.Cinematica.LIMITES.sMax;

    /* pistonEquilibrio decrece con s */

    for(let k = 0; k < 60; k++){

        const m = (lo + hi) / 2;

        if(pistonEquilibrio(m) > pObjetivo){ lo = m; }else{ hi = m; }

    }

    return (lo + hi) / 2;

}

const MANGUITO_MIN_UTIL =
buscarSParaPiston(100 - 1e-6);

const MANGUITO_MAX_UTIL =
buscarSParaPiston(1e-6);


/* =====================================================
   MANGUITO EN REPOSO (etapa 10, 17-oct-2026)

   El Watt físico aún no existe: s sigue siendo un mando
   provisional. Con el pistón CERRADO (p = 0) y el servo
   piloto centrado (b = 0), la única s para la que la
   piloto queda en NEUTRO (sin orden de apertura ni de
   cierre) es la que resuelve la propia geometría del
   varillaje: x_piloto(s, 0, 0) = 0. Se obtiene por
   bisección, sin forzar la piloto. Coincide con el
   extremo superior del intervalo útil (≈ 63.0 mm).

   INCOMPATIBILIDAD DOCUMENTADA: el reposo físico del
   Watt a 0 rpm sería el collar en su tope INFERIOR
   (s = 0). Con s = 0, p = 0 y b = 0 la geometría
   actual pide APERTURA máxima (piloto en su tope), es
   decir, el regulador abriría la turbina parada. Ver
   el informe de la etapa 10: la adaptación mínima es
   el limitador de apertura en 0 % (o la falta de
   presión de aceite) en el arranque.
   MANGUITO_REFERENCIA (49 mm) sigue siendo solo la
   referencia de MONTAJE (equilibrio en marcha).
===================================================== */

function pilotoEnReposo(s){
    const r = resolverVarillaje(s, 0, 0, true);
    return r ? r.carretePilotoM : NaN;
}

const MANGUITO_REPOSO = (function(){

    let lo = MANGUITO_MIN_UTIL;      // piloto > 0 (abre)
    let hi = RW.Cinematica.LIMITES.sMax;

    for(let k = 0; k < 80; k++){
        const m = (lo + hi) / 2;
        if(pilotoEnReposo(m) > 0){ lo = m; }else{ hi = m; }
    }

    return hi;                       // piloto ≤ 0 (nunca abre)

})();


/* =====================================================
   LIMITADOR DE APERTURA
   (etapa 16, 18-oct-2026; consigna desde la etapa 18)

   Mecanismo de la especificación conjunta (palanca limitadora
   paralela a A–B–C, empujador de un solo sentido sobre C y
   selección de mínimo), dibujado POR ENCIMA de A–B–C:
     L1  pivote con ranura, en una guía vertical fija (x = 470);
         su altura fija el límite de apertura p_lim
     L2  pasador en una prolongación de la varilla V–B, a DY_LIM
         px por encima de B: recibe solo la posición del pistón
     L3  extremo del lado de C (a BC de L2, como C respecto a B)
     H   extremo inferior del empujador L3→H (longitud DY_LIM),
         apoyado sobre el pasador C_sal: solo empuja hacia abajo
         (cierre)
   La altura de L1 se calcula para que, con el pistón en p_lim,
   H coincida con la posición de C que deja la piloto en neutro
   (b = 0). Así, al alcanzar p_lim la piloto vuelve a neutro por
   las realimentaciones normales: no hay saturación ni cilindro
   empujando contra un tope.

   CONSIGNA (etapa 18, 18-oct-2026): mando LÍMITE del modo
   MANUAL / AUTO (watt_resorte_integracion.js). En MANUAL, + y −
   mueven L1 directamente; en AUTO, la secuencia de arranque lo
   abre con una rampa lenta y lo libera cuando el regulador toma
   el control. Sustituye a la leva de arranque provisional de la
   etapa 16 (p_lim ligado al ajuste a), que se elimina.
===================================================== */

const LIMITADOR = {
    xL1: 470,              // px: guía vertical de L1 (fuera del barrido del Watt)
    dy: 28                 // px: separación vertical palanca limitadora – A–B–C
};

let limiteAperturaPct =
0;                         // % (lo actualiza watt_resorte_integracion.js)

function geometriaLimitador(B, yL1){
    const L1 = { x: LIMITADOR.xL1, y: yL1 };
    const L2 = { x: B.x, y: B.y - LIMITADOR.dy };
    const d = Math.hypot(L2.x - L1.x, L2.y - L1.y);
    const L3 = {
        x: L2.x + VARILLAJE.largoBC * (L2.x - L1.x) / d,
        y: L2.y + VARILLAJE.largoBC * (L2.y - L1.y) / d
    };
    return { L1, L2, L3, H: { x: L3.x, y: L3.y + LIMITADOR.dy } };
}

/* Tabla p_lim → altura de L1 (geometría exacta, bisección) */

const TABLA_L1 = (function(){

    /* Para cada p_lim se busca la altura de L1 con la que,
       estando el empujador en contacto (C_sal = H), la piloto
       queda exactamente en neutro con b = 0 y el pistón en p_lim.
       Se evalúa con s = 0 (el regulador pide abrir, de modo que
       el empujador es el que manda). */

    const tabla = [];

    for(let i = 0; i <= 200; i++){

        const pl = i / 2;
        const B0 = resolverVarillaje(0, 0, pl, true).B;
        let a = B0.y - 150, b = B0.y + 150;     // x_piloto crece con la altura (y) de L1

        for(let k = 0; k < 90; k++){
            const m = (a + b) / 2;
            const r = resolverVarillaje(0, 0, pl, false, m);
            if(r.carretePilotoM > 0){ b = m; }else{ a = m; }
        }

        tabla.push(a);                          // lado con x_piloto ≤ 0 (nunca pide abrir)
    }

    return tabla;

})();

function alturaL1(pLim){
    const u = Math.max(0, Math.min(200, pLim * 2));
    const i = Math.min(199, Math.floor(u)), fr = u - i;
    return TABLA_L1[i] + fr * (TABLA_L1[i + 1] - TABLA_L1[i]);
}

function puntoEmpujadorLimitador(B, pLim){
    return geometriaLimitador(B, alturaL1(pLim));
}


/* =====================================================
   AMORTIGUADOR DE COMPENSACIÓN (REALIMENTACIÓN TRANSITORIA)
   (etapa 19, 18-oct-2026)

   Pieza nueva intercalada en la varilla V–B (principio del
   amortiguador de compensación de los reguladores mecánicos):
     - CILINDRO RECEPTOR en la varilla V–B: su cuerpo va unido al
       tramo inferior (V, seguidor de la leva); su émbolo, centrado
       por dos resortes, al tramo superior (B). Desplazamiento
       relativo del émbolo: yd (px, + hacia abajo como y SVG).
     - CILINDRO PRIMARIO fijo al bastidor, junto a la varilla; su
       émbolo lo mueve una escuadra solidaria del tramo inferior
       (V). Área primaria = G × área receptora.
     - TUBO de aceite entre ambos y VÁLVULA DE AGUJA que comunica
       la cámara receptora con el depósito.
   Funcionamiento: cuando el pistón principal se mueve, V se mueve
   ΔV; el primario desplaza G·ΔV de volumen receptor y el émbolo
   receptor se separa yd = G·ΔV de su cuerpo: B se mueve
   (1 + G)·ΔV en el mismo sentido que la realimentación rígida.
   Los resortes devuelven el émbolo al centro a través de la
   válvula de aguja con la constante de tiempo Td:
        dyd/dt = G · dV/dt − yd / Td
   En régimen permanente yd = 0: la realimentación rígida (y el
   estatismo permanente) no cambian. Topes del émbolo: ±ydMax.
   Integración exacta por paso: yd ← yd·e^(−dt/Td) + G·ΔV.
===================================================== */

const amortiguador = {
    G: 4,                  // relación de áreas primario / receptor (2 × el mínimo estable, ver informe)
    Td: 6,                 // s, constante de la válvula de aguja (centro del intervalo estable 3–10 s)
    ydMax: 14,             // px, carrera del émbolo receptor a cada lado
    yd: 0,                 // estado
    vAnterior: null        // y de V en el paso anterior
};

function avanzarAmortiguador(dt){
    const vy = resolverSeguidor(posicionPiston).V.y;
    if(amortiguador.vAnterior === null){ amortiguador.vAnterior = vy; }
    const dV = vy - amortiguador.vAnterior;
    amortiguador.vAnterior = vy;
    const yd = amortiguador.yd * Math.exp(-dt / amortiguador.Td) + amortiguador.G * dV;
    amortiguador.yd = Math.max(-amortiguador.ydMax, Math.min(amortiguador.ydMax, yd));
}

function reiniciarAmortiguador(){
    amortiguador.yd = 0;
    amortiguador.vAnterior = null;
}


/* =====================================================
   ADAPTADOR DEL MÓDULO (sin segundo bucle)
===================================================== */

const animadorWatt = (function(){

    const estado = {
        s: 0,                       // etapa 12: reposo físico del manguito (tope inferior)
        fase: 0,
        giro: true,
        velocidadVisual: WATT_VELOCIDAD_VISUAL,
        t: 0
    };

    const suscriptores = [];

    let ultimo =
    RW.Cinematica.resolver(0);

    function notificar(){
        for(const f of suscriptores){ f(ultimo, estado); }
    }

    return {

        estado,

        ultimoEstado: () => ultimo,

        suscribir(f){
            suscriptores.push(f);
            if(ultimo){ f(ultimo, estado); }
        },

        fijarPosicion(s){
            let nuevo;
            try{
                nuevo = RW.Cinematica.resolver(s);
            }catch(err){
                console.warn("[Watt] posición rechazada:", err.message);
                return false;
            }
            ultimo = nuevo;
            estado.s = nuevo.s;
            notificar();
            return true;
        },

        avanzarGiro(dt){
            estado.fase =
            (estado.fase + 2 * Math.PI * estado.velocidadVisual / 60 * dt)
            %
            (2 * Math.PI);
        }

    };

})();


RW.Regulador =
RW.crearInterfaz(animadorWatt);


/* =====================================================
   ESCENA SVG DEL WATT (dibujo.js del módulo)
===================================================== */

/* Etapa 12 (18-oct-2026): REGULADOR CON RESORTE. La escena
   la crea js/watt_resorte/dibujo_resorte.js, que usa el
   mismo dibujo.js del Watt para brazos, bolas y manguito y
   añade resorte, asiento, husillo hueco y cadena de ajuste.
   Misma posición y escala (grupo #watt-regulador). El
   tornillo y el poste superiores quedan recortados por el
   encuadre (aceptado por el usuario). */

const escenaWatt =
RW.DibujoResorte.crearEscena(
    document.getElementById("watt-dibujo")
);

/* Un único collar y un único punto A: los del varillaje
   (collar-toma, pasador-a). Se ocultan el collar, la regla
   y las flechas propios del módulo, y sus rótulos. */

["rr-salida", "rr-regla", "rr-fuerzas"].forEach(function(id){
    const n = document.getElementById(id);
    if(n){ n.style.display = "none"; }
});

document
.querySelectorAll("#watt-dibujo text")
.forEach(function(t){ t.style.display = "none"; });

/* En el simulador no se muestran las cotas ni el
   rótulo de salida del módulo. */

escenaWatt.cotas.style.display = "none";

escenaWatt.salida.style.display = "none";


/* =====================================================
   FUENTE ÚNICA DE MANDO Y POSICIÓN DE LA PILOTO

   La piloto se obtiene SIEMPRE de la geometría con la s
   del manguito, la b del servo piloto y la posición del
   pistón principal (leva). modelo.js la pide en cada
   paso de integración.
===================================================== */

let manguitoActual =
0;                          // etapa 12: s sale del regulador dinámico

let estadoVarillaje =
resolverVarillaje(0, 0, posicionPiston);

/* Desplazamiento de la piloto que PIDE la geometría,
   antes de la limitación numérica a ±carreraCarretePilotoMax
   (etapa 12: se muestra y se registra; la limitación NO es
   una solución mecánica). */

let carretePilotoSolicitado =
0;


function calcularCarretePilotoVarillaje(b){

    const r =
    resolverVarillaje(manguitoActual, b, posicionPiston, false, undefined, amortiguador.yd);

    if(!r){
        console.error("Varillaje A–F sin solución para s =", manguitoActual, "b =", b, "pistón =", posicionPiston);
        return carretePilotoVarillaje;
    }

    estadoVarillaje = r;

    carretePilotoSolicitado =
    r.carretePilotoM;

    const x =
    Math.abs(r.carretePilotoM) < 1e-9
    ?
    0
    :
    r.carretePilotoM;

    /* Tope físico del carrete (por diseño no se alcanza
       dentro del intervalo útil) */

    carretePilotoVarillaje =
    Math.max(
        -PILOTO.carreraCarretePilotoMax,
        Math.min(PILOTO.carreraCarretePilotoMax, x)
    );

    return carretePilotoVarillaje;

}


RW.Regulador.alCambiar(function(sal){

    manguitoActual =
    sal.desplazamiento;

    calcularCarretePilotoVarillaje(
        posicionServoPiloto
    );

});


/* Control provisional: fija s dentro del intervalo útil */

function fijarManguito(s){

    const sLim =
    Math.max(
        MANGUITO_MIN_UTIL,
        Math.min(Math.max(MANGUITO_MAX_UTIL, MANGUITO_REPOSO), s)
    );

    return RW.Regulador.fijarPosicion(sLim);

}


/* =====================================================
   DIBUJO DEL COLLAR, VARILLAJE, LEVA Y SEGUIDOR
===================================================== */

const porIdVarillaje = id => document.getElementById(id);

const elVarillaje = {
    collar:    porIdVarillaje("collar-toma"),
    horquilla: porIdVarillaje("horquilla-toma"),
    pinQ:      porIdVarillaje("pasador-q"),
    bielaQA:   porIdVarillaje("biela-qa"),
    palancaEnt:porIdVarillaje("palanca-entrada"),
    palancaFl: porIdVarillaje("palanca-flotante"),
    pinA:      porIdVarillaje("pasador-a"),
    pinB:      porIdVarillaje("pasador-b"),
    pinC:      porIdVarillaje("pasador-c"),
    pinD:      porIdVarillaje("pasador-d"),
    pinE:      porIdVarillaje("pasador-e"),
    bielaDK:   porIdVarillaje("biela-ck"),
    pinK:      porIdVarillaje("pasador-k"),
    bielaER:   porIdVarillaje("biela-dr"),
    pinR:      porIdVarillaje("pasador-r"),
    varillaVB: porIdVarillaje("varilla-vb"),
    /* etapa 19: amortiguador de compensación */
    amVastagoSup: porIdVarillaje("amort-vastago-sup"),
    amCuerpo:     porIdVarillaje("amort-cuerpo"),
    amAceite:     porIdVarillaje("amort-aceite"),
    amEmbolo:     porIdVarillaje("amort-embolo"),
    amResSup:     porIdVarillaje("amort-resorte-sup"),
    amResInf:     porIdVarillaje("amort-resorte-inf"),
    amTubo:       porIdVarillaje("amort-tubo"),
    amTuboBorde:  porIdVarillaje("amort-tubo-borde"),
    amEmboloPri:  porIdVarillaje("amort-embolo-primario"),
    amVastagoPri: porIdVarillaje("amort-vastago-primario"),
    amEscuadra:   porIdVarillaje("amort-escuadra"),
    pinV:      porIdVarillaje("pasador-v"),
    vastagoSeg:porIdVarillaje("vastago-seguidor"),
    collarSeg: porIdVarillaje("collar-seguidor"),
    resorte:   porIdVarillaje("resorte-seguidor"),
    rodillo:   porIdVarillaje("rodillo-seguidor"),
    leva:      porIdVarillaje("leva-realimentacion"),
    levaPerfil:porIdVarillaje("leva-perfil"),
    rotA:      porIdVarillaje("rotulo-a"),
    rotB:      porIdVarillaje("rotulo-b"),
    rotC:      porIdVarillaje("rotulo-c"),
    rotD:      porIdVarillaje("rotulo-d"),
    rotE:      porIdVarillaje("rotulo-e"),
    rotF:      porIdVarillaje("rotulo-f"),
    rotL1:     porIdVarillaje("rotulo-l1"),
    rotL2:     porIdVarillaje("rotulo-l2"),
    rotL3:     porIdVarillaje("rotulo-l3"),
    lectura:   porIdVarillaje("lectura-manguito"),
    /* etapa 16: limitador de apertura */
    limExtVB:     porIdVarillaje("lim-extension-vb"),
    limPalanca:   porIdVarillaje("lim-palanca"),
    limRanura:    porIdVarillaje("lim-ranura"),
    limEmpujador: porIdVarillaje("lim-empujador"),
    limPinL1:     porIdVarillaje("lim-pasador-l1"),
    limPinL2:     porIdVarillaje("lim-pasador-l2"),
    limPinL3:     porIdVarillaje("lim-pasador-l3"),
    limCorredera: porIdVarillaje("lim-corredera-l1"),
    limUnion:     porIdVarillaje("lim-union-c"),
    pinCsal:      porIdVarillaje("pasador-c-sal")
};


function fijarLinea(el, p, q){

    el.setAttribute("x1", p.x.toFixed(3));
    el.setAttribute("y1", p.y.toFixed(3));
    el.setAttribute("x2", q.x.toFixed(3));
    el.setAttribute("y2", q.y.toFixed(3));

}


function fijarCirculo(el, p){

    el.setAttribute("cx", p.x.toFixed(3));
    el.setAttribute("cy", p.y.toFixed(3));

}


function fijarRotulo(el, p, dx, dy){

    el.setAttribute("x", (p.x + dx).toFixed(2));
    el.setAttribute("y", (p.y + dy).toFixed(2));

}


/* Resorte de compresión (zigzag) entre la guía fija y
   el collar del seguidor */

function trazoResorte(x, y1, y2){

    const n = 7, w = 5;
    const paso = (y2 - y1) / (2 * n + 2);
    let d = "M" + x.toFixed(2) + " " + y1.toFixed(2) +
            " L" + x.toFixed(2) + " " + (y1 + paso).toFixed(2);

    for(let i = 0; i < 2 * n; i++){
        d += " L" + (x + (i % 2 ? -w : w)).toFixed(2) + " " +
             (y1 + paso * (i + 1.5)).toFixed(2);
    }

    d += " L" + x.toFixed(2) + " " + (y2 - paso).toFixed(2) +
         " L" + x.toFixed(2) + " " + y2.toFixed(2);

    return d;

}


/* Perfil de la leva (marco del cilindro, movimientoServo
   = 0); el grupo se traslada con el pistón */

/* Etapa 19: cotas del dibujo del amortiguador (px locales) */

const AMORT_DIBUJO = {
    cuerpoSobreV: 140,     // centro del cilindro receptor sobre V
    semialto: 22,          // medio alto del cuerpo receptor
    primarioSobreV: 80,    // émbolo primario sobre V
    escuadraSobreV: 50,    // escuadra del tramo inferior sobre V
    xPrimario: 663,        // eje del cilindro primario (fijo)
    yPrimarioSup: 330      // cara superior del cilindro primario (fija)
};

function trazoResorteAngosto(x, y1, y2){
    const n = 5, w = 4;
    const paso = (y2 - y1) / (2 * n + 2);
    let d = "M" + x.toFixed(2) + " " + y1.toFixed(2) + " L" + x.toFixed(2) + " " + (y1 + paso).toFixed(2);
    for(let i = 0; i < 2 * n; i++){
        d += " L" + (x + (i % 2 ? -w : w)).toFixed(2) + " " + (y1 + paso * (i + 1.5)).toFixed(2);
    }
    return d + " L" + x.toFixed(2) + " " + (y2 - paso).toFixed(2) + " L" + x.toFixed(2) + " " + y2.toFixed(2);
}


function trazoLeva(){

    const L = LEVA;
    let d = "M" + L.uIzq + " " + L.yBase;

    for(let u = L.uIzq; u <= L.uDer + 1e-9; u += 1){
        d += " L" + u.toFixed(2) + " " + (L.yBase - alturaLeva(u)).toFixed(3);
    }

    d += " L" + L.uDer + " " + L.yBase + " Z";

    return d;

}

if(elVarillaje.levaPerfil){
    elVarillaje.levaPerfil.setAttribute("d", trazoLeva());
}


function dibujarVarillaje(){

    calcularCarretePilotoVarillaje(
        posicionServoPiloto
    );

    const r = estadoVarillaje;
    const e = elVarillaje;

    if(!r || !e.collar){
        return;
    }

    /* Collar (no gira) */

    const semiancho =
    WATT_ESCALA * (RW.GEOMETRIA.manguito.cuerpoSemiancho + 10);

    e.collar.setAttribute("x", (r.salida.x - semiancho).toFixed(3));
    e.collar.setAttribute("y", (r.salida.y - 3).toFixed(3));
    e.collar.setAttribute("width", (2 * semiancho).toFixed(3));
    e.collar.setAttribute("height", "7.75");

    /* Oreja del collar hasta el pasador A y ranura de la
       palanca (±7 px a lo largo de la palanca) */
    fijarLinea(e.horquilla, { x: r.salida.x + semiancho, y: r.salida.y }, r.A);
    e.pinQ.setAttribute("r", "0");

    const uL = Math.hypot(r.B.x - r.A.x, r.B.y - r.A.y);
    const ux = (r.B.x - r.A.x) / uL, uy = (r.B.y - r.A.y) / uL;
    fijarLinea(e.bielaQA, { x: r.A.x - 4 * ux, y: r.A.y - 4 * uy }, { x: r.A.x + 7 * ux, y: r.A.y + 7 * uy });
    fijarLinea(e.palancaEnt, r.A, r.Cent);
    fijarLinea(e.palancaFl, r.C, r.E);

    fijarCirculo(e.pinA, r.A);
    fijarCirculo(e.pinB, r.B);
    fijarCirculo(e.pinC, r.Cent);

    /* Etapa 16: limitador de apertura (palanca, empujador y
       unión elástica C_ent – C_sal) */

    if(e.limPalanca && r.lim){
        const g = r.lim;
        fijarLinea(e.limExtVB, r.B, g.L2);
        fijarLinea(e.limPalanca, g.L1, g.L3);
        fijarLinea(e.limRanura, { x: g.L1.x - 6, y: g.L1.y }, { x: g.L1.x + 6, y: g.L1.y });
        fijarLinea(e.limEmpujador, g.L3, g.H);
        fijarCirculo(e.limPinL1, g.L1);
        fijarCirculo(e.limPinL2, g.L2);
        fijarCirculo(e.limPinL3, g.L3);

        /* Etapa 23: rótulos L1–L3 ligados a los pasadores
           calculados (L1 a la derecha de su guía y su rayado;
           L2 a la izquierda de la prolongación V–B; L3 a la
           derecha del empujador), todos sobre la palanca */
        if(e.rotL1){
            fijarRotulo(e.rotL1, g.L1, 14, -5);
            fijarRotulo(e.rotL2, g.L2, -18, -5);
            fijarRotulo(e.rotL3, g.L3, 5, -5);
        }
        e.limCorredera.setAttribute("y", (g.L1.y - 3).toFixed(3));
        fijarCirculo(e.pinCsal, r.C);
        e.limUnion.setAttribute(
            "d",
            r.C.y - r.Cent.y > 0.3 ? trazoResorte(r.C.x, r.Cent.y, r.C.y) : ""
        );
        e.limEmpujador.classList.toggle("limitando", r.limitando);
    }
    fijarCirculo(e.pinD, r.D);
    fijarCirculo(e.pinE, r.E);

    fijarLinea(e.bielaDK, r.D, r.K);
    fijarCirculo(e.pinK, r.K);

    fijarLinea(e.bielaER, r.E, r.R);
    fijarCirculo(e.pinR, r.R);

    /* Realimentación principal: seguidor directo */

    const rod = r.seg.rodillo;
    const V = r.seg.V;
    const yCollar = rod.y - LEVA.collar;

    /* Etapa 19: amortiguador de compensación. Cuerpo del
       receptor y escuadra del primario con el tramo inferior (V);
       émbolo receptor con el tramo superior (B): su separación del
       centro del cuerpo es yd. Cotas en AMORT_DIBUJO. */

    if(e.amCuerpo){
        const D0 = AMORT_DIBUJO;
        const yCen = V.y - D0.cuerpoSobreV;               // centro del cuerpo (yd = 0)
        const yTop = yCen - D0.semialto, yBot = yCen + D0.semialto;
        const yEmb = yCen + r.yd;                         // émbolo receptor
        const yPri = V.y - D0.primarioSobreV;             // émbolo primario
        const yEsc = V.y - D0.escuadraSobreV;
        fijarLinea(e.varillaVB, V, { x: V.x, y: yBot });
        fijarLinea(e.amVastagoSup, r.B, { x: V.x, y: yEmb });
        e.amCuerpo.setAttribute("y", yTop.toFixed(3));
        e.amAceite.setAttribute("y", (yTop + 3).toFixed(3));
        e.amEmbolo.setAttribute("y", (yEmb - 2).toFixed(3));
        e.amResSup.setAttribute("d", trazoResorteAngosto(V.x, yTop + 3, yEmb - 2));
        e.amResInf.setAttribute("d", trazoResorteAngosto(V.x, yEmb + 2, yBot - 3));
        const yEnt = yBot - 8;                            // entrada a la cámara receptora inferior
        const dTubo = "M" + D0.xPrimario + " " + D0.yPrimarioSup + " L" + D0.xPrimario + " " + yEnt.toFixed(3) +
                      " L" + (V.x + 9) + " " + yEnt.toFixed(3);
        e.amTubo.setAttribute("d", dTubo);
        e.amTuboBorde.setAttribute("d", dTubo);
        e.amEmboloPri.setAttribute("y", (yPri - 2).toFixed(3));
        fijarLinea(e.amVastagoPri, { x: D0.xPrimario, y: yPri }, { x: D0.xPrimario, y: yEsc });
        fijarLinea(e.amEscuadra, { x: V.x, y: yEsc }, { x: D0.xPrimario, y: yEsc });
    }else{
        fijarLinea(e.varillaVB, V, r.B);
    }
    fijarCirculo(e.pinV, V);
    fijarLinea(e.vastagoSeg, V, rod);
    fijarCirculo(e.rodillo, rod);

    e.collarSeg.setAttribute("y", (yCollar - 2).toFixed(3));

    e.resorte.setAttribute(
        "d",
        trazoResorte(LEVA.xSeguidor, LEVA.guiaInf, yCollar - 2)
    );

    /* La leva va dentro del grupo del cilindro (gira con
       él); aquí solo se traslada con el pistón */

    e.leva.setAttribute(
        "transform",
        "translate(" +
        (xPistonDesdePosicion(r.p) - PISTON_X_BASE).toFixed(3) +
        " 0)"
    );

    /* Letras */

    fijarRotulo(e.rotA, r.A, 2, -7);
    /* Etapa 23: B y C a la IZQUIERDA de sus pasadores, sobre
       la palanca (C por debajo, para no tocar la palanca
       limitadora) y fuera de la corredera de B, del empujador
       L3–H y de la unión elástica en C */
    fijarRotulo(e.rotB, r.B, -20, -5);
    fijarRotulo(e.rotC, r.Cent || r.C, -18, 16);
    fijarRotulo(e.rotD, r.D, -3, -7);
    fijarRotulo(e.rotE, r.E, 6, -5);
    fijarRotulo(e.rotF, rod, 12, -10);

    const pilotoMm =
    carretePilotoVarillaje * 1000;

    e.lectura.textContent =
    "s = " + r.s.toFixed(1) + " mm · piloto " +
    (pilotoMm >= -0.0005 ? "+" : "−") +
    Math.abs(pilotoMm).toFixed(3) + " mm · b " +
    (r.b * 1000).toFixed(3) + " mm · B " +
    (r.B.y - VARILLAJE.yPalanca).toFixed(2) + " px";

}


/* =====================================================
   ACTUALIZACIÓN POR FOTOGRAMA (desde simulador.js)
===================================================== */

function actualizarRegulador(dt, enMarcha){

    /* Giro VISUAL proporcional a la velocidad del eje
       (etapa 10): con el eje detenido el Watt no gira.
       A 360 rpm del eje: 90 rpm visuales (0.6667 s/vuelta,
       25 % del eje; etapa 22), con la misma magnitud visual
       que la turbina Francis. */

    if(enMarcha){
        animadorWatt.avanzarGiro(
            dt * Math.max(0, velocidadEjeRpm()) / RPM_NOMINAL
        );
    }

    /* Etapa 12: dibujo del regulador con resorte con las
       lecturas físicas del regulador dinámico. */

    RW.DibujoResorte.actualizar(
        escenaWatt,
        animadorWatt.ultimoEstado(),
        lecturasGobernador(),
        animadorWatt.estado.fase,
        {}
    );

    dibujarVarillaje();

}


/* Posición inicial (etapa 12): la fija el regulador con
   resorte (js/watt_resorte_integracion.js), en su reposo
   físico s = 0. Ya no se impone MANGUITO_REPOSO. */
