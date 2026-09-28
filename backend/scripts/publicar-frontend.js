/**
 * Copia la página (frontend/) a public/, la carpeta que Vercel entrega por su CDN.
 * Lo ejecuta Vercel al publicar (npm run vercel-build en la raíz del proyecto); en el computador no hace falta.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const origen = path.join(raiz, "frontend"), destino = path.join(raiz, "public");

await fs.rm(destino, { recursive: true, force: true });
await fs.cp(origen, destino, { recursive: true });
const archivos = (await fs.readdir(destino, { recursive: true })).length;
console.log(`Página copiada a public/ (${archivos} archivos y carpetas).`);
