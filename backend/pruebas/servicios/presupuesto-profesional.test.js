import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { calcularObra } from "../../src/servicios/calculo.servicio.js";
import { buscarOficial, itemOficial, actividadOficial } from "../../src/servicios/listas-oficiales.servicio.js";
import { presupuestoExcel } from "../../src/servicios/exportacion.servicio.js";
import { generarActividades } from "../../src/dominio/actividades.js";
import { metricasPorClase, sistemaCombinado } from "../../src/dominio/texto/metricas.js";
import { REFERENCIAS_OFICIALES } from "../../src/datos/referencias-oficiales.js";

const bano = { tipo: "bano", cantidad: 1, medidas: { largo: 2, ancho: 1.5, alto: 2.4 } };
const codigos = obra => calcularObra(obra).lineas.map(l => l.codigo);

test("presupuesto por capítulos numerados seguido, con ítems 1.1, 1.2…", () => {
  const { lineas } = calcularObra({ elementos: [bano] });
  assert.deepEqual(lineas.slice(0, 2).map(l => [l.item, l.capitulo.nombre]), [["1.1", "Preliminares"], ["2.1", "Excavaciones y rellenos"]]);
  const numeros = [...new Set(lineas.map(l => l.capitulo.numero))];
  assert.deepEqual(numeros, numeros.map((_, i) => i + 1));          // sin saltos aunque falte un capítulo
});

test("cada ítem trae su memoria de cantidades y su APU", () => {
  const muro = calcularObra({ elementos: [{ tipo: "muro", cantidad: 3, medidas: { largo: 4, alto: 2.5, vanos: 0 } }] }).lineas.find(l => l.codigo === "MAM-01");
  assert.equal(muro.cantidad, 30);
  assert.match(muro.memoria[0].parte, /Muro de 4 × 2,5 m \(× 3 iguales\)/);
  assert.equal(muro.memoria[0].cantidad, 30);
  assert.ok(muro.composicion.insumos.some(x => x.id === "blq") && muro.composicion.cuadrilla.oficiales === 1);
});

test("la cimentación trae excavación, solado, relleno y retiro de sobrantes con precio oficial", () => {
  const l = generarActividades("muro", { largo: 10, alto: 2.5, vanos: 0, sistema: "arcilla" });
  const q = c => l.find(x => x.codigo === c)?.cantidad;
  assert.equal(q("EXC-01"), 2);             // 10 m × 0,40 × 0,50
  assert.equal(q("CON-06"), 4);             // 10 m × 0,40
  assert.equal(q("EXC-02"), 1.3);           // 2 − (0,5 viga + 0,2 solado)
  assert.equal(q("EXC-03"), 0.91);          // 0,7 × 1,3
  const exc = calcularObra({ elementos: [{ tipo: "muro" }] }).lineas.find(x => x.codigo === "EXC-01");
  assert.deepEqual([exc.composicion.oficial.item, exc.unitario], ["100601", 26555]);
});

test("remodelación: sin estructura ni excavación, con demoliciones solo de lo que se cambia", () => {
  const excluir = ["MAM-01", "CON-01", "CON-02", "CON-05", "ACE-01", "CON-03", "ACB-02"];
  const c = codigos({ elementos: [{ ...bano, excluir, remodelacion: true }] });
  assert.ok(c.includes("DEM-01") && !c.includes("DEM-02"));        // se cambia el enchape, el piso no
  for (const x of ["EXC-01", "PRE-01", "CON-05", "MAM-01"]) assert.ok(!c.includes(x), x);
});

test("lista oficial: búsqueda, ítem y actividad para el presupuesto", () => {
  const r = buscarOficial({ q: "demolicion enchape ceramico" });
  assert.ok(r.total >= 1 && r.items.some(i => i.codigo === "100305"));
  assert.equal(itemOficial("GOB-100305").valor, 12080);
  const obra = calcularObra({ extras: [{ codigo: "GOB-100305", cantidad: 10 }] });
  assert.equal(obra.lineas[0].total, 120800);
  assert.deepEqual(obra.cronograma.sinProgramar, ["GOB-100305"]);
  assert.equal(actividadOficial("999999"), null);
});

test("la transcripción de la lista oficial coincide con los precios oficiales tomados a mano", () => {
  const gob = Object.values(REFERENCIAS_OFICIALES).flat().filter(r => r.fuente === "Gobernación 2024" && Number.isInteger(r.precio) && !/×/.test(r.nota));
  assert.ok(gob.length >= 8);
  for (const r of gob) assert.equal(itemOficial(r.item)?.valor, r.precio, `ítem ${r.item}`);
});

test("Excel: hojas, capítulos y fórmulas", async () => {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await presupuestoExcel({ elementos: [bano], ejecucion: "contratista" }, "Baño"));
  assert.deepEqual(libro.worksheets.map(h => h.name), ["Presupuesto", "APU", "Memoria de cantidades", "Compras", "Cronograma"]);
  const formulas = [];
  libro.getWorksheet("Presupuesto").eachRow(f => f.eachCell(c => { if (c.value?.formula) formulas.push(c.value.formula); }));
  assert.ok(formulas.some(f => f.startsWith("SUM(")) && formulas.some(f => /^D\d+\*E\d+$/.test(f)));
});

test("métricas: precisión, recall y F1, y el sistema combinado", () => {
  const m = metricasPorClase({ a: { a: 8, b: 2 }, b: { a: 1, b: 9 } }, ["a", "b"]);
  assert.ok(Math.abs(m.porClase[0].precision - 8 / 9) < 1e-9 && Math.abs(m.porClase[0].recall - 0.8) < 1e-9);
  const sinRespuesta = metricasPorClase({ a: { a: 6, b: 0, ninguna: 4 }, b: { a: 0, b: 10, ninguna: 0 } }, ["a", "b"]);
  assert.equal(sinRespuesta.porClase[0].recall, 0.6);   // las frases sin predicción bajan el recall
  const s = sistemaCombinado([{ frase: "un baño", clase: "bano", pred: "muro" }, { frase: "donde bañarme", clase: "bano", pred: "bano" }]);
  assert.equal(s.aciertos, 2);            // la palabra clave corrige el primero; el modelo resuelve el segundo
});

test("precios de tiendas: la referencia es la mediana y cada precio tiene su enlace", async () => {
  const { INSUMOS } = await import("../../src/datos/precios.js");
  const conTiendas = Object.values(INSUMOS).filter(i => i.tiendas);
  assert.ok(conTiendas.length >= 6);
  for (const i of conTiendas) {
    const orden = i.tiendas.map(t => t.precio).sort((a, b) => a - b), m = Math.floor(orden.length / 2);
    const mediana = orden.length % 2 ? orden[m] : Math.round((orden[m - 1] + orden[m]) / 2);
    assert.equal(i.precio, mediana, i.nombre);
    assert.ok(i.tiendas.every(t => /^https:\/\//.test(t.url) && t.precio > 0), i.nombre);
  }
  assert.equal(INSUMOS.are.precio, 89000);          // el viaje agotado de Homecenter ya no fija el precio de la arena
});

test("referencias: solo las equivalentes marcan una actividad, y el rango suma lo oficial de las marcadas", () => {
  const casa = { elementos: [{ tipo: "casa", medidas: { largo: 10, ancho: 7, alto: 2.5, banos: 2 } }] };
  const c = calcularObra(casa);
  const muro = c.lineas.find(l => l.codigo === "MAM-01");
  assert.ok(muro.referencias.every(r => r.equivalente === false) && muro.alerta === null);   // sin referencia equivalente: no se marca
  const marcadas = c.lineas.filter(l => l.alerta);
  assert.deepEqual(c.presupuesto.rango.actividades.sort(), marcadas.map(l => l.codigo).sort());
  const esperado = c.presupuesto.directo + marcadas.reduce((s, l) => s + l.cantidad * (l.alerta.precio - l.unitario), 0);
  assert.ok(Math.abs(c.presupuesto.rango.total - esperado) < 1);                           // administración directa: total = directo
  // Con una cotización, la actividad deja de marcarse y sale del rango.
  const cotizada = calcularObra({ ...casa, preciosActividad: Object.fromEntries(marcadas.map(l => [l.codigo, l.unitario])) });
  assert.equal(cotizada.presupuesto.rango, null);
});
