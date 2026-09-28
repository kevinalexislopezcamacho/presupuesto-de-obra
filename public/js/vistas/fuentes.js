/**
 * "¿De dónde salen los precios?": fuentes, contraste con precios oficiales y calidad del modelo.
 */
import { estado } from "../estado/estado.js";
import { catalogo, apu, nombreTipo, nombreCortoApu } from "../estado/catalogo.js";
import { esc, pesos } from "../utilidades/formato.js";
import { nav, cargando } from "./comunes.js";

const enlace = (url, texto) => (url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(texto)}</a>` : esc(texto));
/** La fuente de un insumo: cada tienda con su precio (el de referencia es la mediana) o la única fuente. */
const fuenteInsumo = i => (i.tiendas
  ? `${i.tiendas.map(t => `${enlace(t.url, t.tienda)}: ${pesos.format(t.precio)}`).join("<br>")}<br><small style="color:var(--muted)">${esc(i.fuente)}</small>`
  : enlace(i.url, i.fuente));

function tablaInsumos() {
  const m = catalogo.manoDeObra;
  const prestaciones = Object.values(m.factorPrestacional).reduce((a, b) => a + b, 0).toFixed(2).replace(".", ",");
  return `<div class="seccion"><h2>Materiales y mano de obra</h2>
    <p>Materiales y alquileres: precios publicados por tiendas de Cali y Jamundí entre el ${catalogo.fechaPrecios}; donde hay varias tiendas se usa la mediana (el precio del medio, con el precio normal y no el de oferta), para no depender de una sola; formaleta y agua: listas oficiales de EMCALI. Localización, excavación, rellenos, retiro de sobrantes, solado y demoliciones: precio oficial de la Gobernación del Valle 2024 (<button class="enlace" data-vista="oficial">consultar la lista</button>). Mano de obra: salarios 2026 (ayudante, mínimo de ${pesos.format(m.smmlv)}; oficial, promedio de ${pesos.format(m.salarioOficial)}) más ${prestaciones} % de prestaciones y el auxilio de transporte.</p>
    <div class="scroll"><table><thead><tr><th>Insumo</th><th class="n">Precio</th><th>Fuente</th></tr></thead><tbody>
    ${Object.values(catalogo.insumos).map(i => `<tr><td>${esc(i.nombre)}</td><td class="n">${pesos.format(i.precio)}/${i.unidad}</td><td>${fuenteInsumo(i)}</td></tr>`).join("")}
    </tbody></table></div></div>`;
}

function tablaContraste() {
  const filas = Object.entries(catalogo.referenciasOficiales).flatMap(([codigo, referencias]) => {
    const propio = apu(codigo);
    return referencias.map(o => {
      const diferencia = (propio.unitario - o.precio) / o.precio;
      return `<tr><td>${esc(propio.nombre)}<br><small style="color:var(--muted)">${enlace(o.url, o.fuente)}, ítem ${esc(o.item)}</small></td>
        <td class="n">${pesos.format(propio.unitario)}</td><td class="n">${pesos.format(o.precio)}</td>
        <td class="n" style="color:${Math.abs(diferencia) > 0.25 ? "var(--warn)" : "var(--ok)"}">${diferencia > 0 ? "+" : ""}${Math.round(diferencia * 100)} %</td></tr>`;
    });
  });
  return `<div class="seccion"><h2>¿Los cálculos son razonables?</h2>
    <p>Comparamos lo que calcula la herramienta con el precio oficial que publican la Gobernación del Valle (2024), la Alcaldía de Cali (2026) y EMCALI (2025) para la misma actividad. Las entidades lo usan como tope para contratar obra pública. Más de 25 % de diferencia se marca para revisar.</p>
    <div class="scroll"><table><thead><tr><th>Actividad</th><th class="n">Calculado</th><th class="n">Oficial</th><th class="n">Dif.</th></tr></thead><tbody>${filas.join("")}</tbody></table></div></div>`;
}

const pct = v => `${(v * 100).toFixed(1).replace(".", ",")} %`;

/** Precisión, recall y F1 por clase, y comparación con modelos simples (líneas base). */
function metricas(e) {
  if (!e.metricas) return "";
  const clase = c => nombreTipo(c).replace(/^Una? /, "");
  const filas = e.metricas.porClase.map(m => `<tr><td>${clase(m.clase)}</td><td class="n">${pct(m.precision)}</td><td class="n">${pct(m.recall)}</td><td class="n">${pct(m.f1)}</td><td class="n">${m.soporte}</td></tr>`).join("");
  const bases = [...(e.lineasBase || []), ...(e.combinado ? [e.combinado] : [])];
  return `<p style="margin-top:14px"><b>Por clase</b> (validación cruzada; F1 macro ${pct(e.metricas.macro.f1)}):</p>
    <div class="scroll"><table><thead><tr><th>Clase</th><th class="n">Precisión</th><th class="n">Recall</th><th class="n">F1</th><th class="n">Frases</th></tr></thead><tbody>${filas}</tbody></table></div>
    <p style="margin-top:14px"><b>Comparado con modelos simples</b> (mismas ${e.nTest} frases):</p>
    <div class="scroll"><table><thead><tr><th>Modelo</th><th class="n">Exactitud</th></tr></thead><tbody>
      <tr><td>Naive Bayes solo</td><td class="n">${pct(e.exactitud)}</td></tr>
      ${bases.map(b => `<tr><td>${esc(b.nombre)}${b.sinRespuesta ? ` <small>(${b.sinRespuesta} frases sin palabra clave cuentan como error)</small>` : ""}${b.frasesSinPalabraClave !== undefined ? ` <small>(el modelo resolvió ${b.aciertosDelModeloEnEsas} de ${b.frasesSinPalabraClave} frases sin palabra clave)</small>` : ""}</td><td class="n">${pct(b.exactitud)}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="nota">Casi todas las frases de entrenamiento nombran el tipo (“baño”, “muro”), por eso las palabras clave solas aciertan mucho. El modelo aporta en las frases que no lo nombran (“donde bañarme”); para medirlo mejor hacen falta más frases reales de ese tipo.</p>`;
}

function seccionModelo() {
  const d = estado.diagnostico;
  if (!d) return `<div class="seccion"><h2>¿Cómo entiende lo que escribes?</h2>${cargando("Cargando la evaluación del modelo…")}</div>`;
  const e = d.modelo, ei = d.interprete, clase = c => nombreTipo(c).replace(/^Una? /, "");
  const describir = xs => xs.map(v => (/^[A-Z]/.test(v) ? nombreCortoApu(v) : `${v.split(" ")[0]} ${catalogo.nombresTipo[v.split(" ")[1]][+v.split(" ")[0] === 1 ? 0 : 1]}`)).join(" + ") || "nada";
  return `<div class="seccion"><h2>¿Cómo entiende lo que escribes?</h2>
    <p>En tres pasos. Primero separa la frase en partes (“un baño y una cocina” son dos). Después decide qué es cada parte: si nombra el tipo (“bodega”, “tapia”, “pañetar”), esa palabra manda; si no, decide un modelo de Machine Learning (${esc(e.algoritmo)}) entrenado con ${e.frases} frases en ${e.clases.length} clases, y si duda (menos de ${e.umbralConfianza * 100} % de confianza) le pregunta. Por último lee cantidades y medidas con reglas (“4 muros”, “de 3 x 2,5”, “70 m2”).</p>
    <p><b>El modelo:</b> con validación cruzada de ${e.pliegues} partes (cada frase se prueba con un modelo que no la vio) acierta el <b>${Math.round(e.exactitud * 100)} %</b> (${e.aciertos} de ${e.nTest}).</p>
    <div class="scroll"><table class="matriz"><thead><tr><th>Real ↓ Predicho →</th>${e.clases.map(c => `<th>${clase(c)}</th>`).join("")}</tr></thead>
    <tbody>${e.clases.map(r => `<tr><th>${clase(r)}</th>${e.clases.map(p => `<td class="${r === p ? "diag" : ""}">${e.matriz[r][p]}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    ${metricas(e)}
    <p style="margin-top:14px"><b>El intérprete completo:</b> entiende ${ei.aciertos} de ${ei.total} frases nuevas, que no están en el entrenamiento.</p>
    <details><summary>Ver las frases de prueba</summary><div class="scroll"><table><thead><tr><th>Frase</th><th>Entendió</th><th></th></tr></thead><tbody>
      ${ei.detalle.map(x => `<tr><td>${esc(x.frase)}</td><td>${esc(describir(x.obtenido))}</td><td>${x.ok ? "✓" : "✗"}</td></tr>`).join("")}</tbody></table></div></details></div>`;
}

export function pantallaFuentes() {
  return `<h2 class="titulo">¿De dónde salen los precios?</h2>
    <p class="sub">Cada actividad se calcula sumando lo que lleva (materiales, mano de obra y equipo) por su precio real.</p>
    ${tablaInsumos()}
    ${tablaContraste()}
    ${seccionModelo()}
    ${nav("", `<button class="btn sec" data-accion="volver">Volver</button>`)}`;
}
