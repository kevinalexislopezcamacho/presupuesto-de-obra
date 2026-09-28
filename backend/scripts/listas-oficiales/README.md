# Cómo se transcribió la lista oficial de la Gobernación del Valle 2024

El listado de precios del Decreto 1.22-1441 del 14 de agosto de 2024 solo está publicado como PDF escaneado
([PDF](https://cdnm.heyzine.com/files/uploaded/6974b64a5ee54ea4f0181b50808c40b0d7260a79.pdf),
[publicación](https://www.valledelcauca.gov.co/publicaciones/83513/listo-el-decreto-con-el-listado-de-precios-de-referencia-para-obras-civiles-en-el-valle-del-cauca/)).
Estos scripts lo convierten en `src/datos/listas-oficiales/gobernacion-valle-2024.json`. Se corren una sola vez, en Windows.

1. **Imágenes.** Extraer la imagen de cada página del PDF (pypdf) y ampliarla al doble. Hacer una copia en blanco y negro
   (umbral 125) para quitar la sombra del reverso de la hoja, y copias ampliadas de las columnas de unidad y valor.
   Carpetas: `gob/` (gris), `gobb/` (blanco y negro), `gob-col/` y `gobb-col/` (columnas).
2. **OCR.** `ocr.ps1 -Carpeta <carpeta>` lee cada imagen con el OCR de Windows (español) y guarda cada palabra con su posición.
3. **Listado 2019.** Descargar el listado 2019 de la Gobernación de datos.gov.co (conjunto `e839-6uct`) como `gob-2019.json`.
4. **Transcripción.** `python transcribir.py <carpeta> <salida.json>`:
   - **Inclinación.** En muchas páginas el escaneo está torcido y la columna de valores queda hasta media fila más arriba
     o más abajo que la de códigos. La inclinación se mide en las líneas de texto de cada página, y con ella se alinean en
     orden los códigos con los valores (sin cruces; un código puede quedar sin valor). Con esas parejas se ajusta el
     desfase según la altura, que se usa también para las unidades y las descripciones.
   - **Cuatro lecturas por ítem** (gris y blanco y negro; página completa y columnas ampliadas). Si una lectura es el
     comienzo de otra más larga ("108" y "108307"), el OCR cortó el número y vale la larga.
   - **Valor verificado** = al menos dos lecturas dan el mismo número, ninguna da otro y el precio es creíble frente al
     del mismo código en 2019 (entre 0,7 y 3 veces). Los demás quedan "por verificar", con la página del PDF para revisarlos.
   - La página 3 del PDF tiene la columna de valores cortada en el escaneo: esos ítems quedan marcados.
   - **Unidad:** la leída en el PDF; si el OCR no la leyó, la del mismo código en el listado 2019, solo si la descripción
     también se parece.

Resultado: 3.506 ítems con valor en 314 capítulos, 3.081 verificados; 85 sin unidad. Los 24 precios oficiales tomados
a mano del PDF coinciden exactamente con la transcripción (lo revisa una prueba automática), y una muestra al azar de
16 ítems verificados, comparada con la imagen de su fila, también coincide.
