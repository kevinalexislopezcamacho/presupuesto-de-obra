import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularObra, resumirObra } from "../../src/servicios/calculo.servicio.js";
import { limpiarObra } from "../../src/servicios/obra-entrada.js";

const bano = { tipo: "bano", cantidad: 1, medidas: { largo: 2, ancho: 1.5, alto: 2.4 } };

test("limpiarObra descarta lo que no se reconoce y completa medidas", () => {
  const o = limpiarObra({ elementos: [{ tipo: "piscina" }, { tipo: "muro" }], disponibles: { cem: 5, xyz: 3, are: -1 }, hechas: ["NO-EXISTE"] });
  assert.equal(o.elementos.length, 1);
  assert.equal(o.elementos[0].medidas.largo, 6);
  assert.deepEqual(o.disponibles, { cem: 5 });
  assert.deepEqual(o.hechas, []);
});

test("dos baños iguales cuestan el doble que uno", () => {
  const uno = calcularObra({ elementos: [bano] }).presupuesto.directo;
  const dos = calcularObra({ elementos: [{ ...bano, cantidad: 2 }] }).presupuesto.directo;
  assert.ok(Math.abs(dos - 2 * uno) < 1);
});

test("contratista suma AIU; hacerlo directo no", () => {
  const directo = calcularObra({ elementos: [bano], ejecucion: "directo" }).presupuesto;
  const contratista = calcularObra({ elementos: [bano], ejecucion: "contratista" }).presupuesto;
  assert.equal(directo.total, directo.directo);
  assert.ok(contratista.total > directo.total);
});

test("materiales propios y comprados bajan lo que falta por invertir", () => {
  const base = calcularObra({ elementos: [bano] }).presupuesto.porInvertir;
  const conCemento = calcularObra({ elementos: [bano], disponibles: { cem: 10 } }).presupuesto.porInvertir;
  const conCompra = calcularObra({ elementos: [bano], comprados: ["cpa"] }).presupuesto.porInvertir;
  assert.ok(conCemento < base && conCompra < base);
});

test("marcar actividades hechas reduce los días que faltan", () => {
  const antes = calcularObra({ elementos: [bano] }).cronograma;
  const despues = calcularObra({ elementos: [bano], hechas: [antes.tramos[0].codigo] }).cronograma;
  assert.ok(despues.avance.falta < antes.avance.falta);
  assert.equal(despues.tramos.length, antes.tramos.length - 1);
});

test("cambiar cerámica de piso por la de pared cambia los materiales requeridos", () => {
  const r = calcularObra({ elementos: [bano], reemplazos: { cpi: "cpa" } }).requeridos;
  assert.equal(r.cpi, undefined);
  assert.ok(r.cpa > 0);
});

test("lo que la persona pide quitar no se calcula (y el muro se quita sea de arcilla o de concreto)", () => {
  const sinEnchape = calcularObra({ elementos: [{ ...bano, excluir: ["ACB-01"] }] }).lineas.map(l => l.codigo);
  assert.ok(!sinEnchape.includes("ACB-01") && sinEnchape.includes("ACB-02"));
  const muroConcreto = { tipo: "muro", medidas: { largo: 6, alto: 2.5, vanos: 0, sistema: "concreto" }, excluir: ["MAM-01"] };
  assert.ok(!calcularObra({ elementos: [muroConcreto] }).lineas.some(l => l.codigo.startsWith("MAM")));
});

test("precios de las cotizaciones: por insumo y por actividad", () => {
  const base = calcularObra({ elementos: [bano] });
  const conCotizacion = calcularObra({ elementos: [bano], precios: { cem: 40000 }, preciosActividad: { "CON-05": 43069 } });
  assert.ok(conCotizacion.presupuesto.directo !== base.presupuesto.directo);
  const cemento = conCotizacion.precios.find(p => p.id === "cem");
  assert.deepEqual([cemento.precio, cemento.referencia, cemento.propio], [40000, 32500, true]);
  const viga = conCotizacion.lineas.find(l => l.codigo === "CON-05");
  assert.equal(viga.unitario, 43069);
  assert.ok(viga.precioPropio && viga.unitarioAPU > 43069);
  assert.equal(conCotizacion.compras.find(c => c.id === "cem").precioPropio, true);
});

test("cada actividad trae su referencia oficial y la diferencia", () => {
  const viga = calcularObra({ elementos: [bano] }).lineas.find(l => l.codigo === "CON-05");
  assert.equal(viga.referencias[0].fuente, "Gobernación 2024");
  assert.ok(Math.abs(viga.referencias[0].diferencia - (viga.unitarioAPU / viga.referencias[0].precio - 1)) < 1e-9);
});

test("precios inválidos se descartan", () => {
  const o = limpiarObra({ precios: { cem: -5, xyz: 100, are: "abc", gra: 90000 }, preciosActividad: { "NO-1": 5, "PAN-01": 0 } });
  assert.deepEqual(o.precios, { gra: 90000 });
  assert.deepEqual(o.preciosActividad, {});
});

test("resumen para el historial", () => {
  const r = resumirObra({ elementos: [bano], hechas: [] });
  assert.ok(r.total > 0 && r.dias > 0 && r.avance === 0);
});
