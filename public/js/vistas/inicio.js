/**
 * Pantalla de inicio: qué hace la herramienta y "Mis obras".
 */
import { estado } from "../estado/estado.js";
import { historial } from "../estado/historial.js";
import { esc, num, pesos } from "../utilidades/formato.js";
import { duracion } from "../utilidades/cronometro.js";

const fecha = iso => { try { return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }); } catch { return ""; } };

function misObras() {
  if (!historial.lista.length) return "";
  return `<div class="seccion" style="margin-top:40px"><h2>Mis obras</h2>
    <p>Guardadas en este navegador: siguen aquí al volver a entrar desde este dispositivo, sin iniciar sesión. Se pueden abrir para ver el detalle, marcar avances o modificarlas.</p>
    <div class="filas">${historial.lista.map(o => `<div class="fila">
      <span class="nom">${esc(o.nombre)}<small>${fecha(o.actualizada)}${o.resumen.avance ? ` · ${o.resumen.avance} % hecho` : ""}${o.resumen.dias ? ` · faltan ${num.format(o.resumen.dias)} días` : ""}${o.ejecucion === "contratista" ? " · con AIU" : ""}${o.tiempo?.ms ? ` · elaborado en ${duracion(o.tiempo.ms)}` : ""}</small></span>
      <span class="val">${historial.borrar === o.id
        ? `<button class="btn peligro chico" data-borrar-si="${esc(o.id)}">Borrar</button> <button class="enlace" data-borrar-no="1">Cancelar</button>`
        : `<b>${pesos.format(o.resumen.total || 0)}</b><br><button class="enlace" data-abrir="${esc(o.id)}">Abrir</button> · <button class="enlace" data-borrar="${esc(o.id)}">Borrar</button>`}</span>
    </div>`).join("")}</div>
    <div class="acciones" style="margin-top:14px"><button class="enlace" data-accion="descargar-tiempos">Descargar tiempos de elaboración (CSV, para la validación)</button></div></div>`;
}

export function pantallaInicio() {
  return `<section class="inicio">
    <h1>Presupuesto de obra</h1>
    <p class="sub">Presupuesto por capítulos con APU, cronograma y lista de compras para obras pequeñas en Cali, con precios de tiendas locales y de la lista oficial de la Gobernación del Valle.</p>
    <div class="bloque"><button class="btn" data-accion="nueva">${historial.lista.length ? "Nueva obra" : "Empezar un presupuesto"}</button></div>
    ${estado.mensaje ? `<p class="aviso ok" role="status">${esc(estado.mensaje)}</p>` : ""}
    ${misObras()}
    <ul class="incluye">
      <li><b>1</b><span>Se describe la obra con palabras: muros, baños, cocinas, cuartos o una casa de un piso, remodelaciones o actividades sueltas.</span></li>
      <li><b>2</b><span>Se revisan las medidas, lo que incluye cada parte y los materiales disponibles en obra.</span></li>
      <li><b>3</b><span>Resultado: presupuesto por capítulos con el APU de cada ítem, cronograma, compras, y descarga en Excel o PDF.</span></li>
    </ul>
    <div class="bloque acciones"><button class="enlace" data-vista="fuentes">¿De dónde salen los precios?</button><button class="enlace" data-vista="oficial">Consultar la lista oficial de precios</button></div>
  </section>`;
}
