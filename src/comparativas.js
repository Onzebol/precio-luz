import { CAMBIOS } from "./hitos";

// Media de cada mes por zona, [PCB, CYM] en €/MWh, que genera scripts/actualizar-datos.js.
// Se pide una sola vez; si falla, se olvida para poder reintentar
let peticion = null;
export const pedirMedias = () => {
	peticion ??= fetch(`${import.meta.env.BASE_URL}datos/medias.json`, { cache: "no-cache" })
		.then((response) => {
			if (!response.ok) throw new Error(`Error ${response.status}`);
			return response.json();
		})
		.catch((error) => {
			peticion = null;
			throw error;
		});
	return peticion;
};

const ANIOS_REFERENCIA = 3;
// Diferencias menores se cuentan como «lo habitual»
const MARGEN_IGUAL = 0.05;

// Compara la media de un día con la del mismo mes en los años anteriores (hasta 3).
// Solo usa años en los que el precio se calculaba igual que ese día (sin un cambio
// regulatorio por medio); si no hay ninguno, usa los 3 anteriores y lo avisa.
// Devuelve null si no hay con qué comparar
export const compararConHabitual = (medias, fecha, zona, mediaDia) => {
	const mes = fecha.slice(5, 7);
	const anio = Number(fecha.slice(0, 4));
	const columna = zona === "CYM" ? 1 : 0;
	const anteriores = [];
	for (let a = anio - 1; a >= anio - ANIOS_REFERENCIA; a--) {
		const valor = medias[`${a}-${mes}`]?.[columna];
		if (valor !== undefined) anteriores.push({ anio: a, valor });
	}
	if (!anteriores.length) return null;

	// Último cambio regulatorio hasta ese día: los meses de referencia deben empezar después
	const ultimoCambio = CAMBIOS.filter((cambio) => cambio.fecha <= fecha).at(-1);
	const comparables = anteriores.filter(
		({ anio: a }) => !ultimoCambio || `${a}-${mes}-01` >= ultimoCambio.fecha
	);
	const referencia = comparables.length ? comparables : anteriores;
	const media = referencia.reduce((suma, { valor }) => suma + valor, 0) / referencia.length;
	const diferencia = (mediaDia - media) / Math.abs(media);
	return {
		anios: referencia.map(({ anio: a }) => a).sort(),
		media,
		diferencia,
		tendencia:
			Math.abs(diferencia) < MARGEN_IGUAL ? "igual" : diferencia < 0 ? "barato" : "caro",
		// Comparación que cruza un cambio regulatorio (no había años comparables)
		cambio: comparables.length ? null : ultimoCambio,
	};
};
