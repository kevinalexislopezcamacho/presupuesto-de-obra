/**
 * Análisis de precios unitarios: costo de una unidad de actividad a partir de sus insumos.
 */

import { HERRAMIENTA_MENOR } from "../datos/precios.js";

export const precioInsumo = insumo => insumo.precio;

/**
 * Costo unitario = Σ (cantidad × precio de cada insumo) + herramienta menor (% de la mano de obra).
 */
export function analizarAPU(apu, insumos) {
  // Ítem con precio oficial y sin composición publicada: su costo es ese precio.
  if (!apu.insumos.length && apu.oficial) return { lineas: [], herramienta: 0, unitario: apu.oficial.precio, oficial: apu.oficial };
  // Ítem cotizado (no está en la base): su costo es el de la cotización.
  if (!apu.insumos.length && apu.cotizacion) return { lineas: [], herramienta: 0, unitario: apu.cotizacion.precio, cotizacion: apu.cotizacion };
  const lineas = apu.insumos.map(([id, cantidad]) => {
    const ins = insumos[id];
    const precio = precioInsumo(ins);
    return { id, nombre: ins.nombre, unidad: ins.unidad, tipo: ins.tipo, cantidad, precio, parcial: cantidad * precio };
  });
  const manoDeObra = lineas.filter(l => l.tipo === "mo").reduce((s, l) => s + l.parcial, 0);
  const herramienta = manoDeObra * HERRAMIENTA_MENOR;
  return { lineas, herramienta, unitario: lineas.reduce((s, l) => s + l.parcial, 0) + herramienta };
}

/**
 * Personas de la cuadrilla, deducidas de las horas-hombre y del rendimiento en una jornada de 8 h
 * (por ejemplo, 0,8 hh de ayudante por m² con 20 m²/día = 2 ayudantes). Se redondea a medias personas.
 */
export function cuadrilla(apu, horasDia = 8) {
  const personas = id => {
    const hh = apu.insumos.filter(([i]) => i === id).reduce((s, [, c]) => s + c, 0);
    return Math.round((hh * apu.rendimiento / horasDia) * 2) / 2;
  };
  return { oficiales: personas("mof"), ayudantes: personas("may") };
}

// Revisa la base antes de usarla: útil cuando se carguen los APU reales.
export function validarBase(apus, insumos) {
  const errores = [], codigos = new Set();
  for (const apu of apus) {
    if (codigos.has(apu.codigo)) errores.push(`${apu.codigo}: código repetido`);
    codigos.add(apu.codigo);
    if (!(apu.rendimiento > 0)) errores.push(`${apu.codigo}: rendimiento inválido`);
    if (!apu.insumos.length && !(apu.oficial?.precio > 0)) errores.push(`${apu.codigo}: sin insumos ni precio oficial`);
    for (const [id, cant] of apu.insumos) {
      if (!insumos[id]) errores.push(`${apu.codigo}: el insumo "${id}" no existe`);
      if (!(cant > 0)) errores.push(`${apu.codigo}: cantidad inválida para "${id}"`);
    }
  }
  return errores;
}
