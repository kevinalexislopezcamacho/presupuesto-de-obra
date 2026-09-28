/**
 * Entrada para publicar en Vercel: exporta la aplicación Express del backend (la API en /api).
 * Vercel no entrega archivos con express.static(): la página está en public/, que entrega su CDN.
 * En el computador se sigue usando `npm start` dentro de backend/.
 */
import express from "express";
import { crearApp } from "./backend/src/app.js";
import { config } from "./backend/src/config/index.js";

const app = express();
// Si la raíz del sitio llega a la API en vez de al CDN, se manda a la página.
app.get("/", (_req, res) => res.redirect(302, "/index.html"));
app.use(crearApp({ ...config, carpetaFrontend: null }));

export default app;
