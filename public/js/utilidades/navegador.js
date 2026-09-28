/**
 * Utilidades que dependen del navegador: enlaces de Google Maps y portapapeles.
 */
export const mapsBuscar = q => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
export const mapsRuta = q => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;

/** Copia texto al portapapeles; devuelve una promesa con true si se pudo. */
export function copiar(texto) {
  const respaldo = () => {
    const area = document.createElement("textarea");
    area.value = texto;
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    area.remove();
    return ok;
  };
  try { return navigator.clipboard.writeText(texto).then(() => true, respaldo); } catch { return Promise.resolve(respaldo()); }
}
