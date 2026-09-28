/**
 * Arma la aplicación Express. Recibe sus dependencias para poder probarla con otra
 * configuración (por ejemplo, una IA de prueba).
 */
import express from "express";
import { seguridad } from "./middlewares/seguridad.js";
import { registro } from "./middlewares/registro.js";
import { rutaNoEncontrada, manejarErrores } from "./middlewares/errores.js";
import { crearRutas } from "./rutas/index.js";
import { crearServicioInterprete } from "./servicios/interprete.servicio.js";
import { crearClienteGemini } from "./ia/gemini.js";

/**
 * @param {object} config ver src/config/index.js
 * @param {{ ia?: object | null }} dependencias `ia` reemplaza al cliente de Gemini (pruebas)
 * @returns {import("express").Express}
 */
export function crearApp(config, dependencias = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(seguridad(config));
  app.use(express.json({ limit: "200kb" }));

  const ia = "ia" in dependencias ? dependencias.ia : crearClienteGemini(config.ia || {});
  const servicioInterprete = crearServicioInterprete({ ia });
  if (config.registrarPeticiones) app.use("/api", registro);
  app.use("/api", crearRutas({ servicioInterprete }));
  app.use("/api", rutaNoEncontrada);

  if (config.carpetaFrontend) app.use(express.static(config.carpetaFrontend));
  app.use(manejarErrores);
  return app;
}
