/**
 * Presupuesto: costo directo y, si la obra la hace un contratista, AIU con IVA sobre la utilidad.
 */

/** Porcentajes máximos de la Resolución 2026 de la Alcaldía de Cali (licitación pública). */
export const AIU_CALI_2026 = Object.freeze({ a: 0.2909, i: 0.01, u: 0.05, iva: 0.19 });
const SIN_AIU = Object.freeze({ a: 0, i: 0, u: 0, iva: 0 });

/** AIU que aplica según quién hace la obra: "directo" no lleva AIU; "contratista" sí. */
export function aiuEfectivo(ejecucion, aiu = AIU_CALI_2026) {
  return ejecucion === "contratista" ? aiu : SIN_AIU;
}

export function calcularPresupuesto(lineas, aiu) {
  const directo = lineas.reduce((s, l) => s + l.cantidad * l.unitario, 0);
  const admin = directo * aiu.a, imprev = directo * aiu.i, util = directo * aiu.u, ivaUtil = util * aiu.iva;
  return { directo, admin, imprev, util, ivaUtil, total: directo + admin + imprev + util + ivaUtil };
}
