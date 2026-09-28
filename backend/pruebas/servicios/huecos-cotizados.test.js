import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { areaHueco, revisarHuecos, limpiarHuecos } from "../../src/dominio/huecos.js";
import { generarActividades } from "../../src/dominio/actividades.js";
import { interpretarTexto } from "../../src/dominio/texto/interprete.js";
import { calcularObra } from "../../src/servicios/calculo.servicio.js";
import { buscarOficial } from "../../src/servicios/listas-oficiales.servicio.js";
import { presupuestoExcel } from "../../src/servicios/exportacion.servicio.js";
import { crearServicioInterprete } from "../../src/servicios/interprete.servicio.js";

const cerca = (a, b) => Math.abs(a - b) < 0.005;
const arco = { tipo: "puerta", forma: "arco", ancho: 1, alto: 2.1, cantidad: 1 };

test("área de los huecos: rectangular, en arco de medio punto y circular", () => {
  assert.ok(cerca(areaHueco({ forma: "rectangular", ancho: 0.8, alto: 2.1 }), 1.68));
  assert.ok(cerca(areaHueco(arco), 1 * 1.6 + Math.PI * 0.25 / 2));          // 1,99 m²
  assert.ok(cerca(areaHueco({ forma: "circular", diametro: 1 }), Math.PI * 0.25)); // 0,79 m²
});

test("los huecos detallados reemplazan los típicos y quedan en la memoria de cantidades", () => {
  const muro = generarActividades("muro", { largo: 4, alto: 2.5, vanos: 1.68, sistema: "arcilla" }, { huecos: limpiarHuecos([arco]) });
  const mam = muro.find(l => l.codigo === "MAM-01");
  assert.ok(cerca(mam.cantidad, 10 - areaHueco(arco)));                      // no descuenta además los 1,68 m² escritos
  assert.match(mam.memoria[0].texto, /puerta en arco de 1 × 2,1 m/);
  const bano = generarActividades("bano", { largo: 2, ancho: 1.5, alto: 2.4, sistema: "arcilla" },
    { huecos: limpiarHuecos([{ tipo: "puerta", forma: "circular", diametro: 1 }]) });
  assert.ok(cerca(bano.find(l => l.codigo === "ACB-01").cantidad, 7 * 2.1 - Math.PI * 0.25));
});

test("medidas imposibles o poco usuales de una puerta o ventana", () => {
  assert.equal(revisarHuecos([{ ...arco, alto: 0.4 }]).errores.length, 1);        // el arco no cabe
  assert.match(revisarHuecos([{ tipo: "puerta", forma: "circular", diametro: 1 }]).advertencias[0], /no permite pasar de pie/);
  const [h] = limpiarHuecos([{ tipo: "ventana", forma: "circular" }]);
  assert.deepEqual([h.diametro, h.porDefecto], [0.6, ["diametro"]]);            // medida típica, marcada de ejemplo
});

test("reglas: puertas y ventanas con forma y medidas, sin confundirlas con las del muro", () => {
  const [p] = interpretarTexto("muro de 4 x 2,5 con una puerta en arco de 1 x 2,10 y una ventana circular de 60 cm de diámetro").partes;
  assert.deepEqual(p.medidas, { largo: 4, alto: 2.5 });
  assert.deepEqual(p.huecos.map(h => [h.tipo, h.forma, h.ancho, h.alto, h.diametro]), [["puerta", "arco", 1, 2.1, 1], ["ventana", "circular", 1, 1.2, 0.6]]);
  const [q] = interpretarTexto("una puerta circular de 1 metro de diametro en un muro de 3 x 2,4").partes;
  assert.deepEqual([q.medidas.largo, q.huecos[0].diametro], [3, 1]);
  // En un baño se conserva la ventana típica que no se nombró; en una casa se deja una nota.
  assert.deepEqual(interpretarTexto("un baño de 2 x 1,5 con puerta en arco").partes[0].huecos.map(h => h.tipo + " " + h.forma), ["puerta arco", "ventana rectangular"]);
  const casa = interpretarTexto("casa de 9 x 7 con una puerta en arco");
  assert.deepEqual(casa.partes[0].huecos, []);
  assert.match(casa.observaciones.at(-1).nota, /detállelas todas/);
  assert.deepEqual(interpretarTexto("un muro de 4 x 2,5 con una puerta").partes[0].huecos, []);   // sin forma: la puerta típica
});

test("IA: las medidas de una puerta que no están en el texto se descartan", async () => {
  const respuesta = { partes: [{ texto: "muro de 4 x 2,5 con una puerta en arco de 1 m", tipo: "muro", cantidad: 1, largo: 4, ancho: null, alto: 2.5,
    area: null, vanos: null, puertas: null, ventanas: null, meson: null, banos: null, sistema: "sin-especificar", excluir: [], remodelacion: false,
    huecos: [{ texto: "una puerta en arco de 1 m", tipo: "puerta", forma: "arco", cantidad: 1, ancho: 1, alto: 2.4, diametro: null }] }],
  trabajos: [], materiales: [], observaciones: [], noSoportado: [], dudas: [] };
  const ia = { nombre: "Falsa", modelo: "prueba", async generarJSON() { return { respuesta: structuredClone(respuesta), modelo: "prueba" }; } };
  const r = await crearServicioInterprete({ ia }).interpretarObra("muro de 4 x 2,5 con una puerta en arco de 1 m");
  const [h] = r.partes[0].huecos;
  assert.deepEqual([h.forma, h.ancho, h.alto, h.porDefecto], ["arco", 1, 2.1, ["alto"]]);   // 2,4 no estaba escrito
  assert.ok(r.verificacion.some(v => /2,4/.test(v)));
});

test("ítems cotizados: capítulo propio, precio de la cotización, sin cronograma y en el Excel", async () => {
  const obra = { elementos: [{ tipo: "muro", huecos: [arco] }],
    cotizados: [{ id: "c1", nombre: "Puerta en arco en madera", unidad: "und", cantidad: 1, precio: 1200000, fuente: "Carpintería El Roble" },
      { id: "c2", nombre: "", unidad: "und", cantidad: 1, precio: 10 }, { id: "c3", nombre: "Sin precio", unidad: "und", cantidad: 1, precio: 0 }] };
  const c = calcularObra(obra);
  const l = c.lineas.find(x => x.codigo === "COT-c1");
  assert.deepEqual([l.capitulo.nombre, l.unitario, l.total, l.composicion.cotizacion.fuente], ["Ítems cotizados", 1200000, 1200000, "Carpintería El Roble"]);
  assert.equal(c.lineas.filter(x => x.codigo.startsWith("COT-")).length, 1);   // los incompletos no entran
  assert.ok(c.cronograma.sinProgramar.includes("COT-c1"));
  assert.ok(cerca(c.elementos[0].areaHuecos, 1.99));
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await presupuestoExcel(obra, "Muro"));
  const textos = [];
  libro.getWorksheet("APU").eachRow(f => textos.push(String(f.getCell(1).value)));
  assert.ok(textos.some(t => t.startsWith("Precio cotizado: Carpintería El Roble")));
});

test("lista oficial: se busca por palabras completas y en singular o plural", () => {
  assert.ok(buscarOficial({ q: "arco", limite: 200 }).items.every(i => !/MARCO/.test(i.actividad)));
  assert.ok(buscarOficial({ q: "puertas" }).items.some(i => /\bPUERTA\b/.test(i.actividad)));
  assert.ok(buscarOficial({ q: "pint" }).total > 0);                             // el comienzo de una palabra sí sirve
});
