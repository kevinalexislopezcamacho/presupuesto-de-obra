import { test } from "node:test";
import assert from "node:assert/strict";
import { APU } from "../../src/datos/apu.js";
import {
  evaluarFactibilidad, cantidadCompra, aplicarReemplazos, recomendarMaterialNuevo, buscarInsumo
} from "../../src/dominio/materiales.js";
import { interpretarMateriales } from "../../src/dominio/materiales-texto.js";

const insumosPrueba = {
  x: { nombre: "x", unidad: "u", precio: 100, tipo: "material" },
  y: { nombre: "y", unidad: "u", precio: 50, tipo: "material" }
};
const leidos = r => r.map(x => `${x.id}=${x.cantidad}`).join();

test("factibilidad: completa, parcial y faltante", () => {
  assert.ok(evaluarFactibilidad({ x: 10 }, { x: 10 }, insumosPrueba, []).factible);
  const f = evaluarFactibilidad({ x: 10, y: 4 }, { x: 5 }, insumosPrueba, []);
  assert.equal(f.factible, false);
  assert.deepEqual(f.items.map(i => i.estado), ["parcial", "falta"]);
});

test("factibilidad: sugiere un reemplazo válido", () => {
  const f = evaluarFactibilidad({ x: 10 }, { y: 3 }, insumosPrueba, [{ falta: "x", tiene: "y", valido: true, texto: "t" }]);
  assert.ok(f.recomendaciones.some(r => r.tipo === "Reemplazar"));
});

test("compra en unidades enteras para und, bulto y lb", () => {
  assert.equal(cantidadCompra(12.2, "und"), 13);
  assert.equal(cantidadCompra(0.34, "m³"), 0.4);
});

test("reemplazo: cambia el insumo dentro del APU", () => {
  const piso = aplicarReemplazos(APU.find(a => a.codigo === "ACB-02"), { cpi: "cpa" });
  assert.ok(piso.insumos.some(([id]) => id === "cpa"));
});

test("recomendación: cerámica de pared en el piso no es lo correcto", () => {
  const r = recomendarMaterialNuevo("cpa", { cpi: 3 });
  assert.equal(r.tipo, "reemplaza");
  assert.equal(r.alt.valido, false);
});

test("búsqueda por otros nombres", () => {
  assert.equal(buscarInsumo("varillas"), "acr");
  assert.equal(buscarInsumo("ladrillos"), "blq");
});

test("materiales escritos: cantidades y unidades", () => {
  assert.equal(leidos(interpretarMateriales("tengo 20 bultos de cemento, 300 ladrillos y 10 varillas de 1/2")), "cem=20,blq=300,acr=59.6");
});

test("materiales escritos: conversiones", () => {
  assert.equal(leidos(interpretarMateriales("50 kilos de cemento, 36 bultos de arena y 5 cajas de cerámica de piso")), "cem=1,are=1,cpi=7.2");
});

test("materiales escritos: miles con punto, sin inventar cantidades y con el texto original", () => {
  const r = interpretarMateriales("Tengo 1.500 ladrillos, una volqueta de arena, 2,5 bultos de Cemento y 10 varillas");
  assert.equal(leidos(r), "blq=1500,are=null,cem=2.5,acr=null");
  assert.match(r[1].nota, /no hay una conversión segura a m³/);
  assert.match(r[3].nota, /calibre/);
  assert.equal(r[2].texto, "2,5 bultos de Cemento");
});

test("materiales escritos: el tipo se elige según la obra y lo no calculado se avisa", () => {
  assert.equal(interpretarMateriales("200 bloques", { blc: 100 })[0].id, "blc");
  const tejas = interpretarMateriales("tejas de barro")[0];
  assert.equal(tejas.id, null);
  assert.match(tejas.nota, /techos/);
});
