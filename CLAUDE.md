# CLAUDE.md

## Proyecto

SPA en React 18 + Vite que muestra el precio horario de la luz (PVPC) en España, obtenido de la API de REE/ESIOS. Toda la UI y los nombres de funciones/variables están en español; mantener esa convención. La documentación (este fichero, README, comentarios, mensajes de commit y PR) se escribe siempre en español.

## Comandos

```bash
npm install
npm run dev       # servidor de desarrollo Vite
npm run build     # build de producción en ./dist
npm run preview   # sirve el build localmente
npm run lint      # ESLint sobre src/ con --max-warnings 0 (cualquier warning hace fallar el lint)
```

No hay tests ni framework de testing configurado.

## Despliegue

Cada push a `main` dispara `.github/workflows/deploy.yml`, que construye y publica `dist/` en GitHub Pages. Por eso `vite.config.js` fija `base: "/precio-luz/"`; no quitarlo o se rompen las rutas de los assets en Pages.

## Arquitectura

`src/App.jsx` concentra el estado y la carga de datos; `src/utils.js` contiene helpers puros (formato, fechas, periodos, niveles); `src/components/` tiene las piezas visuales: `Controles` (fecha con botones de día anterior/siguiente limitados al rango permitido, zona, unidad; exporta también `Segmentado`, el grupo de botones de opción reutilizable), `SelectorDuracion`, `FranjaHoras` (las 24 barras, protagonista de la página), `TablaHoras` (detalle desplegable).

Flujo de datos:
1. Fecha, zona, unidad y duración se leen de la URL (`?fecha=YYYY-MM-DD&zona=cym&unidad=mwh&duracion=2`) y se reescriben con `history.replaceState`; los valores por defecto (hoy, PCB, kWh, sin duración) no aparecen en la URL.
2. Las peticiones pasan por `cargarDia(fecha)`, una caché en memoria de promesas por día: solo guarda los aciertos (un fallo se borra para poder reintentar, p. ej. mañana antes de publicarse). Tras cargar un día se precargan el anterior y el siguiente. Mientras carga otro día se sigue mostrando el anterior (`datos` guarda `{ fecha, data }`); solo se atenúa si la carga tarda más de 150 ms, y el esqueleto de carga aparece únicamente en la primera carga. Las respuestas de un día que ya no es el elegido se descartan (`vigente`).
3. `pedirDatos(fecha)` llama a `https://api.esios.ree.es/archives/70/download_json?date=YYYY-MM-DD` (API key en la cabecera `x-api-key`, embebida en el cliente) y normaliza `data.PVPC` a `{ Hora: "HH:00", PCB, CYM }`. Los precios llegan como strings con formato español (`"123,45"`) y se convierten con `StringToNumerLocale`. Algunos días antiguos traen solo `GEN` en lugar de `PCB`/`CYM`, de ahí el fallback.
4. Para días sin publicar (p. ej. mañana antes de ~20:15, hora a la que Red Eléctrica publica el PVPC del día siguiente) la API responde **HTTP 200** con `{"message": "No values for specified archive"}`; se detecta y se lanza `SinDatos`. `estado` puede ser `cargando`, `ok`, `sin-datos` o `error`.
5. Mientras se ve el día de hoy, un segundo efecto comprueba (también vía `cargarDia`) si ya hay precios de mañana; si no, vuelve a mirar a las 20:15 y luego cada 10 minutos. Cuando los hay, aparece el botón «Ver los precios de mañana».
6. Atajos de teclado globales en `App.jsx` (← / → cambian de día, H vuelve a hoy), limitados al mismo rango que el selector. Se ignoran con modificadores o si el foco está en un campo de formulario, porque allí las flechas ya tienen función (fecha, botones de opción). La pista de atajos del pie solo se muestra con puntero fino (`@media (pointer: fine)`).
7. Los precios de la API vienen en €/MWh; para kWh se dividen entre 1000. `formatearPrecio` usa 3 decimales en el resumen y 5 en el detalle para kWh (2 para MWh).

Fechas: usar siempre los helpers de `utils.js` (`hoy`, `manana`, `parseISO` de date-fns). `new Date("YYYY-MM-DD")` y `toISOString()` trabajan en UTC y desplazan el día.

Los días de cambio de hora tienen 23 o 25 horas: no asumir 24 elementos (por eso las listas usan el índice como `key` y la franja calcula sus columnas con `precios.length`).

Conceptos de dominio:
- **Zona**: `PCB` = Península, Canarias y Baleares; `CYM` = Ceuta y Melilla.
- **Periodos de peaje** (`periodoPeaje`): valle/llano/punta según hora, día de la semana (fin de semana = todo valle) y zona; CYM tiene un reparto de horas distinto. No contempla festivos nacionales.
- **Nivel de precio** (`nivelesPrecio`): divide el rango min–max del día en tercios (bajo/medio/alto); colorea las barras.
- **Tramo más barato** (`tramoMasBarato`): parte de la hora más barata y se extiende mientras las horas vecinas no superen el mínimo + 15 % del rango del día; es el titular de la página. El umbral se eligió comparando con datos reales (resultados estables entre 10 % y 20 %).
- **Mejor bloque** (`mejorBloque`): para la duración elegida en el selector (1, 2, 3, 4, 6 u 8 h), las horas seguidas con menor precio medio; en empate, el primero. Se marca con un corchete sobre las barras. No cruza la medianoche.
- Puede haber **precios negativos** (p. ej. 12/10/2026); las barras los recortan a 0.

## Diseño

Tokens en `tailwind.config.js`: colores `papel`, `tinta`, `suave`, `linea` y `barato`/`medio`/`caro` (solo para el nivel de precio; cada uno con una variante `-intenso`, más oscura, para la barra seleccionada); tipografías Barlow (`font-sans`) y Barlow Semi Condensed (`font-display`, cifras y titulares), cargadas desde Google Fonts en `index.html`. No hay librería de componentes: todo es Tailwind sobre HTML semántico.
