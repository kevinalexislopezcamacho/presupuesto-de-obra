/**
 * Dibuja la pantalla actual a partir del estado y coordina los cálculos con el backend.
 * Las vistas solo generan HTML; aquí se decide cuál mostrar y cuándo volver a calcular.
 */
import * as api from "./api/cliente.js";
import { estado, PANTALLA, PASOS, datosDeObra, guardarBorrador } from "./estado/estado.js";
import { esc } from "./utilidades/formato.js";
import { pantallaInicio } from "./vistas/inicio.js";
import { pantallaObra } from "./vistas/obra.js";
import { pantallaMedidas } from "./vistas/medidas.js";
import { pantallaMateriales } from "./vistas/materiales.js";
import { pantallaResultado } from "./vistas/resultado.js";
import { pantallaFuentes } from "./vistas/fuentes.js";
import { pantallaOficial } from "./vistas/oficial.js";

const $ = selector => document.querySelector(selector);
const VISTAS = {
  [PANTALLA.INICIO]: pantallaInicio, [PANTALLA.OBRA]: pantallaObra, [PANTALLA.MEDIDAS]: pantallaMedidas,
  [PANTALLA.MATERIALES]: pantallaMateriales,
  [PANTALLA.RESULTADO]: pantallaResultado, [PANTALLA.FUENTES]: pantallaFuentes, [PANTALLA.OFICIAL]: pantallaOficial
};
/** Pantallas que muestran resultados del cálculo. */
export const USAN_CALCULO = [PANTALLA.MEDIDAS, PANTALLA.MATERIALES, PANTALLA.RESULTADO, PANTALLA.OFICIAL];

let ultimaPantalla = null, programado = false;

function barraDeProgreso() {
  const paso = PASOS.indexOf(estado.pantalla);
  const listo = estado.pantalla === PANTALLA.RESULTADO;
  $("#progreso-txt").textContent = listo ? "Listo" : paso >= 0 ? `Paso ${paso + 1} de ${PASOS.length}` : "";
  $("#progreso").style.width = listo ? "100%" : paso >= 0 ? `${((paso + 1) / (PASOS.length + 1)) * 100}%` : "0%";
}

/** Vuelve a dibujar (una sola vez por ciclo aunque se pida varias veces), conservando el foco. */
export function render() {
  if (programado) return;
  programado = true;
  queueMicrotask(() => {
    programado = false;
    const foco = document.activeElement?.id;
    const error = estado.error ? `<div class="aviso no" role="alert"><strong>Algo falló.</strong>${esc(estado.error)}</div>` : "";
    $("#app").innerHTML = error + VISTAS[estado.pantalla]();
    document.body.dataset.pantalla = estado.pantalla;   // el CSS ajusta el ancho según la pantalla
    barraDeProgreso();
    if (ultimaPantalla !== estado.pantalla) {
      window.scrollTo(0, 0);
      ultimaPantalla = estado.pantalla;
      if (estado.pantalla === PANTALLA.OBRA) $("#texto-obra")?.focus();
    } else if (foco) {
      const elemento = document.getElementById(foco);
      elemento?.focus();
      if (foco === "busqueda" && elemento) elemento.setSelectionRange(elemento.value.length, elemento.value.length);
    }
  });
}

let secuencia = 0;
/** Pide al backend el cálculo de la obra actual. Si llegan respuestas en desorden, solo vale la última. */
export async function recalcular() {
  const numero = ++secuencia;
  try {
    const calculo = await api.calcular(datosDeObra());
    if (numero === secuencia) { estado.calculo = calculo; estado.error = ""; }
  } catch (e) {
    if (numero === secuencia) estado.error = e.message;
  }
}

/**
 * Aplica un cambio: lo ejecuta, guarda el borrador, dibuja y, si cambió algo de la obra,
 * vuelve a calcular y dibuja de nuevo con el resultado.
 * @param {() => (void|Promise<void>)} cambio
 * @param {{ calcular?: boolean }} opciones
 */
export async function actualizar(cambio, { calcular = false } = {}) {
  try {
    await cambio();
    estado.error = "";
  } catch (e) {
    estado.error = e.message;
  }
  guardarBorrador();
  const faltaCalculo = USAN_CALCULO.includes(estado.pantalla) && !estado.calculo;
  render();
  if (calcular || faltaCalculo) {
    await recalcular();
    render();
  }
}

/** Mensaje corto que se borra solo (por ejemplo, "Lista copiada"). */
export function avisoBreve(texto) {
  const el = $("#aviso-breve");
  if (!el) return;
  el.textContent = texto;
  clearTimeout(avisoBreve.temporizador);
  avisoBreve.temporizador = setTimeout(() => { el.textContent = ""; }, 4000);
}
