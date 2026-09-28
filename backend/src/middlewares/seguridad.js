/**
 * Cabeceras de seguridad básicas y permiso para otro origen (CORS) si se configuró.
 * @param {{ origenPermitido: string }} opciones
 */
export const seguridad = ({ origenPermitido }) => (req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "same-origin");
  res.set("X-Frame-Options", "SAMEORIGIN");
  if (origenPermitido && req.headers.origin === origenPermitido) {
    res.set("Access-Control-Allow-Origin", origenPermitido);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.sendStatus(204);
  }
  next();
};
