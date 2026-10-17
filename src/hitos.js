import { INICIO_2_0TD, desplazarDia } from "./utils";

// Cambios regulatorios que alteran la definición del precio del PVPC y hacen que
// comparar a ambos lados no sea comparar lo mismo. `hasta` (opcional) es el último
// día de una medida temporal: su fin también es un cambio, con el nombre `tituloFin`
export const HITOS = [
	{
		fecha: INICIO_2_0TD,
		titulo: "Tarifa 2.0TD",
		texto:
			"Sustituye a la 2.0A. Los peajes y cargos pasan a ser distintos en punta, llano y valle, así que el precio de cada hora incluye una parte regulada que cambia a lo largo del día. Desde este día el precio de Ceuta y Melilla también es distinto.",
		fuente: {
			texto: "Circular 3/2020 de la CNMC",
			url: "https://www.boe.es/buscar/act.php?id=BOE-A-2020-1066",
		},
	},
	{
		fecha: "2022-06-15",
		hasta: "2023-12-31",
		tituloFin: "Fin de la excepción ibérica",
		titulo: "Excepción ibérica",
		texto:
			"Tope al precio del gas usado para producir electricidad. Rebaja el precio del mercado mayorista, pero el coste de la compensación a las centrales de gas se suma al precio del PVPC.",
		fuente: {
			texto: "Real Decreto-ley 10/2022",
			url: "https://www.boe.es/buscar/act.php?id=BOE-A-2022-7843",
		},
	},
	{
		fecha: "2024-01-01",
		titulo: "PVPC ligado a futuros",
		texto:
			"Parte del precio de la energía deja de salir del mercado diario y se toma de los mercados a plazo: un 25 % en 2024, un 40 % en 2025 y un 55 % desde 2026. El precio se suaviza frente a las subidas y bajadas del mercado diario.",
		fuente: {
			texto: "Real Decreto 446/2023",
			url: "https://www.boe.es/buscar/doc.php?id=BOE-A-2023-14048",
		},
	},
];

// Días en que empieza a regir una definición distinta del precio, en orden
export const CAMBIOS = HITOS.flatMap((hito) => [
	{ fecha: hito.fecha, titulo: hito.titulo, hito },
	...(hito.hasta
		? [{ fecha: desplazarDia(hito.hasta, 1), titulo: hito.tituloFin, hito }]
		: []),
]).sort((a, b) => a.fecha.localeCompare(b.fecha));

// Cambios entre dos fechas (sin incluir `desde`, que aún es de la definición anterior)
export const cambiosEntre = (desde, hasta) =>
	CAMBIOS.filter((cambio) => cambio.fecha > desde && cambio.fecha <= hasta);
