/**
 * Entrada para publicar en Vercel: exporta la aplicación Express del backend (la API en /api).
 * Vercel no entrega archivos con express.static(): la página (frontend/) se copia a public/ al publicar
 * (npm run vercel-build) y la entrega su CDN. En el computador se sigue usando `npm start` dentro de backend/.
 */
import express from "express";
import { crearApp } from "./backend/src/app.js";
import { config } from "./backend/src/config/index.js";

const app = express();
app.use(crearApp({ ...config, carpetaFrontend: null }));

export default app;
