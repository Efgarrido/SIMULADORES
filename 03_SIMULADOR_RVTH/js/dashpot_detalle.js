/* =====================================================
   SIMULADOR RVTH
   PROPUESTA VISUAL DASHOPT (20-oct-2026)
   CORTE DIDÁCTICO AMPLIADO DEL AMORTIGUADOR DE COMPENSACIÓN

   Archivo: dashpot_detalle.js (solo presentación)

   QUÉ CALCULA EL MODELO (watt_integracion.js, sin cambios)
     Una sola variable de estado del amortiguador: yd, desplazamiento
     del émbolo receptor respecto a su cuerpo (px de la escena,
     + hacia abajo como y SVG):
         yd ← yd·e^(−dt/Td) + G·ΔV        (G = 4, Td = 6 s)
     con ΔV = variación de la y del pasador V (seguidor de la leva)
     en el paso. B = B_rígido(V) + yd. Topes ±ydMax.
     El modelo NO calcula presiones ni caudales.

   QUÉ SE PUEDE INFERIR DE yd (y se dibuja aquí)
     La ecuación es la continuidad de una línea de aceite cerrada
     salvo por la válvula de aguja. Con el conexionado del dibujo
     (cara superior del primario ↔ cámara inferior del receptor;
     aguja entre la línea y el depósito), en «px de carrera del
     receptor por segundo» (caudal / área receptora):
         q_pri = −G·dV/dt   primario → línea      (+ sube por el tubo)
         q_rec = −dyd/dt    línea → cámara inferior del receptor
         q_ag  = q_pri − q_rec = −yd/Td   línea → depósito (aguja)
     Son SIGNOS y magnitudes relativas del modelo reducido: no son
     m³/s ni hay presiones. Las flechas son por ello CUALITATIVAS
     (rotuladas así en la capa de anotaciones). Con el pistón quieto
     q_pri = 0 pero, si yd ≠ 0, siguen circulando q_rec y q_ag
     (recuperación del émbolo receptor hacia el centro).
     Para obtenerlos sin tocar el modelo se envuelve
     avanzarAmortiguador(dt): se llama a la función original y solo
     se LEEN amortiguador.yd y amortiguador.vAnterior antes y
     después. No se escribe ninguna variable del modelo.

   TRANSFORMACIÓN DE PRESENTACIÓN (solo dentro del detalle)
     Ronda 2 (20-oct-2026): FACTOR FIJO K = 8 (antes 20), sin
     reescalado automático. Mismo K para todas las piezas móviles,
     de modo que las uniones rígidas se conservan dentro del detalle:
       cuerpo receptor, varilla a V, escuadra, émbolo primario:
           K·(V − V_ref),  V_ref = V con el pistón al 0 %
       émbolo receptor y varilla a B: K·(V − V_ref) + K·yd
     La escena (V, B, varillas, amortiguador 1:1) NO se amplifica.

     DIMENSIONADO (ensayos 0–400 rpm, ver INFORME ronda 2):
       extremos observados de yd: −3.94 px / +1.14 px (escena)
       rango visual del detalle: |yd| ≤ ydVisible = 6 px
         (margen +52 % sobre |−3.94|, +426 % sobre +1.14)
       carrera dibujada = K·ydVisible = ±48 px de detalle;
       cámara interior ±63 px: con el émbolo (±3 px) en ±48 px
       cada resorte conserva ≥ 12 px (nunca se invierte).
       Cota teórica del modelo: |yd| ≤ G·(V(100 %) − V(0 %)) =
       4 × 3.09 = 12.4 px < ydMax = 14 px (el tope del modelo no
       se alcanza con la leva actual).
     Si |yd| > ydVisible el émbolo se dibuja en el límite del
     DETALLE (posición posible: resortes de 12 px), con contorno
     rojo, chevron hacia el sentido del exceso y el aviso «yd fuera
     del detalle»; la lectura anotada da el valor real. Si el
     modelo llegara a su tope ±ydMax aparece, aparte, «tope del
     modelo ±ydMax». El modelo sigue siempre con su propia yd.
===================================================== */

const DASHPOT_DETALLE = {
    K: 8,                  // factor FIJO de presentación de desplazamientos
    ydVisible: 6,          // px de escena representables en el detalle
    yc0: 118,              // centro del cuerpo receptor con V = V_ref
    semiInterior: 63,      // medio alto interior del receptor
    semiEmbolo: 3,         // medio espesor del émbolo receptor
    priInteriorSup: 145,   // cara interior superior del primario (fija)
    priInteriorInf: 190,   // cara interior inferior del primario (fija)
    priEmboloSobreCentro: 41,  // centro del émbolo primario respecto a yc
    semiEmboloPri: 4,
    puerto: { x: 44, dy: 58 },  // entrada a la cámara inferior del receptor
    tuboFijo: { x: 60, y: 122 }, // fin del tubo rígido (inicio del conducto flexible)
    qMin: 0.0125,          // px/s de ESCENA (|q|) para mostrar una flecha
    qPleno: 0.125          // px/s de escena para opacidad completa
};

const dashpotDetalle = (function(){

    const D = DASHPOT_DETALLE;
    const el = id => document.getElementById(id);
    const raiz = el("dashpot-detalle");
    if(!raiz){ return null; }

    const e = {
        movilV:   el("dd-movil-v"),
        embolo:   el("dd-embolo-rec"),
        varillaB: el("dd-varilla-b"),
        varillaV: el("dd-varilla-v"),
        recSup:   el("dd-rec-superior"),
        recInf:   el("dd-rec-inferior"),
        resSup:   el("dd-resorte-sup"),
        resInf:   el("dd-resorte-inf"),
        priCam:   el("dd-pri-camara"),
        priInf:   el("dd-pri-inferior"),
        mang:     el("dd-manguera"),
        mangB:    el("dd-manguera-borde"),
        fPri:     el("dd-flecha-pri"),
        fRec:     el("dd-flecha-rec"),
        fAg:      el("dd-flecha-ag"),
        aviso:    el("dd-fuera-escala"),
        tope:     el("dd-tope-modelo"),
        exceso:   el("dd-exceso"),
        escala:   el("dd-escala"),
        nota:     el("dd-nota-escala"),
        lectura:  el("lectura-amortiguador")
    };

    const Vref = resolverSeguidor(0).V.y;

    /* ---------- Lectura de los pasos del modelo (sin escribir) ---------- */

    const acum = { dt: 0, dV: 0, dyd: 0, dec: 0, tope: false };
    const caudal = { pri: 0, rec: 0, ag: 0, tope: false };

    const avanzarModelo = avanzarAmortiguador;

    avanzarAmortiguador = function(dt){
        const yd0 = amortiguador.yd;
        const v0 = amortiguador.vAnterior;
        avanzarModelo(dt);
        const dV = v0 === null ? 0 : amortiguador.vAnterior - v0;
        const dec = yd0 * (1 - Math.exp(-dt / amortiguador.Td));
        const libre = yd0 - dec + amortiguador.G * dV;
        acum.dt += dt;
        acum.dV += dV;
        acum.dyd += amortiguador.yd - yd0;
        acum.dec += dec;
        if(Math.abs(libre - amortiguador.yd) > 1e-12){ acum.tope = true; }
    };

    const reiniciarModelo = reiniciarAmortiguador;

    reiniciarAmortiguador = function(){
        reiniciarModelo();
        acum.dt = acum.dV = acum.dyd = acum.dec = 0; acum.tope = false;
        caudal.pri = caudal.rec = caudal.ag = 0; caudal.tope = false;
    };

    /* Caudales medios desde el último cuadro dibujado. En PAUSA no
       hay pasos: se conserva el último valor (escena congelada). */

    function tomarCaudales(){
        if(acum.dt > 0){
            caudal.pri = -amortiguador.G * acum.dV / acum.dt;
            caudal.rec = -acum.dyd / acum.dt;
            caudal.ag  = -acum.dec / acum.dt;
            caudal.tope = acum.tope;
            acum.dt = acum.dV = acum.dyd = acum.dec = 0; acum.tope = false;
        }
    }

    /* ---------- Dibujo ---------- */

    function resorte(x, y1, y2, n, w){
        const paso = (y2 - y1) / (2 * n + 2);
        let d = "M" + x + " " + y1.toFixed(2) + " L" + x + " " + (y1 + paso).toFixed(2);
        for(let i = 0; i < 2 * n; i++){
            d += " L" + (x + (i % 2 ? -w : w)) + " " + (y1 + paso * (i + 1.5)).toFixed(2);
        }
        return d + " L" + x + " " + (y2 - paso).toFixed(2) + " L" + x + " " + y2.toFixed(2);
    }

    function altoRect(r, y1, y2){
        r.setAttribute("y", y1.toFixed(3));
        r.setAttribute("height", Math.max(0, y2 - y1).toFixed(3));
    }

    function flecha(f, x, y, q, anguloPositivo){
        const qa = Math.abs(q);
        const mostrar = simulando && qa >= D.qMin;
        f.style.display = mostrar ? "inline" : "none";
        if(!mostrar){ return; }
        const ang = q > 0 ? anguloPositivo : anguloPositivo + 180;
        f.setAttribute("transform", "translate(" + x + " " + y + ") rotate(" + ang + ")");
        f.style.opacity = (0.35 + 0.65 * Math.min(1, qa / D.qPleno)).toFixed(3);
    }

    function dibujar(){

        const r = estadoVarillaje;
        if(!r){ return; }

        tomarCaudales();

        const V = r.seg.V.y;
        const yd = r.yd;
        const sV = D.K * (V - Vref);                 // tramo inferior
        const carrera = D.K * D.ydVisible;           // límite del DETALLE (no del modelo)
        let sYd = D.K * yd;                           // émbolo respecto al cuerpo
        const fuera = Math.abs(yd) > D.ydVisible;
        sYd = Math.max(-carrera, Math.min(carrera, sYd));

        const yc = D.yc0 + sV;                        // centro del cuerpo receptor
        const yE = yc + sYd;                          // centro del émbolo receptor
        const iSup = yc - D.semiInterior, iInf = yc + D.semiInterior;

        e.movilV.setAttribute("transform", "translate(0 " + sV.toFixed(3) + ")");
        e.embolo.setAttribute("transform", "translate(0 " + (yE - D.yc0).toFixed(3) + ")");
        e.varillaB.setAttribute("y2", (yE - D.semiEmbolo).toFixed(3));
        /* Extremos en B y V reales: solo se amplía el desplazamiento
           relativo dentro del corte didáctico. No se mueve el modelo. */
        e.varillaB.setAttribute("y1", ((r.B.y - 208) / 0.8).toFixed(3));
        e.varillaV.setAttribute("y2", ((V - 208) / 0.8 - sV).toFixed(3));


        altoRect(e.recSup, iSup, yE - D.semiEmbolo);
        altoRect(e.recInf, yE + D.semiEmbolo, iInf);
        e.resSup.setAttribute("d", resorte(28, iSup, yE - D.semiEmbolo, 6, 7));
        e.resInf.setAttribute("d", resorte(28, yE + D.semiEmbolo, iInf, 6, 7));

        const yP = yc + D.priEmboloSobreCentro;      // émbolo primario
        altoRect(e.priCam, D.priInteriorSup, yP - D.semiEmboloPri);
        altoRect(e.priInf, yP + D.semiEmboloPri, D.priInteriorInf);

        const t = D.tuboFijo, py = yc + D.puerto.dy;
        const dM = "M" + t.x + " " + t.y + " C" + t.x + " " + (py - 6).toFixed(2) + " " +
                   (t.x - 2) + " " + py.toFixed(2) + " " + D.puerto.x + " " + py.toFixed(2);
        e.mang.setAttribute("d", dM);
        e.mangB.setAttribute("d", dM);

        flecha(e.fPri, 100, 131.5, caudal.pri, -90);  // + : del primario hacia la T
        flecha(e.fRec, 80, 122, caudal.rec, 180);     // + : de la T hacia el receptor
        flecha(e.fAg, 100, 111, caudal.ag, -90);      // + : de la T hacia el depósito

        raiz.classList.toggle("dd-fuera-escala", fuera);
        e.aviso.setAttribute("display", fuera ? "inline" : "none");
        e.exceso.setAttribute("display", fuera ? "inline" : "none");
        if(fuera){
            /* chevron FUERA del cuerpo, a la altura del émbolo, hacia
               el sentido en que yd continúa más allá del detalle */
            e.exceso.setAttribute("transform", "translate(6 " + yE.toFixed(2) + ")" + (yd < 0 ? "" : " rotate(180)"));
        }
        e.tope.setAttribute("display", caudal.tope ? "inline" : "none");
        e.escala.textContent = "×" + D.K;
        e.nota.textContent = "×" + D.K + " · flechas cualitativas";

        if(e.lectura){
            const s = x => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(3);
            e.lectura.textContent =
                "amortiguador: yd " + s(yd) + " px · V " + s(V - Vref) + " px · B " +
                s(r.B.y - VARILLAJE.yPalanca) + " px" + (caudal.tope ? " · TOPE ±ydMax" : "");
        }

        ultimo = { t: performance.now(), V, yd, sV, sYd, yc, yE, fuera,
                   resorteSup: (yE - D.semiEmbolo) - iSup, resorteInf: iInf - (yE + D.semiEmbolo),
                   Bescena: r.B.y, q: Object.assign({}, caudal) };
    }

    let ultimo = null;

    /* Se dibuja después del varillaje de la escena en cada cuadro */

    const dibujarVarillajeEscena = dibujarVarillaje;

    dibujarVarillaje = function(){
        dibujarVarillajeEscena();
        dibujar();
    };

    dibujar();

    return {
        Vref,
        caudal,
        dibujar,
        ultimoDibujo: () => ultimo
    };

})();
