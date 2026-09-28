/**
 * Casos de uso del lenguaje natural: entender la obra descrita, leer medidas de un trozo
 * de texto y leer los materiales que la persona dice tener.
 *
 * Si hay IA configurada (Gemini), se usa primero y su respuesta se verifica (ia/verificar.js).
 * Si la IA no está, tarda demasiado, falla o no encuentra nada, se usa el intérprete por reglas:
 * la herramienta siempre responde.
 */
import { interpretarTexto, extraerMedidas, nombraObra } from "../dominio/texto/interprete.js";
import { interpretarMateriales } from "../dominio/materiales-texto.js";
import { revisarMaterial } from "../dominio/opciones-material.js";
import { INSUMOS } from "../datos/precios.js";
import { instruccionesObra, instruccionesMateriales, ESQUEMA_OBRA, ESQUEMA_MATERIALES } from "../ia/instrucciones.js";
import { verificarObra, verificarMateriales } from "../ia/verificar.js";
import { requerimientosDeObra } from "./calculo.servicio.js";
import { buscarOficial } from "./listas-oficiales.servicio.js";
import { limpiarObra } from "./obra-entrada.js";

const MAX_CACHE = 300;

// El mismo error se escribe en la consola una vez cada 5 minutos, no en cada petición.
const ultimaVez = new Map();
/** Mensaje para la persona cuando la IA falla; el detalle técnico queda en la consola del servidor. */
function avisoFallo(e, siguiente) {
  if (Date.now() - (ultimaVez.get(e.message) || 0) > 5 * 60 * 1000) {
    ultimaVez.set(e.message, Date.now());
    console.error(`[IA] ${e.message}${e.detalle ? ` · ${e.detalle}` : ""}${e.ayuda ? `\n[IA] Para arreglarlo: ${e.ayuda}` : ""}`);
  }
  return `No se pudo usar la IA: ${e.message.replace(/\.$/, "")}. ${siguiente}`;
}

/** El intérprete por reglas con los mismos campos que devuelve la IA. */
const porReglas = texto => {
  const r = interpretarTexto(texto);
  return { ...r, partes: r.partes.map(p => ({ excluir: [], ...p })), materiales: [], observaciones: r.observaciones || [], verificacion: [], motor: "reglas" };
};

/**
 * @param {{ ia?: null | { nombre: string, via?: string, modelo: string, modelos?: string[], generarJSON: Function } }} dependencias
 *   `generarJSON` devuelve { respuesta, modelo }: el JSON y el modelo que respondió
 */
export function crearServicioInterprete({ ia = null } = {}) {
  // Misma pregunta, misma respuesta: se guarda lo que respondió la IA (ahorra tiempo y cuota, y da resultados estables).
  const cache = new Map();
  /** @returns {Promise<{ respuesta: object, modelo: string }>} */
  async function preguntar(clave, pedido) {
    if (!cache.has(clave)) {
      cache.set(clave, await ia.generarJSON(pedido));
      if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
    }
    return cache.get(clave);
  }
  const motorIA = modelo => ({ motor: "ia", proveedor: ia.nombre, via: ia.via ?? null, modelo: modelo || ia.modelo });

  return {
    /** Si la IA está activa y cuál es (nunca la clave). */
    estadoIA: () => ({ activa: Boolean(ia), proveedor: ia?.nombre ?? null, via: ia?.via ?? null, modelo: ia?.modelo ?? null, modelos: ia?.modelos ?? [] }),

    /** "4 muros de 3 x 2,5 y un baño sin enchape" → partes, trabajos, materiales, observaciones, dudas y lo que no se calcula. */
    async interpretarObra(texto) {
      if (!ia) return porReglas(texto);
      try {
        const { respuesta: salida, modelo } = await preguntar(`obra\n${texto}`, { instrucciones: instruccionesObra(), mensaje: texto, esquema: ESQUEMA_OBRA });
        // Los materiales parecidos ("bloques") se deciden con lo que usa la obra descrita.
        const previa = verificarObra(salida, texto);
        const elementos = previa.partes.map(p => ({ ...p, medidas: { ...p.medidas, ...(p.sistema ? { sistema: p.sistema } : {}) } }));
        const req = requerimientosDeObra({ elementos, extras: previa.trabajos });
        const res = verificarObra(salida, texto, req);
        const nada = !res.partes.length && !res.trabajos.length && !res.dudas.length && !res.noSoportado.length && !res.materiales.length;
        if (nada) {
          const reglas = porReglas(texto);
          if (reglas.partes.length || reglas.trabajos.length) return { ...reglas, avisoIA: "La IA no encontró nada que calcular; se entendió con reglas." };
        }
        return { ...res, ...motorIA(modelo) };
      } catch (e) {
        return { ...porReglas(texto), avisoIA: avisoFallo(e, "Se entendió con reglas.") };
      }
    },

    /** Medidas de un trozo de texto para un tipo de construcción ya elegido. */
    leerMedidas: async (texto, tipo) => extraerMedidas(texto, tipo),

    /** Materiales escritos; la obra ayuda a elegir entre materiales parecidos (bloque de arcilla o de concreto). */
    async leerMateriales(texto, obra) {
      const req = obra ? requerimientosDeObra(obra) : {};
      const reglas = () => ({ materiales: interpretarMateriales(texto, req), verificacion: [], motor: "reglas" });
      if (!ia) return reglas();
      try {
        const { respuesta: salida, modelo } = await preguntar(`materiales\n${texto}`, { instrucciones: instruccionesMateriales(), mensaje: texto, esquema: ESQUEMA_MATERIALES });
        const res = verificarMateriales(salida, texto, req);
        if (!res.materiales.length) return { ...reglas(), avisoIA: "La IA no encontró materiales; se leyeron con reglas." };
        return { ...res, ...motorIA(modelo) };
      } catch (e) {
        return { ...reglas(), avisoIA: avisoFallo(e, "Se leyeron con reglas.") };
      }
    },

    /**
     * Cuadro rápido del presupuesto: obras y trabajos para sumar al presupuesto, y materiales sueltos para comprar
     * aparte ("10 bultos de cemento"). Un material escrito dentro de una obra ("un muro en bloque de concreto") no es
     * una compra aparte. Lo que no está claro ("10 alambres") llega en `dudas`, con opciones para elegir o qué buscar
     * en la lista oficial.
     */
    async interpretarAgregado(texto, obra) {
      const [o, m] = await Promise.all([this.interpretarObra(texto), this.leerMateriales(texto, obra)]);
      const req = obra ? requerimientosDeObra(obra) : {}, precios = limpiarObra(obra || {}).precios;
      const precio = id => precios[id] ?? INSUMOS[id].precio;
      const sueltos = m.materiales.filter(x => !nombraObra(x.texto || ""));
      const materiales = [], dudas = [], notas = [];
      for (const x of sueltos) {
        const r = revisarMaterial(x, req);
        if (r?.claro) materiales.push(r.claro);
        else if (r?.opciones?.length) dudas.push({ texto: x.texto, opciones: r.opciones.map(op => ({ ...op, costo: op.cantidad * precio(op.id) })) });
        else if (r?.nota) notas.push(r.nota);
        else if (r?.buscar) {
          const q = r.buscar.find(q => buscarOficial({ q, limite: 1 }).total > 0);
          if (q) dudas.push({ texto: x.texto, opciones: [], buscar: q });
        }
      }
      // Una parte que no nombra una obra ni trae medidas ("20 ladrillos", "una ventana") es una suposición del
      // clasificador: aquí no se agrega un muro que nadie pidió.
      const partes = o.partes.filter(p => nombraObra(p.texto || "") || Object.keys(p.medidas || {}).length > 0);
      return { partes, trabajos: o.trabajos, materiales, dudas, notas, noSoportado: o.noSoportado,
        motor: o.motor, avisoIA: o.avisoIA || m.avisoIA || null };
    }
  };
}
