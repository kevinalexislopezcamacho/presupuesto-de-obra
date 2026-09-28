import { test } from "node:test";
import assert from "node:assert/strict";
import { APU } from "../../src/datos/apu.js";
import { INSUMOS, SMMLV_2026, costoHora } from "../../src/datos/precios.js";
import { analizarAPU, validarBase } from "../../src/dominio/apu.js";
import { generarActividades, validarMedidas } from "../../src/dominio/actividades.js";
import { calcularPresupuesto } from "../../src/dominio/presupuesto.js";
import { calcularCronograma, avanceObra } from "../../src/dominio/cronograma.js";
import { r2 } from "../../src/dominio/numeros.js";

const cerca = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≠ ${b}`);
const insumosPrueba = {
  x: { nombre: "x", unidad: "u", precio: 100, tipo: "material" },
  m: { nombre: "m", unidad: "hh", precio: 1000, tipo: "mo" }
};

test("precio unitario: insumos + 5 % de herramienta sobre la mano de obra", () => {
  cerca(analizarAPU({ codigo: "T", rendimiento: 10, insumos: [["x", 2], ["m", 1]] }, insumosPrueba).unitario, 200 + 1000 + 50);
});

test("hora de ayudante 2026 con prestaciones y auxilio de transporte (base de cesantías, intereses y prima)", () => {
  assert.equal(costoHora(SMMLV_2026), Math.round((1750905 * 1.4479 + 249095 * 1.1766) / 210));
});

test("todos los insumos tienen precio y fuente, y la base de APU no tiene errores", () => {
  assert.ok(Object.values(INSUMOS).every(i => i.precio > 0 && i.fuente && i.estado));
  assert.deepEqual(validarBase(APU, INSUMOS), []);
});

test("muro de 6 × 2,5: área, columnas, vigas y acero", () => {
  const muro = generarActividades("muro", { largo: 6, alto: 2.5, vanos: 0, sistema: "arcilla" });
  const q = c => muro.find(l => l.codigo === c).cantidad;
  assert.equal(q("MAM-01"), 15);
  assert.equal(q("CON-01"), 7.5);
  assert.equal(q("CON-02"), 6);
  cerca(q("ACE-01"), r2((7.5 + 6) * 3.3 + 6 * 5));
});

test("cuarto de 3 × 4: placa y piso de 12 m²", () => {
  const cuarto = generarActividades("cuarto", { largo: 3, ancho: 4, alto: 2.4, sistema: "arcilla" });
  assert.equal(cuarto.find(l => l.codigo === "CON-03").cantidad, 12);
  assert.equal(cuarto.find(l => l.codigo === "ACB-02").cantidad, 12);
});

test("validación: errores que impiden calcular y recomendaciones que no", () => {
  assert.ok(validarMedidas("bano", { largo: 0, ancho: 1.5, alto: 2.4 }).errores.length > 0);
  assert.match(validarMedidas("bano", { largo: 2, ancho: 1, alto: 2.4 }).advertencias.join(), /estrecho/);
  assert.match(validarMedidas("muro", { largo: 12, alto: 15, vanos: 0 }).advertencias.join(), /ingeniero/);
});

test("AIU con IVA solo sobre la utilidad", () => {
  cerca(calcularPresupuesto([{ cantidad: 2, unitario: 100 }], { a: 0.1, i: 0.05, u: 0.05, iva: 0.19 }).total, 241.9);
});

test("cronograma en medios días, una actividad tras otra", () => {
  const c = calcularCronograma([{ cantidad: 25, rendimiento: 10 }, { cantidad: 1, rendimiento: 10 }]);
  assert.equal(c[0].dias, 2.5);
  assert.equal(c[1].inicio, 2.5);
  assert.equal(c[1].dias, 0.5);
});

test("avance: marcar una actividad reduce lo que falta", () => {
  const a = avanceObra([{ codigo: "A", cantidad: 20, rendimiento: 10 }, { codigo: "B", cantidad: 10, rendimiento: 10 }], ["A"]);
  assert.equal(a.total, 3);
  assert.equal(a.falta, 1);
  cerca(a.pct, 2 / 3);
});
