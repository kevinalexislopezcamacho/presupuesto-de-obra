import { test } from "node:test";
import assert from "node:assert/strict";
import { revisarMaterial } from "../../src/dominio/opciones-material.js";
import { interpretarMateriales } from "../../src/dominio/materiales-texto.js";
import { distancia } from "../../src/dominio/texto/normalizar.js";
import { ESQUEMA_MATERIALES } from "../../src/ia/instrucciones.js";
import { crearServicioInterprete } from "../../src/servicios/interprete.servicio.js";

/** Lo que se hace con un material escrito, leído por reglas. */
const revisar = (texto, req = {}) => revisarMaterial(interpretarMateriales(texto, req)[0], req);
const opciones = r => r.opciones.map(o => [o.id, o.cantidad]);

test("claro: se agrega tal cual", () => {
  assert.deepEqual(revisar("10 bultos de cemento").claro.cantidad, 10);
  assert.deepEqual(revisar("10 kg de alambre").claro.id, "alb");
  assert.equal(revisar("20 ladrillos").claro.id, "blq");                           // "ladrillo" ya dice el tipo
});

test("sin unidad: el material se vende por kilos, libras o metros y se pregunta en cuál se contó", () => {
  assert.deepEqual(opciones(revisar("10 alambres")), [["alb", 10], ["alb", 100], ["alb", 4.54]]);   // kg, rollos, lb
  assert.match(revisar("10 alambres").opciones[1].medida, /10 rollos \(100 kg\)/);
  assert.deepEqual(opciones(revisar("2 arenas")), [["are", 2], ["are", 0.06]]);                        // m³ o bultos
});

test("varillas sin calibre, tipo sin decir y palabra mal escrita", () => {
  assert.deepEqual(opciones(revisar("5 varillas")), [["acr", 16.8], ["acr", 29.8], ["acr", 46.55]]);
  assert.deepEqual(opciones(revisar("10 bloques", { blc: 5 })), [["blc", 10], ["blq", 10]]);       // primero el que usa la obra
  assert.deepEqual(opciones(revisar("3 tubos")).map(([, c]) => c), [18, 18]);                     // sanitaria o presión
  assert.deepEqual(opciones(revisar("10 semento")), [["cem", 10]]);
  assert.equal(distancia("semento", "cemento"), 1);
});

test("lo que no está en la base se busca en la lista oficial; una unidad sin conversión pide el dato", () => {
  assert.equal(revisar("10 tejas").buscar[0], "tejas");
  assert.deepEqual(revisar("3 galones de pintura").buscar, ["pintura"]);             // "galones" no dice qué es
  assert.match(revisar("3 volquetas de arena").nota, /indique la cantidad en m³/);
  assert.match(revisar("cemento").nota, /falta la cantidad/);
});

test("cuadro rápido con IA: «10 alambres» contado en unidades da opciones en lugar de perderse", async () => {
  const materiales = { materiales: [{ texto: "10 alambres", id: "alb", nombre: "alambres", cantidad: 10, unidad: "und", calibre: "no-dice", tipoDicho: false }] };
  const vacia = { partes: [], trabajos: [], materiales: [], observaciones: [], noSoportado: [], dudas: [] };
  const ia = { nombre: "Falsa", modelo: "prueba",
    async generarJSON(pedido) { return { respuesta: structuredClone(pedido.esquema === ESQUEMA_MATERIALES ? materiales : vacia), modelo: "prueba" }; } };
  const r = await crearServicioInterprete({ ia }).interpretarAgregado("10 alambres", { elementos: [] });
  assert.deepEqual(r.materiales, []);
  assert.deepEqual(r.dudas[0].opciones.map(o => o.cantidad), [10, 100, 4.54]);
  assert.equal(r.dudas[0].opciones[0].costo, 10 * 6790);
});

test("cuadro rápido: un material solo no agrega un muro, y lo que no se calcula se ofrece buscar", async () => {
  const servicio = crearServicioInterprete({ ia: null });
  const ladrillos = await servicio.interpretarAgregado("20 ladrillos", { elementos: [] });
  assert.deepEqual([ladrillos.partes.length, ladrillos.materiales[0].id], [0, "blq"]);
  const ventana = await servicio.interpretarAgregado("una ventana de 1 x 1", { elementos: [] });
  assert.deepEqual([ventana.partes.length, ventana.dudas[0].buscar], [0, "ventana"]);
  const precio = await servicio.interpretarAgregado("10 alambres", { elementos: [], precios: { alb: 8000 } });
  assert.equal(precio.dudas[0].opciones[0].costo, 80000);                          // con el precio cotizado
});
