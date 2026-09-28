/**
 * Configuración leída de variables de entorno, con valores por defecto para desarrollo.
 * Si existe backend/.env se carga primero. Ver .env.example para la lista completa.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const raizBackend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
try { process.loadEnvFile(path.join(raizBackend, ".env")); } catch { /* sin .env: se usan las variables del sistema */ }

export const config = Object.freeze({
  puerto: Number(process.env.PUERTO || process.env.PORT || 3000),
  // Archivo JSON donde se guardan las obras terminadas.
  archivoObras: process.env.ARCHIVO_OBRAS || path.join(raizBackend, "almacenamiento", "obras.json"),
  // Carpeta de la página (public/, el nombre que usa Vercel) que el servidor entrega en "/"; vacío para no servirla.
  carpetaFrontend: process.env.CARPETA_FRONTEND ?? path.resolve(raizBackend, "..", "public"),
  // Origen permitido para llamar la API desde otro dominio (por ejemplo, un servidor de desarrollo del frontend).
  origenPermitido: process.env.ORIGEN_PERMITIDO || "",
  registrarPeticiones: process.env.REGISTRAR_PETICIONES !== "no",
  // IA para entender lo que se escribe. Sin clave, la herramienta usa solo el intérprete por reglas.
  ia: Object.freeze({
    clave: (process.env.GEMINI_API_KEY || "").trim(),
    modelo: process.env.GEMINI_MODELO || "gemini-3.5-flash-lite",
    // Si el modelo principal está saturado o sin cuota, se prueban estos en orden.
    respaldo: (process.env.GEMINI_MODELOS_RESPALDO ?? "gemini-3.8-flash,gemini-3.5-flash").split(",").map(s => s.trim()).filter(Boolean),
    // "auto" prueba AI Studio (gratis, sin facturación) y después Vertex AI; también "aistudio" o "vertex".
    proveedor: process.env.GEMINI_PROVEEDOR || "auto",
    tiempoMaximoMs: Number(process.env.IA_TIEMPO_MAXIMO_MS || 25000)
  })
});
