/**
 * Caso de uso principal: a partir de lo que describe la persona (partes de la obra, trabajos
 * sueltos, materiales que tiene, avances y precios de sus cotizaciones) calcula actividades,
 * materiales, compras, presupuesto y cronograma.
 */
import { APU } from "../datos/apu.js";
import { INSUMOS } from "../datos/precios.js";
import { SUSTITUTOS } from "../datos/materiales.js";
import { REFERENCIAS_OFICIALES, LIMITE_REFERENCIA } from "../datos/referencias-oficiales.js";
import { analizarAPU, precioInsumo, cuadrilla } from "../dominio/apu.js";
import { generarActividades, unirLineas, validarMedidas } from "../dominio/actividades.js";
import {
  requerimientosMateriales, evaluarFactibilidad, cantidadCompra, valorMaterialesPropios,
  aplicarReemplazos, recomendarMaterialNuevo
} from "../dominio/materiales.js";
import { calcularPresupuesto, aiuEfectivo } from "../dominio/presupuesto.js";
import { FASES, faseDe, ordenFase, calcularCronograma, avanceObra } from "../dominio/cronograma.js";
import { capituloDe, PREFIJO_COTIZADO } from "../datos/capitulos.js";
import { areaHueco, areaHuecos, revisarHuecos } from "../dominio/huecos.js";
import { NOMBRES_TIPO } from "../datos/tipos-obra.js";
import { limpiarObra } from "./obra-entrada.js";
import { actividadOficial, PREFIJO_OFICIAL } from "./listas-oficiales.servicio.js";

/** Insumos con los precios que la persona cotizó en lugar de los de referencia. */
function insumosDe(obra) {
  const insumos = { ...INSUMOS };
  for (const [id, precio] of Object.entries(obra.precios)) insumos[id] = { ...INSUMOS[id], precio, propio: true };
  return insumos;
}

/** El APU tal como se usó en esta obra: cada insumo con su cantidad por unidad, precio y parcial, y la cuadrilla. */
function composicionDe(apu, insumos) {
  const a = analizarAPU(apu, insumos);
  return {
    insumos: a.lineas.map(x => ({ id: x.id, cantidad: x.cantidad, precio: x.precio, parcial: x.parcial, propio: Boolean(insumos[x.id].propio) })),
    herramienta: a.herramienta,
    cuadrilla: apu.insumos.length ? cuadrilla(apu) : null,
    oficial: apu.oficial || null,         // precio oficial sin composición publicada
    cotizacion: apu.cotizacion || null    // ítem cotizado: { precio, fuente }
  };
}

/** Diferencia con los precios oficiales de la misma actividad (negativa = más barato que la referencia). */
const referenciasDe = (codigo, unitario) => (REFERENCIAS_OFICIALES[codigo] || []).map(r => ({
  fuente: r.fuente, item: r.item, desc: r.desc, url: r.url, precio: r.precio, diferencia: unitario / r.precio - 1,
  equivalente: r.equivalente !== false, nota: r.nota || ""
}));

/**
 * Si el cálculo se aleja más de LIMITE_REFERENCIA de todas sus referencias equivalentes, la más reciente de ellas;
 * si no, null. Las actividades con precio cotizado, oficial o de una cotización no se marcan.
 */
function alertaDe(l) {
  if (l.precioPropio || l.apu.oficial || l.apu.cotizacion) return null;
  const eq = referenciasDe(l.codigo, l.unitarioAPU).filter(r => r.equivalente);
  if (!eq.length || !eq.every(r => Math.abs(r.diferencia) > LIMITE_REFERENCIA)) return null;
  const año = r => Number((r.fuente.match(/\d{4}/) || [0])[0]);
  const { fuente, item, precio, diferencia } = [...eq].sort((a, b) => año(b) - año(a))[0];
  return { fuente, item, precio, diferencia };
}

// "Baño de 2 × 1,5 m" para la memoria de cantidades.
const d = v => String(Math.round(v * 100) / 100).replace(".", ",");
function parteDe(el) {
  const m = el.medidas, nombre = NOMBRES_TIPO[el.tipo][0];
  const medida = el.tipo === "muro" ? `${d(m.largo)} × ${d(m.alto)} m` : `${d(m.largo)} × ${d(m.ancho)} m`;
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} de ${medida}${el.cantidad > 1 ? ` (× ${el.cantidad} iguales)` : ""}`;
}

/** Un ítem cotizado como actividad del presupuesto: su costo es el de la cotización y no tiene composición. */
const actividadCotizada = x => ({
  codigo: PREFIJO_COTIZADO + x.id, corto: x.nombre, nombre: x.nombre, categoria: "Ítems cotizados", unidad: x.unidad,
  rendimiento: null, insumos: [], cotizacion: { precio: x.precio, fuente: x.fuente }
});

/** Validación de las medidas de una parte, con la de sus puertas y ventanas. */
function validarParte(el) {
  const v = validarMedidas(el.tipo, el.medidas), h = revisarHuecos(el.huecos);
  return { errores: [...v.errores, ...h.errores], advertencias: [...v.advertencias, ...h.advertencias] };
}

/** Actividades de la obra con su APU (ya con los materiales cambiados por la persona y sin lo que pidió quitar). */
function actividadesDe(obra, insumos) {
  const elementos = obra.elementos.map(el => {
    const v = validarParte(el);
    const actividades = v.errores.length ? [] : generarActividades(el.tipo, el.medidas, { excluir: el.excluir, remodelacion: el.remodelacion, huecos: el.huecos });
    const quitoMuro = el.excluir.some(c => c.startsWith("MAM-"));
    if (el.huecos.length && actividades.length && !quitoMuro && !actividades.some(l => l.codigo.startsWith("MAM-")))
      v.advertencias.push("Las puertas y ventanas ocupan todo el muro: revise sus medidas.");
    return { el, v, actividades };
  });
  const generadas = elementos.flatMap(({ el, actividades }) => (
    actividades.map(l => [l.codigo, l.cantidad * el.cantidad,
      l.memoria.map(x => ({ parte: parteDe(el), texto: x.texto, cantidad: Math.round(x.cantidad * el.cantidad * 100) / 100 }))])));
  const sueltos = obra.extras.filter(x => x.cantidad > 0).map(x => [x.codigo, x.cantidad,
    [{ parte: x.codigo.startsWith(PREFIJO_OFICIAL) ? "Ítem de la lista oficial" : "Trabajo suelto", texto: "cantidad escrita", cantidad: x.cantidad }]]);
  const cotizados = obra.cotizados.map(x => [PREFIJO_COTIZADO + x.id, x.cantidad,
    [{ parte: "Ítem cotizado", texto: `cantidad escrita${x.fuente ? `; cotización: ${x.fuente}` : ""}`, cantidad: x.cantidad }]]);
  // Base de APU con los materiales cambiados, más los ítems de la lista oficial y los cotizados que se agregaron.
  const apus = [...APU.map(a => aplicarReemplazos(a, obra.reemplazos)),
    ...obra.extras.filter(x => x.codigo.startsWith(PREFIJO_OFICIAL)).map(x => actividadOficial(x.codigo)).filter(Boolean),
    ...obra.cotizados.map(actividadCotizada)];
  const lineas = unirLineas([...generadas, ...sueltos, ...cotizados]).map(l => {
    const apu = apus.find(a => a.codigo === l.codigo);
    const unitarioAPU = analizarAPU(apu, insumos).unitario, cotizado = obra.preciosActividad[l.codigo];
    return { ...l, apu, rendimiento: apu.rendimiento, unitarioAPU, unitario: cotizado ?? unitarioAPU, precioPropio: cotizado !== undefined };
  });
  // Orden del presupuesto: por capítulo y, dentro, en el orden del capítulo.
  const posicion = c => { const cap = capituloDe(c); return cap.numero * 100 + Math.max(0, cap.codigos.indexOf(c)); };
  lineas.sort((a, b) => posicion(a.codigo) - posicion(b.codigo) || a.codigo.localeCompare(b.codigo));
  return { elementos, lineas, apus };
}

/** Capítulos numerados seguido con los que tiene la obra (1, 2, 3…) e ítems 1.1, 1.2, 2.1… */
function numerarItems(lineas) {
  const numeros = new Map(), contador = new Map();
  for (const l of lineas) { const cap = capituloDe(l.codigo); if (!numeros.has(cap.nombre)) numeros.set(cap.nombre, numeros.size + 1); }
  return lineas.map(l => {
    const cap = capituloDe(l.codigo), numero = numeros.get(cap.nombre), n = (contador.get(numero) || 0) + 1;
    contador.set(numero, n);
    return { ...l, capitulo: { numero, nombre: cap.nombre }, item: `${numero}.${n}` };
  });
}

/** Materiales que necesita la obra: { idInsumo: cantidad }. */
export function requerimientosDeObra(entrada) {
  const obra = limpiarObra(entrada);
  const { lineas, apus } = actividadesDe(obra, insumosDe(obra));
  return requerimientosMateriales(lineas, apus, INSUMOS);
}

/** Todos los insumos que usa la obra (materiales, equipos y mano de obra), con su precio y de dónde sale. */
function preciosUsados(lineas, insumos) {
  const peso = new Map();
  for (const l of lineas) for (const [id, coef] of l.apu.insumos) peso.set(id, (peso.get(id) || 0) + l.cantidad * coef * insumos[id].precio);
  const orden = { material: 0, equipo: 1, servicio: 2, mo: 3 };
  return [...peso].sort(([a, pa], [b, pb]) => orden[insumos[a].tipo] - orden[insumos[b].tipo] || pb - pa)
    .map(([id, valor]) => ({ id, precio: insumos[id].precio, referencia: INSUMOS[id].precio, propio: Boolean(insumos[id].propio), valor }));
}

/**
 * @param {object} entrada datos de la obra (ver obra-entrada.js)
 * @returns {object} resultado completo para dibujar todas las pantallas
 */
export function calcularObra(entrada) {
  const obra = limpiarObra(entrada);
  const insumos = insumosDe(obra);
  const { elementos, lineas, apus } = actividadesDe(obra, insumos);
  const requeridos = requerimientosMateriales(lineas, apus, insumos);

  // Materiales: con lo que tiene (para saber qué falta) y sumando lo ya comprado (para lo que falta invertir).
  const conLoQueTiene = evaluarFactibilidad(requeridos, obra.disponibles, insumos, SUSTITUTOS);
  const disponiblesYComprados = { ...obra.disponibles };
  for (const id of obra.comprados) if (requeridos[id]) disponiblesYComprados[id] = Math.max(disponiblesYComprados[id] || 0, requeridos[id]);
  const conComprados = evaluarFactibilidad(requeridos, disponiblesYComprados, insumos, SUSTITUTOS);

  const aiu = aiuEfectivo(obra.ejecucion, obra.aiu);
  const presupuesto = calcularPresupuesto(lineas, aiu);
  // Rango: el total si las actividades marcadas costaran lo de su referencia oficial equivalente.
  const alertas = new Map(lineas.map(l => [l.codigo, alertaDe(l)]).filter(([, a]) => a));
  const rango = alertas.size ? {
    total: calcularPresupuesto(lineas.map(l => (alertas.has(l.codigo) ? { ...l, unitario: alertas.get(l.codigo).precio } : l)), aiu).total,
    actividades: [...alertas.keys()]
  } : null;
  const propios = valorMaterialesPropios(conComprados.items, insumos);

  // Cronograma: en el orden en que se construye. Los ítems de la lista oficial y los cotizados no traen rendimiento: no se programan.
  const porFase = lineas.filter(l => l.rendimiento > 0).sort(ordenFase);
  const pendientes = porFase.filter(l => !obra.hechas.includes(l.codigo));
  const tramos = calcularCronograma(pendientes).map(t => ({ codigo: t.codigo, inicio: t.inicio, dias: t.dias }));

  const compras = conLoQueTiene.items.filter(i => i.falta > 1e-9).map(i => {
    const ins = insumos[i.id], cantidad = cantidadCompra(i.falta, ins.unidad);
    return { id: i.id, cantidad, costo: cantidad * precioInsumo(ins), precioPropio: Boolean(ins.propio), comprado: obra.comprados.includes(i.id) };
  });

  // Opinión sobre cada material que la persona dijo tener.
  const suyos = new Set([...Object.keys(obra.disponibles), ...obra.anotados.map(a => a.id).filter(Boolean)]);
  const recomendaciones = Object.fromEntries([...suyos].map(id => [id, recomendarMaterialNuevo(id, requeridos)]));

  // Cantidades para comprar redondeadas a como se vende cada material.
  const conCompra = item => {
    const unidad = insumos[item.id].unidad;
    return { ...item, compraNecesita: cantidadCompra(item.necesita, unidad), compraFalta: cantidadCompra(item.falta, unidad) };
  };

  return {
    elementos: elementos.map(({ el, v, actividades }) => ({
      id: el.id, errores: v.errores, advertencias: v.advertencias, actividades: actividades.map(l => l.codigo),
      // Puertas y ventanas detalladas, con el área que se descuenta de cada una.
      huecos: el.huecos.map(h => ({ ...h, area: Math.round(areaHueco(h) * 100) / 100 })), areaHuecos: Math.round(areaHuecos(el.huecos) * 100) / 100
    })),
    hayErrores: elementos.some(x => x.v.errores.length > 0),
    extrasSinCantidad: obra.extras.some(x => !(x.cantidad > 0)),
    lineas: numerarItems(lineas).map(l => ({
      codigo: l.codigo, item: l.item, capitulo: l.capitulo, nombre: l.apu.nombre, unidad: l.apu.unidad, cantidad: l.cantidad, unitario: l.unitario,
      unitarioAPU: l.unitarioAPU, precioPropio: l.precioPropio, referencias: referenciasDe(l.codigo, l.unitarioAPU), alerta: alertas.get(l.codigo) || null,
      total: l.cantidad * l.unitario, rendimiento: l.rendimiento, fase: FASES[faseDe(l.codigo)]?.nombre || "Otras actividades",
      composicion: composicionDe(l.apu, insumos), memoria: l.memoria
    })),
    requeridos,
    materiales: {
      items: conLoQueTiene.items.map(conCompra),
      factible: conLoQueTiene.factible,
      cobertura: conLoQueTiene.recomendaciones.find(r => r.tipo === "Cambiar")?.texto || null
    },
    recomendaciones,
    compras,
    precios: preciosUsados(lineas, insumos),
    presupuesto: { ...presupuesto, propios, porInvertir: presupuesto.total - propios, rango },
    cronograma: { orden: porFase.map(l => l.codigo), tramos, avance: avanceObra(porFase, obra.hechas),
      sinProgramar: lineas.filter(l => !(l.rendimiento > 0)).map(l => l.codigo) }
  };
}
