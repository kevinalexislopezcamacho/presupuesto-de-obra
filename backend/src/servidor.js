/**
 * Punto de entrada: crea la aplicación y la pone a escuchar.
 * Uso: npm start  →  http://localhost:3000
 */
import { crearApp } from "./app.js";
import { config } from "./config/index.js";

const app = crearApp(config);
const servidor = app.listen(config.puerto, () => {
  console.log(`Presupuesto de obra escuchando en http://localhost:${config.puerto}`);
  if (config.carpetaFrontend) console.log(`Frontend servido desde ${config.carpetaFrontend}`);
  console.log(config.ia.clave
    ? `IA activa: Gemini (${[config.ia.modelo, ...config.ia.respaldo].join(", ")}). Prueba la conexión con: npm run ia:probar`
    : "IA desactivada (no hay GEMINI_API_KEY en backend/.env): se usa el intérprete por reglas.");
});

// Cierre ordenado (Ctrl+C o el sistema detiene el proceso).
for (const senal of ["SIGINT", "SIGTERM"]) process.on(senal, () => servidor.close(() => process.exit(0)));
