/**
 * Limpia y completa los datos de una obra que llegan del cliente.
 * Todo lo que no se reconoce se descarta, para que los cálculos nunca reciban basura.
 */
import { APU } from "../datos/apu.js";
import { INSUMOS } from "../datos/precios.js";
import { AIU_CALI_2026 } from "../dominio/presupuesto.js";
import { medidasPorDefecto, limpiarExcluidas } from "../dominio/actividades.js";
import { limpiarHuecos } from "../dominio/huecos.js";
import { TIPOS_OBRA } from "../datos/tipos-obra.js";
import { esObjeto } from "../utilidades/valores.js";
import { itemOficial, PREFIJO_OFICIAL } from "./listas-oficiales.servicio.js";

const CODIGOS_APU = new Set(APU.map(a => a.codigo));
// Una actividad válida: de la base de APU o un ítem de la lista oficial agregado al presupuesto ("GOB-100113").
const esActividad = c => CODIGOS_APU.has(c) || (typeof c === "string" && c.startsWith(PREFIJO_OFICIAL) && Boolean(itemOficial(c)));
const numero = (v, porDefecto = 0) => (Number.isFinite(Number(v)) ? Number(v) : porDefecto);
const texto = (v, max = 2000) => (typeof v === "string" ? v.slice(0, max) : "");
const lista = v => (Array.isArray(v) ? v : []);

// Precios que escribe la persona (sus cotizaciones): solo códigos conocidos y valores razonables.
function limpiarPrecios(obj, validos) {
  const r = {};
  if (!esObjeto(obj)) return r;
  for (const [k, v] of Object.entries(obj)) if (validos(k) && numero(v) > 0 && numero(v) < 1e9) r[k] = numero(v);
  return r;
}

function limpiarElemento(e, i) {
  if (!esObjeto(e) || !TIPOS_OBRA.includes(e.tipo)) return null;
  const base = medidasPorDefecto(e.tipo);
  const medidas = { ...base };
  const entrada = esObjeto(e.medidas) ? e.medidas : {};
  for (const campo of Object.keys(base)) {
    if (campo === "sistema") medidas.sistema = entrada.sistema === "concreto" ? "concreto" : "arcilla";
    else if (campo in entrada) medidas[campo] = numero(entrada[campo], NaN);
  }
  return {
    id: texto(e.id, 60) || `e${i}`,
    tipo: e.tipo,
    cantidad: Math.min(500, Math.max(1, Math.round(numero(e.cantidad, 1)))),
    medidas,
    estimadas: lista(e.estimadas).filter(k => typeof k === "string"),
    porDefecto: lista(e.porDefecto).filter(k => typeof k === "string"),
    excluir: limpiarExcluidas(e.excluir),
    remodelacion: e.remodelacion === true,     // el espacio ya existe: se agregan las demoliciones
    huecos: limpiarHuecos(e.huecos)            // puertas y ventanas con su forma (reemplazan las típicas)
  };
}

// Ítems que no están en la base, con el precio de una cotización ("Puerta en arco en madera", 1 und, $1.200.000).
export const UNIDADES_COTIZADO = ["und", "m", "m²", "m³", "gl", "kg", "día", "mes", "viaje"];
function limpiarCotizados(v) {
  const vistos = new Set();
  return lista(v).filter(esObjeto).slice(0, 100).map((x, i) => {
    let id = typeof x.id === "string" && /^[\w-]{1,40}$/.test(x.id) ? x.id : `c${i + 1}`;
    while (vistos.has(id)) id = `${id}-${i}`;
    vistos.add(id);
    return {
      id, nombre: texto(x.nombre, 150).trim(),
      unidad: UNIDADES_COTIZADO.includes(x.unidad) ? x.unidad : "und",
      cantidad: Math.min(1e6, Math.max(0, numero(x.cantidad))),
      precio: Math.min(1e10, Math.max(0, Math.round(numero(x.precio)))),
      fuente: texto(x.fuente, 150).trim()
    };
  }).filter(x => x.nombre && x.cantidad > 0 && x.precio > 0);
}

const fechaISO = v => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
function limpiarTiempo(t) {
  if (!esObjeto(t)) return null;
  return { inicio: fechaISO(t.inicio), fin: fechaISO(t.fin), ms: Math.min(1e9, Math.max(0, Math.round(numero(t.ms)))) };
}

function limpiarCantidades(obj) {
  const r = {};
  if (!esObjeto(obj)) return r;
  for (const [id, v] of Object.entries(obj)) if (INSUMOS[id] && numero(v) > 0) r[id] = numero(v);
  return r;
}

/**
 * @param {object} entrada datos crudos de la obra
 * @returns {object} obra con valores válidos y completos
 */
export function limpiarObra(entrada = {}) {
  const o = esObjeto(entrada) ? entrada : {};
  const aiu = esObjeto(o.aiu) ? o.aiu : {};
  const pct = (k) => Math.min(1, Math.max(0, numero(aiu[k], AIU_CALI_2026[k])));
  const reemplazos = {};
  if (esObjeto(o.reemplazos)) for (const [de, a] of Object.entries(o.reemplazos)) if (INSUMOS[de] && INSUMOS[a]) reemplazos[de] = a;
  return {
    texto: texto(o.texto),
    elementos: lista(o.elementos).map(limpiarElemento).filter(Boolean),
    extras: lista(o.extras)
      .filter(x => esObjeto(x) && esActividad(x.codigo))
      .map(x => ({ codigo: x.codigo, cantidad: Math.max(0, numero(x.cantidad)), ...(x.nota ? { nota: texto(x.nota, 600) } : {}) })),
    cotizados: limpiarCotizados(o.cotizados),
    disponibles: limpiarCantidades(o.disponibles),
    anotados: lista(o.anotados).filter(esObjeto).map(a => ({
      clave: texto(a.clave, 60), id: INSUMOS[a.id] ? a.id : null, texto: texto(a.texto, 200), nota: texto(a.nota, 400),
      decision: a.decision === "aparte" ? "aparte" : null
    })),
    comprados: lista(o.comprados).filter(id => INSUMOS[id]),
    hechas: lista(o.hechas).filter(esActividad),
    reemplazos,
    cambiosMat: lista(o.cambiosMat).filter(c => esObjeto(c) && INSUMOS[c.de] && INSUMOS[c.a]).map(c => ({
      de: c.de, a: c.a, valido: Boolean(c.valido), texto: texto(c.texto, 400), sistema: c.sistema === "concreto" || c.sistema === "arcilla" ? c.sistema : null
    })),
    ejecucion: o.ejecucion === "contratista" ? "contratista" : o.ejecucion === "directo" ? "directo" : null,
    aiu: { a: pct("a"), i: pct("i"), u: pct("u"), iva: pct("iva") },
    inicioObra: /^\d{4}-\d{2}-\d{2}$/.test(o.inicioObra || "") ? o.inicioObra : null,
    // Precios de las cotizaciones de la persona: por insumo ({ cem: 31000 }) o por actividad ({ "CON-05": 45000 }).
    precios: limpiarPrecios(o.precios, id => Boolean(INSUMOS[id])),
    preciosActividad: limpiarPrecios(o.preciosActividad, esActividad),
    // Pedidos de la descripción que no se pudieron aplicar tal cual (se muestran para que nada se pierda).
    observaciones: lista(o.observaciones).filter(esObjeto).slice(0, 30)
      .map(x => ({ texto: texto(x.texto, 300), nota: texto(x.nota, 400) })).filter(x => x.texto || x.nota),
    // Cronómetro para la validación: tiempo activo armando el presupuesto (ms) y cuándo empezó y terminó.
    tiempo: limpiarTiempo(o.tiempo)
  };
}
