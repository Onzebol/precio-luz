import { useEffect, useMemo, useState } from "react";
import { diaYMes, formatearPrecio } from "../utils";

// Agregados por día y por mes que genera scripts/actualizar-datos.js. Se pide una sola vez
let peticion = null;
const pedirResumen = () => {
	peticion ??= fetch(`${import.meta.env.BASE_URL}datos/resumen.json`, {
		cache: "no-cache",
	})
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

// Posición de cada zona en los valores de un día: [media, mín, máx, horaMín, horaMáx] × zona
const DESPLAZAMIENTO = { PCB: 0, CYM: 5 };

// Por año: media de las medias diarias y los días con la media más baja y más alta
const resumirAnios = (dias, zona) => {
	const anios = new Map();
	for (const [fecha, valores] of Object.entries(dias)) {
		const media = valores[DESPLAZAMIENTO[zona]];
		const anio = fecha.slice(0, 4);
		const actual = anios.get(anio);
		if (!actual) {
			anios.set(anio, { anio, suma: media, dias: 1, barato: { fecha, media }, caro: { fecha, media } });
			continue;
		}
		actual.suma += media;
		actual.dias++;
		if (media < actual.barato.media) actual.barato = { fecha, media };
		if (media > actual.caro.media) actual.caro = { fecha, media };
	}
	return [...anios.values()]
		.map((anio) => ({ ...anio, media: anio.suma / anio.dias }))
		.sort((a, b) => b.anio.localeCompare(a.anio));
};

// Precio y, debajo, el día: así la tabla cabe a lo ancho en el móvil
function Dia({ fecha, media, precio }) {
	return (
		<>
			<span className="block whitespace-nowrap font-medium">{precio(media)}</span>
			<span className="block text-sm text-suave">{diaYMes(fecha)}</span>
		</>
	);
}

export function Historico({ zona, unidad }) {
	const [resumen, setResumen] = useState(null);
	const [error, setError] = useState(false);
	const [intento, setIntento] = useState(0);

	useEffect(() => {
		let vigente = true;
		pedirResumen()
			.then((datos) => vigente && setResumen(datos))
			.catch(() => vigente && setError(true));
		return () => {
			vigente = false;
		};
	}, [intento]);

	const anios = useMemo(
		() => (resumen ? resumirAnios(resumen.dias, zona) : []),
		[resumen, zona]
	);
	const precio = (valor) => formatearPrecio(unidad === "MWh" ? valor : valor / 1000, unidad);

	return (
		<>
			<h1 className="max-w-[18ch] text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
				Histórico del precio de la luz
			</h1>
			<p className="mt-4 max-w-prose text-suave">
				Precio medio de cada año desde abril de 2014, el primer día publicado por Red
				Eléctrica.
			</p>

			{!resumen && !error && <p className="mt-10 text-suave">Cargando histórico…</p>}

			{error && (
				<div className="mt-10 max-w-prose">
					<p>No se ha podido cargar el histórico. Comprueba tu conexión a internet.</p>
					<button
						type="button"
						onClick={() => {
							setError(false);
							setIntento((n) => n + 1);
						}}
						className="mt-4 rounded-md bg-tinta px-4 py-2 font-medium text-papel hover:bg-tinta/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta"
					>
						Reintentar
					</button>
				</div>
			)}

			{resumen && (
				<div className="mt-10 overflow-x-auto border-t border-linea pt-6">
					<table className="w-full max-w-3xl text-left text-sm sm:text-base">
						<caption className="sr-only">Precio medio por año (€/{unidad})</caption>
						<thead className="text-sm text-suave">
							<tr className="border-b border-linea">
								<th scope="col" className="py-2 pr-4 font-normal">
									Año
								</th>
								<th scope="col" className="py-2 pr-4 text-right font-normal">
									Media (€/{unidad})
								</th>
								<th scope="col" className="py-2 pr-4 font-normal">
									Día más barato
								</th>
								<th scope="col" className="py-2 font-normal">
									Día más caro
								</th>
							</tr>
						</thead>
						<tbody>
							{anios.map((anio) => (
								<tr key={anio.anio} className="border-b border-linea/60">
									<th scope="row" className="py-2 pr-4 font-medium">
										{anio.anio}
									</th>
									<td className="whitespace-nowrap py-2 pr-4 text-right font-medium">
										{precio(anio.media)}
									</td>
									<td className="py-2 pr-4">
										<Dia {...anio.barato} precio={precio} />
									</td>
									<td className="py-2">
										<Dia {...anio.caro} precio={precio} />
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</>
	);
}
