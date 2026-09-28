/**
 * Cliente de Gemini (Google) para respuestas en JSON con esquema.
 * Solo lo usa el intérprete: la IA entiende el texto, pero nunca calcula precios ni cantidades.
 *
 * - Funciona con AI Studio y con Vertex AI. En automático prueba primero AI Studio (tiene capa gratuita y no pide
 *   facturación) y después Vertex AI, y se queda con el que responda. Las claves "AIza…" y "AQ.…" pueden servir en ambos.
 * - Si un modelo está saturado, sin cuota o no existe, prueba el siguiente de la lista de respaldo.
 * - Si la clave no sirve en un servicio (inválida, sin permiso, API sin activar, sin facturación), lo salta
 *   por unos minutos para no demorar cada petición; si no sirve en ninguno, la herramienta usa el intérprete por reglas.
 * Documentación: https://ai.google.dev/gemini-api/docs/generate-content/structured-output
 */

const PROVEEDORES = {
  aistudio: {
    via: "AI Studio",
    url: modelo => `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`,
    formatos: ["responseFormat", "responseJsonSchema", "responseSchema"]
  },
  vertex: {
    via: "Vertex AI",
    url: modelo => `https://aiplatform.googleapis.com/v1/publishers/google/models/${encodeURIComponent(modelo)}:generateContent`,
    formatos: ["responseJsonSchema", "responseSchema"]
  }
};
const PAUSA_CLAVE_MS = 5 * 60 * 1000;    // la clave no sirve en un servicio: se vuelve a intentar en 5 minutos
const PAUSA_MODELO_MS = 60 * 1000;       // modelo saturado o sin cuota: se salta durante 1 minuto

/** Servicios que se prueban, en orden: el que se pida ("aistudio" o "vertex") o, en automático, los dos. */
export const ordenProveedores = (proveedor = "auto") => (proveedor in PROVEEDORES ? [proveedor] : ["aistudio", "vertex"]);

class ErrorGemini extends Error {
  /**
   * @param {string} mensaje para la persona, en español
   * @param {{ estado?: number, tipo?: string, detalle?: string, ayuda?: string }} info
   *   tipo: "clave" (no sirve en ese servicio), "modelo" (probar otro), "formato" (probar otro esquema), "respuesta"
   *   detalle: respuesta técnica de la API y ayuda: enlace para arreglarlo (solo para la consola del servidor)
   */
  constructor(mensaje, { estado = 0, tipo = "modelo", detalle = "", ayuda = "" } = {}) {
    super(mensaje);
    this.name = "ErrorGemini";
    Object.assign(this, { estado, tipo, detalle, ayuda });
  }
}

/** Traduce el error de la API a un mensaje claro y decide si vale la pena probar otro modelo o servicio. */
function clasificar(estado, error, modelo) {
  const detalle = error?.message || "";
  const razones = (error?.details || []).map(d => d.reason).filter(Boolean).join(" ");
  const enlace = (detalle.match(/https:\/\/console\.\S+/) || [""])[0].replace(/[.,;]+$/, "");
  const ayuda = (error?.details || []).flatMap(d => d.links || []).map(l => l.url).find(Boolean) || enlace;
  const info = { estado, detalle, ayuda };
  if (/API key not valid|API_KEY_INVALID|API key expired/i.test(`${detalle} ${razones}`)) return new ErrorGemini("la clave de Gemini no es válida", { ...info, tipo: "clave" });
  if (/SERVICE_DISABLED/.test(razones) || /has not been used in project|is disabled/i.test(detalle))
    return new ErrorGemini("la API de Gemini no está activada en el proyecto de Google Cloud de esta clave", { ...info, tipo: "clave" });
  if (/BILLING_DISABLED/.test(razones) || /requires billing/i.test(detalle))
    return new ErrorGemini("el proyecto de Google Cloud de esta clave necesita facturación activada para usar este servicio", { ...info, tipo: "clave" });
  if (estado === 401 || estado === 403) return new ErrorGemini("la clave de Gemini no tiene permiso para usar Gemini", { ...info, tipo: "clave" });
  if (estado === 404) return new ErrorGemini(`el modelo “${modelo}” no está disponible`, { ...info, tipo: "modelo" });
  if (estado === 429) return new ErrorGemini("se agotó por ahora la cuota de Gemini", { ...info, tipo: "modelo" });
  if (estado >= 500) return new ErrorGemini("Gemini está saturado o tuvo un error temporal", { ...info, tipo: "modelo" });
  if (estado === 400 && /responseFormat|response_format|responseJsonSchema|response_json_schema|responseSchema|Unknown name|Invalid JSON payload|schema/i.test(detalle))
    return new ErrorGemini("Gemini no aceptó el formato de la petición", { ...info, tipo: "formato" });
  return new ErrorGemini(`Gemini respondió con error ${estado}`, { ...info, tipo: "respuesta" });
}

/** Esquema en el formato anterior de la API (OpenAPI): ["number", "null"] → { type: "number", nullable: true }. */
function aOpenAPI(esquema) {
  if (Array.isArray(esquema)) return esquema.map(aOpenAPI);
  if (!esquema || typeof esquema !== "object") return esquema;
  const r = {};
  for (const [k, v] of Object.entries(esquema)) {
    if (k === "type" && Array.isArray(v)) { r.type = v.find(t => t !== "null"); if (v.includes("null")) r.nullable = true; }
    else if (k === "properties") r.properties = Object.fromEntries(Object.entries(v).map(([p, s]) => [p, aOpenAPI(s)]));
    else r[k] = typeof v === "object" ? aOpenAPI(v) : v;
  }
  return r;
}

const CONFIGURACION = {
  responseFormat: esquema => ({ responseFormat: { text: { mimeType: "application/json", schema: esquema } } }),
  responseJsonSchema: esquema => ({ responseMimeType: "application/json", responseJsonSchema: esquema }),
  responseSchema: esquema => ({ responseMimeType: "application/json", responseSchema: aOpenAPI(esquema) })
};

/** El error que más ayuda a arreglar el problema: el que trae un enlace para resolverlo. */
const masUtil = errores => errores.find(e => e.ayuda) || errores[0];

/**
 * @param {{ clave: string, modelo: string, respaldo?: string[], proveedor?: string, tiempoMaximoMs?: number }} opciones
 * @returns {null | object} null si no hay clave
 */
export function crearClienteGemini({ clave, modelo, respaldo = [], proveedor = "auto", tiempoMaximoMs = 25000 }) {
  if (!clave) return null;
  const orden = ordenProveedores(proveedor);
  const modelos = [...new Set([modelo, ...respaldo].filter(Boolean))];
  const formato = Object.fromEntries(orden.map(id => [id, 0]));   // formato de esquema que acepta cada servicio
  const pausa = new Map();          // "servicio" o "servicio:modelo" → { hasta, error }: se salta mientras tanto
  let actual = orden[0];            // el servicio que respondió la última vez
  const enPausa = clavePausa => Date.now() < (pausa.get(clavePausa)?.hasta || 0);

  async function pedir(id, m, instrucciones, mensaje, esquema, tiempo) {
    const p = PROVEEDORES[id];
    let respuesta;
    try {
      respuesta = await fetch(p.url(m), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": clave },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instrucciones }] },
          contents: [{ role: "user", parts: [{ text: mensaje }] }],
          ...(esquema ? { generationConfig: CONFIGURACION[p.formatos[formato[id]]](esquema) } : {})
        }),
        signal: AbortSignal.timeout(tiempo)
      });
    } catch (e) {
      throw new ErrorGemini(e.name === "TimeoutError" ? `Gemini no respondió a tiempo (${m})` : "no se pudo conectar con Gemini", { tipo: "modelo" });
    }
    const datos = await respuesta.json().catch(() => null);
    if (!respuesta.ok) throw clasificar(respuesta.status, datos?.error, m);
    const candidato = datos?.candidates?.[0];
    if (!candidato) throw new ErrorGemini(`Gemini no devolvió respuesta${datos?.promptFeedback?.blockReason ? ` (${datos.promptFeedback.blockReason})` : ""}`, { tipo: "respuesta" });
    if (candidato.finishReason && candidato.finishReason !== "STOP") throw new ErrorGemini(`Gemini se detuvo antes de terminar (${candidato.finishReason})`, { tipo: "respuesta" });
    return (candidato.content?.parts || []).filter(x => !x.thought).map(x => x.text || "").join("");
  }

  /** Un modelo, probando los formatos de esquema que conoce el servicio hasta que uno sirva. */
  async function conModelo(id, m, pedido, tiempo) {
    for (;;) {
      try {
        return await pedir(id, m, pedido.instrucciones, pedido.mensaje, pedido.esquema, tiempo);
      } catch (e) {
        if (e.tipo === "formato" && formato[id] < PROVEEDORES[id].formatos.length - 1) { formato[id]++; continue; }
        throw e;
      }
    }
  }

  /** Un servicio, probando los modelos en orden. Si la clave no sirve en este servicio, lo dice de una vez. */
  async function conServicio(id, pedido, limite) {
    let ultimo = null;
    for (const m of modelos) {
      if (enPausa(`${id}:${m}`)) continue;
      const tiempo = limite - Date.now();
      if (tiempo < 1500) break;
      try {
        const texto = await conModelo(id, m, pedido, tiempo);
        try { return { respuesta: JSON.parse(texto), modelo: m }; } catch { throw new ErrorGemini("Gemini devolvió una respuesta que no es JSON", { tipo: "respuesta" }); }
      } catch (e) {
        ultimo = e;
        if (e.tipo === "clave") throw e;
        if (e.tipo === "modelo") pausa.set(`${id}:${m}`, { hasta: Date.now() + PAUSA_MODELO_MS, error: e });
        // Con cualquier otro problema de este modelo, se prueba el siguiente.
      }
    }
    throw ultimo || new ErrorGemini("ningún modelo de Gemini está disponible en este momento", { tipo: "modelo" });
  }

  return {
    nombre: "Gemini",
    /** Servicio en uso: "AI Studio" o "Vertex AI" (el que respondió la última vez). */
    get via() { return PROVEEDORES[actual].via; },
    modelo: modelos[0],
    modelos,

    /**
     * @param {{ instrucciones: string, mensaje: string, esquema: object }} pedido
     * @returns {Promise<{ respuesta: object, modelo: string }>} el JSON del modelo (sin validar: eso lo hace ia/verificar.js)
     */
    async generarJSON(pedido) {
      const servicios = [actual, ...orden.filter(id => id !== actual)].filter(id => !enPausa(id));
      if (!servicios.length) throw masUtil(orden.map(id => pausa.get(id).error));
      const limite = Date.now() + tiempoMaximoMs, errores = [];
      for (const id of servicios) {
        try {
          const r = await conServicio(id, pedido, limite);
          actual = id;
          return r;
        } catch (e) {
          errores.push(e);
          // La clave no sirve en este servicio: se salta unos minutos para no demorar cada petición.
          if (e.tipo === "clave") pausa.set(id, { hasta: Date.now() + PAUSA_CLAVE_MS, error: e });
        }
      }
      throw errores.find(e => e.tipo !== "clave") || masUtil(errores);
    },

    /** Prueba cada servicio con el modelo principal y cada modelo en el que funcione (para `npm run ia:probar`). */
    async diagnosticar() {
      const probar = async (id, m) => {
        const inicio = Date.now(), base = { id, via: PROVEEDORES[id].via, modelo: m };
        try {
          await pedir(id, m, "Responde solo: ok", "ok", null, tiempoMaximoMs);
          return { ...base, ok: true, segundos: (Date.now() - inicio) / 1000 };
        } catch (e) {
          return { ...base, ok: false, segundos: (Date.now() - inicio) / 1000, mensaje: e.message, detalle: e.detalle, ayuda: e.ayuda, tipo: e.tipo };
        }
      };
      const servicios = [];
      for (const id of orden) servicios.push(await probar(id, modelos[0]));
      // Un servicio sirve si responde, o si el modelo principal solo está saturado (la clave funciona ahí).
      const bueno = servicios.find(s => s.ok) || servicios.find(s => s.tipo !== "clave");
      const porModelo = [];
      if (bueno) {
        actual = bueno.id;
        for (const m of modelos) porModelo.push(m === modelos[0] ? bueno : await probar(bueno.id, m));
      }
      return { servicios, modelos: porModelo, via: bueno?.via ?? null };
    }
  };
}
