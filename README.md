# Precio-luz

Aplicación web que muestra el precio horario de la luz en España (tarifa PVPC) a partir de los datos públicos de Red Eléctrica de España (REE), obtenidos a través de la API de ESIOS.

**Demo:** https://onzebol.github.io/precio-luz/

## Funcionalidades

- Las tres horas seguidas más baratas del día, destacadas al abrir la página.
- Precio de la hora actual, el más bajo, el medio y el más alto del día.
- Selector de duración (1, 2, 3, 4, 6 u 8 horas): indica a qué hora empezar algo que dura ese tiempo (lavadora, lavavajillas, carga del coche…) para pagar el precio medio más bajo, y lo marca en el gráfico.
- Gráfico de barras con el precio de cada hora, coloreado según sea bajo, medio o alto, y con los periodos de peaje (valle, llano y punta).
- Tabla hora a hora con el precio, el nivel y el periodo de cada hora.
- Selección de cualquier día desde el 01/04/2014 (primer día con PVPC publicado) hasta mañana, con el calendario, con los botones de día anterior y día siguiente o con el teclado (<kbd>←</kbd> y <kbd>→</kbd> cambian de día, <kbd>H</kbd> vuelve a hoy). Red Eléctrica publica los precios del día siguiente hacia las 20:15; cuando ya están disponibles, aparece un botón «Ver los precios de mañana».
- Selección de zona: Península, Canarias y Baleares, o Ceuta y Melilla.
- Precios en €/kWh o €/MWh.
- Se puede **instalar como aplicación** en el ordenador y en el móvil, y muestra los últimos precios consultados aunque no haya conexión (ver más abajo).
- La fecha, la zona, la unidad y la duración elegida quedan en la URL, así que se puede compartir el enlace a un día concreto.

## Instalar la aplicación

La web es una PWA (aplicación web progresiva), así que se puede instalar desde el navegador:

- **Ordenador (Chrome o Edge):** abre la web y pulsa el icono de instalar de la barra de direcciones, o el menú › «Instalar Precio de la luz».
- **Android (Chrome):** menú › «Añadir a pantalla de inicio» o «Instalar aplicación».
- **iPhone y iPad (Safari):** botón de compartir › «Añadir a pantalla de inicio».

## Tecnologías

- [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [date-fns](https://date-fns.org/)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) para la instalación como aplicación y el funcionamiento sin conexión
- Tipografías [Barlow y Barlow Semi Condensed](https://fonts.google.com/specimen/Barlow)

## Desarrollo

Requisitos: Node.js 20.19 o superior (o 22.12+) y npm.

```bash
npm install       # instalar dependencias
npm run dev       # servidor de desarrollo
npm run build     # build de producción en ./dist
npm run preview   # previsualizar el build
npm run lint      # comprobar el código con ESLint
npm run datos     # descargar de ESIOS los precios que falten (requiere ESIOS_API_KEY)
```

## Despliegue

Cada push a la rama `main` lanza un workflow de GitHub Actions que construye el proyecto y lo publica en GitHub Pages. El mismo workflow se ejecuta también de forma programada cada tarde (varias veces a partir de las 20:20, hora a la que Red Eléctrica ya suele haber publicado los precios del día siguiente) y por la mañana: descarga los precios nuevos, los guarda en el repositorio y vuelve a desplegar. También se puede lanzar a mano desde la pestaña *Actions*.

La API key de ESIOS se guarda como *secret* del repositorio (`ESIOS_API_KEY`) y solo la usa el workflow; la web no se conecta a ESIOS.

## Fuente de los datos

Los precios provienen del archivo PVPC de [ESIOS](https://www.esios.ree.es/), el sistema de información del operador del sistema eléctrico (REE).

El script `scripts/actualizar-datos.js` los descarga y los guarda ya normalizados en `public/datos/AAAA/MM.json`, un fichero por mes con el precio de cada hora en €/MWh para cada zona:

```json
{
"2026-10-01":[{"Hora":"00:00","PCB":205.85,"CYM":205.85}, ...],
...
}
```

Sin argumentos descarga desde el día siguiente al último guardado hasta mañana; con `--desde AAAA-MM-DD` vuelve a descargar desde esa fecha. El histórico completo (desde el 01/04/2014) ocupa unos 5 MB.
