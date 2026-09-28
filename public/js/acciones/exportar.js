/**
 * Salidas del presupuesto: texto para pegar en Excel, archivo Excel (.xlsx) y PDF (vista de impresión).
 */
import * as api from "../api/cliente.js";
import { estado, datosDeObra } from "../estado/estado.js";
import { catalogo } from "../estado/catalogo.js";
import { esc, num, pesos, r2 } from "../utilidades/formato.js";
import { nombrePorDefecto } from "../vistas/comunes.js";

const aTexto = filas => filas.map(f => f.join("\t")).join("\n");
const nombreObra = () => (estado.nombreObra || "").trim() || nombrePorDefecto();

/** Capítulos con sus líneas, en el orden del presupuesto. */
export function capitulosDe(lineas) {
  const caps = [];
  for (const l of lineas) {
    let c = caps.find(x => x.numero === l.capitulo.numero);
    if (!c) caps.push(c = { ...l.capitulo, lineas: [], subtotal: 0 });
    c.lineas.push(l);
    c.subtotal += l.total;
  }
  return caps;
}

export function textoPresupuesto() {
  const { lineas, presupuesto: p } = estado.calculo;
  const filas = [["Ítem", "Descripción", "Unidad", "Cantidad", "Vr. unitario", "Vr. parcial", "Precio"]];
  for (const c of capitulosDe(lineas)) {
    filas.push([String(c.numero), c.nombre.toUpperCase()]);
    c.lineas.forEach(l => filas.push([l.item, l.nombre, l.unidad, l.cantidad, Math.round(l.unitario), Math.round(l.total), l.precioPropio || l.composicion.cotizacion ? "Cotización" : l.composicion.oficial ? "Oficial" : "APU"]));
    filas.push(["", `Subtotal capítulo ${c.numero}`, "", "", "", Math.round(c.subtotal)]);
  }
  const pie = (texto, valor) => filas.push(["", texto, "", "", "", Math.round(valor)]);
  filas.push([]);
  pie("Costo directo", p.directo);
  if (estado.ejecucion === "contratista") {
    const pct = k => r2(estado.aiu[k] * 100);
    pie(`Administración ${pct("a")}%`, p.admin); pie(`Imprevistos ${pct("i")}%`, p.imprev);
    pie(`Utilidad ${pct("u")}%`, p.util); pie(`IVA ${pct("iva")}% de la utilidad`, p.ivaUtil); pie("Valor total con AIU", p.total);
  }
  if (p.propios > 0) { pie("Suministrado o ya comprado", -p.propios); pie("Por invertir", p.porInvertir); }
  return aTexto(filas);
}

export function textoCompras() {
  const filas = [["Material o ítem", "Cantidad", "Unidad", "Costo aprox.", "Estado", "Precio"]];
  const precio = c => (c.tipo === "oficial" ? "Lista oficial" : c.tipo === "cotizado" || c.precioPropio ? "Cotización" : "Referencia");
  estado.calculo.compras.forEach(c => {
    filas.push([c.nombre, c.cantidad, c.unidad, Math.round(c.costo), c.comprado ? "Comprado" : "Por comprar", precio(c)]);
  });
  return aTexto(filas);
}

/** Descarga el presupuesto en Excel (capítulos, APU, memoria de cantidades, compras y cronograma). */
export async function descargarExcel() {
  const archivo = await api.descargarExcel(datosDeObra(), nombreObra());
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = `Presupuesto - ${nombreObra().replace(/[\\/:*?"<>|]+/g, "")}.xlsx`;
  document.body.appendChild(enlace);
  enlace.click();
  setTimeout(() => { URL.revokeObjectURL(enlace.href); enlace.remove(); }, 1000);
}

/**
 * Tiempos de elaboración de las obras guardadas, para comparar con y sin la herramienta (objetivo 5).
 * @param {object[]} obras resúmenes de "Mis obras"
 */
export function descargarTiempos(obras) {
  const celda = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const filas = [["Obra", "Empezó", "Terminó", "Minutos activos", "Valor total", "AIU"]];
  for (const o of obras) filas.push([o.nombre, o.tiempo?.inicio || "", o.tiempo?.fin || "", o.tiempo ? Math.round(o.tiempo.ms / 6000) / 10 : "",
    o.resumen?.total ?? "", o.ejecucion === "contratista" ? "Con AIU" : "Costo directo"]);
  const csv = "\ufeff" + filas.map(f => f.map(celda).join(";")).join("\r\n");
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  enlace.download = "tiempos-de-elaboracion.csv";
  document.body.appendChild(enlace);
  enlace.click();
  setTimeout(() => { URL.revokeObjectURL(enlace.href); enlace.remove(); }, 1000);
}

/** Abre la vista de impresión del presupuesto; desde ahí se guarda como PDF. */
export function imprimirPresupuesto() {
  const { lineas, presupuesto: p } = estado.calculo;
  const conAIU = estado.ejecucion === "contratista";
  const fila = (a, b, valor, clase = "") => `<tr class="${clase}"><td></td><td colspan="4">${a}</td><td class="n">${b ?? ""}${valor !== undefined ? pesos.format(valor) : ""}</td></tr>`;
  const cuerpo = capitulosDe(lineas).map(c => `
    <tr class="cap"><td>${c.numero}</td><td colspan="5">${esc(c.nombre.toUpperCase())}</td></tr>
    ${c.lineas.map(l => `<tr><td>${l.item}</td><td>${esc(l.nombre)}${l.precioPropio || l.composicion.cotizacion ? " <i>(precio cotizado)</i>" : ""}</td><td>${esc(l.unidad)}</td>
      <td class="n">${num.format(l.cantidad)}</td><td class="n">${pesos.format(l.unitario)}</td><td class="n">${pesos.format(l.total)}</td></tr>`).join("")}
    ${fila(`Subtotal capítulo ${c.numero}`, null, c.subtotal, "sub")}`).join("");
  const pct = k => `${num.format(r2(estado.aiu[k] * 100))} %`;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Presupuesto - ${esc(nombreObra())}</title>
  <style>
    @page { size: letter; margin: 16mm 14mm; }
    body { font: 10.5pt/1.4 "Helvetica Neue", Arial, sans-serif; color: #222; margin: 0; }
    h1 { font-size: 16pt; margin: 0 0 4pt; } .meta { color: #555; margin-bottom: 12pt; } .meta b { color: #222; }
    table { width: 100%; border-collapse: collapse; } th, td { padding: 4pt 5pt; border-bottom: 0.5pt solid #ccc; vertical-align: top; text-align: left; }
    th { background: #f1ece3; font-size: 9pt; } td.n, th.n { text-align: right; white-space: nowrap; }
    tr.cap td { background: #f7f4ee; font-weight: bold; } tr.sub td { font-weight: bold; } tr.total td { font-weight: bold; font-size: 11.5pt; border-top: 1pt solid #222; }
    tr { page-break-inside: avoid; } .nota { color: #555; font-size: 8.5pt; margin-top: 12pt; }
  </style></head><body>
  <h1>Presupuesto de obra</h1>
  <div class="meta"><b>Proyecto:</b> ${esc(nombreObra())}<br><b>Fecha:</b> ${new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}
    · <b>Valor:</b> ${conAIU ? "con AIU (la ejecuta un contratista)" : "costo directo, sin AIU"}<br>
    <b>Precios:</b> referencia de Cali consultada el ${esc(catalogo.fechaPrecios)}; ítems oficiales de la Gobernación del Valle 2024${lineas.some(l => l.precioPropio || l.composicion.cotizacion) ? "; precios cotizados donde se indica" : ""}.</div>
  <table><thead><tr><th>Ítem</th><th>Descripción</th><th>Unidad</th><th class="n">Cantidad</th><th class="n">Vr. unitario</th><th class="n">Vr. parcial</th></tr></thead>
  <tbody>${cuerpo}
    ${fila("COSTO DIRECTO", null, p.directo, "sub")}
    ${conAIU ? `${fila(`Administración (${pct("a")})`, null, p.admin)}${fila(`Imprevistos (${pct("i")})`, null, p.imprev)}${fila(`Utilidad (${pct("u")})`, null, p.util)}${fila(`IVA sobre la utilidad (${pct("iva")})`, null, p.ivaUtil)}` : ""}
    ${fila(conAIU ? "VALOR TOTAL CON AIU" : "VALOR TOTAL", null, p.total, "total")}
  </tbody></table>
  ${p.rango ? `<p class="nota"><b>Rango:</b> si ${p.rango.actividades.length} actividades costaran lo de su referencia oficial, el total sería ${pesos.format(p.rango.total)}.</p>` : ""}
  <p class="nota">Valores en pesos colombianos. Mano de obra con prestaciones sociales 2026. Presupuesto preliminar para obra de un piso: no reemplaza el diseño estructural (NSR-10) ni las cotizaciones de proveedores y contratistas.</p>
  </body></html>`;
  const marco = document.createElement("iframe");
  marco.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
  document.body.appendChild(marco);
  marco.contentDocument.open();
  marco.contentDocument.write(html);
  marco.contentDocument.close();
  setTimeout(() => { marco.contentWindow.focus(); marco.contentWindow.print(); setTimeout(() => marco.remove(), 2000); }, 300);
}
