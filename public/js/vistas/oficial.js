/**
 * Lista oficial de precios de la Gobernación del Valle 2024: buscar un ítem, filtrarlo por capítulo
 * y agregarlo al presupuesto con su precio oficial.
 */
import { estado } from "../estado/estado.js";
import { catalogo } from "../estado/catalogo.js";
import { esc, num, pesos } from "../utilidades/formato.js";
import { nav, cargando } from "./comunes.js";

const SUGERENCIAS = ["demolición", "excavación", "pintura", "cubierta", "cielo raso", "puerta", "ventana", "estuco", "impermeabilización", "andén"];
const UNIDAD = { M2: "m²", M3: "m³", ML: "m", M: "m", UND: "und", KG: "kg" };

function fila(i) {
  const u = UNIDAD[i.unidad] || (i.unidad || "").toLowerCase() || "—";
  const pdf = `${catalogo.listaOficial.url}#page=${i.pagina}`;
  const yaEsta = estado.extras.find(x => x.codigo === `GOB-${i.codigo}`);
  return `<div class="fila con-campo oficial-fila">
    <span class="nom"><span class="codigo">${esc(i.codigo)}</span> ${esc(i.actividad)}
      <small>${esc(i.nombreCapitulo)} · <a href="${esc(pdf)}" target="_blank" rel="noopener">página ${i.pagina} del decreto</a>${i.verificado ? "" : ` · <span class="alerta-txt">${esc(i.nota || "valor por verificar en el PDF")}</span>`}${i.unidadDe === "listado-2019" ? " · unidad del listado 2019" : ""}${yaEsta ? ` · <b class="ya-agregado">en el presupuesto: ${num.format(yaEsta.cantidad)} ${esc(u)}</b>` : ""}</small></span>
    <span class="val"><span class="precio-oficial"><b>${pesos.format(i.valor)}</b> por ${esc(u)}</span>
      <label class="campo-cant" for="o-${esc(i.codigo)}"><span>Cantidad (${esc(u)})</span>
        <input class="cant" id="o-${esc(i.codigo)}" type="number" min="0" step="any" inputmode="decimal" placeholder="0"></label>
      <button class="btn sec chico" data-agregar-oficial="${esc(i.codigo)}">${yaEsta ? "Sumar" : "Agregar"}</button></span>
  </div>`;
}

/** Ítems oficiales que ya están en el presupuesto, con nombre, cantidad y valor (del último cálculo). */
function yaAgregados() {
  const agregados = estado.extras.filter(x => x.codigo.startsWith("GOB-"));
  if (!agregados.length) return "";
  const lineas = estado.calculo?.lineas || [];
  const filas = agregados.map(x => {
    const l = lineas.find(y => y.codigo === x.codigo);
    const detalle = l ? `${num.format(x.cantidad)} ${esc(l.unidad)} × ${pesos.format(l.unitario)}` : `Cantidad: ${num.format(x.cantidad)}`;
    return `<div class="fila"><span class="nom"><span class="codigo">${esc(x.codigo.slice(4))}</span> ${esc(l?.nombre || "")}<small>${detalle}</small></span>
      <span class="val">${l ? `<b>${pesos.format(l.total)}</b>` : ""} <button class="enlace" data-quitar-trabajo="${esc(x.codigo)}">Quitar</button></span></div>`;
  }).join("");
  const suma = agregados.reduce((s, x) => s + (lineas.find(y => y.codigo === x.codigo)?.total || 0), 0);
  return `<div class="bloque ya-en-presupuesto">
    <p class="etiqueta">Ya en el presupuesto (${agregados.length} ${agregados.length === 1 ? "ítem" : "ítems"}${suma ? ` · ${pesos.format(suma)} de costo directo` : ""})</p>
    <div class="filas">${filas}</div>
    <div class="acciones"><button class="btn chico" data-accion="ver-presupuesto">Ver el presupuesto</button></div>
  </div>`;
}

export function pantallaOficial() {
  const o = estado.oficial, lista = catalogo.listaOficial;
  const r = o.resultado;
  const capitulos = o.capitulos
    ? o.capitulos.map(c => `<option value="${esc(c.codigo)}" ${o.capitulo === c.codigo ? "selected" : ""}>${esc(c.codigo)} · ${esc(c.nombre)} (${c.items})</option>`).join("")
    : "";
  return `<h2 class="titulo">Lista oficial de precios</h2>
    <p class="sub">${esc(lista.fuente)}, ${esc(lista.documento.split(":")[0])}: ${num.format(lista.total)} ítems con su precio unitario de referencia (costo directo). Sirve para consultar precios oficiales y para agregar al presupuesto lo que la herramienta no calcula sola: pintura, cubierta, puertas, ventanas, cielo raso…</p>
    <ol class="pasos-oficial">
      <li><b>Busque la actividad.</b> Escríbala en el buscador o toque una sugerencia.</li>
      <li><b>Escriba la cantidad</b> en la casilla del ítem, en la unidad que indica (m, m², und…).</li>
      <li><b>Pulse Agregar.</b> El ítem pasa al presupuesto, en el capítulo “Ítems de la lista oficial”.</li>
    </ol>
    <div class="bloque buscador-oficial">
      <input class="buscar" id="oficial-q" type="search" placeholder="Ej.: demolición de enchape, excavación, cielo raso…" value="${esc(o.q)}" aria-label="Buscar en la lista oficial">
      <select id="oficial-cap" data-oficial-capitulo="1" aria-label="Capítulo"><option value="">Todos los capítulos</option>${capitulos}</select>
      <button class="btn chico" data-accion="buscar-oficial" ${o.buscando ? "disabled" : ""}>Buscar</button>
    </div>
    <div class="chips sugerencias">${SUGERENCIAS.map(s => `<button class="chip" data-sugerencia-oficial="${esc(s)}">${esc(s)}</button>`).join("")}</div>
    ${yaAgregados()}
    ${o.buscando && !r ? cargando("Buscando…") : ""}
    ${r ? `<p class="etiqueta" style="margin-top:20px">${r.total ? `${num.format(r.total)} ${r.total === 1 ? "ítem" : "ítems"}${r.total > r.items.length ? `; se muestran ${r.items.length}` : ""}` : "No hay ítems con esa búsqueda."}</p>
      <div class="filas">${r.items.map(fila).join("")}</div>
      ${r.total > r.items.length ? `<div class="acciones"><button class="btn sec chico" data-accion="mas-oficial" ${o.buscando ? "disabled" : ""}>Ver más</button></div>` : ""}` : ""}
    <div class="estado-msg" id="aviso-breve" role="status" aria-live="polite"></div>
    <p class="nota">Transcrito del <a href="${esc(lista.url)}" target="_blank" rel="noopener">PDF oficial</a> escaneado, con lectura automática (OCR) verificada: cada valor se leyó cuatro veces y se acepta cuando coinciden. Los marcados “por verificar” conviene confirmarlos en la página indicada. Son precios de 2024.</p>
    ${nav("", `<button class="btn sec" data-accion="volver">Volver</button>`)}`;
}
