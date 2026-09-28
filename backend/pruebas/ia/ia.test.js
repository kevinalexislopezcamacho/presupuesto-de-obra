import { test } from "node:test";
import assert from "node:assert/strict";
import { crearServicioInterprete } from "../../src/servicios/interprete.servicio.js";
import { numerosDe } from "../../src/ia/verificar.js";
import { instruccionesObra, ESQUEMA_OBRA } from "../../src/ia/instrucciones.js";
import { APU } from "../../src/datos/apu.js";

/** IA de prueba: devuelve siempre la misma respuesta (o lanza el error) y cuenta las llamadas. */
const iaFalsa = respuesta => ({
  nombre: "Falsa", modelo: "prueba", llamadas: 0,
  async generarJSON() { this.llamadas++; if (respuesta instanceof Error) throw respuesta; return { respuesta: structuredClone(respuesta), modelo: "prueba" }; }
});
const vacia = { partes: [], trabajos: [], materiales: [], observaciones: [], noSoportado: [], dudas: [] };
const parte = datos => ({ texto: "", tipo: "muro", cantidad: 1, largo: null, ancho: null, alto: null, area: null, vanos: null,
  puertas: null, ventanas: null, meson: null, banos: null, sistema: "sin-especificar", excluir: [], ...datos });
const trabajo = datos => ({ texto: "", area: null, largo: null, ancho: null, alto: null, conteo: null, espacio: "ninguno", ...datos });
const interpretar = (respuesta, texto) => crearServicioInterprete({ ia: iaFalsa(respuesta) }).interpretarObra(texto);

test("números del texto: decimales con coma, miles con punto y números en palabras", () => {
  const n = numerosDe("dos muros de 2,5 y 1.500 bloques");
  for (const v of [2, 2.5, 1500]) assert.ok(n.includes(v), `falta ${v}`);
});

test("IA: usa lo que entendió y respeta cantidades, medidas, bloque y lo que se pidió quitar", async () => {
  const texto = "necesito 4 muros de 3 x 2,5 en bloque de concreto y un baño de 2x1,5 sin enchape";
  const r = await interpretar({ ...vacia, partes: [
    parte({ texto: "4 muros de 3 x 2,5 en bloque de concreto", cantidad: 4, largo: 3, alto: 2.5, sistema: "concreto" }),
    parte({ texto: "un baño de 2x1,5 sin enchape", tipo: "bano", largo: 2, ancho: 1.5, excluir: ["ACB-01"] })
  ] }, texto);
  assert.equal(r.motor, "ia");
  assert.deepEqual(r.partes.map(p => `${p.cantidad} ${p.tipo}`), ["4 muro", "1 bano"]);
  assert.deepEqual(r.partes[0].medidas, { largo: 3, alto: 2.5 });
  assert.equal(r.partes[0].sistema, "concreto");
  assert.deepEqual(r.partes[1].excluir, ["ACB-01"]);
  assert.deepEqual(r.verificacion, []);
});

test("IA: un número que no está en el texto se descarta y se avisa", async () => {
  const r = await interpretar({ ...vacia, partes: [parte({ texto: "un muro de 3 x 2,5", largo: 4, alto: 2.5 })] }, "un muro de 3 x 2,5");
  assert.equal(r.partes[0].medidas.largo, undefined);
  assert.equal(r.partes[0].medidas.alto, 2.5);
  assert.match(r.verificacion.join(), /largo = 4/);
});

test("IA: la cantidad inventada tampoco pasa", async () => {
  const r = await interpretar({ ...vacia, partes: [parte({ texto: "muros de 3 x 2,5", cantidad: 6, largo: 3, alto: 2.5 })] }, "muros de 3 x 2,5");
  assert.equal(r.partes[0].cantidad, 1);
  assert.match(r.verificacion.join(), /cantidad = 6/);
});

test("IA: centímetros pasados a metros sí se aceptan", async () => {
  const r = await interpretar({ ...vacia, partes: [parte({ texto: "un muro de 300 cm de largo", largo: 3 })] }, "un muro de 300 cm de largo");
  assert.equal(r.partes[0].medidas.largo, 3);
});

test("IA: tipos, códigos e insumos inventados se descartan", async () => {
  const r = await interpretar({ ...vacia,
    partes: [parte({ tipo: "piscina" }), parte({ texto: "un muro", excluir: ["NO-EXISTE"] })],
    trabajos: [trabajo({ codigo: "XYZ-99", area: 20 })]
  }, "un muro y una piscina de 20");
  assert.equal(r.partes.length, 1);
  assert.deepEqual(r.partes[0].excluir, []);
  assert.equal(r.trabajos.length, 0);
});

test("IA: la cantidad de un trabajo la calcula la herramienta a partir de las medidas", async () => {
  const r = await interpretar({ ...vacia, trabajos: [
    trabajo({ texto: "enchapar el baño de 2 x 1,5", codigo: "ACB-01", largo: 2, ancho: 1.5, espacio: "bano" }),
    trabajo({ texto: "pañetar la sala de 20 m2", codigo: "PAN-01", area: 20 })
  ] }, "enchapar el baño de 2 x 1,5 y pañetar la sala de 20 m2");
  assert.equal(r.trabajos[0].cantidad, 13.02);           // 2 × (2 + 1,5) × 2,1 m − una puerta de 1,68 m²
  assert.match(r.trabajos[0].detalle, /2 × 1,5 m/);
  assert.equal(r.trabajos[1].cantidad, 20);
});

test("IA: materiales en la descripción, con miles y el tipo de bloque que usa la obra", async () => {
  const texto = "3 muros de 4 x 2,5 en bloque de concreto, ya tengo 1.500 bloques";
  const r = await interpretar({ ...vacia,
    partes: [parte({ texto: "3 muros de 4 x 2,5 en bloque de concreto", cantidad: 3, largo: 4, alto: 2.5, sistema: "concreto" })],
    materiales: [{ texto: "ya tengo 1.500 bloques", id: "blq", cantidad: 1500, unidad: "und" }]
  }, texto);
  assert.equal(r.materiales[0].id, "blc");
  assert.equal(r.materiales[0].cantidad, 1500);
  assert.match(r.materiales[0].nota, /No se indicó el tipo/);
});

test("IA: observaciones y lo que no se calcula llegan tal cual", async () => {
  const r = await interpretar({ ...vacia,
    partes: [parte({ texto: "cocina de 3 x 2,5", tipo: "cocina", largo: 3, ancho: 2.5 })],
    observaciones: [{ texto: "con porcelanato", nota: "Se calcula con cerámica de piso de referencia." }],
    noSoportado: [{ texto: "techo en teja", categoria: "techos o cubiertas" }]
  }, "cocina de 3 x 2,5 con porcelanato y techo en teja");
  assert.equal(r.observaciones[0].texto, "con porcelanato");
  assert.deepEqual(r.noSoportado, ["techos o cubiertas"]);
});

test("si la IA falla, responde con reglas y lo avisa", async () => {
  const r = await interpretar(new Error("Gemini no respondió en 25 s."), "4 muros de 3 x 2,5 y un baño");
  assert.equal(r.motor, "reglas");
  assert.match(r.avisoIA, /reglas/);
  assert.deepEqual(r.partes.map(p => `${p.cantidad} ${p.tipo}`), ["4 muro", "1 bano"]);
});

test("si la IA no encuentra nada pero las reglas sí, se usan las reglas", async () => {
  const r = await interpretar(vacia, "un baño de 2 x 1,5");
  assert.equal(r.motor, "reglas");
  assert.equal(r.partes[0].tipo, "bano");
});

test("IA: una duda con una sola opción se vuelve parte; con varias opciones se pregunta", async () => {
  const r = await interpretar({ ...vacia, dudas: [
    { texto: "dos paredes divisorias de 3 metros", opciones: ["muro"] },
    { texto: "algo para el patio", opciones: ["muro", "cuarto"] }
  ] }, "dos paredes divisorias de 3 metros y algo para el patio");
  assert.equal(r.motor, "ia");
  assert.deepEqual(r.partes.map(p => [p.tipo, p.cantidad, p.medidas.largo]), [["muro", 2, 3]]);
  assert.deepEqual(r.dudas.map(d => d.texto), ["algo para el patio"]);
  const inventado = await interpretar({ ...vacia, dudas: [{ texto: "una pared de 9 metros", opciones: ["muro"] }] }, "una pared");
  assert.equal(inventado.partes.find(p => p.medidas.largo === 9), undefined);     // texto que no escribió: no se usa
  const yaEsTrabajo = await interpretar({ ...vacia,
    trabajos: [trabajo({ texto: "el lavaplatos y el mesón", codigo: "MES-01", espacio: "cocina" })],
    dudas: [{ texto: "el lavaplatos y el mesón", opciones: ["cocina"] }] }, "hacer el lavaplatos y el mesón");
  assert.deepEqual([yaEsTrabajo.partes.length, yaEsTrabajo.trabajos[0].codigo, yaEsTrabajo.dudas.length], [0, "MES-01", 1]);   // no agrega una cocina que no pidió
});

test("casa con habitaciones y cocinas: la nota la pone la herramienta y reemplaza la de la IA", async () => {
  const texto = "casa de 10 x 7 con dos habitaciones, dos cocinas y dos baños";
  const r = await interpretar({ ...vacia,
    partes: [parte({ texto, tipo: "casa", largo: 10, ancho: 7, banos: 2 })],
    observaciones: [{ texto: "dos habitaciones, dos cocinas", nota: "Las cantidades solicitadas se ajustarán en la configuración." }]
  }, texto);
  assert.equal(r.observaciones.length, 1);
  assert.match(r.observaciones[0].nota, /no cambia el cálculo/);
  assert.match(r.observaciones[0].nota, /la otra se puede agregar con trabajos sueltos/);
  assert.doesNotMatch(JSON.stringify(r.observaciones), /se ajustarán/);
  const reglas = await crearServicioInterprete({ ia: null }).interpretarObra(texto);
  assert.match(reglas.observaciones[0].nota, /no cambia el cálculo/);
  assert.deepEqual((await crearServicioInterprete({ ia: null }).interpretarObra("casa de 9 x 7 con cocina")).observaciones, []);
});

test("la misma frase no se le pregunta dos veces a la IA", async () => {
  const ia = iaFalsa({ ...vacia, partes: [parte({ texto: "un muro de 6 x 2,5", largo: 6, alto: 2.5 })] });
  const servicio = crearServicioInterprete({ ia });
  await servicio.interpretarObra("un muro de 6 x 2,5");
  await servicio.interpretarObra("un muro de 6 x 2,5");
  assert.equal(ia.llamadas, 1);
});

test("IA en materiales: calibre, unidades sin conversión segura y materiales fuera de la base", async () => {
  const texto = "10 varillas de 1/2, 2 volquetas de arena y 3 galones de pintura";
  const servicio = crearServicioInterprete({ ia: iaFalsa({ materiales: [
    { texto: "10 varillas de 1/2", id: "acr", nombre: "varillas", cantidad: 10, unidad: "varilla", calibre: "1/2", tipoDicho: false },
    { texto: "2 volquetas de arena", id: "are", nombre: "arena", cantidad: 2, unidad: "viaje", calibre: "no-dice", tipoDicho: false },
    { texto: "3 galones de pintura", id: "otro", nombre: "pintura", cantidad: 3, unidad: "ninguna", calibre: "no-dice", tipoDicho: false }
  ] }) });
  const { materiales, motor } = await servicio.leerMateriales(texto, null);
  assert.equal(motor, "ia");
  assert.equal(materiales[0].cantidad, 59.6);
  assert.equal(materiales[1].cantidad, null);          // no se inventa cuántos m³ trae una volqueta
  assert.match(materiales[1].nota, /no hay una conversión segura a m³/);
  assert.equal(materiales[2].id, null);
});

test("IA en materiales: la unidad escrita manda (3 volquetas no son 3 m³)", async () => {
  const servicio = crearServicioInterprete({ ia: iaFalsa({ materiales: [
    { texto: "3 volquetas de arena", id: "are", nombre: "arena", cantidad: 3, unidad: "m3", calibre: "no-dice", tipoDicho: false }
  ] }) });
  const { materiales } = await servicio.leerMateriales("tengo 20 bultos de cemento y 3 volquetas de arena", null);
  assert.equal(materiales[0].cantidad, null);
  assert.match(materiales[0].nota, /3 volquetas/);
});

test("las instrucciones y el esquema nombran todas las actividades", () => {
  const instrucciones = instruccionesObra();
  for (const a of APU.filter(x => x.codigo !== "MAM-02")) assert.ok(instrucciones.includes(a.codigo), a.codigo);
  assert.deepEqual(ESQUEMA_OBRA.required, ["partes", "trabajos", "materiales", "observaciones", "noSoportado", "dudas"]);
});
