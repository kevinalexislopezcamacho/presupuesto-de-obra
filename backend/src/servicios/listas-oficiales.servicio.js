/**
 * Catálogo de la lista oficial de precios de la Gobernación del Valle 2024 (Decreto 1.22-1441):
 * búsqueda por texto, capítulo y unidad, y los ítems que se agregan al presupuesto como "GOB-<código>".
 * Los datos se transcribieron del PDF oficial (ver scripts/listas-oficiales).
 */
import { readFileSync } from "node:fs";
import { normalizar } from "../dominio/texto/normalizar.js";

const LISTA = JSON.parse(readFileSync(new URL("../datos/listas-oficiales/gobernacion-valle-2024.json", import.meta.url), "utf8"));
const UNIDAD = { M2: "m²", M3: "m³", ML: "m", M: "m", UND: "und", KG: "kg", GL: "gl", PUNTO: "punto", LB: "lb", HORA: "h", DIA: "día" };
export const PREFIJO_OFICIAL = "GOB-";

// Cada ítem con su texto de búsqueda ya normalizado (una sola vez al arrancar).
const ITEMS = LISTA.items.map(i => ({
  ...i,
  unidadMostrada: UNIDAD[i.unidad] || (i.unidad ? i.unidad.toLowerCase() : null),
  nombreCapitulo: LISTA.capitulos[i.capitulo] || "",
  buscar: normalizar(`${i.codigo} ${i.actividad} ${LISTA.capitulos[i.capitulo] || ""}`),
  nombreBuscar: normalizar(`${i.codigo} ${i.actividad}`)
}));
const POR_CODIGO = new Map(ITEMS.map(i => [i.codigo, i]));

/** Datos de la fuente (para citarla). */
export const fuenteOficial = () => ({ fuente: LISTA.fuente, documento: LISTA.documento, url: LISTA.url, publicacion: LISTA.publicacion, metodo: LISTA.metodo, total: ITEMS.length });

/** Capítulos con cuántos ítems tiene cada uno. */
export function capitulosOficiales() {
  const cuenta = new Map();
  for (const i of ITEMS) cuenta.set(i.capitulo, (cuenta.get(i.capitulo) || 0) + 1);
  return [...cuenta].map(([codigo, n]) => ({ codigo, nombre: LISTA.capitulos[codigo] || "", items: n }));
}

const publico = ({ buscar, nombreBuscar, ...i }) => i;

/**
 * Busca en la lista: cada palabra debe ser el comienzo de una palabra del ítem o de su capítulo (sin tildes ni mayúsculas).
 * @param {{ q?: string, capitulo?: string, unidad?: string, limite?: number, desde?: number }} filtros
 */
export function buscarOficial({ q = "", capitulo = "", unidad = "", limite = 50, desde = 0 } = {}) {
  const palabras = normalizar(q).split(/\s+/).filter(Boolean).map(palabraCompleta);
  const encontrados = ITEMS.filter(i =>
    (!capitulo || i.capitulo === capitulo || i.capitulo.startsWith(capitulo)) &&
    (!unidad || i.unidad === unidad.toUpperCase()) &&
    palabras.every(re => re.test(i.buscar)));
  // Primero los que lo dicen en su nombre; después los que solo coinciden por el nombre del capítulo.
  const enNombre = i => palabras.every(re => re.test(i.nombreBuscar));
  encontrados.sort((a, b) => enNombre(b) - enNombre(a));
  return { ...fuenteOficial(), total: encontrados.length, items: encontrados.slice(desde, desde + Math.min(limite, 200)).map(publico) };
}

/**
 * Una palabra de la búsqueda debe ser el comienzo de una palabra del ítem ("pint" encuentra "pintura"),
 * no un pedazo de otra ("arco" no encuentra "marco"). Acepta el singular: "puertas" encuentra "puerta".
 */
function palabraCompleta(p) {
  const escapar = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const formas = new Set([p]);
  if (p.length > 4 && p.endsWith("es")) formas.add(p.slice(0, -2));
  if (p.length > 3 && p.endsWith("s")) formas.add(p.slice(0, -1));
  return new RegExp(`(?:^|[^a-z0-9])(?:${[...formas].map(escapar).join("|")})`);
}

/** Un ítem de la lista por su código ("100113") o por el código de presupuesto ("GOB-100113"). */
export function itemOficial(codigo) {
  const i = POR_CODIGO.get(String(codigo).replace(PREFIJO_OFICIAL, ""));
  return i ? publico(i) : null;
}

/** El ítem oficial como una actividad del presupuesto: su costo es el precio oficial y no tiene composición publicada. */
export function actividadOficial(codigo) {
  const i = itemOficial(codigo);
  if (!i) return null;
  const nombre = i.actividad.charAt(0) + i.actividad.slice(1).toLowerCase();
  return {
    codigo: PREFIJO_OFICIAL + i.codigo, corto: nombre, nombre, categoria: i.nombreCapitulo, unidad: i.unidadMostrada || "und",
    rendimiento: null, insumos: [],
    oficial: { fuente: LISTA.fuente + " 2024", item: i.codigo, precio: i.valor, url: LISTA.url, pagina: i.pagina, verificado: i.verificado }
  };
}
