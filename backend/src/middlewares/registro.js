/**
 * Registra cada petición de la API en consola: método, ruta, código y tiempo.
 */
export const registro = (req, res, next) => {
  const inicio = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
    console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${ms.toFixed(1)} ms)`);
  });
  next();
};
