/**
 * Aplica un esquema al cuerpo de la petición y deja el resultado en `req.datos`.
 * @param {(cuerpo: object) => object} esquema
 */
export const validar = esquema => (req, _res, next) => {
  req.datos = esquema(req.body ?? {});
  next();
};

/** Lo mismo para los parámetros de la URL (?q=…). */
export const validarConsulta = esquema => (req, _res, next) => {
  req.datos = esquema(req.query ?? {});
  next();
};
