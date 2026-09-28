import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { crearClienteGemini, ordenProveedores } from "../../src/ia/gemini.js";

// fetch de prueba: responde según la URL y guarda cada llamada; nunca sale a internet.
const original = globalThis.fetch;
let llamadas = [];
function simular(responder) {
  llamadas = [];
  globalThis.fetch = async (url, opciones) => {
    const cuerpo = JSON.parse(opciones.body);
    llamadas.push({ url, cuerpo });
    const [estado, datos] = responder(url, cuerpo);
    return new Response(JSON.stringify(datos), { status: estado, headers: { "Content-Type": "application/json" } });
  };
}
afterEach(() => { globalThis.fetch = original; });

const ok = json => [200, { candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(json) }] } }] }];
const error = (estado, mensaje, detalles = []) => [estado, { error: { code: estado, message: mensaje, details: detalles } }];
const pedido = { instrucciones: "i", mensaje: "m", esquema: { type: "object", properties: { a: { type: ["number", "null"] } } } };
const cliente = (extra = {}) => crearClienteGemini({ clave: "AIzaPrueba", modelo: "principal", respaldo: ["respaldo"], ...extra });

test("sin clave no hay cliente", () => {
  assert.equal(crearClienteGemini({ clave: "", modelo: "x" }), null);
});

test("en automático prueba AI Studio y luego Vertex AI; con uno elegido, solo ese", () => {
  assert.deepEqual(ordenProveedores(), ["aistudio", "vertex"]);
  assert.deepEqual(ordenProveedores("vertex"), ["vertex"]);
});

test("una clave AQ. que funciona en AI Studio se usa ahí (no pide facturación)", async () => {
  simular(url => (url.includes("generativelanguage") ? ok({ a: 1 }) : error(403, "This API method requires billing to be enabled.", [{ reason: "BILLING_DISABLED" }])));
  const ia = cliente({ clave: "AQ.prueba" });
  assert.deepEqual(await ia.generarJSON(pedido), { respuesta: { a: 1 }, modelo: "principal" });
  assert.equal(ia.via, "AI Studio");
  assert.equal(llamadas.length, 1);
});

test("si la clave no sirve en AI Studio, usa Vertex AI y se queda con él", async () => {
  simular(url => (url.includes("generativelanguage") ? error(403, "The caller does not have permission") : ok({ a: 1 })));
  const ia = cliente({ clave: "AQ.prueba" });
  await ia.generarJSON(pedido);
  assert.equal(ia.via, "Vertex AI");
  assert.match(llamadas.at(-1).url, /aiplatform\.googleapis\.com\/v1\/publishers\/google\/models\/principal:generateContent/);
  const antes = llamadas.length;
  await ia.generarJSON(pedido);
  assert.equal(llamadas.length, antes + 1);            // va directo a Vertex AI
});

test("sin facturación en Vertex AI: mensaje claro con el enlace", async () => {
  simular(() => error(403, "This API method requires billing to be enabled. Please enable billing on project #123 by visiting https://console.developers.google.com/billing/enable?project=123 then retry.",
    [{ reason: "BILLING_DISABLED" }]));
  await assert.rejects(cliente({ proveedor: "vertex" }).generarJSON(pedido),
    e => /facturación/.test(e.message) && e.ayuda === "https://console.developers.google.com/billing/enable?project=123");
});

test("si el modelo principal está saturado, responde el de respaldo", async () => {
  simular(url => (url.includes("principal") ? error(503, "This model is currently experiencing high demand.") : ok({ a: 2 })));
  const ia = cliente();
  assert.deepEqual(await ia.generarJSON(pedido), { respuesta: { a: 2 }, modelo: "respaldo" });
  // El saturado se salta un rato: la siguiente petición va directo al respaldo.
  await ia.generarJSON(pedido);
  assert.equal(llamadas.filter(l => l.url.includes("principal")).length, 1);
});

test("clave sin permiso o API sin activar: mensaje claro y no se reintenta en cada petición", async () => {
  simular(() => error(403, "Agent Platform API has not been used in project 123 before or it is disabled.",
    [{ reason: "SERVICE_DISABLED" }, { links: [{ url: "https://console.developers.google.com/apis/api/aiplatform.googleapis.com/overview?project=123" }] }]));
  const ia = cliente({ clave: "AQ.prueba" });
  await assert.rejects(ia.generarJSON(pedido), e => e.tipo === "clave" && /no está activada/.test(e.message) && /project=123/.test(e.ayuda));
  const antes = llamadas.length;
  await assert.rejects(ia.generarJSON(pedido), /no está activada/);
  assert.equal(llamadas.length, antes);                  // en pausa: no volvió a llamar
});

test("si la API no reconoce el formato del esquema, usa el anterior (con nullable)", async () => {
  simular((url, cuerpo) => (cuerpo.generationConfig.responseFormat
    ? error(400, "Invalid JSON payload received. Unknown name \"responseFormat\" at 'generation_config'")
    : ok({ a: 3 })));
  const r = await cliente().generarJSON(pedido);
  assert.equal(r.respuesta.a, 3);
  assert.ok(llamadas[1].cuerpo.generationConfig.responseJsonSchema);
});

test("el esquema OpenAPI convierte los campos que aceptan null", async () => {
  simular((url, cuerpo) => (cuerpo.generationConfig.responseSchema ? ok({ a: 4 }) : error(400, "Unknown name \"responseJsonSchema\"")));
  await cliente({ clave: "AQ.prueba" }).generarJSON(pedido);
  const esquema = llamadas.at(-1).cuerpo.generationConfig.responseSchema;
  assert.deepEqual(esquema.properties.a, { type: "number", nullable: true });
});

test("si todos los modelos fallan, lanza el último error", async () => {
  simular(() => error(429, "Resource exhausted"));
  await assert.rejects(cliente().generarJSON(pedido), /cuota/);
});
