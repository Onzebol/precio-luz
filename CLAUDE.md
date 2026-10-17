# CLAUDE.md

## Proyecto

SPA en React 18 + Vite que muestra el precio horario de la luz (PVPC) en España. Los precios se descargan de la API de REE/ESIOS con un workflow programado y se publican como JSON estáticos junto a la web; el navegador no llama a ESIOS. Toda la UI y los nombres de funciones/variables están en español; mantener esa convención. La documentación (este fichero, README, comentarios, mensajes de commit y PR) se escribe siempre en español.

## Comandos

```bash
npm install
npm run dev       # servidor de desarrollo Vite
npm run build     # build de producción en ./dist
npm run preview   # sirve el build localmente
npm run lint      # ESLint sobre src/ con --max-warnings 0 (cualquier warning hace fallar el lint)
npm run datos     # descarga los precios que falten a public/datos (requiere la variable ESIOS_API_KEY)
npm run datos:resumen  # solo regenera public/datos/resumen.json (sin API key)
```

No hay tests ni framework de testing configurado.

Versiones principales: Vite 8 (requiere Node 20.19+ o 22.12+; CI usa Node 24), React 18.3 (se probó React 19: funciona, pero añade ~79 kB al bundle sin aportar nada que se use), Tailwind 3, date-fns 4. ESLint usa configuración plana en `eslint.config.js`; está en ESLint 9 porque `eslint-plugin-react` aún no admite ESLint 10. `react-hooks` 7 incluye las reglas del React Compiler (p. ej. `set-state-in-effect`).

## Despliegue

`.github/workflows/deploy.yml` construye y publica `dist/` en GitHub Pages. Por eso `vite.config.js` fija `base: "/precio-luz/"`; no quitarlo o se rompen las rutas de los assets en Pages.

El workflow se dispara con cada push a `main`, a mano (`workflow_dispatch`) y de forma programada (cron en UTC: cada 30 min de 18:20 a 20:50, que cubre de ~20:20 a ~22:50 en verano y de 19:20 a 21:50 en invierno, más una repesca a las 6:30). En cada ejecución:
1. `npm run datos` descarga de ESIOS los días nuevos con el secret `ESIOS_API_KEY`. En un push, si falla, se despliega igualmente (`continue-on-error`).
2. Si hay cambios en `public/datos`, los commitea como `github-actions[bot]` («Precios actualizados») y hace push. Ese push, hecho con `GITHUB_TOKEN`, no dispara otro workflow, así que el despliegue ocurre en la misma ejecución.
3. Construye y despliega; las ejecuciones programadas solo lo hacen si hubo precios nuevos.

`concurrency` impide dos ejecuciones a la vez. GitHub desactiva los workflows programados tras 60 días sin actividad en el repositorio.

## Arquitectura

`src/App.jsx` concentra el estado y la carga de datos; `scripts/actualizar-datos.js` (Node, sin dependencias salvo `StringToNumerLocale` de `src/utils.js`) descarga y normaliza los precios; `src/utils.js` contiene helpers puros (formato, fechas, periodos, niveles); `src/components/` tiene las piezas visuales: `Controles` (fecha con botones de día anterior/siguiente limitados al rango permitido, zona, unidad; exporta también `Segmentado`, el grupo de botones de opción reutilizable), `SelectorDuracion`, `FranjaHoras` (las 24 barras, protagonista de la página), `TablaHoras` (detalle desplegable) e `Historico` (vista de histórico, #9; lee `datos/resumen.json` y por ahora muestra una tabla por año, con los cambios regulatorios intercalados, y la sección «Antes de comparar»). `src/hitos.js` guarda esos cambios regulatorios (`HITOS`: fecha, `hasta` y `tituloFin` si fue temporal, explicación y norma en el BOE); `CAMBIOS` y `cambiosEntre(desde, hasta)` dan los días en que cambia la definición del precio, para marcarlos en el histórico y avisar en las comparativas.

Hay dos vistas, `dia` e `historico`, sin router: el parámetro `vista` de la URL decide cuál se pinta en `main`. Los enlaces de la cabecera son `<a href>` de verdad (se pueden abrir en otra pestaña) y el clic normal cambia de vista sin recargar. Cambiar de vista hace `pushState` (para que «Atrás» funcione, con un listener de `popstate` que vuelve a leer la URL); el resto de cambios, `replaceState`. `Historico` se carga con `React.lazy` en su propio chunk para no engordar la vista de día. Zona y unidad son comunes a las dos vistas; en el histórico `Controles` se usa sin `onFecha` y oculta el selector de día. El estado y las cargas de la vista de día siguen en `App.jsx` aunque se esté en el histórico (el día ya cargado no se pierde al volver).

Flujo de datos:
1. Vista, fecha, zona, unidad y duración se leen de la URL (`?vista=historico&fecha=YYYY-MM-DD&zona=cym&unidad=mwh&duracion=2`) y se reescriben con `history.replaceState` (`pushState` si cambia la vista); los valores por defecto (vista de día, hoy, PCB, kWh, sin duración) no aparecen en la URL.
2. Las peticiones pasan por `cargarDia(fecha)`, una caché en memoria de promesas por día: solo guarda los aciertos (un fallo se borra para poder reintentar, p. ej. mañana antes de publicarse). Tras cargar un día se precargan el anterior y el siguiente. Mientras carga otro día se sigue mostrando el anterior (`datos` guarda `{ fecha, data }`); solo se atenúa si la carga tarda más de 150 ms, y el esqueleto de carga aparece únicamente en la primera carga. Las respuestas de un día que ya no es el elegido se descartan (`vigente`).
3. Datos: `scripts/actualizar-datos.js` llama a `https://api.esios.ree.es/archives/70/download_json?date=YYYY-MM-DD` (API key en la cabecera `x-api-key`, leída de `ESIOS_API_KEY`) y normaliza `data.PVPC` a `{ Hora: "HH:00", PCB, CYM }`. Los precios llegan como strings con formato español (`"123,45"`) y se convierten con `StringToNumerLocale`. Algunos días antiguos traen solo `GEN` en lugar de `PCB`/`CYM`, de ahí el fallback. Para días sin publicar (p. ej. mañana antes de ~20:15, hora a la que Red Eléctrica publica el PVPC del día siguiente) la API responde **HTTP 200** con `{"message": "No values for specified archive"}`. Se guarda en `public/datos/AAAA/MM.json` (`{ "AAAA-MM-DD": [...] }`, un día por línea para que los diffs sean pequeños); Vite lo copia tal cual a `dist/datos/`. Sin `--desde`, empieza en el día siguiente al último guardado, así que un hueco en medio no se vuelve a pedir solo. El primer día con datos en ESIOS es el 01/04/2014 (`FECHA_MINIMA`, en la web y en el script). Al final de cada ejecución (o solo eso, con `--solo-resumen`) se regenera entero `public/datos/resumen.json`, para el histórico (#9): `dias` (por fecha, `[media, mín, máx, horaMín, horaMáx]` de PCB seguido de lo mismo para CYM) y `perfiles` (por mes y zona, precio medio de cada hora del reloj). En los días de 25 horas la API numera las horas seguidas de `00:00` a `24:00` (las posiciones 2 y 3 son las dos 02:00), mientras que en los de 23 horas ya se salta `02:00`; `horaReloj` lo traduce. `leerMeses` solo recorre carpetas de año para no tropezar con `resumen.json`.
4. En la web, `pedirDatos(fecha)` lee el día del fichero de su mes (`pedirMes`, con `cache: "no-cache"` para revalidar con el servidor; Pages cachea 10 min). Los meses se guardan como promesas en `meses`; si el día no está en el fichero se olvida el mes, para volver a pedirlo (mañana se publica más tarde en el mismo mes), y se lanza `SinDatos`. Un mes sin fichero (404 en Pages; en `vite dev`/`preview` llega `index.html` con 200, por eso se mira el `content-type`) cuenta como vacío. `estado` (`cargando`, `ok`, `sin-datos` o `error`) no se guarda: se deriva de `resultado`, la última carga terminada, comparando su fecha e intento con los actuales. Así el efecto no llama a `setState` de forma síncrona, que la regla `react-hooks/set-state-in-effect` prohíbe.
5. Mientras se ve el día de hoy, un segundo efecto comprueba (también vía `cargarDia`) si ya hay precios de mañana en los ficheros; si no, vuelve a mirar a las 20:15 y luego cada 10 minutos (los datos llegan cuando el workflow programado los publica, unos minutos después que en ESIOS). Cuando los hay, aparece el botón «Ver los precios de mañana».
6. Atajos de teclado globales en `App.jsx` (← / → cambian de día, H vuelve a hoy), solo en la vista de día y limitados al mismo rango que el selector. Se ignoran con modificadores o si el foco está en un campo de formulario, porque allí las flechas ya tienen función (fecha, botones de opción). La pista de atajos del pie solo se muestra con puntero fino (`@media (pointer: fine)`).
7. Los precios de la API vienen en €/MWh; para kWh se dividen entre 1000. `formatearPrecio` usa 3 decimales en el resumen y 5 en el detalle para kWh (2 para MWh).

Fechas: usar siempre los helpers de `utils.js` (`hoy`, `manana`, `parseISO` de date-fns). `new Date("YYYY-MM-DD")` y `toISOString()` trabajan en UTC y desplazan el día.

Los días de cambio de hora tienen 23 o 25 horas: no asumir 24 elementos (por eso las listas usan el índice como `key` y la franja calcula sus columnas con `precios.length`).

Conceptos de dominio:
- **Zona**: `PCB` = Península, Canarias y Baleares; `CYM` = Ceuta y Melilla.
- **Periodos de peaje** (`periodoPeaje`): valle/llano/punta según hora, día de la semana (fin de semana = todo valle) y zona; CYM tiene un reparto de horas distinto. No contempla festivos nacionales. Solo existen desde la tarifa 2.0TD (`INICIO_2_0TD`, 01/06/2021): antes `periodoPeaje` devuelve `null` y `hayPeriodos(fecha)` es falso, así que `FranjaHoras` no pinta la banda de periodos y `TablaHoras` oculta la columna.
- **Nivel de precio** (`nivelesPrecio`): divide el rango min–max del día en tercios (bajo/medio/alto); colorea las barras.
- **Tramo más barato** (`tramoMasBarato`): parte de la hora más barata y se extiende mientras las horas vecinas no superen el mínimo + 15 % del rango del día; es el titular de la página. El umbral se eligió comparando con datos reales (resultados estables entre 10 % y 20 %).
- **Mejor bloque** (`mejorBloque`): para la duración elegida en el selector (1, 2, 3, 4, 6 u 8 h), las horas seguidas con menor precio medio; en empate, el primero. Se marca con un corchete sobre las barras. No cruza la medianoche.
- **El precio no es homogéneo en el tiempo** (ver `src/hitos.js`): hasta el 31/05/2021 es la tarifa 2.0A (sin periodos; `PCB` = `CYM`), desde el 01/06/2021 la 2.0TD; del 15/06/2022 al 31/12/2023 incluye el coste de la excepción ibérica; desde 2024 se indexa en parte a futuros (25/40/55 %). Siempre sin impuestos y en euros corrientes.
- Puede haber **precios negativos** (p. ej. 12/10/2026); las barras los recortan a 0.

## PWA

`vite-plugin-pwa` (configurado en `vite.config.js`) genera el manifiesto, el service worker (Workbox, `registerType: "autoUpdate"`) y lo registra solo. Estrategias de caché:
- Recursos de la app: precacheados en cada build.
- Ficheros de precios (`/precio-luz/datos/`): `NetworkFirst` (red con 5 s de espera; la copia guardada solo se usa sin conexión). No entran en el precache (Workbox solo precachea js, css y html por defecto).
- Google Fonts: `StaleWhileRevalidate` para el CSS y `CacheFirst` para las fuentes.

El service worker no se activa con `npm run dev`; para probarlo: `npm run build && npx vite preview`. Los iconos (`public/pwa-*.png`, `maskable-512x512.png`, `apple-touch-icon.png`) se generaron a partir del rayo de `favicon.svg`; la versión *maskable* tiene fondo completo y el rayo dentro de la zona segura.

## Diseño

Tokens en `tailwind.config.js`: colores `papel`, `tinta`, `suave`, `linea` y `barato`/`medio`/`caro` (solo para el nivel de precio; cada uno con una variante `-intenso`, más oscura, para la barra seleccionada); tipografías Barlow (`font-sans`) y Barlow Semi Condensed (`font-display`, cifras y titulares), cargadas desde Google Fonts en `index.html`. No hay librería de componentes: todo es Tailwind sobre HTML semántico.
