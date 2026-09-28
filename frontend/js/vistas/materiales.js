/**
 * Paso 3, en tres partes:
 * 1) disponibles: los materiales que ya están en la obra;
 * 2) revisión: si cada uno sirve, no es lo correcto o no se usa, y qué hacer;
 * 3) lo que falta: ¿lo tiene o se lo compra? (cantidad, precio y dónde).
 */
import { estado, PANTALLA } from "../estado/estado.js";
import { catalogo, insumo, nombreCortoApu } from "../estado/catalogo.js";
import { esc, num, pesos, mayus, cantU, listaY, r2 } from "../utilidades/formato.js";
import { mapsBuscar, mapsRuta } from "../utilidades/navegador.js";
import { cargando, ocupado } from "./comunes.js";

const SUBPASOS = [["tengo", "Disponibles"], ["revision", "Revisión"], ["faltan", "Por comprar"]];
const ICONO = { bien: "✓", mal: "✗", duda: "?", otro: "–" };
const atras = attrs => `<button class="enlace" ${attrs}>Atrás</button>`;
const boton = (attrs, texto, secundario = true) => `<button class="btn ${secundario ? "sec " : ""}chico" ${attrs}>${texto}</button>`;

function subpasos() {
  const k = SUBPASOS.findIndex(([id]) => id === estado.pasoMateriales);
  return `<ol class="subpasos">${SUBPASOS.map(([, t], i) => `<li class="${i < k ? "hecho" : i === k ? "actual" : ""}">${t}</li>`).join("")}</ol>`;
}

/** Todo lo que la persona dijo que tiene: lo escrito (aunque no se reconozca) y lo anotado en "lo que falta". */
function listaTengo() {
  const filas = [], vistos = new Set();
  for (const a of estado.anotados) {
    if (!a.id) { filas.push({ id: null, clave: a.clave, texto: a.texto, nota: a.nota }); continue; }
    if (vistos.has(a.id) || !catalogo.insumos[a.id]) continue;
    vistos.add(a.id);
    filas.push({ id: a.id, cantidad: estado.disponibles[a.id] ?? null, nota: a.nota, decision: a.decision, texto: a.texto });
  }
  for (const [id, v] of Object.entries(estado.disponibles))
    if (!vistos.has(id) && catalogo.insumos[id] && v > 0) { vistos.add(id); filas.push({ id, cantidad: v, nota: "" }); }
  return filas;
}

const EJEMPLOS = { cem: "10 bultos de cemento", are: "1 m³ de arena", blq: "200 ladrillos", blc: "200 bloques de concreto",
  acr: "10 varillas de 3/8", gra: "1 m³ de triturado", cpi: "4 cajas de cerámica de piso", cpa: "3 cajas de cerámica de pared", tps: "2 tubos sanitarios" };
function ejemplo(requeridos) {
  const xs = Object.keys(EJEMPLOS).filter(id => requeridos[id]).slice(0, 3).map(id => EJEMPLOS[id]);
  const lista = xs.length > 1 ? xs : ["10 bultos de cemento", "1 m³ de arena", "200 ladrillos"];
  return listaY(lista);
}

/* ---------- 1) Lo que hay en obra ---------- */
/** Lo que escribió la persona, tal cual, para que vea de dónde sale cada material. */
const escribiste = f => (f.texto ? `<small class="escrito">Escrito: “${esc(f.texto)}”</small>` : "");

function filaTengo(f) {
  if (!f.id) return `<div class="fila"><span class="nom">${esc(f.texto)}<small>${esc(f.nota)}</small></span>
    <span class="val"><button class="enlace" data-quitar-material="${f.clave}">Quitar</button></span></div>`;
  const ins = insumo(f.id);
  return `<div class="fila con-campo"><span class="nom">${esc(ins.nombre)}${escribiste(f)}${f.nota ? `<small>${esc(f.nota)}</small>` : ""}</span>
    <span class="val"><input class="cant" id="t-${f.id}" data-tengo="${f.id}" type="number" min="0" step="any" inputmode="decimal" placeholder="Cant." value="${f.cantidad ?? ""}" aria-label="Cantidad disponible de ${esc(ins.nombre)} (${ins.unidad})"><span class="uni">${ins.unidad}</span>
    <button class="enlace" data-quitar-material="${f.id}">Quitar</button></span></div>`;
}

function pantallaTengo(calculo) {
  const filas = listaTengo();
  return `${subpasos()}
    <h2 class="titulo">Materiales disponibles en obra</h2>
    <p class="sub">Materiales que ya están en la obra o que suministra el cliente, con su cantidad. La herramienta revisa si sirven para esta obra y calcula lo que falta comprar.</p>
    <div class="bloque">
      <textarea id="texto-materiales" aria-label="Materiales disponibles" placeholder="Ej.: ${esc(ejemplo(calculo.requeridos))}" ${estado.ocupado ? "readonly" : ""}>${esc(estado.textoMateriales)}</textarea>
      <div class="acciones" style="margin-top:10px"><button class="btn sec chico" data-accion="agregar-materiales" ${estado.ocupado ? "disabled" : ""}>Agregar</button></div>
      ${ocupado()}
      ${estado.avisoMateriales ? `<p class="nota">${esc(estado.avisoMateriales)}</p>` : ""}
    </div>
    ${filas.length ? `<div class="bloque"><p class="etiqueta">Disponibles (${filas.length})</p><div class="filas">${filas.map(filaTengo).join("")}</div></div>` : ""}
    <div class="nav">${atras(`data-ir="${PANTALLA.MEDIDAS}"`)}${filas.length
      ? `<button class="btn" data-materiales="revision">Revisar materiales</button>`
      : `<button class="btn" data-materiales="faltan">No hay materiales disponibles</button>`}</div>`;
}

/* ---------- 2) Revisión ---------- */
/** Opinión sobre un material: { clase, veredicto, texto, reco, extra, acciones }. */
function juzgar(f, calculo) {
  const quitar = boton(`data-quitar-material="${f.id || f.clave}"`, "Quitar de la lista");
  if (!f.id) return { clase: "otro", veredicto: "No se tiene en cuenta", texto: esc(f.nota), acciones: quitar };
  const ins = insumo(f.id), u = ins.unidad;
  const nombre = id => esc(insumo(id).nombre.toLowerCase());
  const item = calculo.materiales.items.find(i => i.id === f.id);
  const cubre = () => {
    if (!item || !(f.cantidad > 0)) return "";
    return item.falta > 1e-9
      ? `La obra necesita ${cantU(item.compraNecesita, u)}: faltan ${cantU(item.compraFalta, u)} (ver el siguiente paso).`
      : `La obra necesita ${cantU(item.compraNecesita, u)}: alcanza${f.cantidad > item.necesita * 1.1 ? ` y sobran unos ${cantU(r2(f.cantidad - item.necesita), u)}` : ""}.`;
  };
  const pideCantidad = f.cantidad > 0 ? "" : `<label class="campo pedir">¿Qué cantidad hay?<span><input class="cant" id="t-${f.id}" data-tengo="${f.id}" type="number" min="0" step="any" inputmode="decimal" aria-label="Cantidad disponible de ${esc(ins.nombre)}"> ${u}</span></label>`;

  // Ya se usó en lugar de otro material.
  const cambio = estado.cambiosMat.find(c => c.a === f.id);
  if (cambio) return cambio.valido
    ? { clase: "bien", veredicto: `Sirve: se usa en lugar de ${nombre(cambio.de)}`, texto: `${esc(cambio.texto)} ${cubre()}`, extra: pideCantidad,
        acciones: boton(`data-deshacer="${cambio.de}"`, "Deshacer el cambio") }
    : { clase: "mal", veredicto: `No es lo correcto en lugar de ${nombre(cambio.de)}`, texto: esc(cambio.texto),
        reco: `volver a ${nombre(cambio.de)}.`, acciones: boton(`data-deshacer="${cambio.de}"`, "Corregir", false) };

  const rec = calculo.recomendaciones[f.id] || { tipo: calculo.requeridos[f.id] ? "usa" : "otra-actividad", usos: [] };
  if (rec.tipo === "usa") {
    const conversion = catalogo.conversiones[f.id];
    if (item && f.cantidad > 3 * item.necesita)
      return { clase: "duda", veredicto: "Sirve, pero conviene revisar la cantidad",
        texto: `Hay ${cantU(f.cantidad, u)} y la obra necesita ${cantU(item.compraNecesita, u)}.${conversion ? ` ${esc(conversion.pregunta)}` : ` ¿Está en ${u}?`}`,
        acciones: conversion ? boton(`data-convertir="${f.id}"`, `Cambiar a ${num.format(Math.round(f.cantidad * conversion.factor * 10) / 10)} ${u}`, false) : "" };
    return f.cantidad > 0
      ? { clase: "bien", veredicto: "Sirve para esta obra", texto: cubre() }
      : { clase: "duda", veredicto: "Sirve para esta obra", texto: f.nota ? esc(f.nota) : "Indique la cantidad para descontarla de lo que hay que comprar.", extra: pideCantidad };
  }
  if (rec.tipo === "reemplaza") {
    const de = nombre(rec.de), cambiar = `data-cambiar-de="${rec.de}" data-cambiar-a="${f.id}"`;
    if (!rec.alt.valido) return { clase: "mal", veredicto: `No sirve en lugar de ${de}`, texto: esc(rec.alt.texto),
      reco: "no usarlo en esta obra.", acciones: quitar + boton(cambiar, "Usarlo igual") };
    if (f.decision === "aparte") return { clase: "otro", veredicto: "Se dejó aparte", texto: `No entra en el cálculo. Podría reemplazar a ${de}.`,
      acciones: boton(cambiar, `Usarlo en lugar de ${de}`) };
    // Se recomienda el material del que más se tiene: así se compra menos.
    const tieneOriginal = estado.disponibles[rec.de] || 0, usar = !(tieneOriginal > 0 && tieneOriginal >= (f.cantidad || 0));
    return { clase: "duda", veredicto: `Puede reemplazar a ${de}`, texto: esc(rec.alt.texto), extra: pideCantidad,
      reco: usar ? `usarlo en lugar de ${de}: se aprovecha lo disponible y se compra menos.` : `mantener ${de}, que hay en mayor cantidad, y dejar este aparte.`,
      acciones: boton(cambiar, `Usarlo en lugar de ${de}`, !usar) + boton(`data-aparte="${f.id}"`, "Dejarlo aparte", usar) };
  }
  // "Muro en bloque de arcilla N.º 5" → "muro"; sin repetir.
  const base = c => nombreCortoApu(c).split(/ en | \d/)[0].trim().toLowerCase();
  const usos = (rec.usos || []).filter((c, k, todos) => todos.findIndex(x => base(x) === base(c)) === k);
  return { clase: "otro", veredicto: "Esta obra no lo usa",
    texto: usos.length ? `Sirve para: ${listaY(usos.slice(0, 4).map(c => esc(base(c))))}${usos.length > 4 ? ", entre otros" : ""}.` : "",
    reco: usos.length ? "quitarlo de la lista, o agregar a la obra la actividad donde se va a usar." : "quitarlo de la lista.",
    acciones: quitar + usos.slice(0, 2).map(c => boton(`data-ir-catalogo="${c}"`, `+ Agregar ${esc(base(c))}`)).join("") };
}

function pantallaRevision(calculo) {
  const juicios = listaTengo().map(f => ({ f, j: juzgar(f, calculo) }));
  const n = clase => juicios.filter(x => x.j.clase === clase).length;
  const resumen = [[n("bien"), "sirve", "sirven"], [n("duda"), "requiere confirmar un dato", "requieren confirmar un dato"],
    [n("mal"), "no es lo correcto", "no son lo correcto"], [n("otro"), "no se usa en esta obra", "no se usan en esta obra"]]
    .filter(([k]) => k).map(([k, uno, varios]) => `${k} ${k === 1 ? uno : varios}`);
  return `${subpasos()}
    <h2 class="titulo">Revisión de materiales</h2>
    <p class="sub">${resumen.length ? `${mayus(listaY(resumen))}.` : "No se anotaron materiales."}</p>
    <div class="bloque">${juicios.map(({ f, j }) => `<div class="juicio ${j.clase}">
      <div class="j-cab"><b>${esc(f.id ? insumo(f.id).nombre : f.texto)}</b>${f.id && f.cantidad > 0 ? `<span>Hay ${cantU(f.cantidad, insumo(f.id).unidad)}</span>` : ""}</div>
      ${f.id ? escribiste(f) : ""}
      <p class="j-veredicto"><span aria-hidden="true">${ICONO[j.clase]}</span> ${j.veredicto}</p>
      ${j.texto ? `<p>${j.texto}</p>` : ""}${j.reco ? `<p class="j-reco">Recomendación: ${j.reco}</p>` : ""}${j.extra || ""}
      ${j.acciones ? `<div class="acciones">${j.acciones}</div>` : ""}</div>`).join("")}</div>
    <div class="nav">${atras('data-materiales="tengo"')}<button class="btn" data-materiales="faltan">Ver lo que falta</button></div>`;
}

/* ---------- 3) Lo que falta ---------- */
export function tiendasDeCali() {
  return `<div class="seccion" style="margin-top:28px"><p class="etiqueta">Tiendas grandes en Cali</p><div class="filas">
    ${catalogo.tiendas.map(t => `<div class="fila"><span class="nom">${esc(t.nombre)}<small>${esc(t.direccion)}</small></span><a href="${mapsRuta(`${t.nombre}, ${t.direccion}, Cali`)}" target="_blank" rel="noopener">Cómo llegar</a></div>`).join("")}
    <div class="fila"><span class="nom">Ferreterías cerca<small>Todas las de Cali en el mapa</small></span><a href="${mapsBuscar("ferretería Cali")}" target="_blank" rel="noopener">Ver mapa</a></div></div></div>`;
}

function pantallaFaltan(calculo) {
  const tiene = listaTengo().some(f => f.id && f.cantidad > 0);
  const volver = atras(`data-materiales="${listaTengo().length ? "revision" : "tengo"}"`);
  const siguiente = `<button class="btn" data-ir="${PANTALLA.RESULTADO}">Ver presupuesto</button>`;
  const faltan = calculo.materiales.items.filter(i => i.falta > 1e-9);
  if (!faltan.length) return `${subpasos()}
    <h2 class="titulo">Los materiales disponibles alcanzan</h2>
    <p class="sub">No hay que comprar materiales para esta obra.</p>
    <div class="nav">${volver}${siguiente}</div>`;

  const modo = estado.modoFaltan;
  // En "sí, tengo algunos" se muestran los que faltaban al abrirlo, aunque ya se hayan cubierto.
  const ids = modo === "tengo" && estado.faltanVista ? estado.faltanVista : faltan.map(i => i.id);
  const items = ids.map(id => calculo.materiales.items.find(i => i.id === id)).filter(Boolean);
  const costoDe = id => calculo.compras.find(c => c.id === id)?.costo || 0;
  const fila = i => {
    const ins = insumo(i.id), u = ins.unidad;
    const detalle = i.falta <= 1e-9 ? "✓ Ya alcanza" : i.tiene > 0 ? `Hay ${cantU(r2(i.tiene), u)}; faltan ${cantU(i.compraFalta, u)}` : `Se necesitan ${cantU(i.compraFalta, u)}`;
    if (modo === "tengo") return `<div class="fila"><span class="nom">${esc(ins.nombre)}<small>${detalle}</small></span>
      <span class="val"><input class="cant" id="t-${i.id}" data-tengo="${i.id}" type="number" min="0" step="any" inputmode="decimal" placeholder="Cantidad" value="${estado.disponibles[i.id] ?? ""}" aria-label="Cantidad disponible de ${esc(ins.nombre)} (${u})"><span class="uni">${u}</span></span></div>`;
    if (modo === "comprar") return `<div class="fila"><span class="nom">${esc(ins.nombre)}<small>Comprar ${cantU(i.compraFalta, u)} · <a href="${mapsBuscar(`${ins.tienda} Cali`)}" target="_blank" rel="noopener">dónde comprar</a></small></span>
      <span class="val">${pesos.format(costoDe(i.id))}${calculo.compras.find(c => c.id === i.id)?.precioPropio ? `<small class="tag propio">cotizado</small>` : ""}</span></div>`;
    return `<div class="fila"><span class="nom">${esc(ins.nombre)}<small>${detalle}</small></span></div>`;
  };
  const total = calculo.compras.reduce((suma, c) => suma + c.costo, 0);
  const cuantos = `${faltan.length} ${faltan.length === 1 ? "material" : "materiales"}`;
  const pregunta = modo ? "" : `<div class="aviso"><strong>¿Hay alguno de estos en obra?</strong>
      <div class="acciones" style="margin-top:10px"><button class="btn sec chico" data-modo-faltan="tengo">Sí, hay algunos</button>
      <button class="btn chico" data-modo-faltan="comprar">No, ver cuánto y dónde comprar</button></div></div>`;
  const pie = modo === "tengo"
    ? `<div class="acciones"><button class="btn chico" data-modo-faltan="comprar">Listo: ver lo que falta comprar</button></div>`
    : modo === "comprar"
      ? `<div class="suma"><div class="fila fuerte"><span>Total aproximado</span><span>${pesos.format(total)}</span></div></div>
        <p class="nota">Precios de referencia de Cali consultados el ${catalogo.fechaPrecios}. La cantidad ya viene redondeada a como se vende (bultos y unidades enteras). Las cotizaciones se registran en la pestaña <b>Precios</b> del resultado.</p>
        <div class="acciones"><button class="btn sec chico" data-accion="copiar-compras">Copiar lista</button><button class="enlace" data-modo-faltan="tengo">Hay alguno de estos en obra</button></div>
        <div class="estado-msg" id="aviso-breve" role="status" aria-live="polite"></div>
        ${tiendasDeCali()}`
      : "";
  return `${subpasos()}
    <h2 class="titulo">${modo === "comprar" ? "Lista de compras" : tiene ? "También se necesitan" : "Materiales que necesita la obra"}</h2>
    <p class="sub">${modo === "tengo" ? "Escriba la cantidad disponible de cada uno." : modo === "comprar" ? `${cuantos}, con la cantidad a comprar y dónde conseguirlos en Cali.` : `${cuantos}${tiene ? " que no hay o no alcanzan" : ""}.`}</p>
    ${calculo.materiales.cobertura && modo !== "comprar" ? `<p class="nota">${esc(calculo.materiales.cobertura)}</p>` : ""}
    ${pregunta}
    <div class="bloque filas">${items.map(fila).join("")}</div>
    ${pie}
    <div class="nav">${volver}${siguiente}</div>`;
}

export function pantallaMateriales() {
  const calculo = estado.calculo;
  if (!calculo) return cargando();
  if (estado.pasoMateriales === "revision") return pantallaRevision(calculo);
  if (estado.pasoMateriales === "faltan") return pantallaFaltan(calculo);
  return pantallaTengo(calculo);
}
