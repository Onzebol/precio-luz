# Precio-luz

Aplicación web que muestra el precio horario de la luz en España (tarifa PVPC) a partir de los datos públicos de Red Eléctrica de España (REE), obtenidos a través de la API de ESIOS.

**Demo:** https://onzebol.github.io/precio-luz/

## Funcionalidades

- Las tres horas seguidas más baratas del día, destacadas al abrir la página.
- Precio de la hora actual, el más bajo, el medio y el más alto del día.
- Gráfico de barras con el precio de cada hora, coloreado según sea bajo, medio o alto, y con los periodos de peaje (valle, llano y punta).
- Tabla hora a hora con el precio, el nivel y el periodo de cada hora.
- Selección de cualquier día desde el 31/03/2014 hasta mañana (cuando Red Eléctrica ya ha publicado los precios).
- Selección de zona: Península, Canarias y Baleares, o Ceuta y Melilla.
- Precios en €/kWh o €/MWh.
- La fecha, la zona y la unidad quedan en la URL, así que se puede compartir el enlace a un día concreto.

## Tecnologías

- [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [date-fns](https://date-fns.org/)
- Tipografías [Barlow y Barlow Semi Condensed](https://fonts.google.com/specimen/Barlow)

## Desarrollo

Requisitos: Node.js y npm.

```bash
npm install       # instalar dependencias
npm run dev       # servidor de desarrollo
npm run build     # build de producción en ./dist
npm run preview   # previsualizar el build
npm run lint      # comprobar el código con ESLint
```

## Despliegue

Cada push a la rama `main` lanza un workflow de GitHub Actions que construye el proyecto y lo publica en GitHub Pages.

## Fuente de los datos

Los precios provienen del archivo PVPC de [ESIOS](https://www.esios.ree.es/), el sistema de información del operador del sistema eléctrico (REE).
