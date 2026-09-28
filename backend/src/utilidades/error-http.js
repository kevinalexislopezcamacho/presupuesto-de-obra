/**
 * Error con código HTTP: los controladores y servicios lo lanzan y el middleware
 * de errores lo convierte en una respuesta JSON.
 */
export class ErrorHttp extends Error {
  /**
   * @param {number} estado código HTTP (400, 404…)
   * @param {string} mensaje explicación para quien usa la API
   */
  constructor(estado, mensaje) {
    super(mensaje);
    this.name = "ErrorHttp";
    this.estado = estado;
  }
}

export const solicitudInvalida = mensaje => new ErrorHttp(400, mensaje);
export const noEncontrado = mensaje => new ErrorHttp(404, mensaje);
