/**
 * Paso 1: la persona describe la obra con sus palabras (o elige un tipo).
 */
import { estado, PANTALLA } from "../estado/estado.js";
import { catalogo, nombreTipo } from "../estado/catalogo.js";
import { esc } from "../utilidades/formato.js";
import { nav, resumenInterpretacion, notaNoCalculado, notasInterpretacion, insigniaMotor, ocupado } from "./comunes.js";

export const FRASES_EJEMPLO = [
  "4 muros de 3 x 2,5 m en bloque de concreto",
  "Remodelar un baño de 2 x 1,5 y una cocina de 3 x 2,5 con mesón de 2 m",
  "Una habitación de 3 x 4 y pañetar la sala de 20 m2",
  "Una casa de 9 x 7 con dos baños"
];

// Lo que se entendió, con preguntas cuando hay dudas o partes que no se calculan.
function avisoInterpretacion() {
  const i = estado.interpretacion;
  if (!i || (!i.res.dudas.length && !i.res.noSoportado.length)) return "";
  const lista = resumenInterpretacion(i.res);
  const dudas = i.res.dudas.map((d, k) => `<div class="duda"><strong>No se identificó qué es “${esc(d.texto)}”.</strong> ¿A cuál corresponde?
    <div class="chips">${d.ranking.slice(0, 3).map(o => `<button class="chip" data-duda="${k}" data-duda-tipo="${o.tipo}">${nombreTipo(o.tipo)}</button>`).join("")}
    <button class="chip" data-duda="${k}" data-duda-tipo="ignorar">Ignorar</button></div></div>`).join("");
  const cierre = i.res.dudas.length ? ""
    : lista ? `<div class="acciones" style="margin-top:12px"><button class="btn chico" data-accion="seguir-interpretacion">Continuar con lo identificado</button></div>`
      : `<p style="margin-top:8px">No se encontró nada que se pueda calcular. Elija abajo qué se va a construir o escríbalo de otra forma.</p>`;
  return `<div class="aviso">
    ${lista ? `<div class="aviso-cab"><strong>Se identificó:</strong>${insigniaMotor(i.res)}</div><ul class="entendi">${lista}</ul>` : ""}
    ${dudas}
    ${notaNoCalculado(i.res, lista || i.res.dudas.length ? "margin-top:10px" : "margin:0")}
    ${notasInterpretacion(i.res)}
    ${cierre}
  </div>`;
}

/** Aviso de quién entiende el texto (y a dónde se envía). */
function notaIA() {
  const ia = estado.diagnostico?.ia;
  if (!ia) return "";
  return ia.activa
    ? `<p class="nota"><span class="insignia ia">IA · ${esc(ia.proveedor)}</span> La descripción se envía a ${esc(ia.proveedor)} (Google) para interpretarla. La herramienta verifica cada número contra lo escrito y calcula todo con sus propias fórmulas.</p>`
    : `<p class="nota">Puede pedir varias cosas separadas por comas o “y”, con sus medidas, e indicar lo que no se incluye: “sin enchape”.</p>`;
}

export function pantallaObra() {
  const ocupada = Boolean(estado.ocupado);
  return `<h2 class="titulo">Descripción de la obra</h2>
    <p class="sub">Describa qué se va a construir o remodelar: cantidad, medidas y lo que se incluye o no, como se le explicaría a un maestro de obra.</p>
    <div class="bloque">
      <textarea id="texto-obra" aria-label="Describe la obra" placeholder="Ej.: 4 muros de 3 x 2,5 m y un baño de 2 x 1,5 sin enchape" ${ocupada ? "readonly" : ""}>${esc(estado.texto)}</textarea>
      ${notaIA()}
      <div class="ejemplos">${FRASES_EJEMPLO.map((f, k) => `<button data-ejemplo="${k}" ${ocupada ? "disabled" : ""}>${esc(f)}</button>`).join("")}</div>
      ${ocupado()}
      ${avisoInterpretacion()}
    </div>
    <div class="bloque">
      <p class="etiqueta">O elija directamente:</p>
      <div class="chips">${catalogo.tiposObra.map(t => `<button class="chip" data-tipo="${t}">${nombreTipo(t)}</button>`).join("")}
        <button class="chip" data-tipo="libre">Solo trabajos sueltos</button></div>
    </div>
    ${nav(`data-ir="${PANTALLA.INICIO}"`, `<button class="btn" data-accion="interpretar" ${ocupada ? "disabled" : ""}>${ocupada ? "Interpretando…" : "Siguiente"}</button>`)}`;
}
