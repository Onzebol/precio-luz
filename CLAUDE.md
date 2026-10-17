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

Casi toda la lógica vive en `src/App.jsx`; `src/utils.js` contiene helpers puros y `src/components/PriceCard.jsx` es la tarjeta de métricas.

Flujo de datos en `App.jsx`:
1. `pedirDatos(fecha)` llama a `https://api.esios.ree.es/archives/70/download_json?date=YYYY-MM-DD` (la API key va en la cabecera `x-api-key`, embebida en el cliente). Normaliza `data.PVPC` a `{ Hora: "HH:00", PCB, CYM }`. Los precios llegan como strings con formato español (`"123,45"`) y se convierten con `StringToNumerLocale`. Algunos días antiguos traen solo `GEN` en lugar de `PCB`/`CYM`, de ahí el fallback.
2. Un `useEffect` sobre `date` vuelve a pedir datos; otro sobre `[data, unity, province]` deriva `dataFiltered` (`{ Hora, Precio }`) y las métricas mínimo/medio/máximo.
3. Los precios de la API vienen en €/MWh; para kWh se dividen entre 1000 (y se muestran con 5 decimales en vez de 2).

Conceptos de dominio:
- **Zona** (`province`): `PCB` = Península, Canarias y Baleares; `CYM` = Ceuta y Melilla.
- **Periodos de peaje** (`periodoPeaje` en `utils.js`): valle/llano/punta según hora, día de la semana (fin de semana = todo valle) y zona; CYM tiene un reparto de horas distinto. No contempla festivos nacionales.
- `colorearPrecios` divide el rango min–max en tercios para colorear filas de la tabla (verde/naranja/rojo).

## Dependencias a tener en cuenta

- **@tremor/react v2**: usa la API antigua (`Dropdown`/`DropdownItem`, `TabList`/`Tab`, `numColsLg`, `decorationColor`). No usar componentes/props de Tremor v3+ sin migrar.
- **@heroicons/react v1**: los iconos se importan de `@heroicons/react/outline` con nombres v1 (`ArrowSmDownIcon`, `LightningBoltIcon`...).
- **Tailwind**: `tailwind.config.js` incluye en `content` los paquetes de Tremor y `react-tailwindcss-datepicker` dentro de `node_modules`; necesario para que sus clases no se purguen.
- El selector de fecha es `react-tailwindcss-datepicker` (en modo fecha única); `tailwind-datepicker-react` está en `package.json` pero no se usa.
