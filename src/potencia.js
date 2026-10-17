// Término de potencia del PVPC (tarifa 2.0TD), en €/kW y año, por año de aplicación.
// Cambia cada 1 de enero: añadir el año nuevo con los valores del BOE (resolución de
// peajes de la CNMC y orden de cargos del Ministerio). P1 = punta y llano, P2 = valle
export const POTENCIA = {
	2026: {
		peajes: { p1: 23.324952, p2: 0.44377 },
		cargos: { p1: 4.379461, p2: 0.281653 },
		// Coste fijo de comercialización del PVPC, solo sobre la potencia de P1
		margen: 3.113,
		fuentes: [
			{
				texto: "Peajes: Resolución de la CNMC de 18/12/2025",
				url: "https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-26348",
			},
			{
				texto: "Cargos: Orden TED/1524/2025",
				url: "https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-26705",
			},
			{
				texto: "Margen: Orden ETU/1948/2016, prorrogada por la Orden TED/1484/2021",
				url: "https://www.boe.es/diario_boe/txt.php?id=BOE-A-2021-21794",
			},
		],
	},
};

// Valores del año pedido o, si aún no están, los del último año disponible
export const potenciaDe = (anio) => {
	const anios = Object.keys(POTENCIA).map(Number).sort();
	const elegido = anios.filter((a) => a <= anio).at(-1) ?? anios[0];
	const valores = POTENCIA[elegido];
	const p1 = valores.peajes.p1 + valores.cargos.p1 + valores.margen;
	const p2 = valores.peajes.p2 + valores.cargos.p2;
	return { anio: elegido, ...valores, total: { p1, p2 } };
};
