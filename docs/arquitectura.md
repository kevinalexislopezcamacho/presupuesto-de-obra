# Arquitectura

La aplicación tiene dos partes separadas que se comunican por una API REST en JSON:

- **Backend:** Node.js con Express. Tiene toda la lógica: datos de precios, APU, cálculos, el intérprete con el modelo de aprendizaje automático y las obras guardadas.
- **Frontend:** HTML, CSS y JavaScript con módulos del navegador, sin frameworks. Solo muestra datos y recoge lo que escribe la persona.

```
 Navegador (frontend)                         Servidor (backend)
┌───────────────────────────┐   HTTP/JSON   ┌───────────────────────────────────────────┐
│ eventos → estado → render │ ────────────▶ │ rutas → validación → controladores         │
│        vistas (HTML)      │ ◀──────────── │            → servicios → dominio → datos   │
│        api/cliente.js     │               │            → repositorio (obras.json)      │
└───────────────────────────┘               └───────────────────────────────────────────┘
```

## Backend (`backend/src`)

El backend está organizado en capas. Cada capa solo usa las que están debajo de ella.

| Capa | Carpeta | Responsabilidad |
|---|---|---|
| Entrada | `servidor.js`, `app.js` | Arrancar el servidor y armar Express: middlewares, rutas, archivos estáticos y errores |
| Rutas | `rutas/` | Qué URL llama a qué controlador y con qué validación |
| Validación | `validacion/`, `middlewares/validar.js` | Revisar el cuerpo de cada petición; si no sirve, responder 400 con un mensaje claro |
| Controladores | `controladores/` | Recibir la petición validada, llamar al servicio y responder. No tienen lógica |
| Servicios | `servicios/` | Casos de uso: calcular una obra (capítulos, APU, memoria de cantidades), interpretar texto, armar el catálogo, guardar obras, buscar en la lista oficial de la Gobernación y generar el Excel |
| Dominio | `dominio/` | Reglas del negocio con funciones puras (sin HTTP ni archivos): APU, actividades, materiales, presupuesto, cronograma, clasificador Naive Bayes e intérprete |
| IA | `ia/` | `gemini.js` habla con la API de Gemini (tiempo máximo, un reintento, errores en español); `instrucciones.js` arma el prompt y los esquemas JSON con los mismos datos de la herramienta; `verificar.js` revisa la respuesta antes de usarla |
| Datos | `datos/` | Conocimiento fijo: precios con fuente, APU (propios y con precio oficial), capítulos, supuestos, tipos de obra, vocabulario, frases de entrenamiento, referencias oficiales y la lista oficial de la Gobernación 2024 transcrita (`listas-oficiales/`) |
| Repositorio | `repositorios/` | Guardar y leer obras en un archivo JSON. Para usar una base de datos se cambia solo esta clase |
| Transversal | `middlewares/`, `utilidades/`, `config/` | Seguridad y CORS, registro de peticiones, errores HTTP y configuración por variables de entorno |

### Decisiones

- **Funciones puras en el dominio.** Se prueban sin servidor y dan el mismo resultado cada vez.
- **El servidor limpia la obra antes de calcular** (`servicios/obra-entrada.js`). El cliente puede mandar datos incompletos o mal formados y los cálculos nunca reciben basura.
- **El modelo se entrena una vez al arrancar** (`dominio/texto/modelo.js`). Con 150 frases toma milisegundos. Su evaluación honesta (validación cruzada) queda disponible en `/api/diagnostico`.
- **"Mis obras" se guarda en el navegador** (`js/estado/historial.js`, almacenamiento local). Cada dispositivo tiene sus obras sin inicio de sesión y la herramienta funciona publicada en un servicio sin disco permanente. El resumen de cada obra (total, días, avance) lo calcula el servidor al guardarla, con los mismos cálculos del presupuesto. La API `/api/obras` y su repositorio JSON siguen disponibles, pero la interfaz ya no los usa (solo copia una vez, en `localhost`, las obras que había guardadas ahí).
- **Inyección de dependencias en `crearApp(config, { ia })`.** Las pruebas levantan la API con un archivo de obras temporal y una IA de prueba, sin tocar los datos reales ni gastar cuota.
- **La IA entiende, la herramienta calcula.** Gemini solo convierte el texto en datos con un esquema JSON fijo. `ia/verificar.js` descarta cualquier número que no esté en lo que escribió la persona, y cualquier tipo, actividad o insumo que no exista. Las cantidades de los trabajos y las conversiones de unidades salen de las fórmulas de la herramienta. Así la IA puede equivocarse, pero no puede cambiar lo que la persona escribió ni inventar precios.
- **Siempre hay respuesta.** Si no hay clave, la IA tarda más de `IA_TIEMPO_MAXIMO_MS`, falla o no encuentra nada, se usa el intérprete por reglas y se avisa (`motor`, `avisoIA`). Las respuestas de la IA se guardan en memoria por texto: la misma frase no se pregunta dos veces.
- **La clave de la IA vive solo en el servidor** (`backend/.env`). El diagnóstico dice si la IA está activa, pero nunca expone la clave.
- **Precios de referencia y precios propios.** La base trae precios de referencia con fuente y fecha. Cada obra puede reemplazarlos por cotizaciones (`precios` por insumo, `preciosActividad` por actividad), y el cálculo usa esos valores en todo: presupuesto, compras y lo que falta por invertir.
- **APU propios y precios oficiales.** Las actividades con composición conocida tienen su APU (insumos × precios de Cali). Las de preliminares, movimiento de tierra y demoliciones usan el precio oficial de la Gobernación 2024, porque la entidad publica el valor pero no su composición; así no se inventan coeficientes.
- **Lo que depende de otra actividad se deriva.** La excavación, el solado, el relleno y el retiro de sobrantes salen de la viga de cimentación y las zapatas que quedan en la obra; si se quitan (por ejemplo, en una remodelación), desaparecen también.
- **Puertas y ventanas con su forma** (`dominio/huecos.js`). El área de cada hueco (rectangular, en arco de medio punto o circular) la calcula el servidor y reemplaza a las típicas del tipo de obra; en un baño, cocina o cuarto se conservan las típicas que la persona no nombró. La hoja de la puerta o ventana no se calcula: va como ítem cotizado o de la lista oficial.
- **Ítems cotizados.** Lo que no está en la base ni en la lista oficial entra con el precio de una cotización y su fuente. No se inventa un APU: el costo es el cotizado y queda marcado así en pantalla, en el PDF y en el Excel.
- **El repositorio no se bloquea.** Si una escritura del archivo de obras falla, se deshace el cambio en memoria y las siguientes escrituras se intentan normalmente.
- **Express 5.** Los errores de los controladores asíncronos llegan solos al manejador central de errores.
- **Publicación en Vercel.** `index.js` (en la raíz) exporta la aplicación que arma `crearApp`, sin archivos estáticos; la página está en `public/`, la carpeta que entrega la red de Vercel. El mismo código corre en el computador con `npm start` desde `backend/`, que entrega esa misma carpeta.

## Frontend (`public/`)

| Carpeta o archivo | Responsabilidad |
|---|---|
| `index.html` | Estructura fija de la página: barra, contenedor principal y pie |
| `css/` | `base.css` (colores claro y oscuro, ancho adaptable por pantalla), `componentes.css` (botones, campos, listas, etiquetas) y `pantallas.css` (estilos de cada paso; en celular, barra inferior fija; en escritorio, resultado en dos columnas) |
| `js/main.js` | Arranque: carga el catálogo, recupera el borrador, registra eventos y dibuja |
| `js/config.js` | Dirección de la API |
| `js/api/cliente.js` | Única parte que habla con el backend |
| `js/estado/` | `estado.js` (una sola fuente de verdad), `catalogo.js` (datos de referencia del backend) e `historial.js` (Mis obras) |
| `js/acciones/` | Cambios que la persona hace sobre la obra y exportación a Excel |
| `js/vistas/` | Una función por pantalla. Solo generan HTML a partir del estado |
| `js/render.js` | Decide qué pantalla dibujar, conserva el foco y pide el cálculo al backend cuando cambia la obra |
| `js/eventos.js` | Traduce clics y cambios en acciones. Cada botón declara lo que hace con un atributo `data-*` |
| `js/utilidades/` | Formato de números y textos, fechas hábiles, Google Maps, portapapeles y tema claro/oscuro |

### Flujo de una acción

1. La persona hace algo, por ejemplo marcar una actividad como hecha.
2. `eventos.js` cambia el `estado`.
3. `render.js` guarda el borrador en el navegador, llama a `POST /api/calculos` y vuelve a dibujar con el resultado.
4. Si llegan dos respuestas en desorden, solo se usa la última.

El frontend no hace cálculos del negocio: los precios, cantidades, días y recomendaciones vienen del backend, y el frontend solo los ordena y los muestra.
