/**
 * Guarda las obras en un archivo JSON. Suficiente para un prototipo con pocos usuarios;
 * para producción se cambia esta clase por una base de datos sin tocar el resto del código.
 */
import fs from "node:fs/promises";
import path from "node:path";

export class RepositorioObras {
  /** @param {string} archivo ruta del archivo JSON */
  constructor(archivo) {
    this.archivo = archivo;
    this.obras = null;                 // se carga la primera vez que se usa
    this.cola = Promise.resolve();     // las escrituras se hacen de una en una
  }

  async #cargar() {
    if (this.obras) return this.obras;
    try {
      const contenido = JSON.parse(await fs.readFile(this.archivo, "utf8"));
      this.obras = new Map((Array.isArray(contenido) ? contenido : []).map(o => [o.id, o]));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      this.obras = new Map();
    }
    return this.obras;
  }

  // Escribe en un archivo temporal y luego lo renombra: si algo falla a mitad, no se pierde lo anterior.
  // Si una escritura falla, la cola sigue: las siguientes se intentan normalmente.
  #escribir() {
    const escritura = this.cola.then(async () => {
      await fs.mkdir(path.dirname(this.archivo), { recursive: true });
      const temporal = `${this.archivo}.tmp`;
      await fs.writeFile(temporal, JSON.stringify([...this.obras.values()], null, 2));
      await fs.rename(temporal, this.archivo);
    });
    this.cola = escritura.catch(() => {});
    return escritura;
  }

  // Aplica un cambio en memoria y lo escribe; si no se pudo escribir, deshace el cambio
  // para que lo que se ve en "Mis obras" sea siempre lo que está en el archivo.
  async #cambiar(id, aplicar) {
    const obras = await this.#cargar();
    const tenia = obras.has(id), anterior = obras.get(id);
    aplicar(obras);
    try {
      await this.#escribir();
    } catch (e) {
      if (tenia) obras.set(id, anterior); else obras.delete(id);
      throw e;
    }
  }

  async listar() {
    return [...(await this.#cargar()).values()];
  }

  async obtener(id) {
    return (await this.#cargar()).get(id) || null;
  }

  async guardar(obra) {
    await this.#cambiar(obra.id, obras => obras.set(obra.id, obra));
    return obra;
  }

  async eliminar(id) {
    if (!(await this.#cargar()).has(id)) return false;
    await this.#cambiar(id, obras => obras.delete(id));
    return true;
  }
}
