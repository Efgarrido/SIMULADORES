"use strict";

/* =========================================================
   ESCENA DE PROCESO — CALDERA PIROTUBULAR (vista lateral)

   Dibuja la escena base dentro de <svg id="calderaSVG"> (viewBox 1200 x 600)
   y expone una API mínima en window.EscenaCaldera para que la lógica del
   simulador cambie estados sin tocar el dibujo.

   Convención de color (definida en css/caldera-escena.css):
     rojo  = parado / cerrada      verde = en marcha / abierta
     azul  = agua                  azul claro = vapor
     naranja = tubería vacía       amarillo = combustible

   Referencias E01…E11 = tabla "Escena base" de la especificación.
========================================================= */

(() => {
    const svg = document.getElementById("calderaSVG");
    if (!svg) return;

    /* ---------------------------------------------------------
       GEOMETRÍA DE REFERENCIA (coordenadas del viewBox)
    --------------------------------------------------------- */
    const CAV = { x: 358, y: 218, w: 544, h: 254 };   // cavidad de agua / vapor
    const CAV_FONDO = CAV.y + CAV.h;                  // y = 472
    // Detector de lectura: posición y dimensiones ajustables en unidades SVG.
    // Segmentos visuales: unidades SVG y unidades SVG por segundo real activo.
    const VAPOR_VISUAL = Object.freeze({
        color: "#bdeaff", contorno: "#287397", grosor: 2.2, borde: 1.2,
        longitud: 7, separacionMinima: 15, separacionMaxima: 38,
        velocidadInterna: 18, velocidadProceso: 28, referenciaCaudal: 0.32,
        columnasMinimas: 3, columnasMaximas: 12, umbralCaudal: 1e-8
    });
    // Rotación desde la vertical: mínimo abajo izquierda, máximo abajo derecha.
    const ESCALAS_INSTRUMENTOS = Object.freeze({
        "aguja-presion": { minimo: 0, maximo: 12, anguloMinimo: -135, anguloMaximo: 135 },
        "aguja-temperatura": { minimo: 0, maximo: 250, anguloMinimo: -135, anguloMaximo: 135 }
    });
    const GASES_VISUALES = { longitud: 9, separacion: 27, grosor: 1.8, velocidad: 42, color: "#666666" };
    // Escalas sobre la llama original, con origen fijo en la boquilla (410, 412).
    const TAMANOS_LLAMA = [
        { apertura: 0, longitud: 0, ancho: 0 },
        { apertura: 15, longitud: 0.25, ancho: 0.45 },
        { apertura: 50, longitud: 0.60, ancho: 0.70 },
        { apertura: 100, longitud: 0.98, ancho: 0.95 }
    ];
    // Punta exterior original: x=790; origen: x=410. Inicio fijo tras la llama al 15 %.
    const INICIO_GASES_HOGAR = 410 + (790 - 410) *
        TAMANOS_LLAMA.find(ref => ref.apertura === 15).longitud + 5;
    const DETECTOR_FLAMA = { x: 933, y: 390, w: 64, h: 48 };
    const PANEL_INSTRUMENTOS = { desplazamientoY: -10 };
    const VISOR = { y: 222, h: 83.5 };                  // vidrio de nivel (panel E02)
    const NIVEL_REFERENCIA = { inferior: 270, normal: 250.5, superior: 231 };
    const limitar = (v) => Math.min(1, Math.max(0, Number(v) || 0));
    const nivelRelativo = (fraccion) => {
        const yAgua = CAV_FONDO - limitar(fraccion) * CAV.h;
        return 10 * (NIVEL_REFERENCIA.normal - yAgua) /
            (NIVEL_REFERENCIA.normal - NIVEL_REFERENCIA.superior);
    };
    const lecturaNivelRelativo = (fraccion) => {
        const relativo = nivelRelativo(fraccion);
        // Redondear antes de decidir el signo evita -0.0 % y +0.0 %.
        const redondeado = Math.round(relativo * 10) / 10;
        return `${redondeado > 0 ? "+" : ""}${redondeado.toFixed(1)} %`;
    };

    /* ---------------------------------------------------------
       HELPERS DE DIBUJO
    --------------------------------------------------------- */
    const pts = (lista) => lista.map((p) => p.join(",")).join(" ");

    // Tubería: borde oscuro + relleno que cambia según el fluido.
    const tuberia = (id, elemento, nombre, lista, fluido, ancho = 7) => `
        <g id="${id}" class="tuberia" data-elemento="${elemento}" data-fluido="${fluido}">
            <title>${nombre}</title>
            <polyline class="t-borde" points="${pts(lista)}" stroke-width="${ancho + 4}"/>
            <polyline class="t-fluido" points="${pts(lista)}" stroke-width="${ancho}"/>
        </g>`;

    // Válvula: tres tipos de símbolo. El color lo da data-estado (abierta/cerrada).
    const CUERPO_COMPUERTA = `<path class="v-cuerpo color-estado" d="M-14,-10 L0,0 L-14,10 Z M14,-10 L0,0 L14,10 Z"/>`;

    const FORMAS_VALVULA = {
        compuerta: `
            ${CUERPO_COMPUERTA}
            <line class="v-trazo" x1="0" y1="0" x2="0" y2="-17"/>
            <path class="v-domo color-estado" d="M-11,-17 A11,11 0 0 1 11,-17 Z"/>
            <rect class="v-tapa" x="-6" y="-31" width="12" height="3"/>`,
        manual: `
            <path class="v-cuerpo color-estado" d="M-10,-7 L0,0 L-10,7 Z M10,-7 L0,0 L10,7 Z"/>
            <line class="v-trazo" x1="0" y1="0" x2="0" y2="-13"/>
            <line class="v-trazo" x1="-6" y1="-13" x2="6" y2="-13"/>`,
        vertical: `
            <path class="v-cuerpo color-estado" d="M-7,-10 L0,0 L7,-10 Z M-7,10 L0,0 L7,10 Z"/>
            <line class="v-trazo" x1="0" y1="0" x2="-14" y2="0"/>
            <line class="v-trazo" x1="-14" y1="-6" x2="-14" y2="6"/>`
    };

    const valvula = ({ id, elemento, ref, nombre, x, y, tipo, estado, escala = 1 }) => `
        <g id="${id}" class="valvula interactivo" data-elemento="${elemento}" data-ref="${ref}"
           data-estado="${estado}" tabindex="0" role="button" aria-label="${nombre}"
           transform="translate(${x} ${y}) scale(${escala})">
            <title>${nombre}</title>
            <rect class="zona-clic" x="-18" y="-34" width="36" height="52"/>
            ${FORMAS_VALVULA[tipo]}
        </g>`;

    // Válvula de corte informativa: mismo cuerpo de compuerta y actuador de solenoide.
    const valvulaSolenoide = ({ id, nombre, x, y }) => `
        <g id="${id}" class="valvula" data-elemento="valvulaCorteCombustible"
           data-estado="cerrada" role="img" aria-label="${nombre}"
           transform="translate(${x} ${y})">
            <title>${nombre}</title>
            ${CUERPO_COMPUERTA}
            <line class="v-trazo" x1="0" y1="0" x2="0" y2="-17"/>
            <rect x="-9" y="-35" width="18" height="18" fill="#ececec" stroke="#1c1c1c" stroke-width="2"/>
            <text x="0" y="-26" text-anchor="middle" dominant-baseline="central"
                  font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#333333">S</text>
        </g>`;

    // Recuadro común: altura fija, nombre corto y lectura independiente del símbolo.
    const indicadorHMI = ({ id, nombre, x = 0, y, ancho = 124, lectura, clase = "" }) => `
        <g ${id ? `id="${id}"` : ""} class="indicador-hmi" data-ancho="${ancho}"
           transform="translate(${x} ${y})" ${["hmi-presion", "hmi-temperatura"].includes(id) ? `role="img" aria-label="${nombre}: ${lectura}"` : ""}>
            ${["hmi-presion", "hmi-temperatura"].includes(id) ? `<title>${nombre}: ${lectura}</title>` : ""}
            <rect class="hmi-fondo" x="${-ancho / 2}" y="-12" width="${ancho}" height="24" rx="3"/>
            <text class="hmi-nombre" x="0" y="-3">${nombre}</text>
            <text class="hmi-valor ${clase}" x="0" y="8">${lectura}</text>
        </g>`;

    // Medidor en línea: símbolo conservado y recuadro en un espacio libre adyacente.
    const medidorFlujo = ({ id, elemento, nombre, etiqueta, x, y, lecturaX = 0, lecturaY = -52 }) => {
        const lecturaInicial = elemento === "flujoCombustible" ? "0.000 kg/s" : "0.00 kg/s";
        return `
        <g id="${id}" data-elemento="${elemento}" data-nombre="${nombre}"
           data-valor="0" data-unidad="kg/s" role="img" aria-label="${nombre}: ${lecturaInicial}"
           transform="translate(${x} ${y})">
            <title>${nombre}: ${lecturaInicial}</title>
            <rect x="-20" y="-12" width="8" height="24" fill="#b9b9b9" stroke="#1c1c1c" stroke-width="2"/>
            <rect x="12" y="-12" width="8" height="24" fill="#b9b9b9" stroke="#1c1c1c" stroke-width="2"/>
            <circle r="15" fill="#ffffff" stroke="#1c1c1c" stroke-width="2"/>
            ${indicadorHMI({ nombre: etiqueta, x: lecturaX, y: lecturaY, lectura: lecturaInicial, clase: "lectura-flujo" })}
        </g>`;
    };

    // Instrumentos originales: nueve marcas principales, sin números diminutos.
    const manometro = (cx, cy, idAguja, nombre) => {
        const escala = ESCALAS_INSTRUMENTOS[idAguja];
        let marcas = "";
        for (let i = 0; i <= 8; i++) {
            const a = ((escala.anguloMinimo + i * (escala.anguloMaximo - escala.anguloMinimo) / 8) * Math.PI) / 180;
            const x1 = (cx + Math.sin(a) * 8).toFixed(1);
            const y1 = (cy - Math.cos(a) * 8).toFixed(1);
            const x2 = (cx + Math.sin(a) * 10.5).toFixed(1);
            const y2 = (cy - Math.cos(a) * 10.5).toFixed(1);
            marcas += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
        }
        return `
            <g class="manometro" pointer-events="none" data-elemento="${idAguja}-instrumento">
                <title>${nombre}</title>
                <circle class="m-cara" cx="${cx}" cy="${cy}" r="12.5"/>
                <g class="m-marcas">${marcas}</g>
                <g id="${idAguja}" data-cx="${cx}" data-cy="${cy}" transform="rotate(${escala.anguloMinimo} ${cx} ${cy})">
                    <line class="m-aguja" x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - 9}"/>
                </g>
                <circle cx="${cx}" cy="${cy}" r="1.8" fill="#222"/>
            </g>`;
    };

    // Sonda de nivel (E03): cabezal + varilla que entra al cuerpo.
    const sonda = (x, yFin) => `
        <g class="sonda">
            <rect x="${x - 6}" y="150" width="12" height="10" fill="#3a3a3a" stroke="#1c1c1c" stroke-width="1.5"/>
            <rect x="${x - 9}" y="160" width="18" height="36" rx="2" fill="url(#ce-g-sonda)" stroke="#1c1c1c" stroke-width="1.5"/>
            <rect x="${x - 5}" y="196" width="10" height="14" fill="#6a6a6a" stroke="#1c1c1c" stroke-width="1.5"/>
            <line x1="${x}" y1="210" x2="${x}" y2="${yFin}" stroke="#1c1c1c" stroke-width="2.5"/>
        </g>`;

    // Hogar corrugado (E01-hogar): entrada lisa 353–425 y 13 corrugaciones de 30 u (425–815).
    // Cada ondulación baja `prof` unidades desde la envolvente (y 357–469); las de arriba y
    // abajo coinciden en x, formando bandas anulares.
    // El hogar termina en x=815 con el extremo ABIERTO: desemboca en la cámara de retorno,
    // por lo que el contorno (trazo) no cierra ese extremo. El relleno sí llega a x=816
    // (1 u bajo la cámara) para que no quede una línea clara en la unión.
    const hogar = (() => {
        const H = { x0: 353, yT: 357, yB: 469, ini: 425, paso: 30, n: 13, prof: 7, r: 6 };
        const m = H.paso / 4;
        const fin = H.ini + H.n * H.paso;                    // 815
        const pliegues = [];                                 // x de cada pliegue (valle)
        let arriba = "";                                     // ondas del borde superior, izq → der
        let abajo = "";                                      // ondas del borde inferior, der → izq
        for (let i = 0; i < H.n; i++) {
            const a = H.ini + i * H.paso;
            arriba += ` C${a + m},${H.yT} ${a + m},${H.yT + H.prof} ${a + H.paso / 2},${H.yT + H.prof}`;
            arriba += ` C${a + H.paso - m},${H.yT + H.prof} ${a + H.paso - m},${H.yT} ${a + H.paso},${H.yT}`;
            pliegues.push(a + H.paso / 2);
        }
        for (let i = H.n - 1; i >= 0; i--) {
            const a = H.ini + i * H.paso;
            abajo += ` C${a + H.paso - m},${H.yB} ${a + H.paso - m},${H.yB - H.prof} ${a + H.paso / 2},${H.yB - H.prof}`;
            abajo += ` C${a + m},${H.yB - H.prof} ${a + m},${H.yB} ${a},${H.yB}`;
        }
        const izquierda = ` H${H.x0 + H.r} Q${H.x0},${H.yB} ${H.x0},${H.yB - H.r}` +
                          ` V${H.yT + H.r} Q${H.x0},${H.yT} ${H.x0 + H.r},${H.yT}`;

        // Relleno / recorte (cerrado)
        const d = `M${H.x0 + H.r},${H.yT} H${H.ini}${arriba} H${fin + 1} V${H.yB} H${fin}${abajo}${izquierda} Z`;
        // Contorno (abierto): extremo izquierdo cerrado; extremo derecho abierto hacia la cámara
        const contorno = `M${fin},${H.yB}${abajo}${izquierda} H${H.ini}${arriba}`;

        // Trazos de cada pliegue: oscuro fino + reflejo claro, con extremos curvos
        // que siguen la ondulación. Se recortan al contorno (ce-clip-hogar).
        const trazo = (x) =>
            `M${x + 2.5},${H.yT + 3.6} Q${x},${H.yT + H.prof} ${x},${H.yT + H.prof + 5} ` +
            `V${H.yB - H.prof - 5} Q${x},${H.yB - H.prof} ${x + 2.5},${H.yB - 3.6}`;
        let oscuros = "";
        let claros = "";
        pliegues.forEach((x) => {
            oscuros += trazo(x);
            claros += trazo(x + 3.2);
        });
        // Borde entre la entrada lisa y el tramo corrugado
        oscuros += `M${H.ini},${H.yT + 1}V${H.yB - 1}`;
        claros += `M${H.ini + 2.4},${H.yT + 1}V${H.yB - 1}`;
        return { d, contorno, oscuros, claros };
    })();

    /* ---------------------------------------------------------
       ESCENA (de atrás hacia adelante)
    --------------------------------------------------------- */
    const escena = `
    <defs>
        <linearGradient id="ce-g-apertura-agua" gradientUnits="userSpaceOnUse" x1="-14" y1="0" x2="14" y2="0">
            <stop offset="0" class="apertura-verde"/><stop offset="0.5" class="apertura-verde"/>
            <stop offset="0.5" class="apertura-rojo"/><stop offset="1" class="apertura-rojo"/>
        </linearGradient>
        <linearGradient id="ce-g-cavidad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#f1a24d"/><stop offset="1" stop-color="#fbdcae"/>
        </linearGradient>
        <linearGradient id="ce-g-haz" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#fff3c4"/><stop offset="1" stop-color="#f7d98a"/>
        </linearGradient>
        <linearGradient id="ce-g-hogar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#e0532c"/><stop offset=".28" stop-color="#f29a52"/>
            <stop offset=".5" stop-color="#fde8b0"/><stop offset=".72" stop-color="#f29a52"/>
            <stop offset="1" stop-color="#e0532c"/>
        </linearGradient>
        <linearGradient id="ce-g-camara" gradientUnits="userSpaceOnUse" x1="0" y1="335" x2="0" y2="469">
            <stop offset="0" stop-color="#ee6a33"/><stop offset="1" stop-color="#d8491f"/>
        </linearGradient>
        <linearGradient id="ce-g-caja" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#f7a445"/><stop offset="1" stop-color="#ee7a24"/>
        </linearGradient>
        <linearGradient id="ce-g-metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#f6f6f6"/><stop offset=".5" stop-color="#b9b9b9"/>
            <stop offset="1" stop-color="#8a8a8a"/>
        </linearGradient>
        <linearGradient id="ce-g-sonda" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#f2f2f2"/><stop offset="1" stop-color="#8d8d8d"/>
        </linearGradient>
        <linearGradient id="ce-g-flama" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#fff6a8"/><stop offset=".25" stop-color="#ffd23a"/>
            <stop offset=".55" stop-color="#ff9f2e"/><stop offset=".9" stop-color="#e9532a"/>
            <stop offset="1" stop-color="#e9532a" stop-opacity=".25"/>
        </linearGradient>
        <marker id="ce-punta" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 Z" fill="#ffb300"/>
        </marker>
        <!-- Recorte desde el inicio fijo, 5 unidades después de la punta de encendido. -->
        <clipPath id="ce-clip-inicio-gases-hogar" clipPathUnits="userSpaceOnUse">
            <rect x="${INICIO_GASES_HOGAR}" y="357" width="${816 - INICIO_GASES_HOGAR}" height="112"/>
        </clipPath>
        <clipPath id="ce-clip-recorrido-gases" clipPathUnits="userSpaceOnUse">
            <path d="${hogar.d}" clip-path="url(#ce-clip-inicio-gases-hogar)"/>
            <rect x="817" y="330" width="77" height="137"/>
            <rect x="305" y="289" width="48" height="69"/>
            <rect x="350" y="329.5" width="468" height="3"/>
            <rect x="350" y="341.5" width="468" height="3"/>
            <rect x="350" y="294.5" width="554" height="3"/>
            <rect x="350" y="306.5" width="554" height="3"/>
            <rect x="904" y="242" width="62" height="104"/>
            <rect x="965" y="264" width="31" height="36"/>
        </clipPath>
        <clipPath id="ce-clip-hogar">
            <path d="${hogar.d}"/>
        </clipPath>
        <clipPath id="ce-clip-vapor-superficie" clipPathUnits="userSpaceOnUse">
            <rect id="vapor-superficie-recorte" x="${CAV.x + 3}" y="${CAV.y + 3}" width="${CAV.w - 6}" height="0"/>
        </clipPath>
        <mask id="ce-mascara-vapor-interno" maskUnits="userSpaceOnUse" x="${CAV.x}" y="${CAV.y}" width="${CAV.w}" height="${CAV.h}">
            <rect x="${CAV.x + 3}" y="${CAV.y + 3}" width="${CAV.w - 6}" height="${CAV.h - 6}" rx="5" fill="white"/>
            <path d="${hogar.d}" fill="black" stroke="black" stroke-width="4"/>
            <path d="${hogar.contorno}" fill="none" stroke="black" stroke-width="4"/>
            <rect x="353" y="291.5" width="545" height="9" fill="black"/>
            <rect x="353" y="303.5" width="545" height="9" fill="black"/>
            <rect x="353" y="326.5" width="463" height="9" fill="black"/>
            <rect x="353" y="338.5" width="463" height="9" fill="black"/>
            <rect x="813" y="326" width="85" height="145" fill="black"/>
            <rect x="894" y="240" width="8" height="107" fill="black"/>
        </mask>
        <clipPath id="ce-clip-vapor-proceso" clipPathUnits="userSpaceOnUse">
            <!-- Interior de los tramos reales; cortes bajo válvula y medidor. -->
            <rect x="250" y="63.75" width="53.5" height="10.5"/>
            <rect x="343.5" y="63.75" width="53.5" height="10.5"/>
            <rect x="425" y="63.75" width="123.25" height="10.5"/>
            <rect x="537.75" y="69" width="10.5" height="162"/>
            <rect x="541.5" y="231" width="3" height="14.5"/>
        </clipPath>
        <clipPath id="ce-clip-visor-agua" clipPathUnits="userSpaceOnUse">
            <rect x="438.5" y="${VISOR.y + 0.75}" width="11" height="${VISOR.h - 1.5}"/>
        </clipPath>
        <clipPath id="ce-clip-cavidad">
            <rect x="${CAV.x}" y="${CAV.y}" width="${CAV.w}" height="${CAV.h}" rx="5"/>
        </clipPath>
    </defs>

    <!-- ========== E11 · BASE DE CONCRETO Y SOPORTES ========== -->
    <g id="E11-base" data-ref="E11">
        <title>Placa de concreto y soportes</title>
        <path d="M361,479 H452 L446,527.231 H367 Z M784,479 H903 L897,527.231 H790 Z" fill="#555" stroke="#1c1c1c" stroke-width="1.5"/>
        <rect x="215" y="527.231" width="840" height="37" fill="#a8a8a8"/>
        <line x1="215" y1="527.731" x2="1055" y2="527.731" stroke="#8a8a8a" stroke-width="1"/>
    </g>

    <!-- ========== E01 · CUERPO DE LA CALDERA ========== -->
    <g id="E01-cuerpo" data-ref="E01">
        <title>Cuerpo de la caldera</title>
        <rect id="E01-envolvente" x="350" y="210" width="560" height="270" rx="10"
              fill="#8f8f8f" stroke="#1c1c1c" stroke-width="3"/>
        <rect id="E01-cavidad" x="${CAV.x}" y="${CAV.y}" width="${CAV.w}" height="${CAV.h}" rx="5"
              fill="url(#ce-g-cavidad)" stroke="#1c1c1c" stroke-width="1.5"/>

        <!-- Capas dinámicas: vapor (arriba) y agua (sube desde el fondo) -->
        <g clip-path="url(#ce-clip-cavidad)">
            <rect id="vapor-espacio" x="${CAV.x}" y="${CAV.y}" width="${CAV.w}" height="${CAV.h}" fill="#d3e6f3"/>
        <g id="vapor-generacion-segmentos" visibility="hidden" pointer-events="none" aria-hidden="true"
           clip-path="url(#ce-clip-vapor-superficie)" mask="url(#ce-mascara-vapor-interno)"
           fill="none" stroke-linecap="round" stroke-dasharray="${VAPOR_VISUAL.longitud} ${VAPOR_VISUAL.separacionMaxima}">
            ${Array.from({ length: VAPOR_VISUAL.columnasMaximas }, (_, i) => `
                <g id="vapor-columna-${i}">
                    <path id="vapor-ascenso-${i}" stroke="${VAPOR_VISUAL.contorno}" stroke-width="${VAPOR_VISUAL.grosor + 2 * VAPOR_VISUAL.borde}"/>
                    <path id="vapor-centro-${i}" stroke="${VAPOR_VISUAL.color}" stroke-width="${VAPOR_VISUAL.grosor}"/>
                </g>`).join("")}
        </g>
            <rect id="agua-nivel" x="${CAV.x}" y="${CAV_FONDO}" width="${CAV.w}" height="0" fill="#2f86c0"/>
        </g>



        <!-- Cuatro tubos de gases, dos por paso, separados por el espacio de agua de la envolvente
             (se ve el fondo con la caldera vacía y agua al subir el nivel). Cada tubo tiene sus
             propias paredes superior e inferior (2.5); el relleno va de pared a pared.
             Paso 3 (E01-paso3, x 353–896): tubos y 293–299 y y 305–311, cámara frontal → caja de humos.
             Paso 2 (E01-paso2, x 353–815): tubos y 328–334 y y 340–346, cámara de retorno → cámara frontal.
             Las paredes del paso 2 se dibujan con la cámara de retorno (E01-camara-retorno-paredes). -->
        <g id="E01-tubos">
            <g id="E01-paso3">
                <rect id="E01-paso3-tubo1" x="353" y="293" width="543" height="6" fill="url(#ce-g-haz)"/>
                <rect id="E01-paso3-tubo2" x="353" y="305" width="543" height="6" fill="url(#ce-g-haz)"/>
                <!-- Rellenos bajo la cámara frontal: el fondo de cada tubo llega hasta la cámara sin costura -->
                <rect x="350" y="293" width="5" height="6" fill="url(#ce-g-haz)"/>
                <rect x="350" y="305" width="5" height="6" fill="url(#ce-g-haz)"/>
                <path d="M353,293H896M353,299H896M353,305H896M353,311H896" fill="none" stroke="#1c1c1c" stroke-width="2.5"/>
            </g>
            <g id="E01-paso2">
                <rect id="E01-paso2-tubo1" x="353" y="328" width="463" height="6" fill="url(#ce-g-haz)"/>
                <rect id="E01-paso2-tubo2" x="353" y="340" width="463" height="6" fill="url(#ce-g-haz)"/>
                <rect x="350" y="328" width="5" height="6" fill="url(#ce-g-haz)"/>
                <rect x="350" y="340" width="5" height="6" fill="url(#ce-g-haz)"/>
            </g>
        </g>

        <!-- Cámara frontal reducida (x 293–353, y 280–372; interior x 304–353, y 288–359).
             Techo próximo al borde inferior del tablero (y 290); interior 5 u sobre la boca superior.
             La pared derecha (x=353) se interrumpe en las cuatro bocas: paso 3 (y 293–299 y 305–311)
             y paso 2 (y 328–334 y 340–346). Se conservan el contorno exterior, las paredes entre
             las bocas (y 299–305, 311–328 y 334–340) y la pared inferior que separa la cámara del
             hogar y de la entrada del quemador (y 346–372). -->
        <g id="E01-camara-frontal">
            <path d="M296,280 H352 V372 H296 A3,3 0 0 1 293,369 V283 A3,3 0 0 1 296,280 Z" fill="#8f8f8f"/>
            <rect x="304" y="288" width="49" height="71" fill="url(#ce-g-caja)"/>
            <path d="M353,293 V283 A3,3 0 0 0 350,280 H296 A3,3 0 0 0 293,283 V369 A3,3 0 0 0 296,372 H350 A3,3 0 0 0 353,369 V346 M353,299 V305 M353,311 V328 M353,334 V340"
                  fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="square"/>
            <path d="M353,293 V288 H304 V359 H353 V346" fill="none" stroke="#1c1c1c" stroke-width="1.5"/>
        </g>

        <!-- Hogar corrugado: 1) fondo  2) llama  3) detalles  4) contorno -->
        <path id="E01-hogar" d="${hogar.d}" fill="url(#ce-g-hogar)"/>

        <!-- Llama (capa dinámica): apagada | piloto | principal -->
        <g id="llama" data-estado="apagada" clip-path="url(#ce-clip-hogar)">
            <g class="llama-forma">
                <path d="M410,412 C470,374 620,382 790,412 C620,442 470,450 410,412 Z" fill="url(#ce-g-flama)"/>
                <path d="M410,412 C470,397 580,399 700,412 C580,425 470,427 410,412 Z" fill="#fffbd0" opacity=".85"/>
            </g>
        </g>

        <g id="E01-hogar-detalle" clip-path="url(#ce-clip-hogar)" fill="none" stroke-linecap="round">
            <path d="${hogar.oscuros}" stroke="#7a2400" stroke-width="1.6" opacity=".55"/>
            <path d="${hogar.claros}" stroke="#ffffff" stroke-width="1.1" opacity=".4"/>
        </g>
        <path id="E01-hogar-contorno" d="${hogar.contorno}" fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linejoin="round"/>

        <!-- Cámara de retorno: recibe la salida del hogar (abajo, y 357–469) y las bocas de los dos tubos
             del paso 2 (y 328–334 y 340–346). Su techo (y 328) queda a ras de la pared superior del
             tubo de arriba, de modo que ambos tubos desembocan en ella; la pared x=815 entre las
             dos bocas (y 334–340) separa los tubos. Sin pared en la boca del hogar ni en las bocas. -->
        <path id="E01-camara-retorno" d="M815,328 H896 V469 H815 Z" fill="url(#ce-g-camara)"/>
        <path id="E01-camara-retorno-paredes" d="M354,328 H896 V469 H815 M354,334 H815 V340 H354 M354,346 H815 V357"
              fill="none" stroke="#1c1c1c" stroke-width="2.5" stroke-linejoin="miter" stroke-linecap="square"/>

        <!-- Caja de humos y salida -->
        <!-- Caja de humos: misma geometría y salida lateral. La pared izquierda (marco x=896 e interior
             x=903) se interrumpe solo en las dos entradas del paso 3 (y 293–299 y 305–311) y se
             conserva la pared entre ellas (y 299–305). Las paredes de los tubos se prolongan hasta el
             interior. El paso 2 no se conecta con esta caja. -->
        <g id="E01-caja-humos">
            <rect x="896" y="234" width="78" height="120" rx="3" fill="#8f8f8f"/>
            <rect x="903" y="241" width="64" height="106" fill="url(#ce-g-caja)"/>
            <rect x="895" y="293" width="9" height="6" fill="url(#ce-g-haz)"/>
            <rect x="895" y="305" width="9" height="6" fill="url(#ce-g-haz)"/>
            <path d="M896,293 V237 A3,3 0 0 1 899,234 H971 A3,3 0 0 1 974,237 V351 A3,3 0 0 1 971,354 H899 A3,3 0 0 1 896,351 V311 M896,299 V305"
                  fill="none" stroke="#1c1c1c" stroke-width="2.5"/>
            <path d="M903,293 V241 H967 V347 H903 V311 M903,299 V305" fill="none" stroke="#1c1c1c" stroke-width="1.5"/>
            <path d="M895,293H903.75M895,299H903.75M895,305H903.75M895,311H903.75" fill="none" stroke="#1c1c1c" stroke-width="2.5"/>
            <rect x="967" y="262" width="28" height="40" fill="url(#ce-g-metal)" stroke="#1c1c1c" stroke-width="2"/>
            <rect x="992" y="260" width="6" height="44" fill="#6a6a6a" stroke="#1c1c1c" stroke-width="1.5"/>
        </g>

        <!-- Boquilla y brida del quemador -->
        <g id="E01-quemador">
            <rect x="356" y="392" width="56" height="40" rx="3" fill="url(#ce-g-metal)" stroke="#1c1c1c" stroke-width="2"/>
            <path d="M372,392V432M382,392V432" stroke="#1c1c1c" stroke-width="1" opacity=".5"/>
            <rect x="340" y="384" width="16" height="58" fill="#555" stroke="#1c1c1c" stroke-width="2"/>
        </g>

    </g>

    <!-- Dos ramas orientadas del hogar a la salida, recortadas al interior. -->
    <g id="gases-segmentos" visibility="hidden" pointer-events="none" aria-hidden="true"
       clip-path="url(#ce-clip-recorrido-gases)" fill="none" stroke="${GASES_VISUALES.color}"
       stroke-width="${GASES_VISUALES.grosor}" stroke-linecap="round" opacity="0.85"
       stroke-dasharray="${GASES_VISUALES.longitud} ${GASES_VISUALES.separacion}">
        <path d="M${INICIO_GASES_HOGAR},402 H846 Q874,402 874,368 Q874,331 818,331 H354 Q322,331 322,313 Q322,296 354,296 H916 Q945,296 945,282 H996"/>
        <path d="M${INICIO_GASES_HOGAR},422 H842 Q862,422 862,380 Q862,343 818,343 H354 Q334,343 334,326 Q334,308 354,308 H916 Q932,308 932,288 Q932,282 946,282 H996"/>
    </g>

    <!-- ========== E02 · PANEL DE INSTRUMENTOS ========== -->
    <g id="E02-panel" data-ref="E02" transform="translate(0 ${PANEL_INSTRUMENTOS.desplazamientoY})">
        <title>Panel de instrumentos</title>
        ${indicadorHMI({ id: "hmi-presion", nombre: "Presión", x: 290, y: 238, ancho: 108, lectura: "— bar(g)" })}
        ${indicadorHMI({ id: "hmi-temperatura", nombre: "Temperatura", x: 290, y: 266, ancho: 108, lectura: "— °C" })}
        ${indicadorHMI({ id: "hmi-nivel", nombre: "Nivel relativo", x: 444, y: 190, lectura: lecturaNivelRelativo(0) })}
        <rect x="352" y="210" width="124" height="107.5" rx="2" fill="#9b9b9b" stroke="#1c1c1c" stroke-width="2"/>
        <rect x="358" y="216" width="112" height="95.5" fill="#ececec" stroke="#6a6a6a" stroke-width="1"/>
        ${manometro(378, 238, "aguja-presion", "Manómetro de presión")}
        ${manometro(378, 266, "aguja-temperatura", "Indicador de temperatura")}
        <g id="indicador-disparo" class="instrumento-aux" role="img" aria-label="Protecciones pendientes de implementar">
            <title>Protecciones pendientes de implementar</title>
            <rect id="indicador-disparo-relleno" x="398" y="244" width="18" height="16" rx="2" fill="#b9b9b9" stroke="#1c1c1c" stroke-width="1.5"/>
            <rect x="402" y="238" width="10" height="6" fill="#555" stroke="#1c1c1c" stroke-width="1"/>
        </g>
        <g id="visor-nivel">
            <title>Visor de nivel de agua</title>
            <rect x="433" y="217" width="22" height="5" fill="#555" stroke="#1c1c1c" stroke-width="1"/>
            <rect x="433" y="${VISOR.y + VISOR.h}" width="22" height="5" fill="#555" stroke="#1c1c1c" stroke-width="1"/>
            <rect x="437" y="${VISOR.y}" width="14" height="${VISOR.h}" fill="#ffffff" stroke="#1c1c1c" stroke-width="1.5"/>
            <rect id="visor-agua" x="438.5" y="${CAV_FONDO - PANEL_INSTRUMENTOS.desplazamientoY}" width="11" height="0" fill="#2f86c0" clip-path="url(#ce-clip-visor-agua)"/>
        </g>
    </g>

    <!-- ========== TUBERÍAS (dinámicas: vacio | agua | vapor) ========== -->
    <g id="tuberias">
        <g id="T-vapor" class="tuberia" data-elemento="tuberiaVapor" data-fluido="vacio">
            <title>Línea de vapor a proceso</title>
            <!-- Corte en los extremos del cuerpo de valvulaVapor: 411 ± 14. -->
            <polyline class="t-borde" points="250,69 303.5,69" stroke-width="14.5"/>
            <polyline class="t-fluido" points="250,69 303.5,69" stroke-width="10.5"/>
            <polyline class="t-borde" points="343.5,69 397,69" stroke-width="14.5"/>
            <polyline class="t-fluido" points="343.5,69 397,69" stroke-width="10.5"/>
            <polyline class="t-borde" points="425,69 543,69 543,231" stroke-width="14.5"/>
            <polyline class="t-fluido" points="425,69 543,69 543,231" stroke-width="10.5"/>

        </g>
        <line x1="543" y1="231" x2="543" y2="245.5" stroke="#1c1c1c" stroke-width="5"/>
        <rect x="529" y="243" width="28" height="5" fill="#1c1c1c"/>
            <g id="vapor-proceso-segmentos" visibility="hidden" pointer-events="none" aria-hidden="true"
               clip-path="url(#ce-clip-vapor-proceso)" fill="none" stroke-linecap="round">
                <!-- Un solo recorrido continuo orientado de caldera a proceso. -->
                <path id="vapor-proceso-recorrido" d="M543,245.5 V69 H250" stroke="${VAPOR_VISUAL.contorno}" stroke-width="${VAPOR_VISUAL.grosor + 2 * VAPOR_VISUAL.borde}"/>
                <path d="M543,245.5 V69 H250" stroke="${VAPOR_VISUAL.color}" stroke-width="${VAPOR_VISUAL.grosor}"/>
            </g>
        <g id="T-agua" class="tuberia" data-elemento="tuberiaAgua" data-fluido="vacio">
            <title>Línea de alimentación de agua</title>
            <!-- Corte en los extremos del cuerpo de valvulaAgua: 965 ± 14. -->
            <polyline class="t-borde" points="1035,150 979,150" stroke-width="11"/>
            <polyline class="t-fluido" points="1035,150 979,150" stroke-width="7"/>
            <polyline class="t-borde" points="951,150 915,150" stroke-width="11"/>
            <polyline class="t-fluido" points="951,150 915,150" stroke-width="7"/>
            <polyline class="t-borde" points="875,150 840,150 840,275" stroke-width="11"/>
            <polyline class="t-fluido" points="875,150 840,150 840,275" stroke-width="7"/>
        </g>
        <rect x="826" y="286" width="28" height="5" fill="#1c1c1c"/>
        <g id="T-drenaje" class="tuberia" data-elemento="tuberiaDrenaje" data-fluido="vacio">
            <title>Línea de drenaje</title>
            <!-- Corte en los extremos del cuerpo de valvulaDrenaje: 1030 ± 10. -->
            <polyline class="t-borde" points="913,463 1020,463" stroke-width="11"/>
            <polyline class="t-fluido" points="913,463 1020,463" stroke-width="7"/>
            <polyline class="t-borde" points="1040,463 1150,463" stroke-width="11"/>
            <polyline class="t-fluido" points="1040,463 1150,463" stroke-width="7"/>
        </g>
        <g id="T-combustible" class="tuberia" data-elemento="tuberiaCombustible" data-fluido="combustible">
            <title>Línea de combustible</title>
            <!-- Cortes para solenoide (30 ± 14), control (86 ± 14) y medidor (146 ± 20). -->
            <polyline class="t-borde" points="2,396.5 16,396.5" stroke-width="11"/>
            <polyline class="t-fluido" points="2,396.5 16,396.5" stroke-width="7"/>
            <polyline class="t-borde" points="44,396.5 72,396.5" stroke-width="11"/>
            <polyline class="t-fluido" points="44,396.5 72,396.5" stroke-width="7"/>
            <polyline class="t-borde" points="100,396.5 126,396.5" stroke-width="11"/>
            <polyline class="t-fluido" points="100,396.5 126,396.5" stroke-width="7"/>
            <polyline class="t-borde" points="166,396.5 335,396.5" stroke-width="11"/>
            <polyline class="t-fluido" points="166,396.5 335,396.5" stroke-width="7"/>
            <g id="combustible-segmentos" class="combustible-visual" opacity="0">
                <path d="M2,396.5 H16 M44,396.5 H72 M100,396.5 H126 M166,396.5 H335"/>
            </g>
        </g>
        ${tuberia("T-venteo", "tuberiaVenteo", "Línea de venteo", [[786, 226], [786, 159]], "vacio", 5)}
    </g>

    <!-- ========== E10 · BOQUILLA DE DRENAJE ==========
         Accesorio soldado a la pared derecha de la envolvente, a la altura de la zona de agua
         inferior (y 463). Atraviesa la pared (x 902–910) y deja libre el espacio de agua entre
         la pared de la cámara de retorno (x 896) y la envolvente. El tubo exterior (T-drenaje)
         arranca en la brida. -->
    <g id="E10-boquilla-drenaje" data-ref="E10">
        <title>Boquilla de drenaje</title>
        <rect x="901" y="457" width="11" height="12" fill="url(#ce-g-metal)" stroke="#1c1c1c" stroke-width="1.5"/>
        <rect x="910" y="453" width="5" height="20" rx="1" fill="#6a6a6a" stroke="#1c1c1c" stroke-width="1.5"/>
    </g>

    <!-- ========== E03 · SONDAS DE NIVEL  /  E04 · VÁLVULA DE SEGURIDAD ========== -->
    <g id="E03-sondas" data-ref="E03">
        <title>Sondas de nivel</title>
        ${sonda(611, NIVEL_REFERENCIA.inferior)}
        ${sonda(667, NIVEL_REFERENCIA.superior)}
    </g>
    <g id="E04-seguridad" data-ref="E04">
        <title>Válvula de seguridad</title>
        <rect x="724" y="196" width="12" height="14" fill="#6a6a6a" stroke="#1c1c1c" stroke-width="1.5"/>
        <rect x="718" y="170" width="24" height="26" rx="3" fill="url(#ce-g-sonda)" stroke="#1c1c1c" stroke-width="1.5"/>
        <rect x="722" y="162" width="16" height="8" rx="1" fill="#555" stroke="#1c1c1c" stroke-width="1.5"/>
        <path d="M742,180 H754 V186 H742" fill="#8d8d8d" stroke="#1c1c1c" stroke-width="1.5"/>
        <line x1="738" y1="164" x2="756" y2="152" stroke="#1c1c1c" stroke-width="2.5" stroke-linecap="round"/>
    </g>

    ${valvulaSolenoide({ id: "E09-valvula-corte", nombre: "Válvula de corte de combustible por solenoide", x: 30, y: 396.5 })}
        <foreignObject x="-13" y="320" width="86" height="38">
            <div xmlns="http://www.w3.org/1999/xhtml" class="panel-encendido botonera-cv" role="group" aria-label="Válvula de corte de combustible">
                <div class="orden-cv"><button type="button" id="btnAbrirCV" class="mando-encendido mando-verde" aria-label="Abrir válvula de corte" title="Abrir válvula de corte" disabled="disabled"><span aria-hidden="true">1</span></button></div>
                <div class="orden-cv"><button type="button" id="btnCerrarCV" class="mando-encendido mando-rojo" aria-label="Cerrar válvula de corte" title="Cerrar válvula de corte" disabled="disabled"><span aria-hidden="true">0</span></button></div>
            </div>
        </foreignObject>
    ${medidorFlujo({ id: "E09-medidor-flujo", elemento: "flujoCombustible", nombre: "Medidor de flujo de combustible", etiqueta: "Combustible", x: 146, y: 396.5, lecturaX: 20, lecturaY: -36 })}

    ${medidorFlujo({ id: "E07-medidor-flujo", elemento: "flujoAgua", nombre: "Medidor de flujo de agua de alimentación", etiqueta: "Agua", x: 895, y: 150, lecturaX: -15, lecturaY: -35 })}

    ${medidorFlujo({ id: "E06-medidor-flujo", elemento: "flujoVapor", nombre: "Medidor de flujo de vapor", etiqueta: "Vapor", x: 323.5, y: 69, lecturaY: 34 })}

    <!-- ========== VÁLVULAS ========== -->
    ${valvula({ id: "E05-valvula-venteo", elemento: "valvulaVenteo", ref: "E05", nombre: "Válvula de venteo", x: 786, y: 150, tipo: "vertical", estado: "abierta", escala: 0.9 })}
    ${valvula({ id: "E06-valvula-vapor", elemento: "valvulaVapor", ref: "E06", nombre: "Válvula principal de vapor", x: 411, y: 69, tipo: "compuerta", estado: "cerrada" })}
    ${valvula({ id: "E07-valvula-agua", elemento: "valvulaAgua", ref: "E07", nombre: "Válvula de agua de alimentación", x: 965, y: 150, tipo: "compuerta", estado: "cerrada" })}
    ${valvula({ id: "E09-valvula-combustible", elemento: "valvulaCombustible", ref: "E09", nombre: "Válvula de combustible", x: 86, y: 396.5, tipo: "compuerta", estado: "cerrada" })}
    ${valvula({ id: "E10-valvula-drenaje", elemento: "valvulaDrenaje", ref: "E10", nombre: "Válvula de drenaje", x: 1030, y: 463, tipo: "manual", estado: "abierta" })}

    <!-- ========== E07 · BAA (bomba de alimentación de agua) ========== -->
    <g id="E07-BAA" class="equipo interactivo" data-elemento="BAA" data-ref="E07" data-estado="parado"
       tabindex="0" role="button" aria-label="BAA, bomba de alimentación de agua"
       transform="translate(1075 150)">
        <title>BAA — Bomba de alimentación de agua</title>
        <rect class="color-estado e-borde" x="-60" y="-11" width="34" height="22"/>
        <g transform="translate(0 20)">
            <path d="M-26,38 H26 L32,50 H-32 Z" fill="#777" stroke="#1c1c1c" stroke-width="2"/>
            <circle class="color-estado e-borde" r="40"/>
            <circle r="26" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="2"/>
            <g class="aspas">
                <path d="M0,-22 L5,0 L0,22 L-5,0 Z M-22,0 L0,-5 L22,0 L0,5 Z" fill="#000" fill-opacity=".28"/>
            </g>
            <circle r="6" fill="#333"/>
        </g>
    </g>

    <!-- ========== E08 · VTF (ventilador de tiro forzado) ========== -->
    <g id="E08-VTF" class="equipo interactivo" data-elemento="VTF" data-ref="E08" data-estado="parado"
       tabindex="0" role="button" aria-label="VTF, ventilador de tiro forzado"
       transform="translate(340 412) scale(1.5384615384615385) translate(-72 29)">
        <title>VTF — Ventilador de tiro forzado</title>
        <rect vector-effect="non-scaling-stroke" class="color-estado e-borde" x="0" y="-42" width="72" height="26"/>
        <circle vector-effect="non-scaling-stroke" class="color-estado e-borde" r="42"/>
        <circle vector-effect="non-scaling-stroke" r="20" fill="#7a7a7a" stroke="#1c1c1c" stroke-width="2"/>
        <g class="aspas">
            <path vector-effect="non-scaling-stroke" d="M0,-18 V18 M-18,0 H18 M-12.7,-12.7 L12.7,12.7 M12.7,-12.7 L-12.7,12.7"
                  stroke="#1c1c1c" stroke-width="2" stroke-opacity=".55"/>
        </g>
        <circle vector-effect="non-scaling-stroke" r="7" fill="#444" stroke="#1c1c1c" stroke-width="1.5"/>
    </g>

    <!-- Representación didáctica del aire: posición calculada con tiempo de simulación. -->
    <defs><clipPath id="vtf-aire-recorte"><rect x="231" y="394" width="107" height="36"/></clipPath></defs>
    <g id="VTF-aire" class="aire-vtf" clip-path="url(#vtf-aire-recorte)" opacity="0">
        <g id="VTF-aire-segmentos">
            <path d="M211,402 h8 M238,402 h8 M265,402 h8 M292,402 h8 M319,402 h8 M346,402 h8
                     M211,422 h8 M238,422 h8 M265,422 h8 M292,422 h8 M319,422 h8 M346,422 h8"/>
        </g>
    </g>

    <!-- Compuerta de varias hojas en la descarga del VTF: dibujo fijo, sin interacción. -->
    <g id="VTF-compuerta-descarga" class="compuerta-vtf interactivo" data-elemento="compuertaAire" data-estado="cerrada" tabindex="0"
       transform="translate(319 392)" role="button" aria-label="Compuerta de descarga del VTF cerrada">
        <title>Compuerta de varias hojas en la descarga del VTF — cerrada</title>
        <defs>
            <linearGradient id="vtf-compuerta-intermedia" gradientUnits="userSpaceOnUse" x1="-12" y1="0" x2="12" y2="0">
                <stop offset="0" class="compuerta-vtf-verde"/><stop offset="0.5" class="compuerta-vtf-verde"/>
                <stop offset="0.5" class="compuerta-vtf-rojo"/><stop offset="1" class="compuerta-vtf-rojo"/>
            </linearGradient>
        </defs>
        <rect id="VTF-compuerta-marco" class="compuerta-vtf-marco" x="-14" y="0" width="28" height="40" rx="1"/>
        <g id="VTF-compuerta-hojas" class="compuerta-vtf-hojas">
            <path d="M-11,9 L11,2 L11,6 L-11,13 Z"/>
            <path d="M-11,21.5 L11,14.5 L11,18.5 L-11,25.5 Z"/>
            <path d="M-11,34 L11,27 L11,31 L-11,38 Z"/>
        </g>
        <path id="VTF-compuerta-enlace" class="compuerta-vtf-enlace" d="M8,7.5 V32.5 M0,7.5 H8 M0,20 H8 M0,32.5 H8"/>
        <g id="VTF-compuerta-pivotes" class="compuerta-vtf-pivotes">
            <circle cx="0" cy="7.5" r="1.7"/><circle cx="0" cy="20" r="1.7"/>
            <circle cx="0" cy="32.5" r="1.7"/>
        </g>
    </g>

    <!-- ========== E09 · UNIDAD DE COMBUSTIBLE ========== -->
    <g id="E09-unidad-combustible" class="equipo interactivo" data-elemento="unidadCombustible" data-ref="E09"
       data-estado="parado" tabindex="0" role="button" aria-label="Unidad de combustible"
       transform="translate(-57 356.5)">
        <title>Unidad de combustible</title>
        <rect class="color-estado e-borde" width="59" height="81"/>
        <circle cx="29.5" cy="22" r="17" fill="#000" fill-opacity=".18" stroke="#1c1c1c" stroke-width="2"/>
        <circle cx="29.5" cy="59" r="17" fill="#000" fill-opacity=".18" stroke="#1c1c1c" stroke-width="2"/>
    </g>

    <!-- Lectura de aire preparada, sin símbolo de medidor ni cálculo de caudal. -->
    <g id="hmi-flujo-aire" data-elemento="flujoAire" data-nombre="Flujo de aire"
       data-valor="0" data-unidad="kg/s" role="img" aria-label="Flujo de aire: 0.00 kg/s">
        <title>Flujo de aire: 0.00 kg/s</title>
        ${indicadorHMI({ nombre: "Aire", x: 340, y: 470, lectura: "0.00 kg/s", clase: "lectura-flujo" })}
    </g>

    <!-- Detector didáctico, sin interacción ni animación. -->
    <g id="detector-flama" transform="translate(${DETECTOR_FLAMA.x},${DETECTOR_FLAMA.y})"
       role="img" aria-label="Sin flama" data-detectada="no">
        <title>Sin flama</title>
        <rect width="${DETECTOR_FLAMA.w}" height="${DETECTOR_FLAMA.h}" fill="#fff" stroke="#333" stroke-width="1.5"/>
        <text x="${DETECTOR_FLAMA.w * 0.18}" y="${DETECTOR_FLAMA.h * 0.28}" text-anchor="middle" font-size="12" fill="#222">0</text>
        <text x="${DETECTOR_FLAMA.w * 0.82}" y="${DETECTOR_FLAMA.h * 0.28}" text-anchor="middle" font-size="12" fill="#222">1</text>
        <line id="detector-flama-aguja" x1="${DETECTOR_FLAMA.w / 2}" y1="${DETECTOR_FLAMA.h * 0.82}"
              x2="${DETECTOR_FLAMA.w * 0.18}" y2="${DETECTOR_FLAMA.h * 0.4}" stroke="#000" stroke-width="2"/>
        <circle cx="${DETECTOR_FLAMA.w / 2}" cy="${DETECTOR_FLAMA.h * 0.82}" r="2.5" fill="#000"/>
        <text x="${DETECTOR_FLAMA.w / 2}" y="-10" text-anchor="middle" font-size="12" fill="#333">Detector de flama</text>
    </g>

    <!-- ========== ETIQUETAS (opcionales: #etiquetas se puede ocultar) ========== -->
    <g id="etiquetas" class="etiquetas">
        <text x="252" y="46" text-anchor="start">Vapor a proceso</text>
        <text x="411" y="28">Válvula principal de vapor</text>
        <text x="411" y="103">FV-3</text>
        <text x="639" y="142">Sondas de nivel</text>
        <text x="730" y="146">Seguridad</text>
        <text x="786" y="130">Venteo</text>
        <text x="1075" y="234">BAA</text>
        <text x="965" y="174">FV-1</text>
        <text x="319" y="450">FZ-1</text>
        <text x="30" y="420">CV</text>
        <text x="86" y="420">FV-2</text>
        <text x="150" y="480">VTF</text>
        <text x="-23" y="458.5">BBA. Combustible</text>
        <text x="1030" y="438">Drenaje</text>
    </g>`;

    svg.innerHTML = escena;
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Vista lateral de una caldera pirotubular con sus equipos auxiliares");

    /* ---------------------------------------------------------
       API PÚBLICA — window.EscenaCaldera
    --------------------------------------------------------- */
    const manejadores = [];
    const porElemento = (nombre) => svg.querySelector(`[data-elemento="${nombre}"]`);
    const formatear = (valor, decimales) => Math.abs(valor) < 1e21 ? valor.toFixed(decimales) :
        valor.toLocaleString("en-US", { useGrouping: false, minimumFractionDigits: decimales, maximumFractionDigits: decimales });

    // Mantener dentro del recuadro incluso lecturas o unidades explícitas largas.
    const actualizarLectura = (texto, lectura, ancho) => {
        texto.textContent = lectura;
        texto.removeAttribute("textLength");
        texto.removeAttribute("lengthAdjust");
        if (typeof texto.getComputedTextLength === "function" && texto.getComputedTextLength() > ancho - 12) {
            texto.setAttribute("textLength", ancho - 12);
            texto.setAttribute("lengthAdjust", "spacingAndGlyphs");
        }
    };

    const actualizarHMI = (id, lectura) => {
        const el = svg.getElementById(id);
        actualizarLectura(el.querySelector(".hmi-valor"), lectura, Number(el.dataset.ancho));
        if (id === "hmi-presion" || id === "hmi-temperatura") {
            const descripcion = `${id === "hmi-presion" ? "Presión" : "Temperatura"}: ${lectura}`;
            el.querySelector("title").textContent = descripcion;
            el.setAttribute("aria-label", descripcion);
        }
    };

    const EscenaCaldera = {
        svg,

        /** Habilita las activaciones de escena sin cambiar colores ni estados del proceso. */
        setManiobrasHabilitadas(habilitadas) {
            svg.querySelectorAll(".interactivo").forEach(el => {
                el.setAttribute("aria-disabled", String(!habilitadas));
            });
        },

        /** Abre/cierra una válvula: "valvulaVapor" | "valvulaAgua" | "valvulaCombustible" | "valvulaCorteCombustible" | "valvulaVenteo" | "valvulaDrenaje" */
        setValvula(nombre, abierta, disparoEnclavado = false) {
            if (nombre === "valvulaVapor") { this.setAperturaValvulaVapor(abierta ? 100 : 0); return; }
            if (nombre === "valvulaAgua") { this.setAperturaValvulaAgua(abierta ? 100 : 0); return; }
            if (nombre === "valvulaCombustible") { this.setAperturaValvulaCombustible(abierta ? 100 : 0); return; }
            const el = porElemento(nombre);
            if (el) {
                el.dataset.estado = abierta ? "abierta" : "cerrada";
                if (nombre === "valvulaCorteCombustible") {
                    const descripcion = `Válvula de corte: ${el.dataset.estado}${disparoEnclavado && !abierta ? ", bloqueada por disparo" : ""}`;
                    el.querySelector("title").textContent = descripcion;
                    el.setAttribute("aria-label", descripcion);
                } else if (nombre === "valvulaVenteo") {
                    const descripcion = `Válvula de venteo: ${el.dataset.estado}`;
                    el.querySelector("title").textContent = descripcion;
                    el.setAttribute("aria-label", descripcion);
                }
            }
        },

        /** FV-3: apertura finita 0…100 %, solo presentación y sin efectos físicos. */
        setAperturaValvulaVapor(valor) {
            if (typeof valor !== "number" || !Number.isFinite(valor)) return;
            const apertura = Math.min(100, Math.max(0, valor));
            const el = porElemento("valvulaVapor");
            el.dataset.apertura = String(apertura);
            el.dataset.estado = apertura === 0 ? "cerrada" : apertura === 100 ? "abierta" : "parcial";
            const descripcion = `Válvula principal de vapor FV-3: apertura ${apertura} %`;
            el.querySelector("title").textContent = descripcion;
            el.setAttribute("aria-label", descripcion);
        },

        /** FV-2: apertura finita 0…100 %, sin cambiar geometría. */
        setAperturaValvulaCombustible(valor) {
            if (typeof valor !== "number" || !Number.isFinite(valor)) return;
            const apertura = Math.min(100, Math.max(0, valor));
            const el = porElemento("valvulaCombustible");
            el.dataset.apertura = String(apertura);
            el.dataset.estado = apertura === 0 ? "cerrada" : apertura === 100 ? "abierta" : "parcial";
            const descripcion = `Válvula de combustible FV-2: apertura ${Math.round(apertura)} %`;
            el.querySelector("title").textContent = descripcion;
            el.setAttribute("aria-label", descripcion);
        },

        /** Segmentos didácticos de combustible, sin lectura de caudal físico. */
        setFlujoCombustibleVisual(activo, apertura, tiempo) {
            if (![apertura, tiempo].every(v => typeof v === "number" && Number.isFinite(v))) return;
            const f = limitar(apertura / 100);
            const el = svg.getElementById("combustible-segmentos");
            el.setAttribute("opacity", activo && f > 0 ? 0.2 + 0.65 * f : 0);
            el.setAttribute("stroke-dashoffset", -((Math.max(0, tiempo) * 24) % 27));
        },

        /** Apertura de aire 0…100 %, hojas fijas y corte de color 50/50. */
        setAperturaCompuertaAire(valor) {
            if (typeof valor !== "number" || !Number.isFinite(valor)) return;
            const apertura = Math.min(100, Math.max(0, valor));
            const el = porElemento("compuertaAire");
            el.dataset.apertura = String(apertura);
            el.dataset.estado = apertura === 0 ? "cerrada" : apertura === 100 ? "abierta" : "intermedia";
            const descripcion = `Compuerta de aire: apertura ${apertura} %`;
            el.querySelector("title").textContent = descripcion;
            el.setAttribute("aria-label", descripcion);
        },

        /** Segmentos didácticos sin caudal físico; desplazamiento ligado al tiempo de simulación. */
        setAireCombustion(activo, apertura, tiempo) {
            if (![apertura, tiempo].every(v => typeof v === "number" && Number.isFinite(v))) return;
            const f = limitar(apertura / 100);
            svg.getElementById("VTF-aire").setAttribute("opacity", activo && f > 0 ? 0.2 + 0.65 * f : 0);
            svg.getElementById("VTF-aire-segmentos").setAttribute("transform", `translate(${((Math.max(0, tiempo) * 24) % 27).toFixed(3)} 0)`);
        },

        /** Apertura manual de alimentación en %, finita y limitada a 0…100; intermedia siempre 50/50. */
        setAperturaValvulaAgua(valor) {
            if (typeof valor !== "number" || !Number.isFinite(valor)) return;
            const apertura = Math.min(100, Math.max(0, valor));
            const el = porElemento("valvulaAgua");
            el.dataset.apertura = String(apertura);
            el.dataset.estado = apertura === 0 ? "cerrada" : apertura === 100 ? "abierta" : "parcial";
            const descripcion = `Válvula de agua de alimentación: apertura ${Math.round(apertura)} %`;
            el.querySelector("title").textContent = descripcion;
            el.setAttribute("aria-label", descripcion);
        },

        /** Lectura: "flujoCombustible" | "flujoAgua" | "flujoVapor" | "flujoAire"; número finito >= 0, combustible con tres decimales y los demás con dos; unidad textual opcional (kg/s por defecto; vacía conserva la actual). */
        setFlujo(nombre, valor, unidad = "kg/s") {
            if (!["flujoCombustible", "flujoAgua", "flujoVapor", "flujoAire"].includes(nombre) ||
                typeof valor !== "number" || !Number.isFinite(valor) || valor < 0 ||
                typeof unidad !== "string") return;
            const el = porElemento(nombre);
            if (!el) return;
            unidad = unidad || el.dataset.unidad || "kg/s";
            const numero = formatear(valor, nombre === "flujoCombustible" ? 3 : 2);
            const lectura = unidad ? `${numero} ${unidad}` : numero;
            el.dataset.valor = String(valor);
            el.dataset.unidad = unidad;
            actualizarLectura(el.querySelector(".lectura-flujo"), lectura, 124);
            el.querySelector("title").textContent = `${el.dataset.nombre}: ${lectura}`;
            el.setAttribute("aria-label", `${el.dataset.nombre}: ${lectura}`);
        },

        /** Presión HMI en bar(g), dos decimales; la aguja utiliza el valor sin redondear. */
        setPresion(valor) {
            if (typeof valor !== "number" || !Number.isFinite(valor)) return;
            actualizarHMI("hmi-presion", `${formatear(valor, 2)} bar(g)`);
            const escala = ESCALAS_INSTRUMENTOS["aguja-presion"];
            this.setAguja("aguja-presion", (valor - escala.minimo) / (escala.maximo - escala.minimo));
        },

        /** Temperatura HMI en °C, un decimal; la aguja utiliza el valor sin redondear. */
        setTemperatura(valor) {
            if (typeof valor !== "number" || !Number.isFinite(valor)) return;
            actualizarHMI("hmi-temperatura", `${formatear(valor, 1)} °C`);
            const escala = ESCALAS_INSTRUMENTOS["aguja-temperatura"];
            this.setAguja("aguja-temperatura", (valor - escala.minimo) / (escala.maximo - escala.minimo));
        },

        /** Pone en marcha/para un equipo: "BAA" | "VTF" | "unidadCombustible" */
        setEquipo(nombre, enMarcha) {
            const el = porElemento(nombre);
            if (el) {
                el.dataset.estado = enMarcha ? "marcha" : "parado";
                if (nombre === "unidadCombustible") {
                    const descripcion = `BBA. Combustible: ${enMarcha ? "en marcha" : "parada"}`;
                    el.querySelector("title").textContent = descripcion;
                    el.setAttribute("aria-label", descripcion);
                }
            }
        },

        /** Cambia el fluido de una tubería: "vacio" | "agua" | "vapor" */
        setTuberia(nombre, fluido) {
            const el = porElemento(nombre);
            if (el) el.dataset.fluido = fluido;
        },

        /** Lectura relativa compartida para una fracción interna 0…1; 0 % corresponde al nivel normal. */
        formatearNivelRelativo(fraccion) {
            return lecturaNivelRelativo(fraccion);
        },

        // Conversión numérica compartida por HMI y PI, sin redondear.
        nivelRelativo,

        /** Agua conserva su altura 0…1; visor calibrado entre las sondas y HMI relativo. */
        setNivelAgua(fraccion) {
            const f = limitar(fraccion);
            const agua = svg.getElementById("agua-nivel");
            const visor = svg.getElementById("visor-agua");
            const alto = f * CAV.h;
            const yAgua = CAV_FONDO - alto;
            agua.setAttribute("y", yAgua);
            agua.setAttribute("height", alto);
            // Misma superficie física en el SVG raíz. El panel desplaza el visor;
            // el recorte de su vidrio decide vacío/lleno, sin remapear porcentajes.
            visor.setAttribute("y", yAgua - PANEL_INSTRUMENTOS.desplazamientoY);
            visor.setAttribute("height", alto);
            actualizarHMI("hmi-nivel", this.formatearNivelRelativo(f));
        },

        /** Muestra/oculta el vapor en la parte alta de la caldera */
        setVapor(activo) {
            svg.getElementById("vapor-espacio").style.opacity = activo ? 1 : 0;
        },

        /** Permiso de acceso a FV-2; su ajuste sigue perteneciendo al estado central. */
        setPermisoAperturaCombustible(habilitado, quemadorEncendido, disparoEnclavado = false) {
            const el = porElemento("valvulaCombustible");
            el.setAttribute("aria-disabled", String(!habilitado));
            const descripcion = disparoEnclavado ? "Bloqueada por disparo" : "Enciende el quemador para regular FV-2";
            el.setAttribute("aria-description", quemadorEncendido ? "" : descripcion);
            if (!quemadorEncendido) el.querySelector("title").textContent += `; ${descripcion}`;
        },

        /** Presentación de transferencia de fase y salida efectiva; sin otro ciclo. */
        setVaporVisual(generacion, caudalProceso, nivel, tiempoVisual) {
            if (![generacion, caudalProceso, nivel, tiempoVisual].every(Number.isFinite) || tiempoVisual < 0) return;
            const interno = svg.getElementById("vapor-generacion-segmentos");
            const proceso = svg.getElementById("vapor-proceso-segmentos");
            const yModelo = CAV_FONDO - limitar(nivel) * CAV.h;
            // El agua existente suaviza y/height con CSS: seguir la superficie
            // realmente dibujada evita segmentos flotando durante ese ajuste.
            const yDibujada = Number.parseFloat(window.getComputedStyle?.(svg.getElementById("agua-nivel"))?.y);
            const yAgua = Number.isFinite(yDibujada) ? Math.min(CAV_FONDO, Math.max(CAV.y, yDibujada)) : yModelo;
            interno.dataset.superficieModelo = String(yModelo);
            svg.getElementById("vapor-superficie-recorte").setAttribute("height", Math.max(0, yAgua - CAV.y - 3));
            const intensidad = limitar(generacion / VAPOR_VISUAL.referenciaCaudal);
            const columnas = Math.round(VAPOR_VISUAL.columnasMinimas + intensidad *
                (VAPOR_VISUAL.columnasMaximas - VAPOR_VISUAL.columnasMinimas));
            interno.setAttribute("visibility", generacion > VAPOR_VISUAL.umbralCaudal && nivel > 0 ? "visible" : "hidden");
            interno.dataset.caudal = String(generacion);
            interno.dataset.superficie = String(yAgua);
            interno.setAttribute("stroke-dashoffset", -tiempoVisual * VAPOR_VISUAL.velocidadInterna);
            for (let i = 0; i < VAPOR_VISUAL.columnasMaximas; i++) {
                svg.getElementById(`vapor-columna-${i}`).setAttribute("visibility", i < columnas && generacion > VAPOR_VISUAL.umbralCaudal && nivel > 0 ? "visible" : "hidden");
                svg.getElementById(`vapor-columna-${i}`).setAttribute("stroke-dashoffset", -tiempoVisual * VAPOR_VISUAL.velocidadInterna - i * (VAPOR_VISUAL.longitud + VAPOR_VISUAL.separacionMaxima) / columnas);
                const x = CAV.x + 16 + (i + 0.5) / columnas * (CAV.w - 32);
                const recorrido = `M${x},${yAgua} V${CAV.y + 3}`;
                svg.getElementById(`vapor-ascenso-${i}`).setAttribute("d", recorrido);
                svg.getElementById(`vapor-centro-${i}`).setAttribute("d", recorrido);
            }
            // Separación variable, acotada; la fase usa distancia visual acumulada.
            const separacion = VAPOR_VISUAL.separacionMaxima - limitar(caudalProceso / VAPOR_VISUAL.referenciaCaudal) *
                (VAPOR_VISUAL.separacionMaxima - VAPOR_VISUAL.separacionMinima);
            proceso.setAttribute("visibility", caudalProceso > VAPOR_VISUAL.umbralCaudal ? "visible" : "hidden");
            proceso.dataset.caudal = String(caudalProceso);
            proceso.setAttribute("stroke-dasharray", `${VAPOR_VISUAL.longitud} ${separacion}`);
            proceso.setAttribute("stroke-dashoffset", -tiempoVisual * VAPOR_VISUAL.velocidadProceso);
        },

        /** Gases didácticos: reloj visual real activo, independiente del factor ×100. */
        setGasesCombustion(activo, tiempoVisual) {
            if (typeof activo !== "boolean" || typeof tiempoVisual !== "number" ||
                !Number.isFinite(tiempoVisual) || tiempoVisual < 0) return;
            const grupo = svg.getElementById("gases-segmentos");
            grupo.setAttribute("visibility", activo ? "visible" : "hidden");
            const periodo = GASES_VISUALES.longitud + GASES_VISUALES.separacion;
            grupo.setAttribute("stroke-dashoffset", -(tiempoVisual * GASES_VISUALES.velocidad % periodo));
        },

        /** Indicador binario de detección didáctica; no ordena encendidos. */
        setFlamaDetectada(detectada) {
            if (typeof detectada !== "boolean") return;
            const el = svg.getElementById("detector-flama");
            const descripcion = detectada ? "Flama detectada" : "Sin flama";
            el.dataset.detectada = detectada ? "si" : "no";
            el.setAttribute("aria-label", descripcion);
            el.querySelector("title").textContent = descripcion;
            svg.getElementById("detector-flama-aguja").setAttribute("x2",
                DETECTOR_FLAMA.w * (detectada ? 0.82 : 0.18));
        },

        /** Llama: apagada | piloto | principal; apertura principal 0…100 (opcional: 100). */
        setLlama(estado, apertura = 100) {
            if (!["apagada", "piloto", "principal"].includes(estado)) return;
            if (typeof apertura !== "number" || !Number.isFinite(apertura)) return;
            const valor = Math.min(100, Math.max(0, apertura));
            const llama = svg.getElementById("llama");
            if (estado === "principal") {
                const superior = TAMANOS_LLAMA.findIndex(ref => ref.apertura >= valor);
                const fin = TAMANOS_LLAMA[superior];
                const inicio = TAMANOS_LLAMA[Math.max(0, superior - 1)];
                const fraccion = fin.apertura === inicio.apertura ? 0 :
                    (valor - inicio.apertura) / (fin.apertura - inicio.apertura);
                const forma = llama.querySelector(".llama-forma");
                forma.style.setProperty("--llama-longitud", inicio.longitud + fraccion * (fin.longitud - inicio.longitud));
                forma.style.setProperty("--llama-ancho", inicio.ancho + fraccion * (fin.ancho - inicio.ancho));
            }
            llama.dataset.estado = estado === "principal" && valor === 0 ? "apagada" : estado;
        },

        /** API informativa: booleano enclavado externo; null = protección pendiente.
         * No altera permisos, combustible ni estado operativo. */
        setDisparoEnclavado(enclavado = null) {
            if (enclavado !== null && typeof enclavado !== "boolean") return;
            const indicador = svg.getElementById("indicador-disparo");
            const descripcion = enclavado === null ? "Protecciones pendientes de implementar" :
                enclavado ? "Caldera disparada" : "Caldera restablecida";
            svg.getElementById("indicador-disparo-relleno").setAttribute("fill",
                enclavado === null ? "#b9b9b9" : enclavado ? "#00a040" : "#d02020");
            indicador.setAttribute("aria-label", descripcion);
            indicador.querySelector("title").textContent = descripcion;
        },

        /** Aguja de instrumento 0…1: "aguja-presion" | "aguja-temperatura" */
        setAguja(id, fraccion) {
            const g = svg.getElementById(id);
            if (!g) return;
            const escala = ESCALAS_INSTRUMENTOS[id];
            if (!escala) return;
            const ang = escala.anguloMinimo + limitar(fraccion) * (escala.anguloMaximo - escala.anguloMinimo);
            g.setAttribute("transform", `rotate(${ang} ${g.dataset.cx} ${g.dataset.cy})`);
        },

        /** Resalta uno o varios elementos interactivos (guía del paso actual). Sin argumentos: quita todo. */
        resaltar(...nombres) {
            svg.querySelectorAll(".resaltado").forEach((el) => el.classList.remove("resaltado"));
            nombres.forEach((n) => porElemento(n)?.classList.add("resaltado"));
        },

        /** Muestra/oculta las etiquetas de texto */
        etiquetas(visibles) {
            svg.getElementById("etiquetas").style.display = visibles ? "" : "none";
        },

        /** Registra un callback (nombreElemento, nodo) para clic / Enter / Espacio en válvulas y equipos */
        alClic(fn) {
            manejadores.push(fn);
        },

        /** Estado inicial = Paso 0 (caldera fría, vacía y parada; venteo y drenaje abiertos) */
        reiniciar() {
            this.setDisparoEnclavado(null);
            ["valvulaVapor", "valvulaAgua", "valvulaCombustible", "valvulaCorteCombustible"].forEach((v) => this.setValvula(v, false));
            ["flujoCombustible", "flujoAgua", "flujoVapor", "flujoAire"].forEach((f) => this.setFlujo(f, 0, "kg/s"));
            ["valvulaVenteo", "valvulaDrenaje"].forEach((v) => this.setValvula(v, true));
            ["BAA", "VTF", "unidadCombustible"].forEach((e) => this.setEquipo(e, false));
            ["tuberiaVapor", "tuberiaAgua", "tuberiaDrenaje", "tuberiaVenteo"].forEach((t) => this.setTuberia(t, "vacio"));
            this.setAperturaCompuertaAire(0);
            this.setAireCombustion(false, 0, 0);
            this.setFlujoCombustibleVisual(false, 0, 0);
            this.setNivelAgua(0);
            this.setPresion(0);
            this.setTemperatura(25);
            this.setVapor(false);
            this.setLlama("apagada");
            this.setGasesCombustion(false, 0);
            this.setVaporVisual(0, 0, 0, 0);
            this.setFlamaDetectada(false);
            this.resaltar();
        }
    };

    const disparar = (el) => {
        if (el.getAttribute("aria-disabled") === "true") return;
        const nombre = el.dataset.elemento;
        manejadores.forEach((fn) => fn(nombre, el));
    };

    svg.addEventListener("click", (ev) => {
        const el = ev.target.closest(".interactivo");
        if (el && svg.contains(el)) disparar(el);
    });

    svg.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        const el = ev.target.closest(".interactivo");
        if (!el) return;
        ev.preventDefault();
        disparar(el);
    });

    EscenaCaldera.reiniciar();
    window.EscenaCaldera = EscenaCaldera;
})();
