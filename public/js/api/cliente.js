/**
 * Cliente de la API: única parte del frontend que habla con el backend.
 * Cada función devuelve el JSON de la respuesta o lanza un Error con el mensaje del servidor.
 */
import { API_URL } from "../config.js";

async function pedir(metodo, ruta, cuerpo) {
  let respuesta;
  try {
    respuesta = await fetch(API_URL + ruta, {
      method: metodo,
      headers: cuerpo === undefined ? {} : { "Content-Type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revise que esté encendido (npm start en la carpeta backend).");
  }
  if (respuesta.status === 204) return null;
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) throw new Error(datos?.error?.mensaje || `El servidor respondió con error ${respuesta.status}.`);
  return datos;
}

export const obtenerCatalogo = () => pedir("GET", "/catalogo");
export const obtenerDiagnostico = () => pedir("GET", "/diagnostico");

export const interpretarObra = texto => pedir("POST", "/interpretaciones/obra", { texto });
export const leerMedidas = (texto, tipo) => pedir("POST", "/interpretaciones/medidas", { texto, tipo });
export const leerMateriales = (texto, obra) => pedir("POST", "/interpretaciones/materiales", { texto, obra });
export const interpretarAgregado = (texto, obra) => pedir("POST", "/interpretaciones/agregado", { texto, obra });

export const calcular = obra => pedir("POST", "/calculos", { obra });

/** Presupuesto en Excel: devuelve el archivo (Blob). */
export async function descargarExcel(obra, nombre) {
  let respuesta;
  try {
    respuesta = await fetch(API_URL + "/exportaciones/excel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ obra, nombre }) });
  } catch {
    throw new Error("No se pudo conectar con el servidor para generar el Excel.");
  }
  if (!respuesta.ok) throw new Error((await respuesta.json().catch(() => null))?.error?.mensaje || "No se pudo generar el Excel.");
  return respuesta.blob();
}

/** Lista oficial de la Gobernación del Valle 2024. */
export const buscarOficial = ({ q = "", capitulo = "", desde = 0, limite = 40 } = {}) =>
  pedir("GET", `/listas-oficiales/gobernacion-2024?${new URLSearchParams({ q, capitulo, desde, limite })}`);
export const capitulosOficiales = () => pedir("GET", "/listas-oficiales/gobernacion-2024/capitulos");

