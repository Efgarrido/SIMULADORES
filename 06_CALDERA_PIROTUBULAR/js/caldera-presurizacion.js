"use strict";

// Supuestos didácticos: agua saturada en equilibrio + metal a la misma T.
// Se supone expulsado el aire durante el calentamiento con venteo abierto.
// No se calculan aire atrapado, vapor sobrecalentado ni líquido monofásico cerrado.
const PRESURIZACION = Object.freeze({
    volumenUtil: 1.50, // m³, equivalente útil descontando hogar/tubos
    descargaVenteo: 0.50, // kg/(s·sqrt(bar)); descarga adicional por sobrepresión
    descargaProceso: Object.freeze({
        // Aproximación didáctica para FV-3 a receptor atmosférico constante.
        // No es dimensionamiento de válvula ni modelo de flujo compresible.
        presionReceptor: 1.01325, // bar(a)
        deltaPReferencia: 6.00, // bar; 6.00 bar(g) contra atmósfera
        presionTrabajo: 8.00, // bar(a); punto estacionario de calibración
        factorSobrecarga: 1.10, // 100 % solicita el 110 % de la producción nominal
        // La tabla carga antes que TERMICA: calcular una vez, al primer uso.
        get caudalReferencia() { return calibrarDescargaProceso().caudalReferencia; }
    }),
    toleranciaInicio: 0.05, // °C respecto a saturación real, nunca al HMI redondeado
    toleranciaResolucion: 1e-9 // °C para el cierre de masa/volumen/energía
});

function propiedadesSaturadas(temperatura) {
    if (!Number.isFinite(temperatura) || temperatura < TABLA_AGUA_SATURADA.minimo ||
        temperatura > TABLA_AGUA_SATURADA.maximo) return null;
    const filas = TABLA_AGUA_SATURADA.filas;
    let lo = 0, hi = filas.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (filas[mid][0] <= temperatura) lo = mid; else hi = mid;
    }
    const a = filas[lo], b = filas[hi], f = (temperatura - a[0]) / (b[0] - a[0]);
    const r = a.map((v, i) => v + (b[i] - v) * f);
    return { temperatura, presionAbsoluta: r[1], vl: r[2], vv: r[3], ul: r[4], uv: r[5], hl: r[6], hv: r[7] };
}

function inventarioSaturado(masaTotal, temperatura) {
    const p = propiedadesSaturadas(temperatura);
    if (!p || !Number.isFinite(masaTotal) || masaTotal <= 0) return null;
    const masaVapor = (PRESURIZACION.volumenUtil - masaTotal * p.vl) / (p.vv - p.vl);
    const masaLiquida = masaTotal - masaVapor;
    if (masaVapor < 0 || masaLiquida < 0) return null;
    const energiaTotal = masaLiquida * p.ul + masaVapor * p.uv +
        TERMICA.capacidadMetal * (temperatura - TERMICA.ambiente);
    return { ...p, masaTotal, masaLiquida, masaVapor, energiaTotal,
        volumenLiquido: masaLiquida * p.vl, volumenVapor: masaVapor * p.vv };
}

function resolverInventario(masaTotal, energiaTotal) {
    if (!Number.isFinite(energiaTotal)) return null;
    let lo = TABLA_AGUA_SATURADA.minimo, hi = TABLA_AGUA_SATURADA.maximo;
    const inicial = inventarioSaturado(masaTotal, lo);
    if (!inicial || energiaTotal < inicial.energiaTotal - 1e-7) return null;
    if (!inventarioSaturado(masaTotal, hi)) {
        // La región bifásica puede acabar antes del máximo de la tabla.
        let valido = lo, invalido = hi;
        for (let i = 0; i < 45; i++) {
            const t = (valido + invalido) / 2;
            if (inventarioSaturado(masaTotal, t)) valido = t; else invalido = t;
        }
        hi = valido;
    }
    const final = inventarioSaturado(masaTotal, hi);
    if (!final || energiaTotal > final.energiaTotal + 1e-7) return null;
    while (hi - lo > PRESURIZACION.toleranciaResolucion) {
        const mid = (hi + lo) / 2;
        const r = inventarioSaturado(masaTotal, mid);
        if (!r) return null;
        if (r.energiaTotal < energiaTotal) lo = mid; else hi = mid;
    }
    const r = inventarioSaturado(masaTotal, (hi + lo) / 2);
    // Conservar la energía integrada sin redondeos, no la aproximación de la raíz.
    return { ...r, energiaTotal };
}

function iniciarPresurizacion(masaLiquida, temperatura) {
    const p = propiedadesSaturadas(temperatura);
    if (!p || masaLiquida <= 0 || masaLiquida > CAPACIDAD_EQUIVALENTE_AGUA ||
        Math.abs(temperatura - TERMICA.saturacion) > PRESURIZACION.toleranciaInicio) return null;
    const espacioVapor = PRESURIZACION.volumenUtil - masaLiquida * p.vl;
    if (espacioVapor <= 0) return null;
    // El vapor ya presente en el espacio abierto no se crea a partir de la masa líquida
    // al cerrar: se hace explícito el inventario que la primera etapa no contabilizaba.
    // Migración de la energía anterior, relativa a ambiente, sin alterar T ni nivel:
    // Eprev=(ml*cp+Cmetal)*(T-Tamb). Se añade ml*[ul-cp*(T-Tamb)] + mv*uv
    // para usar la referencia nativa IF97 y contabilizar la energía del espacio de vapor.
    const masaVapor = espacioVapor / p.vv;
    return inventarioSaturado(masaLiquida + masaVapor, temperatura);
}

let calibracionDescargaProceso = null;
function calibrarDescargaProceso() {
    if (calibracionDescargaProceso) return calibracionDescargaProceso;
    const p = PRESURIZACION.descargaProceso;
    let lo = TABLA_AGUA_SATURADA.minimo, hi = TABLA_AGUA_SATURADA.maximo;
    while (hi - lo > PRESURIZACION.toleranciaResolucion) {
        const mid = (lo + hi) / 2;
        if (propiedadesSaturadas(mid).presionAbsoluta < p.presionTrabajo) lo = mid; else hi = mid;
    }
    const propiedades = propiedadesSaturadas((lo + hi) / 2);
    const potenciaMaxima = CAUDAL_MAX_COMBUSTIBLE * TERMICA.pciDiesel * TERMICA.eficiencia;
    const perdidas = TERMICA.perdidas * (propiedades.temperatura - TERMICA.ambiente);
    const entalpiaAlimentacion = TABLA_AGUA_SATURADA.entalpiaAlimentacion;
    // Estacionario: entrada = vapor, sin venteo/drenaje ni acumulación agua/metal.
    const produccionNominal = (potenciaMaxima - perdidas) / (propiedades.hv - entalpiaAlimentacion);
    const caudalTrabajo = p.factorSobrecarga * produccionNominal;
    const caudalReferencia = caudalTrabajo / Math.sqrt((p.presionTrabajo - p.presionReceptor) / p.deltaPReferencia);
    calibracionDescargaProceso = Object.freeze({
        temperatura: propiedades.temperatura, entalpiaVapor: propiedades.hv,
        entalpiaAlimentacion, potenciaMaxima, perdidas, produccionNominal,
        caudalTrabajo, caudalReferencia
    });
    return calibracionDescargaProceso;
}

function calcularCaudalVaporProceso(aperturaVapor, presionAbsoluta) {
    const p = PRESURIZACION.descargaProceso;
    if (!Number.isFinite(aperturaVapor) || !Number.isFinite(presionAbsoluta) ||
        aperturaVapor <= 0 || presionAbsoluta <= p.presionReceptor) return 0;
    return p.caudalReferencia * Math.min(100, Math.max(0, aperturaVapor)) / 100 *
        Math.sqrt(Math.max(presionAbsoluta - p.presionReceptor, 0) / p.deltaPReferencia);
}

function resolverConDescarga(masaBase, energiaBase, entalpiaVapor, salidaVenteo, salidaProceso) {
    const total = salidaVenteo + salidaProceso;
    const resolver = (factor) => {
        const r = resolverInventario(masaBase - total * factor, energiaBase - total * factor * entalpiaVapor);
        return r && r.masaLiquida <= CAPACIDAD_EQUIVALENTE_AGUA + 1e-7 ? r : null;
    };
    let resultado = resolver(1);
    if (resultado) return { resultado, salidaVenteo, salidaProceso };
    let lo = 0, hi = 1;
    resultado = resolver(0);
    for (let i = 0; i < 40; i++) {
        const f = (lo + hi) / 2;
        const r = resolver(f);
        if (r) {
            lo = f;
            resultado = r;
        } else {
            hi = f;
        }
    }
    return resultado ? { resultado, salidaVenteo: salidaVenteo * lo, salidaProceso: salidaProceso * lo } : null;
}

function integrarInventario(actual, entrada, drenaje, combustible, quemador, venteo, aperturaVapor, dt) {
    const potencia = quemador && actual.masaLiquida > 0 ? combustible * TERMICA.pciDiesel * TERMICA.eficiencia : 0;
    const calor = (potencia - TERMICA.perdidas * (actual.temperatura - TERMICA.ambiente)) * dt;
    const salidaLiquida = Math.min(drenaje * dt, actual.masaLiquida);
    const entradaAceptada = Math.min(entrada * dt,
        Math.max(0, CAPACIDAD_EQUIVALENTE_AGUA - actual.masaLiquida + salidaLiquida));
    const masaSinVenteo = actual.masaTotal + entradaAceptada - salidaLiquida;
    const energiaSinVenteo = actual.energiaTotal + calor +
        entradaAceptada * TABLA_AGUA_SATURADA.entalpiaAlimentacion - salidaLiquida * actual.hl;
    // Derivada dE/dM de la mezcla saturada a T constante y volumen fijo.
    const derivada = (actual.vv * actual.ul - actual.vl * actual.uv) / (actual.vv - actual.vl);
    const vaporTermico = Math.max(0, (calor + entradaAceptada *
        (TABLA_AGUA_SATURADA.entalpiaAlimentacion - derivada) -
        salidaLiquida * (actual.hl - derivada)) / (actual.hv - derivada));
    let salidaVenteo = venteo ? Math.min(actual.masaVapor,
        vaporTermico + PRESURIZACION.descargaVenteo * Math.sqrt(Math.max(0,
            actual.presionAbsoluta - TERMICA.atmosfera)) * dt) : 0;
    let salidaProceso = calcularCaudalVaporProceso(aperturaVapor, actual.presionAbsoluta) * dt;
    // Las dos salidas comparten el vapor disponible al inicio del subpaso.
    // La evaporación/condensación interna se obtiene después del balance de equilibrio.
    const solicitada = salidaVenteo + salidaProceso;
    const fraccionDisponible = solicitada > 0 ? Math.min(1, actual.masaVapor / solicitada) : 1;
    salidaVenteo *= fraccionDisponible;
    salidaProceso *= fraccionDisponible;
    let descarga = resolverConDescarga(masaSinVenteo, energiaSinVenteo, actual.hv, salidaVenteo, salidaProceso);
    let resultado = descarga?.resultado;
    // No descargar por debajo del equilibrio atmosférico mientras haya calor positivo.
    // Limitar la masa descargada (no fijar P/T ni descartar energía) al alcanzar esa frontera.
    if (venteo && actual.temperatura >= TERMICA.saturacion && resultado &&
        resultado.temperatura < TERMICA.saturacion - 1e-7 && vaporTermico > 0) {
        let lo = 0, hi = salidaVenteo;
        for (let i = 0; i < 36; i++) {
            const mv = (lo + hi) / 2;
            const r = resolverConDescarga(masaSinVenteo, energiaSinVenteo, actual.hv, mv, salidaProceso)?.resultado;
            if (r && r.temperatura >= TERMICA.saturacion) lo = mv; else hi = mv;
        }
        salidaVenteo = lo;
        descarga = resolverConDescarga(masaSinVenteo, energiaSinVenteo, actual.hv, salidaVenteo, salidaProceso);
        resultado = descarga?.resultado;
    }
    if (!resultado || resultado.masaLiquida > CAPACIDAD_EQUIVALENTE_AGUA + 1e-7) return null;
    // Diagnóstico de fase, sin volver a restar masa/energía: transferencia
    // líquido→vapor = Δmv + salidas de vapor (alimentación y drenaje son líquidos).
    const transferenciaFase = resultado.masaVapor - actual.masaVapor +
        descarga.salidaVenteo + descarga.salidaProceso;
    return { ...resultado, entradaAceptada, salidaLiquida,
        salidaVenteo: descarga.salidaVenteo,
        salidaProceso: descarga.salidaProceso,
        salidaVapor: descarga.salidaVenteo,
        calor, transferenciaFase, generacionVapor: Math.max(0, transferenciaFase) / dt };
}
