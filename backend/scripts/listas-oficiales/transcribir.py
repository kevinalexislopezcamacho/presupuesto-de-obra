"""Transcribe el listado de la Gobernación del Valle 2024 desde el OCR (palabras con posición) a JSON.

Entradas (ver README.md): carpetas gob/ (gris) y gobb/ (blanco y negro) con p###.png y p###.tsv del OCR,
gob-col/ y gobb-col/ con las columnas de unidad (u) y valor (v) ampliadas al doble, y gob-2019.json (datos.gov.co).
Uso: python transcribir.py <carpeta con todo lo anterior> <salida.json>

Cómo evita errores:
- El escaneo está inclinado en muchas páginas: la columna de valores queda hasta media fila más arriba o más abajo
  que la de códigos. La inclinación se mide en las líneas de texto de las descripciones (pendiente mediana), y con
  ese desfase esperado se alinean en orden los códigos con los valores (programación dinámica: cada código con una
  línea, sin cruces, pudiendo saltar un código sin valor o una línea que no es valor). Con las parejas alineadas se
  ajusta una recta del desfase según la altura, que se usa para asignar unidades y descripciones.
- Cada ítem se lee cuatro veces (gris y blanco/negro; página completa y columnas ampliadas). Si una lectura es el
  comienzo de otra más larga ("108" y "108307"), el OCR cortó el número y vale la larga. Valor verificado = al menos
  dos lecturas iguales y ninguna distinta, y un precio creíble frente al del mismo código en 2019 (razón 0,7 a 3,0).
"""
import collections, difflib, glob, json, os, re, statistics, sys, unicodedata
from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")
BASE, SALIDA = sys.argv[1], sys.argv[2]
UNIDADES = {"UND", "UN", "M", "M2", "M3", "ML", "KG", "GL", "PUNTO", "SALIDA", "LB", "LT", "DIA", "MES", "HR", "HORA", "TON", "JGO", "PAR", "VIAJE", "KM", "M3-KM", "SEM"}
SINONIMOS = {"MZ": "M2", "M²": "M2", "M³": "M3", "UNO": "UND", "UNID": "UND", "IJND": "UND", "LIND": "UND", "UN": "UND",
             "PTO": "PUNTO", "KLS": "KG", "M3K": "M3-KM", "VJE": "VIAJE", "HRS": "HORA", "LBS": "LB", "M/K": "M3-KM"}
COL_CODIGO, COL_UNIDAD, COL_VALOR = 0.05, 0.73, 0.90      # posición horizontal típica de cada columna (fracción del ancho)


def leer(tsv, escala=1.0):
    if not os.path.exists(tsv): return []
    out = []
    for linea in open(tsv, encoding="utf-8-sig"):
        x, y, w, h, t = linea.rstrip("\n").split("\t", 4)
        out.append({"x": int(x) / escala, "cy": (int(y) + int(h) / 2) / escala, "t": t.strip()})
    return out


def lineas_de(tokens, tolerancia=12):
    """Agrupa tokens de una misma línea visual (sin mezclar filas)."""
    tokens = sorted(tokens, key=lambda p: p["cy"])
    grupos, actual = [], []
    for p in tokens:
        if actual and abs(p["cy"] - statistics.mean(q["cy"] for q in actual)) > tolerancia: grupos.append(actual); actual = []
        actual.append(p)
    if actual: grupos.append(actual)
    return [{"cy": statistics.mean(p["cy"] for p in g), "tokens": sorted(g, key=lambda p: p["x"])} for g in grupos]


def valor_de(tokens):
    digitos = "".join(re.sub(r"\D", "", p["t"].replace("O", "0").replace("o", "0")) for p in tokens if re.search(r"\d", p["t"]))
    return int(digitos) if digitos else None


def unidad_de(tokens):
    for p in tokens:
        t = p["t"].upper().strip(".,;:|[]()")
        t = SINONIMOS.get(t, t)
        if t in UNIDADES: return t
    return None


SALTO = 30          # costo de dejar un código sin valor, o un valor sin código (encabezados, números de página)
LEJOS = 45          # un emparejamiento a más de esta distancia vertical no se permite


def alinear(filas_y, lineas, desfase=lambda y: 0.0):
    """Empareja códigos y líneas EN ORDEN de arriba abajo (programación dinámica, como un alineamiento de secuencias).
    El orden resuelve lo que la distancia sola no puede: cuando la página está inclinada media fila, el valor queda a
    la misma distancia del código propio y del vecino, pero solo uno de los dos respeta el orden de la tabla."""
    n, m = len(filas_y), len(lineas)
    INF = float("inf")
    costo = [[INF] * (m + 1) for _ in range(n + 1)]
    paso = [[None] * (m + 1) for _ in range(n + 1)]
    costo[0][0] = 0
    for i in range(n + 1):
        for j in range(m + 1):
            if i == 0 and j == 0: continue
            opciones = []
            if i > 0 and j > 0:
                d = abs(lineas[j - 1]["cy"] - filas_y[i - 1] - desfase(filas_y[i - 1]))
                if d < LEJOS: opciones.append((costo[i - 1][j - 1] + d, "par"))
            if i > 0: opciones.append((costo[i - 1][j] + SALTO, "codigo"))
            if j > 0: opciones.append((costo[i][j - 1] + SALTO, "linea"))
            costo[i][j], paso[i][j] = min(opciones)
    pares, i, j = {}, n, m
    while i > 0 or j > 0:
        p = paso[i][j]
        if p == "par": pares[filas_y[i - 1]] = lineas[j - 1]; i -= 1; j -= 1
        elif p == "codigo": i -= 1
        else: j -= 1
    return pares


def pendiente_de(palabras, W):
    """Inclinación de la página: cuánto baja el texto por cada píxel hacia la derecha, medida en las descripciones
    (líneas largas de varias palabras). Con ella se sabe hacia dónde se corren las columnas de la derecha."""
    pendientes = []
    for linea in lineas_de([p for p in palabras if 0.10 * W < p["x"] < 0.66 * W], 10):
        t = linea["tokens"]
        if len(t) >= 3 and t[-1]["x"] - t[0]["x"] > 0.2 * W:
            xs, ys = [p["x"] for p in t], [p["cy"] for p in t]
            mx, my = statistics.mean(xs), statistics.mean(ys)
            var = sum((x - mx) ** 2 for x in xs)
            if var: pendientes.append(sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / var)
    return statistics.median(pendientes) if len(pendientes) >= 3 else 0.0


def recta_desfase(pares):
    """Desfase (línea − código) según la altura, ajustado con los pares ya alineados: d(y) = a + b·y."""
    puntos = [(c, li["cy"] - c) for c, li in pares.items()]
    if len(puntos) < 4: return lambda y: 0.0
    xs, ds = [p[0] for p in puntos], [p[1] for p in puntos]
    mx, md = statistics.mean(xs), statistics.mean(ds)
    var = sum((x - mx) ** 2 for x in xs)
    b = sum((x - mx) * (d - md) for x, d in zip(xs, ds)) / var if var else 0.0
    a = md - b * mx
    return lambda y: a + b * y


def lecturas(carpeta):
    items, capitulos = {}, {}
    for tsv in sorted(glob.glob(os.path.join(carpeta, "p*.tsv"))):
        base = os.path.basename(tsv)[:-4]
        W = Image.open(tsv.replace(".tsv", ".png")).width
        palabras = leer(tsv)
        codigos = [p for p in palabras if p["x"] < 0.10 * W and re.fullmatch(r"\d{4}|\d{6}", p["t"])]
        if not codigos: continue
        codigos.sort(key=lambda p: p["cy"])
        filas_y = [p["cy"] for p in codigos]
        items_y = [p["cy"] for p in codigos if len(p["t"]) == 6]      # los encabezados de capítulo no tienen valor
        # Valores: de la página y de la columna ampliada; unidades igual.
        val_p = lineas_de([p for p in palabras if p["x"] > 0.80 * W and re.fullmatch(r"\$?[\dOo.,]+", p["t"]) and re.search(r"\d", p["t"])])
        val_c = lineas_de([p for p in leer(os.path.join(carpeta + "-col", base + "v.tsv"), 2) if re.fullmatch(r"\$?[\dOo.,]+", p["t"]) and re.search(r"\d", p["t"])])
        uni_p = [l for l in lineas_de([p for p in palabras if 0.66 * W < p["x"] < 0.84 * W]) if unidad_de(l["tokens"])]
        uni_c = [l for l in lineas_de(leer(os.path.join(carpeta + "-col", base + "u.tsv"), 2)) if unidad_de(l["tokens"])]
        # 1) La inclinación medida en el texto dice cuánto (y hacia dónde) se corre la columna de valores;
        # 2) se alinea en orden con ese desfase; 3) con los pares, se afina la recta y se alinea otra vez.
        pendiente = pendiente_de(palabras, W)
        esperado = pendiente * (COL_VALOR - COL_CODIGO) * W
        base_valores = val_p if len(val_p) >= len(val_c) else val_c
        desfase = recta_desfase(alinear(items_y, base_valores, lambda y: esperado))
        frac_u = (COL_UNIDAD - COL_CODIGO) / (COL_VALOR - COL_CODIGO)     # la columna de unidad se corre menos
        asig = {"vp": alinear(items_y, val_p, desfase), "vc": alinear(items_y, val_c, desfase),
                "up": alinear(items_y, uni_p, lambda y: desfase(y) * frac_u), "uc": alinear(items_y, uni_c, lambda y: desfase(y) * frac_u)}
        # Descripción: palabras entre el código y la unidad; tan a la izquierda casi no se corren.
        texto = lineas_de([p for p in palabras if 0.10 * W < p["x"] < 0.66 * W], 18)
        asig_t = alinear(filas_y, texto, lambda y: desfase(y) * 0.3)
        for p in codigos:
            c = p["cy"]
            actividad = " ".join(t["t"] for t in asig_t[c]["tokens"]) if c in asig_t else ""
            if len(p["t"]) == 4:
                capitulos[p["t"]] = actividad; continue
            items[p["t"]] = {
                "actividad": actividad, "pagina": int(base[1:]),
                "valores": [v for v in (valor_de(asig["vp"][c]["tokens"]) if c in asig["vp"] else None,
                                        valor_de(asig["vc"][c]["tokens"]) if c in asig["vc"] else None) if v],
                "unidades": [u for u in (unidad_de(asig["uc"][c]["tokens"]) if c in asig["uc"] else None,
                                         unidad_de(asig["up"][c]["tokens"]) if c in asig["up"] else None) if u]
            }
    return items, capitulos


def limpio(s):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode()).strip().upper()


def rareza(s):
    return len(re.findall(r"[^A-Z0-9 .,:;()/\-\"'x#%=+&\[\]><]", s or ""))


gris, cap_g = lecturas(os.path.join(BASE, "gob"))
bn, cap_b = lecturas(os.path.join(BASE, "gobb"))
d19 = {}
for r in json.load(open(os.path.join(BASE, "gob-2019.json"), encoding="utf-8")):
    c = str(r.get("codigo", "")).strip()
    if re.fullmatch(r"\d{5,6}", c):
        u = r.get("unidad", "").strip().upper()
        valor = int(re.sub(r"\D", "", str(r.get("v_r_unitario", ""))) or 0)
        d19[c.zfill(6)] = {"unidad": SINONIMOS.get(u, u), "actividad": r.get("actividad", ""), "valor": valor}

items = []
for codigo in sorted(set(gris) | set(bn)):
    a, b = gris.get(codigo, {}), bn.get(codigo, {})
    leidos = a.get("valores", []) + b.get("valores", [])
    # Una lectura que es el comienzo de otra más larga ("108" frente a "108307") es un número que el OCR cortó.
    leidos = [max((w for w in leidos if str(w).startswith(str(v))), key=lambda w: len(str(w))) for v in leidos]
    conteo = collections.Counter(leidos)
    valor, votos = conteo.most_common(1)[0] if conteo else (None, 0)
    ref = d19.get(codigo)
    opciones = [x for x in (a.get("actividad"), b.get("actividad")) if x]
    parecido = lambda x: difflib.SequenceMatcher(None, limpio(x), limpio(ref["actividad"])).ratio()
    actividad = max(opciones, key=parecido) if ref and opciones else (min(opciones, key=rareza) if opciones else "")
    leidas = b.get("unidades", []) + a.get("unidades", [])
    if leidas: unidad, origen = collections.Counter(leidas).most_common(1)[0][0], "pdf"
    elif ref and actividad and parecido(actividad) > 0.55: unidad, origen = ref["unidad"], "listado-2019"
    else: unidad, origen = None, None
    pagina = (b or a)["pagina"]
    notas = []
    if pagina == 3: notas.append("El valor está cortado en el PDF escaneado")
    if valor and valor < 100: notas.append("Valor sospechosamente bajo")
    # Verificación independiente: el mismo código en 2019 (cinco años antes) debe tener un precio del mismo orden.
    if valor and ref and ref["valor"] and parecido(actividad) > 0.5 and not (0.7 <= valor / ref["valor"] <= 3.0):
        notas.append(f"Precio poco creíble frente a 2019 (${ref['valor']:,})".replace(",", "."))
    verificado = bool(valor) and votos >= 2 and len(conteo) == 1 and not notas
    items.append({"codigo": codigo, "actividad": limpio(actividad), "unidad": unidad, "unidadDe": origen, "valor": valor,
                  "verificado": verificado, **({"nota": "; ".join(notas)} if notas else {}), "capitulo": codigo[:4], "pagina": pagina})

capitulos = {}
for c in sorted(set(cap_g) | set(cap_b)):
    opciones = [x for x in (cap_g.get(c), cap_b.get(c)) if x]
    if opciones: capitulos[c] = limpio(min(opciones, key=rareza))

datos = {
    "fuente": "Gobernación del Valle del Cauca",
    "documento": "Decreto 1.22-1441 del 14 de agosto de 2024: listado de precios unitarios de referencia para obras civiles",
    "url": "https://cdnm.heyzine.com/files/uploaded/6974b64a5ee54ea4f0181b50808c40b0d7260a79.pdf",
    "publicacion": "https://www.valledelcauca.gov.co/publicaciones/83513/listo-el-decreto-con-el-listado-de-precios-de-referencia-para-obras-civiles-en-el-valle-del-cauca/",
    "metodo": "Transcrito del PDF escaneado con OCR y corrección de la inclinación de cada página. Valor verificado = al menos dos de las cuatro lecturas iguales, ninguna distinta y un precio creíble frente al mismo código en 2019. Unidades que el OCR no leyó: del mismo código en el listado 2019 de datos.gov.co (e839-6uct).",
    "extraido": "2026-09-27",
    "capitulos": capitulos,
    "items": [i for i in items if i["valor"]]
}
json.dump(datos, open(SALIDA, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
it = datos["items"]
print(f"ítems: {len(items)} | con valor: {len(it)} | verificados: {sum(i['verificado'] for i in it)} | sin unidad: {sum(not i['unidad'] for i in it)} | capítulos: {len(capitulos)}")
