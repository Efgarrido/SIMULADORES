"use strict";

const sliders = [1, 2, 3].map(i => document.getElementById(`parametro${i}`));
const valores = [1, 2, 3].map(i => document.getElementById(`valor${i}`));
const indicadores = [1, 2, 3, 4, 5, 6, 7].map(i => document.getElementById(`indicador${i}`));
const pauseBtn = document.getElementById("pauseBtn");
const pestanas = [...document.querySelectorAll(".pestana-grafica")];
const areaGrafica = document.getElementById("graficas");
let pausado = true;
let iniciado = false;
let solicitudAnimacion = null;
let ultimoTiempo = null;
const velocidadVisual = 120; // grados/s; independiente de RPM y sliders provisionales.

function actualizarValores() {
    valores[0].textContent = `${sliders[0].value} %`;
    valores[1].textContent = `${theta.toFixed(0)}°`;
    valores[2].textContent = sliders[2].value;
}

function actualizarResultados() {
    const s = model.summary;
    const resultados = [
        ['Eficiencia térmica', (s.Efficiency * 100).toFixed(2), '%', 'Eficiencia térmica'],
        ['Trabajo neto', (s.W_net * 1000).toFixed(2), 'J/ciclo', 'Trabajo neto'],
        ['Potencia indicada', s.Power.toFixed(2), 'kW', 'Potencia indicada'],
        ['Calor suministrado', (s.Q_in * 1000).toFixed(2), 'J', 'Calor suministrado'],
        ['Masa del cilindro', (s.m * 1000).toFixed(2), 'g', 'Masa del cilindro'],
        ['Presión máxima', (s.P_max / 1000).toFixed(2), 'MPa', 'Presión máxima'],
        ['Eficiencia teórica', (s.eta_otto * 100).toFixed(2), '%', 'Eficiencia teórica'],
    ];
    resultados.forEach(([titulo, valor, unidad, nombreCompleto], i) => {
        const etiqueta = document.getElementById(`titulo-indicador${i + 1}`);
        etiqueta.textContent = titulo;
        etiqueta.title = nombreCompleto;
        indicadores[i].textContent = valor;
        const elementoUnidad = document.getElementById(`unidad-indicador${i + 1}`);
        elementoUnidad.textContent = unidad;
        elementoUnidad.title = unidad === 'adim.' ? 'Adimensional' : unidad;
    });
}

function actualizarModelo() {
    actualizarValores();
    model = runModel4(params);
    actualizarResultados();
    renderPlot();
    frame();
}

function aplicar() {
    actualizarModelo();
    iniciado = true;
    pausado = false;
    pauseBtn.textContent = "PAUSA";
    pauseBtn.setAttribute("aria-pressed", "false");
    actualizarAnimacion();
}

function posicionarAngulo() {
    theta = Number(sliders[1].value);
    pausado = true;
    pauseBtn.textContent = "CONTINUAR";
    pauseBtn.setAttribute("aria-pressed", "true");
    actualizarAnimacion();
    frame();
}

function alternarPausa() {
    if (!iniciado) return;
    pausado = !pausado;
    pauseBtn.textContent = pausado ? "CONTINUAR" : "PAUSA";
    pauseBtn.setAttribute("aria-pressed", String(pausado));
    actualizarAnimacion();
}

function seleccionarGrafica(pestana) {
    pestanas.forEach(tab => tab.setAttribute("aria-selected", String(tab === pestana)));
    curPlot = pestana.id.replace("tab-", "");
    renderPlot();
    areaGrafica.setAttribute("aria-labelledby", pestana.id);
}

function avanzarPasoPlantilla() {
    if (!pausado) return;
    theta = (theta + 1) % 720;
    frame();
}

function reiniciar() {
    sliders[0].value = "100";
    sliders[1].value = "0";
    sliders[2].value = "50";
    pausado = true;
    iniciado = false;
    pauseBtn.textContent = "PAUSA";
    pauseBtn.setAttribute("aria-pressed", "true");
    theta = 0;
    actualizarModelo();
    actualizarAnimacion();
    seleccionarGrafica(pestanas[0]);
}

function actualizarLecturas(row) {
    const readings = { theta: row.theta, T: row.T, P: row.P,
        V: row.Vol * 1000000, m: row.m * 1000, s: row.s, u: row.u };
    const decimals = { theta: 0, T: 2, P: 2, V: 2, m: 4, s: 4, u: 2 };
    Object.entries(readings).forEach(([key, value]) => {
        document.getElementById(`inst_${key}`).textContent = value.toFixed(decimals[key]);
    });
}

function frame() {
    if (model) { const row = rowNow(); drawEngine(theta, row); actualizarLecturas(row); updateMarker(); }
    sliders[1].value = theta;
    actualizarValores();
}

function tick(tiempo) {
    solicitudAnimacion = null;
    if (pausado) return;
    const dt = ultimoTiempo === null ? 0 : Math.max(0, Math.min(0.1, (tiempo - ultimoTiempo) / 1000));
    ultimoTiempo = tiempo;
    theta = (theta + dt * velocidadVisual * Number(sliders[0].value) / 100) % 720;
    frame();
    solicitudAnimacion = requestAnimationFrame(tick);
}

function actualizarAnimacion() {
    if (solicitudAnimacion !== null) cancelAnimationFrame(solicitudAnimacion);
    solicitudAnimacion = null;
    ultimoTiempo = null;
    if (!pausado) solicitudAnimacion = requestAnimationFrame(tick);
}

pestanas.forEach(tab => tab.addEventListener("click", () => seleccionarGrafica(tab)));
document.getElementById("stepBtn").addEventListener("click", avanzarPasoPlantilla);
sliders[0].addEventListener("input", actualizarValores);
sliders[1].addEventListener("input", posicionarAngulo);
sliders[2].addEventListener("input", actualizarValores);
document.getElementById("applyBtn").addEventListener("click", aplicar);
pauseBtn.addEventListener("click", alternarPausa);
document.getElementById("resetBtn").addEventListener("click", reiniciar);
pauseBtn.setAttribute("aria-pressed", "true");
actualizarValores();
model = runModel4(params);
buildEngine();
buildThermalScale();
actualizarResultados();
renderPlot();
frame();
actualizarAnimacion();

$("csvBtn").addEventListener("click", exportCSV);
$("logY").addEventListener("change", renderPlot);
$("legend").innerHTML = Object.values(STROKE).map(s => `<span><i style="background:${s.c}"></i>${s.es}</span>`).join("");
