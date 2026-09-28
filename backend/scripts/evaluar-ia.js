/**
 * Evalúa la IA (Gemini) con los mismos datos que el modelo propio y escribe docs/evaluacion-ia.md:
 * 1) las 20 frases nuevas del intérprete completo (partes y trabajos esperados);
 * 2) las 150 frases etiquetadas: el tipo de la primera parte que entiende la IA.
 * Usa la clave de backend/.env y va despacio (una consulta cada 4,5 s) para no pasar el límite gratuito.
 * Uso: npm run ia:evaluar  (desde la carpeta backend)
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../src/config/index.js";
import { crearClienteGemini } from "../src/ia/gemini.js";
import { crearServicioInterprete } from "../src/servicios/interprete.servicio.js";
import { EJEMPLOS, PRUEBA_INTERPRETE } from "../src/datos/entrenamiento.js";
import { metricasPorClase } from "../src/dominio/texto/metricas.js";
import { EVALUACION } from "../src/dominio/texto/modelo.js";

const PAUSA_MS = 4500;
const esperar = ms => new Promise(listo => setTimeout(listo, ms));
const pct = v => `${(v * 100).toFixed(1).replace(".", ",")} %`;
const mayus = s => s.charAt(0).toUpperCase() + s.slice(1);

async function evaluar() {
  const ia = crearClienteGemini({ ...config.ia, tiempoMaximoMs: 40000 });
  if (!ia) { console.log("No hay GEMINI_API_KEY en backend/.env."); return 1; }
  const interprete = crearServicioInterprete({ ia });
  const reglas = crearServicioInterprete({ ia: null });
  const modelos = new Map();
  const preguntar = async texto => {
    const r = await interprete.interpretarObra(texto);
    if (r.motor === "ia") modelos.set(r.modelo, (modelos.get(r.modelo) || 0) + 1);
    await esperar(PAUSA_MS);
    return r;
  };

  // 1) Intérprete completo con frases nuevas
  const resumen = r => [...r.partes.map(p => `${p.cantidad} ${p.tipo}`), ...r.trabajos.map(x => x.codigo)];
  const correcto = (obtenido, esperado) => obtenido.length === esperado.length && esperado.every(e => obtenido.includes(e));
  const frases = [];
  for (const [frase, esperado] of PRUEBA_INTERPRETE) {
    const r = await preguntar(frase), conReglas = await reglas.interpretarObra(frase);
    frases.push({ frase, esperado, ia: r.motor === "ia" ? resumen(r) : null, reglas: resumen(conReglas), cayo: r.motor !== "ia" });
    process.stdout.write(".");
  }

  // 2) Clasificación de las 150 frases etiquetadas
  const clases = Object.keys(EJEMPLOS);
  const matriz = Object.fromEntries(clases.map(c => [c, Object.fromEntries([...clases, "ninguna"].map(p => [p, 0]))]));
  let aciertos = 0, total = 0, sinIA = 0;
  const fallos = [];
  for (const [clase, lista] of Object.entries(EJEMPLOS)) for (const frase of lista) {
    const r = await preguntar(frase);
    // Si Gemini respondió pero no encontró nada, el servicio usa las reglas: cuenta como fallo de Gemini, no como "sin respuesta".
    const vacia = r.motor !== "ia" && /no encontró nada/.test(r.avisoIA || "");
    if (r.motor !== "ia" && !vacia) { sinIA++; continue; }
    const pred = vacia ? "ninguna" : r.partes[0]?.tipo || "ninguna";
    matriz[clase][pred]++; total++;
    if (pred === clase) aciertos++;
    else fallos.push({ clase, frase, que: vacia ? ["No encontró nada (se usaron las reglas)", "—"]
      : pred !== "ninguna" ? ["Otro tipo", pred]
      : r.trabajos.length ? ["Trabajo suelto", r.trabajos.map(t => t.codigo).join(", ")]
      : r.dudas.length ? ["Pregunta a la persona", r.dudas.map(d => d.ranking.map(o => o.tipo).join(" o ")).join("; ")]
      : r.noSoportado.length ? ["No se calcula", r.noSoportado.join("; ")] : ["Nada", "—"] });
    process.stdout.write(".");
  }
  console.log();

  const m = metricasPorClase(matriz, clases);
  const okIA = frases.filter(f => f.ia && correcto(f.ia, f.esperado)).length, okReglas = frases.filter(f => correcto(f.reglas, f.esperado)).length;
  let md = `# Evaluación de la IA (Gemini)\n\nGenerado con \`npm run ia:evaluar\` el ${new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}. `;
  md += `Modelos que respondieron: ${[...modelos].map(([k, v]) => `${k} (${v})`).join(", ") || "ninguno"}.\n\n`;
  md += "## Intérprete completo con 20 frases nuevas\n\n";
  md += `| Motor | Frases correctas |\n|---|---:|\n| Gemini, verificado por la herramienta | ${okIA} de ${frases.filter(f => f.ia).length} |\n| Reglas + Naive Bayes | ${okReglas} de ${frases.length} |\n\n`;
  md += "| Frase | Esperado | Gemini | Reglas |\n|---|---|---|---|\n";
  for (const f of frases) md += `| ${f.frase} | ${f.esperado.join(", ")} | ${f.ia ? `${f.ia.join(", ") || "—"} ${correcto(f.ia, f.esperado) ? "✓" : "✗"}` : "no respondió"} | ${f.reglas.join(", ") || "—"} ${correcto(f.reglas, f.esperado) ? "✓" : "✗"} |\n`;
  md += `\n## Clasificación de las ${total + sinIA} frases etiquetadas\n\n`;
  md += "Tipo de la primera parte que entiende Gemini, sin entrenamiento con estas frases. Se compara con el Naive Bayes en validación cruzada de 5 pliegues.\n\n";
  md += `| Modelo | Exactitud | F1 macro |\n|---|---:|---:|\n| Gemini | ${pct(aciertos / Math.max(1, total))} (${aciertos} de ${total}) | ${pct(m.macro.f1)} |\n`;
  const nb = metricasPorClase(EVALUACION.matriz, EVALUACION.clases);
  md += `| Naive Bayes (validación cruzada) | ${pct(EVALUACION.exactitud)} | ${pct(nb.macro.f1)} |\n\n`;
  if (sinIA) md += `${sinIA} frases no se pudieron evaluar porque Gemini no respondió a tiempo o se agotó la cuota.\n\n`;
  md += "| Clase | Precisión | Recall | F1 |\n|---|---:|---:|---:|\n";
  for (const c of m.porClase) md += `| ${c.clase} | ${pct(c.precision)} | ${pct(c.recall)} | ${pct(c.f1)} |\n`;
  md += "\nUna frase cuenta como acierto solo si la primera parte que entiende Gemini es del tipo de la etiqueta. Las demás cuentan como no encontradas y bajan el recall.\n";
  if (fallos.length) {
    const porTipo = Object.entries(Object.groupBy(fallos, f => f.que[0])).map(([k, v]) => `${k.toLowerCase()}: ${v.length}`).join("; ");
    md += `\n### Frases que no coinciden con la etiqueta (${fallos.length})\n\n${mayus(porTipo)}.\n\n`;
    md += "Un \"trabajo suelto\" es otra lectura de la frase: por ejemplo, \"cambiar el piso de la cocina\" como el trabajo de piso y no como una cocina completa. La etiqueta pide el espacio completo; cuál sirve más depende de la obra, y la persona puede corregirlo en Medidas.\n\n";
    md += "| Frase | Etiqueta | Qué entendió Gemini | Detalle |\n|---|---|---|---|\n";
    for (const f of fallos) md += `| ${f.frase} | ${f.clase} | ${f.que[0]} | ${f.que[1]} |\n`;
  }

  const destino = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "evaluacion-ia.md");
  await fs.writeFile(destino, md);
  console.log(`Gemini: ${okIA}/20 frases nuevas, ${aciertos}/${total} frases etiquetadas. Escrito en docs/evaluacion-ia.md`);
  return 0;
}

process.exitCode = await evaluar();
