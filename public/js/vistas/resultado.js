/**
 * Resultado: total, avisos, y pestañas de presupuesto, cronograma, compras y precios.
 */
import { estado } from "../estado/estado.js";
import { catalogo, insumo, nombreTipo, nombreCantidad, nombreCortoApu } from "../estado/catalogo.js";
import { esc, num, coef, pesos } from "../utilidades/formato.js";
import { aISO, diaHabil, fechaCorta } from "../utilidades/fechas.js";
import { mapsBuscar } from "../utilidades/navegador.js";
import { describirElemento, nombrePorDefecto, cargando, nombreActividad } from "./comunes.js";
import { tiendasDeCali } from "./materiales.js";
import { capitulosDe } from "../acciones/exportar.js";

const DIAS_VIGENCIA = 90;         // un precio de referencia con más días se marca como posiblemente desactualizado
const UNIDAD = { hh: "hora", h: "hora" };
const unidad = u => UNIDAD[u] || u;
const pct = v => `${v > 0 ? "+" : ""}${Math.round(v * 100)} %`;
// Más de este % frente a la referencia oficial equivalente se marca para revisar (lo decide el servidor).
const limite = () => Math.round((catalogo.limiteReferencia ?? 0.25) * 100);
// "Gobernación 2024 ítem 190110, $ 27.792 (−37 %)"; si no es el mismo producto, se aclara que es orientativa.
const textoReferencia = r => `${esc(r.fuente)} ítem ${esc(r.item)}, ${pesos.format(r.precio)} (${pct(r.diferencia)})${r.equivalente === false ? ` <i title="${esc(r.nota)}">orientativa: ${esc(r.nota)}</i>` : ""}`;

function titulo() {
  const els = estado.elementos;
  if (els.length === 1 && !estado.extras.length)
    return `Presupuesto: ${els[0].cantidad > 1 ? nombreCantidad(els[0].tipo, els[0].cantidad) : nombreTipo(els[0].tipo).replace(/^Una? /, "").toLowerCase()}`;
  return "Presupuesto de obra";
}

/** Composición de un ítem (su APU), cómo se calculó la cantidad y con qué se compara. */
function detalleLinea(l) {
  const c = l.composicion, u = esc(l.unidad);
  const apu = c.cotizacion
    ? `<p><b>Precio cotizado:</b> ${pesos.format(c.cotizacion.precio)} por ${u}${c.cotizacion.fuente ? ` · ${esc(c.cotizacion.fuente)}` : ""}.
        No está en la base de la herramienta: se usa la cotización. Se cambia en Medidas, en “Ítems cotizados”. No se programa en el cronograma.</p>`
    : c.oficial
    ? `<p><b>Precio oficial:</b> ${esc(c.oficial.fuente)}, ítem ${esc(c.oficial.item)}: ${pesos.format(c.oficial.precio)} por ${u}${c.oficial.url ? ` · <a href="${esc(c.oficial.url)}${c.oficial.pagina ? `#page=${c.oficial.pagina}` : ""}" target="_blank" rel="noopener">ver el decreto</a>` : ""}.
        La entidad publica el valor, no su composición.${l.rendimiento ? ` Rendimiento de referencia para el cronograma: ${num.format(l.rendimiento)} ${u} por día.` : " No se programa en el cronograma (sin rendimiento publicado)."}</p>`
    : `<div class="scroll"><table class="apu"><thead><tr><th>Insumo</th><th class="n">Cantidad por ${u}</th><th class="n">Precio</th><th class="n">Parcial</th></tr></thead><tbody>
        ${c.insumos.map(x => { const ins = insumo(x.id); return `<tr><td>${esc(ins.nombre)}${x.propio ? ` <span class="tag propio">cotización</span>` : ""}</td><td class="n">${coef.format(x.cantidad)} ${esc(unidad(ins.unidad))}</td><td class="n">${pesos.format(x.precio)}</td><td class="n">${pesos.format(x.parcial)}</td></tr>`; }).join("")}
        <tr><td colspan="3">Herramienta menor (5 % de la mano de obra)</td><td class="n">${pesos.format(c.herramienta)}</td></tr>
        <tr class="total-apu"><td colspan="3">Costo unitario (APU)</td><td class="n">${pesos.format(l.unitarioAPU)}</td></tr></tbody></table></div>
      ${c.cuadrilla
    ? `<p class="nota">Rendimiento: ${num.format(l.rendimiento)} ${u} por día, con una cuadrilla de ${c.cuadrilla.oficiales} oficial y ${num.format(c.cuadrilla.ayudantes)} ${c.cuadrilla.ayudantes === 1 ? "ayudante" : "ayudantes"}.</p>`
    : `<p class="nota">Compra adicional, agregada desde el cuadro rápido: sale en Compras y no se programa en el cronograma. <button class="enlace" data-quitar-adicional="${esc(l.codigo.slice(4))}">Quitar del presupuesto</button></p>`}`;
  const memoria = `<p class="etiqueta" style="margin:12px 0 4px">Memoria de cantidades</p><ul class="memoria">${l.memoria.map(m => `<li>${m.parte ? `<b>${esc(m.parte)}:</b> ` : ""}${esc(m.texto)} = ${num.format(m.cantidad)} ${u}</li>`).join("")}</ul>`;
  const refs = (l.referencias || []).length
    ? `<p class="nota">Referencia oficial: ${l.referencias.map(textoReferencia).join(" · ")}</p>` : "";
  const cotizado = l.precioPropio ? `<p class="nota"><b>En el presupuesto se usa el precio cotizado:</b> ${pesos.format(l.unitario)} por ${u}.</p>` : "";
  return `<div class="detalle-linea">${apu}${cotizado}${memoria}${refs}</div>`;
}

/* ---------- Presupuesto ---------- */
function panelPresupuesto({ lineas, presupuesto: p }) {
  const conAIU = estado.ejecucion === "contratista";
  const porcentaje = (k, etiqueta, valor, extra = "") => `<div class="fila"><span>${etiqueta}<input class="pct" id="aiu-${k}" data-aiu="${k}" type="number" min="0" max="100" step="0.5" inputmode="decimal" value="${+(estado.aiu[k] * 100).toFixed(2)}" aria-label="${etiqueta} en porcentaje"> %${extra}</span><span>${pesos.format(valor)}</span></div>`;
  const varias = estado.elementos.length > 1 || (estado.elementos.length && estado.extras.length);
  const marca = l => {
    if (l.precioPropio) return `<span class="tag propio">precio cotizado</span>`;
    if (l.composicion.oficial) return `<span class="tag">oficial</span>`;
    if (l.composicion.cotizacion) return `<span class="tag propio">cotización</span>`;
    if (l.codigo.startsWith("MAT-")) return `<span class="tag">compra adicional</span>`;
    return l.alerta ? `<span class="tag alerta" title="Se aleja más de ${limite()} % de la referencia oficial equivalente: ver el APU o la pestaña Precios">${pct(l.alerta.diferencia)} vs. oficial</span>` : "";
  };
  const linea = l => {
    const abierta = estado.lineaAbierta === l.codigo;
    return `<div class="fila linea${abierta ? " abierta" : ""}">
      <button class="nom linea-boton" data-linea="${esc(l.codigo)}" aria-expanded="${abierta}"><span class="item">${esc(l.item)}</span><span>${esc(l.nombre)} ${marca(l)}<small>${num.format(l.cantidad)} ${esc(l.unidad)} × ${pesos.format(l.unitario)} · ${abierta ? "ocultar APU" : "ver APU y cantidades"}</small></span></button>
      <span class="val">${pesos.format(l.total)}</span>
      ${abierta ? detalleLinea(l) : ""}</div>`;
  };
  const capitulos = capitulosDe(lineas).map(c => `<div class="capitulo">
      <div class="cap-cab"><span>${c.numero}. ${esc(c.nombre)}</span><span>${pesos.format(c.subtotal)}</span></div>
      <div class="filas">${c.lineas.map(linea).join("")}</div></div>`).join("");
  return `${varias ? `<p class="nota" style="margin-top:14px">Incluye: ${[...estado.elementos.map(describirElemento), ...estado.extras.filter(x => x.cantidad > 0).map(x => lineas.find(l => l.codigo === x.codigo)?.nombre || nombreCortoApu(x.codigo))].map(esc).join(" · ")}.</p>` : ""}
    ${capitulos}
    <div class="suma" style="margin-top:10px">
      <div class="fila fuerte"><span>Costo directo</span><span>${pesos.format(p.directo)}</span></div>
      <label class="fila aiu-casilla"><span><input type="checkbox" id="con-aiu" data-con-aiu="1" ${conAIU ? "checked" : ""}> Sumar AIU <small>si la obra la ejecuta un contratista: administración, imprevistos y utilidad</small></span></label>
      ${conAIU ? `${porcentaje("a", "Administración", p.admin)}${porcentaje("i", "Imprevistos", p.imprev)}${porcentaje("u", "Utilidad", p.util)}${porcentaje("iva", "IVA", p.ivaUtil, " de la utilidad")}
        <div class="fila fuerte"><span>Valor total con AIU</span><span>${pesos.format(p.total)}</span></div>` : ""}
      ${p.propios > 0 ? `<div class="fila"><span>Suministrado o ya comprado</span><span>− ${pesos.format(p.propios)}</span></div>
        <div class="fila fuerte"><span>Por invertir</span><span>${pesos.format(p.porInvertir)}</span></div>` : ""}
    </div>
    <p class="nota">${conAIU
      ? "Los porcentajes iniciales son los máximos que fija la Alcaldía de Cali (2026) para licitaciones públicas; en una obra privada pequeña suelen ser menores. Reemplácelos por los que cotice el contratista."
      : "El costo directo incluye materiales, mano de obra con prestaciones sociales y alquiler de equipos. Si la obra la ejecuta un contratista, marque «Sumar AIU»."}
      Precios de referencia del ${esc(catalogo.fechaPrecios)} e ítems oficiales de la Gobernación del Valle 2024. Para un valor exacto, registre las cotizaciones en <button class="enlace" data-tab="precios">Precios</button>.</p>
    <div class="acciones">
      <button class="btn chico" data-accion="descargar-excel">Descargar Excel</button>
      <button class="btn sec chico" data-accion="descargar-pdf">Descargar PDF</button>
      <button class="btn sec chico" data-accion="copiar-presupuesto">Copiar tabla</button>
      <button class="enlace" data-vista="oficial">Agregar un ítem de la lista oficial</button>
    </div>`;
}

/* ---------- Cronograma ---------- */
function panelCronograma({ lineas, cronograma }) {
  if (!lineas.length) return `<p class="nota">Sin actividades.</p>`;
  const { tramos, avance } = cronograma;
  const tramoDe = Object.fromEntries(tramos.map(t => [t.codigo, t]));
  const n = Math.max(1, Math.ceil(avance.falta)), semanas = Math.ceil(n / 5);
  const ini = estado.inicioObra, fin = diaHabil(ini, n - 1), primerDia = diaHabil(ini, 0);
  // Como mucho 5 marcas en la escala (en obras largas, cada 2, 3… semanas) para que los textos no se monten.
  const paso = Math.max(1, Math.ceil(semanas / 5));
  const etiquetas = Array.from({ length: semanas }, (_, w) => w)
    .filter(w => w % paso === 0 && (w === 0 || (w * 5) / n <= 0.86))
    .map(w => `<span style="left:${((w * 5) / n) * 100}%">Sem ${w + 1}<small>${fechaCorta(diaHabil(ini, w * 5)).slice(4)}</small></span>`).join("");
  // En el orden en que se construye (no en el del presupuesto).
  const porFase = (cronograma.orden || []).map(c => lineas.find(l => l.codigo === c)).filter(Boolean);
  const sinProgramar = lineas.filter(l => (cronograma.sinProgramar || []).includes(l.codigo));
  const grupos = [];
  for (const l of porFase) {
    if (!grupos.length || grupos[grupos.length - 1].nombre !== l.fase) grupos.push({ nombre: l.fase, lineas: [] });
    grupos[grupos.length - 1].lineas.push(l);
  }
  const semana = `--sem:${((5 * paso) / n) * 100}%`;   // las líneas de fondo coinciden con las marcas
  const barra = (desde, hasta, clase) => `<i class="${clase}" style="left:${(desde / n) * 100}%;width:${Math.max(0.6, ((hasta - desde) / n) * 100)}%"></i>`;
  const fechas = (a, dias) => {
    const d1 = diaHabil(ini, Math.floor(a)), d2 = diaHabil(ini, Math.ceil(a + dias) - 1);
    return aISO(d1) === aISO(d2) ? fechaCorta(d1) : `${fechaCorta(d1)} → ${fechaCorta(d2)}`;
  };
  const casilla = l => `<input type="checkbox" id="h-${l.codigo}" data-hecha="${l.codigo}" ${estado.hechas.includes(l.codigo) ? "checked" : ""} aria-label="Marcar como hecha: ${esc(l.nombre)}">`;
  const avancePct = Math.round(avance.pct * 100);
  return `<div class="crono-resumen">
      <label class="campo">${avance.hecho ? "Lo que falta empieza" : "Empieza"}<input type="date" id="inicio-obra" data-inicio="1" value="${ini}"></label>
      <div><small>Termina</small><b>${tramos.length ? fechaCorta(fin) : "¡Terminada!"}</b></div>
      <div><small>${avance.hecho ? "Faltan" : "Duración"}</small><b>${num.format(avance.falta)} días hábiles</b><small>${semanas === 1 ? "1 semana" : `${semanas} semanas`} de lunes a viernes</small></div>
    </div>
    <div class="avance"><div class="avance-txt"><span>Avance de la obra</span><b>${avancePct} %</b></div>
      <div class="avance-barra" role="progressbar" aria-valuenow="${avancePct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${avance.pct * 100}%"></i></div>
      <p class="nota" style="margin-top:6px">Marque las actividades que ya están hechas: el cronograma se recalcula con lo que falta.</p></div>
    ${aISO(primerDia) !== ini ? `<p class="nota">La fecha elegida cae en fin de semana: arranca el ${fechaCorta(primerDia)}.</p>` : ""}
    <div class="crono">
      <div class="crono-fila crono-eje"><span></span><span class="eje" style="${semana}">${tramos.length ? etiquetas : ""}</span></div>
      ${grupos.map((g, k) => {
        const tr = g.lineas.map(l => tramoDe[l.codigo]).filter(Boolean);
        const a = tr.length ? tr[0].inicio : 0, z = tr.length ? tr[tr.length - 1].inicio + tr[tr.length - 1].dias : 0;
        return `<div class="crono-fila fase"><span class="nom"><b>${k + 1}. ${esc(g.nombre)}</b><small>${tr.length ? fechas(a, z - a) : "✓ Terminada"}</small></span>
            <span class="pista" style="${semana}">${tr.length ? barra(a, z, "f") : ""}</span></div>
          ${g.lineas.map(l => {
            const t = tramoDe[l.codigo], hecha = !t;
            return `<div class="crono-fila${hecha ? " hecha" : ""}"><label class="nom tarea">${casilla(l)}<span>${esc(l.nombre)}<small>${hecha ? "✓ Hecha" : `${fechas(t.inicio, t.dias)} · ${num.format(t.dias)} ${t.dias === 1 ? "día" : "días"}`}</small></span></label>
            <span class="pista" style="${semana}">${hecha ? "" : barra(t.inicio, t.inicio + t.dias, "")}</span></div>`;
          }).join("")}`;
      }).join("")}
    </div>
    ${sinProgramar.length ? `<p class="nota">No se programan (no tienen rendimiento publicado: ítems de la lista oficial, cotizados y compras adicionales): ${sinProgramar.map(l => esc(l.nombre)).join(" · ")}.</p>` : ""}
    <p class="nota">Cada actividad la hace una cuadrilla de un oficial con uno o dos ayudantes (según la actividad), en jornadas de 8 horas, una actividad tras otra y en el orden en que se construye. No descuenta festivos ni días de lluvia. La duración sale del rendimiento: cuánto hace la cuadrilla en un día; en los ítems con precio oficial el rendimiento es de referencia.</p>`;
}

/* ---------- Compras ---------- */
const ORIGEN_COMPRA = { oficial: "lista oficial", cotizado: "cotización" };

function panelCompras({ compras }) {
  const porComprar = compras.filter(c => !c.comprado);
  const fila = c => {
    const donde = c.comprado ? "✓ Comprado"
      : c.tipo === "material" ? `<a href="${mapsBuscar(`${c.tienda} Cali`)}" target="_blank" rel="noopener">dónde comprar</a>`
        : c.tipo === "oficial" ? "precio oficial de la Gobernación" : "según la cotización";
    const etiqueta = ORIGEN_COMPRA[c.tipo] ? ` <span class="tag${c.tipo === "cotizado" ? " propio" : ""}">${ORIGEN_COMPRA[c.tipo]}</span>` : "";
    return `<div class="fila${c.comprado ? " hecha" : ""}"><label class="nom tarea"><input type="checkbox" id="cp-${esc(c.id)}" data-comprado="${esc(c.id)}" ${c.comprado ? "checked" : ""} aria-label="Ya compré ${esc(c.nombre)}">
      <span>${esc(c.nombre)}${etiqueta}<small>${num.format(c.cantidad)} ${esc(c.unidad)} · ${donde}</small></span></label><span class="val">${pesos.format(c.costo)}${c.precioPropio ? `<small class="tag propio">cotizado</small>` : ""}</span></div>`;
  };
  const lista = compras.length
    ? `<p class="nota" style="margin-top:14px">Marque lo que ya se compró o contrató: se descuenta de lo que falta por invertir.</p>
      <div class="filas">${compras.map(fila).join("")}</div>
      <div class="suma"><div class="fila fuerte"><span>${porComprar.length < compras.length ? "Falta por comprar" : "Total por comprar"}</span><span>${pesos.format(porComprar.reduce((s, c) => s + c.costo, 0))}</span></div></div>
      <div class="acciones"><button class="btn sec chico" data-accion="copiar-compras">Copiar lista</button></div>`
    : `<p class="aviso">Los materiales disponibles alcanzan: no hay que comprar nada.</p>`;
  return lista + tiendasDeCali();
}

/* ---------- Precios ---------- */
/** "consultado el 24 sep 2026" y si ya puede estar desactualizado. */
function vigencia(fecha) {
  if (/^\d{4}$/.test(fecha)) return { texto: `lista de ${fecha}`, vieja: true };
  const d = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { texto: "", vieja: false };
  const dias = Math.floor((Date.now() - d.getTime()) / 864e5);
  return { texto: d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }), vieja: dias > DIAS_VIGENCIA };
}

function filaInsumo(p) {
  const ins = insumo(p.id), u = unidad(ins.unidad), v = vigencia(ins.fecha);
  const enlace = (url, texto) => (url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(texto)}</a>` : esc(texto));
  // Con varias tiendas: la mediana y cada precio, para que se pueda verificar.
  const fuente = ins.tiendas
    ? `${esc(ins.fuente.toLowerCase())}: ${ins.tiendas.map(t => `${enlace(t.url, t.tienda)} ${pesos.format(t.precio)}`).join(", ")}`
    : enlace(ins.url, ins.fuente);
  const porDia = ins.tipo === "mo" ? ` · ≈ ${pesos.format(p.precio * 8)} por día de 8 h` : "";
  return `<div class="fila con-campo precio${p.propio ? " propia" : ""}">
    <span class="nom">${esc(ins.nombre)}${p.propio ? ` <span class="tag propio">cotizado</span>` : ""}
      <small>Referencia ${pesos.format(p.referencia)} por ${u} · ${fuente}${v.texto ? ` · ${v.texto}` : ""}${porDia}</small>
      ${v.vieja ? `<small class="alerta-txt">Precio con más de ${DIAS_VIGENCIA} días: conviene confirmarlo con una cotización.</small>` : ""}</span>
    <span class="val"><input class="cant" id="p-${p.id}" data-precio="${p.id}" type="number" min="0" step="any" inputmode="decimal" placeholder="${Math.round(p.referencia)}" value="${p.propio ? p.precio : ""}" aria-label="Precio cotizado de ${esc(ins.nombre)} por ${u}"><span class="uni">/${u}</span>
      ${p.propio ? `<button class="enlace" data-quitar-precio="${p.id}">usar referencia</button>` : ""}</span></div>`;
}

function filaActividad(l) {
  const ref = l.alerta;
  const refs = (l.referencias || []).map(r => `${esc(r.fuente)}: ${pesos.format(r.precio)} (${pct(r.diferencia)})${r.equivalente === false ? " orientativa" : ""}`).join(" · ");
  const alerta = ref
    ? `<small class="alerta-txt">El cálculo se aleja más de ${limite()} % de la referencia oficial equivalente. Conviene revisarlo con quien vaya a ejecutar la obra o usar su cotización.</small>
       <button class="btn sec chico" data-usar-referencia="${l.codigo}" data-valor="${Math.round(ref.precio)}">Usar la referencia ${esc(ref.fuente)} (${pesos.format(ref.precio)})</button>` : "";
  return `<div class="fila con-campo precio${l.precioPropio ? " propia" : ""}">
    <span class="nom">${esc(l.nombre)}${l.precioPropio ? ` <span class="tag propio">cotizado</span>` : ""}
      <small>Calculado con el APU: ${pesos.format(l.unitarioAPU)} por ${esc(l.unidad)}${refs ? ` · Oficial: ${refs}` : ""}</small>${alerta}</span>
    <span class="val"><input class="cant" id="pa-${l.codigo}" data-precio-actividad="${l.codigo}" type="number" min="0" step="any" inputmode="decimal" placeholder="${Math.round(l.unitarioAPU)}" value="${l.precioPropio ? l.unitario : ""}" aria-label="Precio cotizado de ${esc(l.nombre)} por ${esc(l.unidad)}"><span class="uni">/${esc(l.unidad)}</span>
      ${l.precioPropio ? `<button class="enlace" data-quitar-precio-actividad="${l.codigo}">usar cálculo</button>` : ""}</span></div>`;
}

function panelPrecios({ precios, lineas }) {
  const propios = precios.filter(p => p.propio).length + lineas.filter(l => l.precioPropio).length;
  return `<div class="aviso">
      <strong>Para un valor exacto, registre las cotizaciones.</strong>
      Los precios de referencia son de tiendas grandes de Cali, consultados el ${esc(catalogo.fechaPrecios)}. Un depósito de barrio, otra marca o el maestro que se contrate pueden cobrar distinto. Escriba aquí los valores cotizados: el presupuesto, las compras y lo que falta por invertir se recalculan y quedan guardados con la obra.
      ${propios ? `<p style="margin-top:8px"><b>${propios} ${propios === 1 ? "precio es cotizado" : "precios son cotizados"}</b>; el resto es de referencia.</p>` : ""}
    </div>
    <h3 class="subtitulo">Materiales, equipos y mano de obra</h3>
    <p class="nota">Precio por unidad. Déjelo vacío para usar la referencia.</p>
    <div class="filas">${precios.map(filaInsumo).join("")}</div>
    <h3 class="subtitulo">Precio por actividad <small>(opcional)</small></h3>
    <p class="nota">Si se cotizó una actividad completa (materiales y mano de obra), escríbala aquí: reemplaza el cálculo de esa actividad en el presupuesto. Se compara con los precios oficiales de la Gobernación del Valle, la Alcaldía de Cali y EMCALI.</p>
    <div class="filas">${lineas.filter(l => !l.composicion.cotizacion && !l.codigo.startsWith("MAT-")).map(filaActividad).join("")}</div>`;
}

/* ---------- Pantalla ---------- */
/** Cuadro para agregar algo rápido sin volver a los pasos: obras y trabajos al presupuesto, materiales a Compras. */
function agregarRapido() {
  return `<div class="agregar-rapido">
    <label for="rapido"><strong>Agregar algo rápido</strong><small>Una obra, un trabajo o materiales para comprar</small></label>
    <div class="rapido-fila"><input id="rapido" type="text" maxlength="500" value="${esc(estado.textoRapido)}" placeholder="Ej.: pañetar 20 m², un muro de 3 x 2, 10 bultos de cemento" ${estado.ocupado ? "disabled" : ""}>
      <button class="btn chico" data-accion="agregar-rapido" ${estado.ocupado ? "disabled" : ""}>${estado.ocupado ? "Agregando…" : "Agregar"}</button></div>
    ${estado.avisoRapido ? `<p class="nota" role="status">${esc(estado.avisoRapido)}</p>` : ""}
  </div>`;
}

/** El total si las actividades que se alejan de su referencia oficial equivalente costaran lo oficial. */
function rango({ presupuesto: p }) {
  if (!p.rango) return "";
  const n = p.rango.actividades.length;
  const nombres = p.rango.actividades.map(c => { const n = nombreActividad(c); return n.charAt(0).toLowerCase() + n.slice(1); });
  return `<div class="aviso rango"><strong>Rango del presupuesto</strong>
    ${n === 1 ? "Una actividad se aleja" : `${n} actividades se alejan`} más de ${limite()} % de su referencia oficial (${esc(nombres.join(", "))}).
    Si costaran lo oficial, el total sería <b>${pesos.format(p.rango.total)}</b> (${pct(p.rango.total / p.total - 1)}).
    Conviene dejar ese margen hasta tener cotizaciones. <button class="enlace" data-tab="precios">Revisar en Precios</button></div>`;
}

function avisos(calculo) {
  const malos = estado.cambiosMat.filter(c => !c.valido && calculo.requeridos[c.a]);
  const revisar = [
    ...estado.elementos.flatMap(el => (calculo.elementos.find(v => v.id === el.id)?.advertencias || [])
      .filter(a => /ingeniero/.test(a)).map(a => `${describirElemento(el)}: ${a}`)),
    ...estado.extras.filter(x => x.nota && x.cantidad > 0).map(x => `${nombreCortoApu(x.codigo)}: ${x.nota}`)
  ];
  const pedidos = estado.observaciones.map(o => `${o.texto ? `“${o.texto}”: ` : ""}${o.nota}`);
  return `${malos.length ? `<div class="aviso no"><strong>Hay un material que no es el correcto.</strong>${malos.map(c => `${esc(insumo(c.a).nombre)} en lugar de ${esc(insumo(c.de).nombre.toLowerCase())}. <button class="enlace" data-deshacer="${c.de}">Corregir</button>`).join("<br>")}</div>` : ""}
    ${revisar.length ? `<div class="aviso"><strong>Antes de usar este presupuesto</strong>${revisar.map(esc).join("<br><br>")}</div>` : ""}
    ${pedidos.length ? `<div class="aviso"><strong>Pedidos que conviene revisar</strong><ul class="entendi">${pedidos.map(p => `<li>${esc(p)}</li>`).join("")}</ul></div>` : ""}`;
}

function cierre() {
  const guardada = Boolean(estado.obraId);
  const reinicio = estado.confirmarReinicio
    ? `<span class="nota" style="margin:0">${guardada ? "¿Salir sin guardar los cambios?" : "¿Descartar esta obra?"}</span><button class="btn peligro chico" data-accion="reiniciar-si">Sí, salir</button><button class="btn sec chico" data-accion="reiniciar-no">Cancelar</button>`
    : `<button class="enlace" data-accion="reiniciar">${guardada ? "Salir sin guardar cambios" : "Descartar"}</button>`;
  return `<div class="terminar">
    <label class="campo">Nombre de la obra<input id="nombre-obra" type="text" maxlength="80" value="${esc(estado.nombreObra)}" placeholder="${esc(nombrePorDefecto())}"></label>
    <div class="acciones" style="margin-top:14px"><button class="btn" data-accion="terminar">${guardada ? "Guardar cambios" : "Terminado"}</button>${reinicio}</div>
    <p class="nota">${guardada ? "Esta obra ya está en “Mis obras”; al guardar se actualizan los avances y los precios." : "Se guarda en “Mis obras” y se puede empezar otra. Después se puede abrir para marcar lo que ya está hecho."}</p>
  </div>`;
}

export function pantallaResultado() {
  const calculo = estado.calculo;
  if (!calculo) return cargando();
  const { presupuesto: p, cronograma: { avance, tramos } } = calculo;
  const pestañas = [["presupuesto", "Presupuesto"], ["cronograma", "Cronograma"], ["compras", "Compras"], ["precios", "Precios"]];
  const paneles = { cronograma: panelCronograma, compras: panelCompras, precios: panelPrecios };
  const panel = (paneles[estado.tab] || panelPresupuesto)(calculo);
  const fin = tramos.length ? fechaCorta(diaHabil(estado.inicioObra, Math.ceil(avance.falta) - 1)) : null;
  const propios = calculo.precios.filter(x => x.propio).length + calculo.lineas.filter(l => l.precioPropio).length;
  return `<div class="res-grid">
    <section class="res-resumen">
      <h2 class="titulo">${titulo()}</h2>
      <div class="total"><div class="cifra">${pesos.format(p.total)}</div>
        <div class="datos"><span>Por invertir <b>${pesos.format(p.porInvertir)}</b></span>
        <span>${avance.hecho ? `Faltan <b>${num.format(avance.falta)} días</b> · ${Math.round(avance.pct * 100)} % hecho` : `Duración <b>${num.format(avance.total)} días hábiles</b>`}${fin ? ` · termina ${fin}` : " · obra terminada"}</span>
        <span>${estado.ejecucion === "contratista" ? "<b>Con AIU</b> (la ejecuta un contratista)" : "<b>Costo directo</b>, sin AIU"} · <button class="enlace" data-accion="alternar-aiu">${estado.ejecucion === "contratista" ? "quitar AIU" : "sumar AIU"}</button></span>
        <span>${propios ? `<b>${propios}</b> ${propios === 1 ? "precio cotizado" : "precios cotizados"}, el resto de referencia` : "Precios de referencia"} · <button class="enlace" data-tab="precios">registrar cotizaciones</button></span></div></div>
      ${agregarRapido()}
      ${rango(calculo)}
      ${avisos(calculo)}
    </section>
    <section class="res-panel">
      <div class="tabs" role="tablist">${pestañas.map(([id, t]) => `<button role="tab" id="tab-${id}" data-tab="${id}" aria-selected="${estado.tab === id}">${t}</button>`).join("")}</div>
      <div class="panel" role="tabpanel" aria-labelledby="tab-${estado.tab}">${panel}</div>
    </section>
    <section class="res-cierre">
      ${cierre()}
      <div class="acciones"><button class="enlace" data-vista="fuentes">¿De dónde salen los precios?</button></div>
      <div class="estado-msg" id="aviso-breve" role="status" aria-live="polite"></div>
    </section>
  </div>`;
}
