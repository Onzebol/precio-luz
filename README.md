# Precio-luz

Aplicación web que muestra el precio horario de la luz en España (tarifa PVPC) a partir de los datos públicos de Red Eléctrica de España (REE), obtenidos a través de la API de ESIOS.

**Demo:** https://onzebol.github.io/precio-luz/

## Funcionalidades

- Selección de cualquier día desde el 31/03/2014 hasta hoy.
- Selección de zona: Península, Canarias y Baleares, o Ceuta y Melilla.
- Precios en €/kWh o €/MWh.
- Precio más bajo, medio y más alto del día, con la franja horaria correspondiente.
- Vista **Gráfica**: evolución del precio a lo largo del día.
- Vista **Detalles**: tabla hora a hora, coloreada según el precio (barato, medio, caro) y con el periodo de peaje de cada hora (valle, llano o punta).

## Tecnologías

- [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Tremor](https://www.tremor.so/) para los componentes de la interfaz y las gráficas
- [Tailwind CSS](https://tailwindcss.com/)
- [Heroicons](https://heroicons.com/)

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
