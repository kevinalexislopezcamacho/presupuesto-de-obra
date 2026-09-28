/**
 * Diagnostica la conexión con Gemini usando la clave de backend/.env:
 * 1) en qué servicio de Google funciona la clave (AI Studio o Vertex AI); 2) si cada modelo responde; 3) qué entiende de dos frases.
 * Si algo falla, dice cómo arreglarlo. Nunca muestra la clave.
 * Uso: npm run ia:probar  (desde la carpeta backend)
 */
import { config } from "../src/config/index.js";
import { crearClienteGemini } from "../src/ia/gemini.js";
import { crearServicioInterprete } from "../src/servicios/interprete.servicio.js";

const CLAVE_AI_STUDIO = "https://aistudio.google.com/apikey";

// Devuelve el código de salida. No se usa process.exit(): en Windows falla si quedan conexiones abiertas.
async function diagnosticar() {
  const ia = crearClienteGemini(config.ia);
  if (!ia) {
    console.log(`No hay GEMINI_API_KEY. Crea backend/.env (copia .env.example) y pon tu clave de ${CLAVE_AI_STUDIO}`);
    return 1;
  }

  const linea = r => `   ${r.ok ? "✓" : "✗"} ${r.modelo.padEnd(24)} ${r.segundos.toFixed(1)} s${r.ok ? "" : `  ${r.mensaje}`}`;
  const { servicios, modelos, via } = await ia.diagnosticar();

  console.log("1) ¿En qué servicio de Google funciona la clave?");
  for (const s of servicios) console.log(`   ${s.ok ? "✓" : s.tipo === "clave" ? "✗" : "~"} ${s.via.padEnd(10)} ${s.ok ? "responde" : s.mensaje}`);

  if (!via) {
    console.log("\nLa clave no sirve todavía en ningún servicio.");
    for (const s of servicios) {
      console.log(`\n${s.via}: ${s.mensaje}.`);
      if (s.detalle) console.log(`  Detalle de Google: ${s.detalle}`);
      if (s.ayuda) console.log(`  Para arreglarlo: ${s.ayuda}`);
    }
    console.log(`\nLo más fácil: crea una clave gratuita en Google AI Studio (${CLAVE_AI_STUDIO}), pégala en GEMINI_API_KEY de backend/.env y vuelve a probar. AI Studio no pide facturación.`);
    return 1;
  }
  const otro = servicios.find(s => s.via !== via && !s.ok);
  console.log(`\n   Se usará ${via}.${otro ? ` (${otro.via} no está disponible para esta clave, pero no hace falta.)` : ""}`);

  console.log(`\n2) ¿Responde cada modelo en ${via}?`);
  for (const r of modelos) console.log(linea(r));
  if (!modelos.some(r => r.ok)) {
    console.log("\nNingún modelo respondió ahora (saturados, sin cuota o sin conexión). Intenta en unos minutos o cambia GEMINI_MODELO / GEMINI_MODELOS_RESPALDO en backend/.env.");
    return 1;
  }

  console.log("\n3) ¿Qué entiende?");
  const interprete = crearServicioInterprete({ ia });
  const frases = [
    "remodelar el baño de 2 x 1,5 sin cambiar el piso, con enchape en porcelanato",
    "3 muros de 4 x 2,5 en bloque de concreto y 2 de 6 x 2,5, ya tengo 1.500 bloques"
  ];
  let fallos = 0;
  for (const frase of frases) {
    const inicio = Date.now();
    const r = await interprete.interpretarObra(frase);
    if (r.motor !== "ia") fallos++;
    console.log(`\n“${frase}”  →  ${r.motor === "ia" ? `IA (${r.modelo})` : "REGLAS"} en ${((Date.now() - inicio) / 1000).toFixed(1)} s`);
    if (r.avisoIA) console.log(`  ! ${r.avisoIA}`);
    for (const p of r.partes) console.log(`  parte: ${p.cantidad} ${p.tipo} ${JSON.stringify(p.medidas)}${p.sistema ? ` bloque de ${p.sistema}` : ""}${p.excluir.length ? ` sin ${p.excluir.join(", ")}` : ""}`);
    for (const t of r.trabajos) console.log(`  trabajo: ${t.codigo} = ${t.cantidad}${t.detalle ? ` (${t.detalle})` : ""}`);
    for (const m of r.materiales) console.log(`  tiene: ${m.id ?? "?"} = ${m.cantidad ?? "sin cantidad"}${m.nota ? ` (${m.nota})` : ""}`);
    for (const o of r.observaciones) console.log(`  observación: “${o.texto}” → ${o.nota}`);
    for (const v of r.verificacion) console.log(`  descartado: ${v}`);
  }
  console.log(fallos ? "\nLa IA respondió la prueba mínima pero no las frases: revisa los mensajes de arriba." : "\nConexión con la IA correcta.");
  return fallos ? 1 : 0;
}

process.exitCode = await diagnosticar();
