/**
 * Catálogo que entrega el backend (tipos de obra, insumos, APU, tiendas…),
 * con funciones de consulta para las vistas. Se carga una vez al iniciar.
 */
import * as api from "../api/cliente.js";

/** @type {object|null} datos del catálogo (enlace vivo: se llena con cargarCatalogo) */
export let catalogo = null;

export async function cargarCatalogo() {
  catalogo = await api.obtenerCatalogo();
  return catalogo;
}

export const insumo = id => catalogo.insumos[id];
export const apu = codigo => catalogo.apu.find(a => a.codigo === codigo);
export const nombreApu = codigo => apu(codigo)?.nombre || codigo;
/** Nombre hasta la primera ", " (no corta en "0,12 × 0,20 m"). */
export const nombreCortoApu = codigo => nombreApu(codigo).split(/,\s/)[0];
export const unidadApu = codigo => apu(codigo)?.unidad || "";

export const nombreTipo = tipo => catalogo.tipos[tipo].nombre;
/** "4 muros", "1 baño" */
export const nombreCantidad = (tipo, n) => `${n} ${catalogo.nombresTipo[tipo][n === 1 ? 0 : 1]}`;
export const singular = tipo => catalogo.nombresTipo[tipo][0];

/** Medidas por defecto de un tipo de construcción. */
export const medidasPorDefecto = tipo =>
  ({ sistema: "arcilla", ...Object.fromEntries(catalogo.tipos[tipo].campos.map(([campo, , valor]) => [campo, valor])) });
