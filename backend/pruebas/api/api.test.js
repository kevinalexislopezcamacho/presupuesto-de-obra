import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { crearApp } from "../../src/app.js";

const CONFIG = { carpetaFrontend: "", origenPermitido: "", registrarPeticiones: false };
let servidor, base;

before(async () => {
  const app = crearApp(CONFIG);
  await new Promise(listo => { servidor = app.listen(0, listo); });
  base = `http://127.0.0.1:${servidor.address().port}/api`;
});

after(async () => {
  await new Promise(listo => servidor.close(listo));
});

const pedir = async (metodo, ruta, cuerpo) => {
  const r = await fetch(base + ruta, {
    method: metodo, headers: { "Content-Type": "application/json" }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
  });
  return { estado: r.status, cuerpo: r.status === 204 ? null : await r.json() };
};

test("GET /salud y /catalogo", async () => {
  assert.equal((await pedir("GET", "/salud")).cuerpo.estado, "ok");
  const { cuerpo } = await pedir("GET", "/catalogo");
  assert.deepEqual(cuerpo.tiposObra, ["muro", "bano", "cocina", "cuarto", "casa"]);
  assert.ok(cuerpo.apu.length > 10 && cuerpo.apu.every(a => a.unitario > 0));
});

test("GET /diagnostico", async () => {
  const { cuerpo } = await pedir("GET", "/diagnostico");
  assert.equal(cuerpo.estado, "ok");
  assert.ok(cuerpo.modelo.exactitud >= 0.8);
});

test("POST /interpretaciones/obra entiende la descripción", async () => {
  const { estado, cuerpo } = await pedir("POST", "/interpretaciones/obra", { texto: "4 muros de 3 x 2,5 y un baño" });
  assert.equal(estado, 200);
  assert.deepEqual(cuerpo.partes.map(p => `${p.cantidad} ${p.tipo}`), ["4 muro", "1 bano"]);
});

test("POST /interpretaciones/materiales usa la obra para decidir", async () => {
  const obra = { elementos: [{ tipo: "muro", medidas: { sistema: "concreto" } }] };
  const { cuerpo } = await pedir("POST", "/interpretaciones/materiales", { texto: "100 bloques", obra });
  assert.equal(cuerpo.materiales[0].id, "blc");
});

test("POST /calculos devuelve presupuesto, cronograma y materiales", async () => {
  const { cuerpo } = await pedir("POST", "/calculos", { obra: { elementos: [{ tipo: "cocina" }] } });
  assert.ok(cuerpo.presupuesto.total > 0);
  assert.ok(cuerpo.cronograma.tramos.length > 0);
  assert.ok(cuerpo.materiales.items.length > 0);
});

test("errores de entrada: 400 con mensaje claro", async () => {
  assert.equal((await pedir("POST", "/interpretaciones/obra", {})).estado, 400);
  assert.equal((await pedir("POST", "/interpretaciones/medidas", { texto: "2 x 3", tipo: "piscina" })).estado, 400);
  const { estado, cuerpo } = await pedir("POST", "/calculos", { obra: "no" });
  assert.equal(estado, 400);
  assert.match(cuerpo.error.mensaje, /obra/);
  assert.equal((await pedir("GET", "/no-existe")).estado, 404);
  assert.equal((await pedir("GET", "/obras")).estado, 404);     // "Mis obras" se guarda en el navegador
});

test("sin clave de IA, el diagnóstico lo dice y el intérprete usa reglas", async () => {
  assert.equal((await pedir("GET", "/diagnostico")).cuerpo.ia.activa, false);
  assert.equal((await pedir("POST", "/interpretaciones/obra", { texto: "un baño" })).cuerpo.motor, "reglas");
});

test("con IA, la API responde con lo que entendió la IA ya verificado", async () => {
  const ia = { nombre: "Falsa", modelo: "prueba", generarJSON: async () => ({ modelo: "prueba", respuesta: {
    partes: [{ texto: "dos cocinas de 3 x 2,5", tipo: "cocina", cantidad: 2, largo: 3, ancho: 2.5, alto: null, area: null, vanos: null,
      puertas: null, ventanas: null, meson: null, banos: null, sistema: "sin-especificar", excluir: [] }],
    trabajos: [], materiales: [], observaciones: [], noSoportado: [], dudas: [] } }) };
  const app = crearApp(CONFIG, { ia });
  const otro = await new Promise(listo => { const s = app.listen(0, () => listo(s)); });
  try {
    const r = await fetch(`http://127.0.0.1:${otro.address().port}/api/interpretaciones/obra`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto: "dos cocinas de 3 x 2,5" }) });
    const cuerpo = await r.json();
    assert.equal(cuerpo.motor, "ia");
    assert.deepEqual([cuerpo.partes[0].cantidad, cuerpo.partes[0].medidas.largo], [2, 3]);
  } finally {
    await new Promise(listo => otro.close(listo));
  }
});
