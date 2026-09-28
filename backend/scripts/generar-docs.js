/**
 * Genera la documentación a partir de los datos y del modelo, para que nunca quede desactualizada.
 * Uso: npm run docs  (desde la carpeta backend)
 *   ../docs/precios-y-fuentes.md  → insumos con precio y enlace; APU con composición y contraste oficial
 *   ../docs/modelo-y-pruebas.md   → exactitud del modelo, matriz de confusión y frases de prueba del intérprete
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APU } from "../src/datos/apu.js";
import {
  INSUMOS, FECHA_PRECIOS, SMMLV_2026, SALARIO_OFICIAL, FACTOR_PRESTACIONAL, HORAS_MES, AUX_TRANSPORTE_2026, PRESTACIONES_CON_AUXILIO
} from "../src/datos/precios.js";
import { REFERENCIAS_OFICIALES } from "../src/datos/referencias-oficiales.js";
import { analizarAPU, cuadrilla } from "../src/dominio/apu.js";
import { obtenerDiagnostico } from "../src/servicios/diagnostico.servicio.js";

const carpetaDocs = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "docs");
const pesos = v => `$ ${Math.round(v).toLocaleString("es-CO")}`;
const celda = s => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const coma = v => String(v).replace(".", ",");

function preciosYFuentes() {
  const factor = Object.values(FACTOR_PRESTACIONAL).reduce((a, b) => a + b, 0);
  const factorAuxilio = PRESTACIONES_CON_AUXILIO.reduce((a, k) => a + FACTOR_PRESTACIONAL[k], 0);
  let md = `# Precios y fuentes\n\nGenerado con \`npm run docs\` desde \`backend/src/datos\`. Precios de Cali y Jamundí consultados entre el ${FECHA_PRECIOS}. Donde hay varias tiendas, el precio de referencia es la mediana (un precio por tienda, el normal y no el de oferta).\n\n`;
  md += "## Insumos\n\n| Código | Insumo | Unidad | Precio | Fuente | Referencia | Estado |\n|---|---|---|---:|---|---|---|\n";
  for (const [id, i] of Object.entries(INSUMOS))
    md += `| ${id} | ${celda(i.nombre)} | ${i.unidad} | ${pesos(i.precio)} | ${i.tiendas
      ? `${celda(i.fuente)}: ${i.tiendas.map(t => `[${celda(t.tienda)}](${t.url}) ${pesos(t.precio)}`).join(", ")}`
      : i.url ? `[${celda(i.fuente)}](${i.url})` : celda(i.fuente)} | ${celda(i.ref)} | ${i.estado} |\n`;
  md += `\n## Mano de obra\n\nCosto por hora = (salario × (1 + ${coma(factor.toFixed(2))} % de prestaciones) + auxilio de transporte ${pesos(AUX_TRANSPORTE_2026)} × (1 + ${coma(factorAuxilio.toFixed(2))} %)) ÷ ${HORAS_MES} horas al mes.\n\n`;
  md += "El auxilio de transporte también es base de las cesantías, sus intereses y la prima (Ley 1 de 1963, art. 7), pero no de las vacaciones ni de la seguridad social.\n\n";
  md += `- Ayudante: salario mínimo 2026 ${pesos(SMMLV_2026)} → ${pesos(INSUMOS.may.precio)} por hora.\n`;
  md += `- Oficial: ${pesos(SALARIO_OFICIAL)} → ${pesos(INSUMOS.mof.precio)} por hora.\n`;
  md += `- Prestaciones: ${Object.entries(FACTOR_PRESTACIONAL).map(([k, v]) => `${k} ${coma(v)} %`).join(", ")}.\n`;
  md += "\n## Análisis de precios unitarios (APU)\n\nCosto unitario = Σ (cantidad × precio de cada insumo) + herramienta menor (5 % de la mano de obra).\n\n";
  md += "| Código | Actividad | Unidad | Rendimiento (por día) | Cuadrilla | Costo unitario | Referencia oficial (diferencia) |\n|---|---|---|---:|---|---:|---|\n";
  for (const a of APU) {
    const u = analizarAPU(a, INSUMOS).unitario, c = cuadrilla(a);
    const refs = a.oficial ? `Es el precio oficial: ${a.oficial.fuente} ítem ${a.oficial.item}`
      : (REFERENCIAS_OFICIALES[a.codigo] || []).map(r => `${r.fuente} ítem ${r.item}: ${pesos(r.precio)} (${Math.round((u / r.precio - 1) * 100)} %)${r.equivalente === false ? ", orientativa" : ""}`).join("; ");
    md += `| ${a.codigo} | ${celda(a.nombre)} | ${a.unidad} | ${a.rendimiento}${a.oficial ? " (ref.)" : ""} | ${a.oficial ? "—" : `${c.oficiales} of. + ${coma(c.ayudantes)} ay.`} | ${pesos(u)} | ${celda(refs) || "—"} |\n`;
  }
  md += "\nDiferencia negativa = el APU propio es más barato que la referencia oficial. La cuadrilla sale de las horas-hombre y del rendimiento en una jornada de 8 h (of. = oficial, ay. = ayudante).\n\n";
  md += "Estos son precios de referencia. En la pestaña **Precios** del resultado, cada persona puede reemplazar cualquier precio por el de su cotización (por insumo o por actividad completa); las actividades que se alejan más de 25 % de la referencia oficial se marcan para revisar.\n\n### Composición de cada APU\n";
  for (const a of APU) {
    const r = analizarAPU(a, INSUMOS);
    if (a.oficial) {
      md += `\n**${a.codigo} · ${a.nombre}** (por ${a.unidad}): precio oficial ${pesos(a.oficial.precio)}, [${a.oficial.fuente}](${a.oficial.url}) ítem ${a.oficial.item}. La entidad no publica su composición; el rendimiento (${a.rendimiento} ${a.unidad}/día) es de referencia para el cronograma.\n`;
      continue;
    }
    md += `\n**${a.codigo} · ${a.nombre}** (por ${a.unidad})\n\n| Insumo | Cantidad | Unidad | Precio | Parcial |\n|---|---:|---|---:|---:|\n`;
    for (const l of r.lineas) md += `| ${celda(l.nombre)} | ${l.cantidad} | ${l.unidad} | ${pesos(l.precio)} | ${pesos(l.parcial)} |\n`;
    md += `| Herramienta menor (5 % MO) | | | | ${pesos(r.herramienta)} |\n| **Total** | | | | **${pesos(r.unitario)}** |\n`;
  }
  return md;
}

function modeloYPruebas() {
  const { modelo: e, interprete: ei } = obtenerDiagnostico();
  let md = "# Modelo de texto y pruebas\n\nGenerado con `npm run docs` desde `backend/src/dominio/texto`.\n\n";
  md += "## Cómo se entiende lo que escribe la persona\n\n";
  md += "1. **Reglas**: separan la frase en partes (“un baño y una cocina”, “… con un baño”) y leen cantidades (“4 muros”) y medidas (“3 x 2,5”, “12mx15m”, “de 10 m”, “70 m2”, “300 cm”).\n";
  md += "2. **Palabras clave**: muro, pared, tapia, baño, cocina, habitación, bodega, garaje, casa, apartamento… y trabajos sueltos (pañetar, enchapar, piso, placa, mesón, columnas…).\n";
  md += `3. **${e.algoritmo}** para las partes sin palabra clave: raíces de palabras, pares de palabras y trigramas de letras (tolera errores como “cosina”). Si la confianza es menor a ${e.umbralConfianza * 100} %, la herramienta pregunta.\n\n`;
  md += `## Evaluación del modelo\n\n- Datos: ${e.frases} frases etiquetadas en ${e.clases.length} clases (${e.clases.join(", ")}).\n`;
  md += `- Método: validación cruzada de ${e.pliegues} pliegues (ninguna frase se evalúa con un modelo que la vio).\n`;
  md += `- **Exactitud: ${coma((e.exactitud * 100).toFixed(1))} %** (${e.aciertos} de ${e.nTest}).\n\n`;
  md += `Matriz de confusión (filas = clase real, columnas = predicción):\n\n| | ${e.clases.join(" | ")} |\n|---|${e.clases.map(() => "---:").join("|")}|\n`;
  for (const r of e.clases) md += `| **${r}** | ${e.clases.map(p => e.matriz[r][p]).join(" | ")} |\n`;
  const pct = v => `${coma((v * 100).toFixed(1))} %`;
  md += `\n### Métricas por clase\n\n| Clase | Precisión | Recall | F1 | Frases |\n|---|---:|---:|---:|---:|\n`;
  for (const m of e.metricas.porClase) md += `| ${m.clase} | ${pct(m.precision)} | ${pct(m.recall)} | ${pct(m.f1)} | ${m.soporte} |\n`;
  md += `| **Promedio macro** | ${pct(e.metricas.macro.precision)} | ${pct(e.metricas.macro.recall)} | ${pct(e.metricas.macro.f1)} | ${e.nTest} |\n`;
  md += `\n### Comparación con modelos simples (líneas base)\n\n| Modelo | Exactitud |\n|---|---:|\n| Naive Bayes solo (validación cruzada) | ${pct(e.exactitud)} |\n`;
  for (const b of [...e.lineasBase, e.combinado]) md += `| ${b.nombre} | ${pct(b.exactitud)} (${b.aciertos} de ${b.total}) |\n`;
  md += `\nCasi todas las frases de entrenamiento nombran el tipo de construcción (“baño”, “muro”…): por eso las palabras clave solas aciertan ${pct(e.lineasBase[1].exactitud)}. `;
  md += `La herramienta usa las palabras clave primero y el modelo solo cuando la frase no nombra el tipo; así acierta ${pct(e.combinado.exactitud)}. `;
  md += `En esta colección solo ${e.combinado.frasesSinPalabraClave} frases no nombran el tipo (el modelo acertó ${e.combinado.aciertosDelModeloEnEsas}): para medir mejor el aporte del modelo hacen falta más frases reales de ese estilo, por ejemplo las que escriban los arquitectos en la validación.\n`;
  md += `\nLa evaluación de la IA (Gemini) con los mismos datos está en [evaluacion-ia.md](evaluacion-ia.md) (se genera con \`npm run ia:evaluar\`).\n`;
  md += `\n## Intérprete completo con frases nuevas\n\n**${ei.aciertos} de ${ei.total}** frases que no están en el entrenamiento.\n\n| Frase | Esperado | Obtenido | |\n|---|---|---|---|\n`;
  for (const d of ei.detalle) md += `| ${celda(d.frase)} | ${d.esperado.join(", ")} | ${d.obtenido.join(", ") || "—"} | ${d.ok ? "✓" : "✗"} |\n`;
  md += "\n## IA (Gemini), opcional\n\nSi hay `GEMINI_API_KEY` en `backend/.env`, la descripción y los materiales los entiende primero Gemini, con una respuesta JSON de esquema fijo. La herramienta no le cree a ciegas (`src/ia/verificar.js`):\n\n";
  md += "- Cada número debe estar en lo que escribió la persona (o ser el mismo en cm o mm pasado a metros); si no, se descarta y se avisa.\n";
  md += "- Solo se aceptan tipos, códigos de actividad e insumos que existen.\n";
  md += "- Las cantidades de los trabajos y las conversiones de unidades las calcula la herramienta, no la IA.\n";
  md += "- Lo que la persona pidió y no se puede aplicar tal cual (una marca, un acabado distinto) queda en *observaciones*, a la vista.\n";
  md += "- Si la IA no está configurada, tarda más de lo permitido, falla o no encuentra nada, se usa el intérprete por reglas de arriba.\n";
  md += "\n## Pruebas automáticas\n\n`npm test` (en la carpeta backend) corre las pruebas de `backend/pruebas`: dominio (APU, actividades, presupuesto, cronograma, intérprete, materiales), IA (verificación de números, códigos, fallas y caché, con una IA de prueba), repositorio (fallos de escritura), servicios (cálculo, exclusiones y precios propios) y API (todas las rutas, errores y CRUD de obras).\n";
  return md;
}

await fs.mkdir(carpetaDocs, { recursive: true });
await fs.writeFile(path.join(carpetaDocs, "precios-y-fuentes.md"), preciosYFuentes());
await fs.writeFile(path.join(carpetaDocs, "modelo-y-pruebas.md"), modeloYPruebas());
console.log("Listo: docs/precios-y-fuentes.md y docs/modelo-y-pruebas.md");
