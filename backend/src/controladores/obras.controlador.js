/**
 * Controladores de "Mis obras" (crear, listar, abrir, actualizar y borrar).
 * @param {import("../servicios/obras.servicio.js").ServicioObras} servicio
 */
export const crearControladorObras = servicio => ({
  listar: async (_req, res) => res.json(await servicio.listar()),
  obtener: async (req, res) => res.json(await servicio.obtener(req.params.id)),
  crear: async (req, res) => res.status(201).json(await servicio.crear(req.datos)),
  actualizar: async (req, res) => res.json(await servicio.actualizar(req.params.id, req.datos)),
  eliminar: async (req, res) => { await servicio.eliminar(req.params.id); res.sendStatus(204); }
});
