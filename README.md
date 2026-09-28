# Presupuesto de obra · Cali

Herramienta web que acorta el tiempo de hacer el presupuesto de una obra pequeña. Sistematiza los **análisis de precios unitarios (APU)** de estructuras básicas, los cruza con **precios de tiendas de Cali** y permite consultar la **lista oficial de precios de la Gobernación del Valle 2024** (3.506 ítems). Está pensada para arquitectos con poca experiencia en costeo.

Se describe con palabras lo que se va a construir o remodelar y los materiales disponibles. La herramienta devuelve:

- el presupuesto por capítulos, con ítems numerados, el APU de cada ítem y la memoria de cantidades;
- un cronograma con fechas;
- la lista de compras con enlaces para ubicar las tiendas en Cali;
- recomendaciones sobre los materiales;
- descargas en Excel (con fórmulas) y PDF.

Proyecto Integrador (Proyecto Machine Learning), Universidad de San Buenaventura Cali.

---

## Cómo ejecutarlo

Requiere [Node.js](https://nodejs.org) 20 o superior.

```bash
cd backend
npm install      # una sola vez: instala Express y ExcelJS
npm start        # abre el servidor en http://localhost:3000
```

Luego se abre **http://localhost:3000** en el navegador. El backend sirve la API en `/api` y también la página del frontend.

### Activar la IA (Gemini), opcional pero recomendado

Sin IA la herramienta funciona con su intérprete por reglas. Con IA entiende mejor lo que se escribe: pedidos como "sin enchape", "remodelar", marcas o acabados, y materiales escritos de cualquier forma.

1. Saca una clave gratuita en [Google AI Studio](https://aistudio.google.com/apikey). La herramienta prueba primero AI Studio (gratis, sin facturación) y, si la clave no sirve ahí, Vertex AI (pide facturación en Google Cloud).
2. En `backend/`, copia `.env.example` como `.env` y pon la clave en `GEMINI_API_KEY=`.
3. Prueba la conexión con `npm run ia:probar`: dice qué tipo de clave es, si cada modelo responde y, si algo falla, cómo arreglarlo. Luego usa `npm start` como siempre.

El modelo principal es `gemini-3.5-flash-lite`, que en las pruebas respondió en unos 2 segundos. Si está saturado o sin cuota, la herramienta prueba los de respaldo (`GEMINI_MODELOS_RESPALDO`: `gemini-3.8-flash` y `gemini-3.5-flash`); si ninguno responde, sigue con reglas.

La clave queda en el servidor y nunca llega al navegador. **No subas el archivo `.env` a ningún repositorio**: ya está en `.gitignore`.

| Comando (en `backend/`) | Qué hace |
|---|---|
| `npm start` | Inicia el servidor |
| `npm run dev` | Inicia el servidor y lo reinicia solo al cambiar el código |
| `npm test` | Corre las pruebas automáticas (dominio, IA, repositorio, servicios y API) |
| `npm run docs` | Regenera `docs/precios-y-fuentes.md` y `docs/modelo-y-pruebas.md` desde los datos |
| `npm run ia:probar` | Diagnostica la clave de Gemini: en qué servicio funciona, cada modelo y dos frases de prueba |
| `npm run ia:evaluar` | Evalúa a Gemini con las mismas frases que el modelo propio y escribe `docs/evaluacion-ia.md` (unos 15 minutos) |

La configuración (puerto, archivo de obras, CORS, IA) está en `backend/.env.example`.

## Estructura

```
presupuesto-obra-cali/
├── backend/                      API REST (Node.js + Express)
│   ├── src/
│   │   ├── servidor.js           Punto de entrada
│   │   ├── app.js                Arma Express: middlewares, rutas, estáticos y errores
│   │   ├── config/               Configuración por variables de entorno
│   │   ├── rutas/                URL → validación → controlador
│   │   ├── validacion/           Esquemas de entrada de cada ruta
│   │   ├── controladores/        Reciben la petición y responden (sin lógica)
│   │   ├── servicios/            Casos de uso: calcular obra, interpretar texto, catálogo, obras, lista oficial, Excel
│   │   ├── ia/                   Cliente de Gemini, instrucciones y esquemas, y verificación de lo que responde
│   │   ├── dominio/              Reglas del negocio en funciones puras
│   │   │   ├── apu.js, actividades.js, materiales.js, materiales-texto.js,
│   │   │   │   presupuesto.js, cronograma.js, numeros.js
│   │   │   └── texto/            Normalización, clasificador Naive Bayes, modelo e intérprete
│   │   ├── datos/                Precios con fuente, APU, supuestos, tipos de obra, vocabulario,
│   │   │                         frases de entrenamiento y referencias oficiales
│   │   ├── repositorios/         Obras guardadas en un archivo JSON
│   │   ├── middlewares/          Seguridad y CORS, registro, validación y errores
│   │   └── utilidades/           Error HTTP
│   ├── pruebas/                  node:test → dominio/, ia/, repositorios/, servicios/, api/
│   ├── scripts/                  generar-docs.js, probar-ia.js, evaluar-ia.js y listas-oficiales/ (transcripción del PDF oficial)
│   ├── .env.example              Variables de entorno disponibles
│   └── package.json
├── public/                       Interfaz (HTML + CSS + JavaScript con módulos); se llama así porque Vercel publica esa carpeta
│   ├── index.html
│   ├── css/                      base.css · componentes.css · pantallas.css
│   └── js/
│       ├── main.js               Arranque
│       ├── config.js             Dirección de la API
│       ├── api/cliente.js        Única parte que habla con el backend
│       ├── estado/               Estado de la app, catálogo e historial ("Mis obras")
│       ├── acciones/             Cambios sobre la obra y exportación a Excel
│       ├── vistas/               Una pantalla por archivo (solo generan HTML)
│       ├── render.js             Dibuja y pide los cálculos al backend
│       ├── eventos.js            Clics y cambios → acciones
│       └── utilidades/           Formato, fechas, Maps, portapapeles y tema claro/oscuro
└── docs/
    ├── arquitectura.md           Capas, decisiones y flujo de una acción
    ├── api.md                    Rutas con ejemplos de petición y respuesta
    ├── precios-y-fuentes.md      Insumos con precio y enlace; APU con composición y contraste oficial
    └── modelo-y-pruebas.md       Exactitud del modelo, matriz de confusión y frases de prueba
```

El detalle de las capas y de por qué se organizó así está en [`docs/arquitectura.md`](docs/arquitectura.md).

## Cómo se usa

1. **Descripción de la obra.** Se escribe, por ejemplo: *"Remodelar el baño de 2 x 1,5 sin cambiar el piso y 3 muros de 4 x 2,5 en bloque de concreto"*.
   - Entiende muros, baños, cocinas, cuartos, casas de un piso, remodelaciones y actividades sueltas (pañetar, enchapar, piso, placa, columnas…).
   - Entiende lo que no se incluye ("sin enchape", "sin cambiar el piso") y las remodelaciones: no cobra muros, estructura ni placa que ya existen, y agrega la demolición del enchape y el piso que se cambian.
   - Nunca cambia lo escrito: cada número se revisa contra el texto, y lo que no se puede aplicar tal cual (una marca, el porcelanato) queda a la vista para revisar.
   - Si algo no está claro, pregunta.
2. **Medidas y alcance.** Cada parte tiene su tarjeta con un campo "Cuántos iguales".
   - Muestra las actividades que se calculan (replanteo, excavación, cimentación, estructura, muros, acabados…); cada una se puede quitar o volver a incluir con un toque, y cada parte se puede marcar como remodelación.
   - Las medidas que no se escribieron aparecen como "de ejemplo".
   - Salen recomendaciones cuando una medida es poco usual.
   - **Puertas y ventanas con su forma:** en cada parte se pueden detallar rectangulares, en arco de medio punto o circulares, con sus medidas. La herramienta calcula el área de cada hueco y la descuenta del muro, el pañete y el enchape (por ejemplo, una puerta en arco de 1 × 2,10 m son 1,99 m²). También lo entiende en la descripción: "un muro de 4 x 2,5 con una puerta en arco de 1 m de ancho".
   - Desde aquí se puede buscar cualquier ítem de la **lista oficial de la Gobernación** (pintura, cubierta, carpintería…) y agregarlo con su precio oficial. La búsqueda es por palabras completas: "arco" encuentra arcos, no marcos.
   - **Ítems cotizados:** lo que no está en la herramienta ni en la lista oficial (una puerta en arco, una reja a la medida) se agrega con la descripción, la unidad, la cantidad, el valor de la cotización y quién la hizo. Va al capítulo "Ítems cotizados", marcado como cotización.
3. **Materiales disponibles**, en tres partes:
   - *Disponibles:* los materiales que ya están en obra ("20 bultos de cemento, 1.500 ladrillos"). Cada uno muestra lo escrito. Si una cantidad no se puede convertir con seguridad (una volqueta, varillas sin calibre), pregunta en vez de inventar.
   - *Revisión:* dice si cada uno sirve, no es lo correcto o no se usa, y qué conviene hacer.
   - *Por comprar:* cuánto comprar, a qué precio y dónde.
4. **Resultado.** El presupuesto sale en costo directo. Si la obra la ejecuta un contratista, se marca "Sumar AIU" en la pestaña Presupuesto (administración, imprevistos y utilidad con los porcentajes de la Alcaldía de Cali 2026, editables). Tiene cuatro pestañas: Presupuesto, Cronograma, Compras y Precios.
   - **Presupuesto** por capítulos (1. Preliminares, 2. Excavaciones y rellenos, 3. Cimentación…), con ítems numerados y subtotales. Cada ítem se despliega y muestra su **APU** (insumos, cantidades, precios con fuente, rendimiento y cuadrilla, o el precio oficial), su **memoria de cantidades** y la referencia oficial.
   - Se descarga en **Excel** (hojas de presupuesto con fórmulas, APU, memoria de cantidades, compras y cronograma) y en **PDF**.
   - En Cronograma se marcan las actividades hechas, y bajan los días que faltan.
   - En Compras se marca lo comprado, y baja lo que falta por invertir.
   - En Precios se registran las cotizaciones, por material o por actividad completa, y todo se recalcula. Las actividades que se alejan más de 25 % de su referencia oficial **equivalente** (el mismo elemento y formato, con valor verificado) se marcan; las que no son el mismo producto se muestran como "orientativas" y no marcan.
   - Si hay actividades marcadas, el resumen muestra un **rango**: el total si esas actividades costaran lo oficial (también sale en el PDF y el Excel). Sirve para dejar margen hasta tener cotizaciones.
   - Con "Terminado", la obra queda en "Mis obras" con sus precios y el **tiempo que tomó elaborarla**. Desde "Mis obras" se descargan los tiempos en CSV para la validación con arquitectos.
   - "Mis obras" se guarda **en el navegador de cada dispositivo**: cada persona ve solo las suyas y siguen ahí al volver a entrar, sin inicio de sesión, también con la herramienta publicada. Se pierden si se borran los datos del navegador o se usa modo incógnito, y no pasan de un dispositivo a otro.

La interfaz se adapta a celular, tablet y computador, y tiene tema claro y oscuro (automático o a elección, con el botón de la barra).

## Aprendizaje automático

La descripción se entiende en tres pasos:

1. **Reglas** que separan la frase en partes y leen cantidades y medidas.
2. **Palabras clave** que nombran el tipo de construcción o el trabajo.
3. **Clasificador Naive Bayes multinomial** (suavizado de Laplace), para las partes sin palabra clave.
   - Usa raíces de palabras, pares de palabras y trigramas de letras.
   - Se entrenó con 150 frases en 5 clases.
   - Si la confianza es menor a 60 %, la herramienta pregunta.

Resultados:

- **Modelo:** 84 % de exactitud y F1 macro de 83,5 % con validación cruzada de 5 pliegues; hay precisión, recall y F1 por clase en la documentación.
- **Líneas base:** la clase más frecuente acierta 20 %; solo palabras clave, 94 %. El sistema como funciona la herramienta (palabras clave y, si no hay, el modelo) acierta 98 %. Casi todas las frases de entrenamiento nombran el tipo, así que para medir mejor el aporte del modelo hacen falta más frases reales que no lo nombren.
- **Intérprete completo:** 20 de 20 frases nuevas, que no están en el entrenamiento.

Si hay clave de Gemini, el texto lo entiende primero la IA y después la herramienta verifica lo que respondió:
- números que no están en el texto: se descartan y se avisa;
- tipos, actividades o materiales que no existen: se descartan;
- cantidades y conversiones: las calcula la herramienta, no la IA;
- si la IA duda con una sola opción ("una pared divisoria" → muro), la herramienta crea la parte con medidas de ejemplo en vez de preguntar.

Con las mismas 150 frases, Gemini (verificado) acierta 89,3 % (F1 macro 93,9 %) sin entrenamiento, y 19 de 20 frases nuevas. De las que no coinciden con la etiqueta, la mayoría son preguntas con dos opciones reales o trabajos sueltos ("cambiar el piso de la cocina" como el trabajo de piso). El detalle está en `docs/evaluacion-ia.md`.

Si la IA falla o tarda, se usan las reglas y el clasificador de arriba, así que la herramienta siempre responde.

Detalle en [`docs/modelo-y-pruebas.md`](docs/modelo-y-pruebas.md).

## Fuentes de precios

- **Lista oficial de la Gobernación del Valle 2024** (Decreto 1.22-1441): 3.506 ítems transcritos del PDF escaneado con OCR verificado (cada valor se lee cuatro veces y se corrige la inclinación del escaneo; 3.081 quedaron verificados y el resto se marca "por verificar" con su página del PDF). El método está en `backend/scripts/listas-oficiales/`. Los ítems de preliminares, excavación, rellenos, retiro de sobrantes, solado y demoliciones usan su precio oficial.

- **Materiales:** Homecenter, Easy, Ferretería Jamundí, Ferromateriales del Sur (Jamundí) y Distribuciones PVC (Cali), consultados entre el 24 y el 27 de septiembre de 2026. Los que más pesan en el costo (cemento, arena, triturado, bloque, acero y cerámica de piso) tienen dos a cuatro precios, y la referencia es la **mediana** (precio normal, no de oferta), para que un precio atípico no la mueva.
- **Mano de obra:**
  - salario mínimo 2026 (Decreto 1469 de 2025);
  - auxilio de transporte (Decreto 1470 de 2025), que también es base de cesantías, intereses y prima (Ley 1 de 1963);
  - jornada de 42 h semanales (Ley 2101 de 2021);
  - salario promedio de oficial de obra (Indeed; Computrabajo da un valor parecido).
- **Agua:** EMCALI, tarifa Temporal para obras (julio de 2026).
- **Contraste oficial:**
  - Gobernación del Valle 2024 (Decreto 1.22-1441);
  - Alcaldía de Cali 2026 (Resolución 4151.010.21.1.84), de donde también salen los porcentajes de AIU;
  - EMCALI 2025.

Cada precio, con su enlace, está en [`docs/precios-y-fuentes.md`](docs/precios-y-fuentes.md).

Son **precios de referencia**. El valor exacto de una obra sale de sus cotizaciones: en la pestaña Precios se escribe lo que cobra el depósito o el maestro, y el presupuesto se recalcula con esos valores.

Para actualizar un precio de referencia:

1. Editar `backend/src/datos/precios.js` (precio, enlace y fecha).
2. Correr `npm test` y `npm run docs`.

Los precios de referencia con más de 90 días se marcan en la aplicación para confirmarlos.

## Alcance y limitaciones

- **Qué calcula:** obra gris de un piso con acabados básicos. No calcula por su cuenta techos, escaleras, redes eléctricas, pintura, carpintería ni más de un piso; si se piden, lo avisa, y esos ítems se pueden agregar desde la lista oficial de la Gobernación con su precio oficial.
- **Lista oficial:** es de 2024 y se transcribió con OCR; los valores marcados "por verificar" conviene confirmarlos en la página indicada del PDF. Los ítems con precio oficial no tienen composición publicada, y su rendimiento para el cronograma es de referencia.
- **Precios:** son de tiendas grandes, no cotizaciones de depósitos locales. El alquiler de equipos es de Bogotá y Medellín, porque no hay tarifa publicada en Cali.
- **Por revisar:** la viga de cimentación sale 87 % por encima de la referencia de la Gobernación y la zapata 26 %. En la viga, la mitad del costo es mano de obra (3 horas-hombre por metro), y la formaleta de EMCALI ya incluye su instalación. En la zapata pesa la arena, que en la fuente cuesta casi 3 veces lo que el triturado. Conviene revisar esas composiciones con un ingeniero; mientras tanto, la aplicación marca las diferencias y deja usar la referencia oficial o una cotización.
- **Cronograma:** cada actividad la hace una cuadrilla de un oficial con uno o dos ayudantes (según el APU). No descuenta festivos.
- **IA:** la descripción se envía a Gemini (Google) cuando hay clave configurada, y la aplicación lo avisa en pantalla. La capa gratuita tiene límites de uso; si se agotan, la herramienta sigue con reglas.
- **Obras guardadas:** se guardan en un archivo JSON, que alcanza para un prototipo. Para varios usuarios se cambia el repositorio por una base de datos.
