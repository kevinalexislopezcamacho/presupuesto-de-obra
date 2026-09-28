/**
 * Esquemas de entrada de la API. Cada esquema recibe el cuerpo de la petición,
 * devuelve solo los campos válidos o lanza un error 400 con un mensaje claro.
 */
import { solicitudInvalida } from "../utilidades/error-http.js";
import { TIPOS_OBRA } from "../datos/tipos-obra.js";
import { esObjeto } from "../utilidades/valores.js";


function textoObligatorio(valor, campo, max) {
  if (typeof valor !== "string" || !valor.trim()) throw solicitudInvalida(`El campo "${campo}" es obligatorio y debe ser texto.`);
  if (valor.length > max) throw solicitudInvalida(`El campo "${campo}" admite máximo ${max} caracteres.`);
  return valor.trim();
}

function objetoObligatorio(valor, campo) {
  if (!esObjeto(valor)) throw solicitudInvalida(`El campo "${campo}" es obligatorio y debe ser un objeto.`);
  return valor;
}

/** { texto } */
export const esquemaTexto = cuerpo => ({ texto: textoObligatorio(cuerpo.texto, "texto", 1000) });

/** { texto, tipo } */
export const esquemaMedidas = cuerpo => {
  if (!TIPOS_OBRA.includes(cuerpo.tipo)) throw solicitudInvalida(`El campo "tipo" debe ser uno de: ${TIPOS_OBRA.join(", ")}.`);
  return { texto: textoObligatorio(cuerpo.texto, "texto", 1000), tipo: cuerpo.tipo };
};

/** { texto, obra? } */
export const esquemaMateriales = cuerpo => ({
  texto: textoObligatorio(cuerpo.texto, "texto", 2000),
  obra: cuerpo.obra === undefined ? null : objetoObligatorio(cuerpo.obra, "obra")
});

/** ?q=&capitulo=&unidad=&limite=&desde= (búsqueda en la lista oficial) */
export const esquemaBusquedaOficial = consulta => ({
  q: typeof consulta.q === "string" ? consulta.q.slice(0, 200) : "",
  capitulo: /^\d{2,4}$/.test(consulta.capitulo || "") ? consulta.capitulo : "",
  unidad: /^[A-Za-z0-9-]{1,8}$/.test(consulta.unidad || "") ? consulta.unidad : "",
  limite: Math.min(200, Math.max(1, parseInt(consulta.limite, 10) || 50)),
  desde: Math.max(0, parseInt(consulta.desde, 10) || 0)
});

/** { obra } */
export const esquemaCalculo = cuerpo => ({ obra: objetoObligatorio(cuerpo.obra, "obra") });

/** { obra, nombre? } */
export const esquemaExportacion = cuerpo => ({
  obra: objetoObligatorio(cuerpo.obra, "obra"),
  nombre: typeof cuerpo.nombre === "string" && cuerpo.nombre.trim() ? cuerpo.nombre.trim().slice(0, 80) : "Obra"
});

