import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularObra } from "../../src/servicios/calculo.servicio.js";
import { crearServicioInterprete } from "../../src/servicios/interprete.servicio.js";

const cerca = (a, b) => Math.abs(a - b) < 0.5;
const BANO = { tipo: "bano", medidas: { largo: 2, ancho: 1.5, alto: 2.4, sistema: "arcilla" } };
const COTIZADO = { id: "c1", nombre: "Puerta en arco en madera", unidad: "und", cantidad: 1, precio: 850000 };

test("compras: los ítems de la lista oficial y los cotizados salen con su costo y se pueden marcar", () => {
  const obra = { elementos: [BANO], extras: [{ codigo: "GOB-200802", cantidad: 25 }], cotizados: [COTIZADO] };
  const c = calcularObra(obra);
  const oficial = c.compras.find(x => x.id === "GOB-200802"), cotizado = c.compras.find(x => x.id === "COT-c1");
  assert.deepEqual([oficial.tipo, oficial.cantidad, oficial.comprado], ["oficial", 25, false]);
  assert.ok(cerca(oficial.costo, c.lineas.find(l => l.codigo === "GOB-200802").total));
  assert.deepEqual([cotizado.tipo, cotizado.costo], ["cotizado", 850000]);
  assert.ok(c.compras.filter(x => x.tipo === "material").every(x => x.nombre && x.unidad));

  // Marcarlos como comprados baja lo que falta por invertir; el total no cambia.
  const m = calcularObra({ ...obra, comprados: ["GOB-200802", "COT-c1", "COT-no-existe", "GOB-000000"] });
  assert.equal(m.presupuesto.total, c.presupuesto.total);
  assert.ok(cerca(c.presupuesto.porInvertir - m.presupuesto.porInvertir, oficial.costo + 850000));
  assert.deepEqual(m.compras.filter(x => x.comprado).map(x => x.id), ["GOB-200802", "COT-c1"]);
});

test("compras adicionales: capítulo propio, suman al costo y a Compras, sin cronograma", () => {
  const sin = calcularObra({ elementos: [BANO] });
  const c = calcularObra({ elementos: [BANO], comprasAdicionales: { cem: 10, mof: 3, inventado: 4 } });
  const l = c.lineas.find(x => x.codigo === "MAT-cem");
  assert.deepEqual([l.capitulo.nombre, l.cantidad, l.composicion.cuadrilla], ["Materiales adicionales", 10, null]);
  assert.equal(c.lineas.filter(x => x.codigo.startsWith("MAT-")).length, 1);        // la mano de obra y lo inventado no entran
  assert.ok(c.cronograma.sinProgramar.includes("MAT-cem"));
  assert.ok(cerca(c.presupuesto.total - sin.presupuesto.total, l.total));
  const cemento = calculo => (calculo.compras.find(x => x.id === "cem") || { cantidad: 0 }).cantidad;
  assert.equal(cemento(c) - cemento(sin), 10);
});

test("cuadro rápido: obras y trabajos van al presupuesto, los materiales sueltos a Compras", async () => {
  const servicio = crearServicioInterprete({ ia: null });
  const r = await servicio.interpretarAgregado("10 bultos de cemento y pañetar 20 m2", null);
  assert.deepEqual(r.materiales.map(m => [m.id, m.cantidad]), [["cem", 10]]);
  assert.deepEqual(r.trabajos.map(t => [t.codigo, t.cantidad]), [["PAN-01", 20]]);
  // El material de una obra no es una compra aparte.
  const muro = await servicio.interpretarAgregado("un muro de 3 x 2 en bloque de concreto", null);
  assert.deepEqual([muro.partes.length, muro.materiales.length], [1, 0]);
  const nada = await servicio.interpretarAgregado("hola", null);
  assert.deepEqual([nada.partes, nada.trabajos, nada.materiales, nada.dudas], [[], [], [], []]);
});
