/**
 * Materiales: cantidades requeridas, factibilidad con lo que se tiene, compras,
 * reemplazos y recomendaciones.
 */

import { APU } from "../datos/apu.js";
import { INSUMOS } from "../datos/precios.js";
import { ALTERNATIVAS, SINONIMOS_INSUMO } from "../datos/materiales.js";
import { PALABRAS_VACIAS } from "../datos/lenguaje.js";
import { precioInsumo } from "./apu.js";
import { r2 } from "./numeros.js";
import { normalizar } from "./texto/normalizar.js";

/** Suma los materiales de todas las actividades: { idInsumo: cantidad }. */
export function requerimientosMateriales(lineas, apus, insumos) {
  const req = {};
  for (const l of lineas) {
    const apu = apus.find(a => a.codigo === l.codigo);
    for (const [id, coef] of apu.insumos) {
      if (insumos[id].tipo !== "material") continue;
      req[id] = (req[id] || 0) + l.cantidad * coef;
    }
  }
  return req;
}

/** Cantidad a comprar: unidades enteras para und, bulto y lb; décimas para lo demás. */
const UNIDADES_ENTERAS = new Set(["und", "bulto", "lb"]);
export function cantidadCompra(cantidad, unidad) {
  return UNIDADES_ENTERAS.has(unidad) ? Math.ceil(cantidad - 1e-9) : Math.ceil(cantidad * 10 - 1e-9) / 10;
}

/** Compara lo requerido con lo disponible y arma recomendaciones. */
export function evaluarFactibilidad(req, disp, insumos, sustitutos) {
  const items = Object.entries(req).map(([id, necesita]) => {
    const tiene = disp[id] || 0;
    const falta = Math.max(0, necesita - tiene);
    const estado = falta <= 1e-9 ? "completo" : tiene > 0 ? "parcial" : "falta";
    return { id, necesita, tiene, falta, estado, cobertura: Math.min(1, tiene / necesita) };
  });
  const factible = items.length > 0 && items.every(i => i.estado === "completo");
  const recomendaciones = [];

  for (const s of sustitutos) {
    const item = items.find(i => i.id === s.falta && i.estado !== "completo");
    if (item && (disp[s.tiene] || 0) > 0) recomendaciones.push({ tipo: s.valido ? "Reemplazar" : "No reemplazar", texto: s.texto, sistema: s.sistema });
  }
  for (const i of items.filter(i => i.estado !== "completo")) {
    const ins = insumos[i.id];
    recomendaciones.push({ tipo: "Agregar", texto: `Conseguir ${cantidadCompra(i.falta, ins.unidad).toLocaleString("es-CO")} ${ins.unidad} de ${ins.nombre.charAt(0).toLowerCase() + ins.nombre.slice(1)}${i.tiene > 0 ? ` (hay ${r2(i.tiene).toLocaleString("es-CO")})` : ""}.` });
  }
  const menorCobertura = items.length ? Math.min(...items.map(i => i.cobertura)) : 0;
  if (!factible && menorCobertura > 0)
    recomendaciones.push({ tipo: "Cambiar", texto: `Los materiales disponibles alcanzan para cerca del ${Math.floor(menorCobertura * 100)} % de la obra. Se pueden reducir las medidas o hacerla por etapas.` });
  for (const [id, tiene] of Object.entries(disp)) {
    const necesita = req[id] || 0;
    if (tiene > 0 && tiene > necesita * 1.1 && insumos[id])
      recomendaciones.push({ tipo: "Sobra material", texto: `${insumos[id].nombre}: sobran cerca de ${r2(tiene - necesita).toLocaleString("es-CO")} ${insumos[id].unidad}.` });
  }
  return { items, factible, recomendaciones };
}

/** Valor de los materiales que ya se tienen (lo que no hay que comprar). */
export function valorMaterialesPropios(items, insumos) {
  return items.reduce((s, i) => s + Math.min(i.tiene, i.necesita) * precioInsumo(insumos[i.id]), 0);
}

// Cambia insumos de un APU según los reemplazos elegidos ({ cpi: "cpa" }).
export function aplicarReemplazos(apu, reemplazos) {
  if (!reemplazos || !Object.keys(reemplazos).length) return apu;
  return { ...apu, insumos: apu.insumos.map(([id, c]) => [reemplazos[id] || id, c]) };
}

// Busca un insumo por su nombre o por otros nombres comunes ("varilla", "ladrillo").
export function buscarInsumo(texto) {
  const q = normalizar(texto).trim();
  if (!q) return null;
  const mats = Object.entries(INSUMOS).filter(([, i]) => i.tipo === "material");
  const exacto = mats.find(([, i]) => normalizar(i.nombre) === q);
  if (exacto) return exacto[0];
  const palabras = q.split(/\s+/).filter(w => w.length > 2 && !PALABRAS_VACIAS.has(w));
  let mejor = null, puntos = 0;
  for (const [id, i] of mats) {
    const texto = normalizar(i.nombre + " " + (SINONIMOS_INSUMO[id] || ""));
    const p = palabras.filter(w => texto.includes(w.slice(0, 5))).length;
    if (p > puntos) { puntos = p; mejor = id; }
  }
  return mejor;
}

// Qué decirle a alguien que agrega un material: si la obra lo usa, si reemplaza a otro o en qué actividad sirve.
export function recomendarMaterialNuevo(id, req) {
  if (req[id]) return { tipo: "usa" };
  for (const [de, alts] of Object.entries(ALTERNATIVAS)) {
    if (!req[de]) continue;
    const alt = alts.find(a => a.por === id);
    if (alt) return { tipo: "reemplaza", de, alt };
  }
  return { tipo: "otra-actividad", usos: APU.filter(a => a.insumos.some(([i]) => i === id)).map(a => a.codigo) };
}
