/**
 * Manejo centralizado de errores: toda respuesta de error tiene la forma { error: { mensaje } }.
 */
import { ErrorHttp } from "../utilidades/error-http.js";

/** Rutas de la API que no existen. */
export const rutaNoEncontrada = (req, _res, next) => next(new ErrorHttp(404, `No existe la ruta ${req.method} ${req.originalUrl}.`));

// Express reconoce el manejador de errores porque recibe 4 parámetros.
export const manejarErrores = (err, _req, res, _next) => {
  let estado = 500, mensaje = "Ocurrió un error inesperado en el servidor.";
  if (err instanceof ErrorHttp) ({ estado, message: mensaje } = err);
  else if (err.type === "entity.parse.failed") [estado, mensaje] = [400, "El cuerpo de la petición no es JSON válido."];
  else if (err.type === "entity.too.large") [estado, mensaje] = [413, "El cuerpo de la petición es demasiado grande."];
  if (estado === 500) console.error(err);
  res.status(estado).json({ error: { mensaje } });
};
