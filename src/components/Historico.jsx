import { Fragment, useEffect, useMemo, useState } from "react";
import { parseISO } from "date-fns";
import { perfilAnio } from "../comparativas";
import { HITOS, cambiosEntre } from "../hitos";
import { diaYMes, formatearPrecio } from "../utils";
import { Segmentado } from "./Controles";
import { GraficoEvolucion } from "./GraficoEvolucion";
import { MismoMes } from "./MismoMes";
import { PerfilesAnuales } from "./PerfilesAnuales";

// Años del perfil horario: antes de la 2.0TD y de la solar masiva, el año de la crisis y el actual
const ANIOS_PERFIL = [2019, 2022];

// "2021-06-01" -> "1/6/2021"
const fechaCorta = (fecha) => new Intl.DateTimeFormat("es-ES").format(parseISO(fecha));

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

const RANGOS = [
	{ valor: "todo", texto: "Desde 2014" },
	{ valor: "anio", texto: "Último año" },
	{ valor: "90", texto: "90 días" },
];

const nombreMes = (mes) =>
	new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(
		parseISO(`${mes}-01`)
	);
const nombreDia = (fecha) =>
	new Intl.DateTimeFormat("es-ES", {
		weekday: "short",
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(parseISO(fecha));

// Puntos del gráfico: medias mensuales desde 2014 o días sueltos en los rangos cortos.
// minimo y maximo son la hora más barata y la más cara del día (en un mes, su media)
const puntosEvolucion = (dias, zona, rango) => {
	const d = DESPLAZAMIENTO[zona];
	const fechas = Object.keys(dias).sort();
	if (rango !== "todo") {
		return fechas.slice(rango === "anio" ? -365 : -90).map((fecha) => ({
			desde: fecha,
			hasta: fecha,
			etiqueta: nombreDia(fecha),
			media: dias[fecha][d],
			minimo: dias[fecha][d + 1],
			maximo: dias[fecha][d + 2],
		}));
	}
	const meses = new Map();
	for (const fecha of fechas) {
		const mes = fecha.slice(0, 7);
		if (!meses.has(mes)) meses.set(mes, { desde: fecha, dias: 0, media: 0, minimo: 0, maximo: 0 });
		const acumulado = meses.get(mes);
		acumulado.hasta = fecha;
		acumulado.dias++;
		acumulado.media += dias[fecha][d];
		acumulado.minimo += dias[fecha][d + 1];
		acumulado.maximo += dias[fecha][d + 2];
	}
	return [...meses].map(([mes, a]) => ({
		desde: a.desde,
		hasta: a.hasta,
		etiqueta: nombreMes(mes),
		media: a.media / a.dias,
		minimo: a.minimo / a.dias,
		maximo: a.maximo / a.dias,
	}));
};

// Récords de todo el histórico y días con alguna hora a precio negativo
const cifrasDestacadas = (dias, zona) => {
	const d = DESPLAZAMIENTO[zona];
	const fechas = Object.keys(dias).sort();
	const mayor = (posicion) =>
		fechas.reduce((mejor, fecha) => (dias[fecha][posicion] > dias[mejor][posicion] ? fecha : mejor));
	const menor = (posicion) =>
		fechas.reduce((mejor, fecha) => (dias[fecha][posicion] < dias[mejor][posicion] ? fecha : mejor));
	const diaCaro = mayor(d);
	const diaBarato = menor(d);
	const horaCara = mayor(d + 2);
	const negativos = fechas.filter((fecha) => dias[fecha][d + 1] < 0);
	return {
		diaCaro: { fecha: diaCaro, valor: dias[diaCaro][d] },
		diaBarato: { fecha: diaBarato, valor: dias[diaBarato][d] },
		horaCara: { fecha: horaCara, valor: dias[horaCara][d + 2], hora: dias[horaCara][d + 4] },
		negativos,
	};
};

const fechaConAnio = (fecha) =>
	new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" }).format(
		parseISO(fecha)
	);

function Cifra({ etiqueta, valor, detalle }) {
	return (
		<div>
			<dt className="text-sm text-suave">{etiqueta}</dt>
			<dd className="font-display text-2xl font-semibold sm:text-3xl">{valor}</dd>
			<dd className="text-sm text-suave">{detalle}</dd>
		</div>
	);
}

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
	const [rango, setRango] = useState("todo");
	const puntos = useMemo(
		() => (resumen ? puntosEvolucion(resumen.dias, zona, rango) : []),
		[resumen, zona, rango]
	);
	// Perfil horario medio de cada año (para la tabla) y los que se dibujan
	const perfiles = useMemo(() => {
		if (!resumen) return new Map();
		const anios = new Set(Object.keys(resumen.perfiles).map((mes) => Number(mes.slice(0, 4))));
		return new Map([...anios].map((anio) => [anio, perfilAnio(resumen.perfiles, anio, zona)]));
	}, [resumen, zona]);
	const perfilesDibujados = [...ANIOS_PERFIL, Math.max(...perfiles.keys())]
		.map((anio) => perfiles.get(anio))
		.filter(Boolean);
	const mensuales = useMemo(
		() => (resumen ? puntosEvolucion(resumen.dias, zona, "todo") : []),
		[resumen, zona]
	);
	const cifras = useMemo(
		() => (resumen ? cifrasDestacadas(resumen.dias, zona) : null),
		[resumen, zona]
	);
	const precio = (valor) => formatearPrecio(unidad === "MWh" ? valor : valor / 1000, unidad);
	// "0,715 €" -> "0,715"; la unidad va aparte, como en la vista de día
	const numero = (valor) => precio(valor).replace(/\s*€$/, "");

	return (
		<>
			<h1 className="max-w-[18ch] text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
				Histórico del precio de la luz
			</h1>
			<p className="mt-4 max-w-prose text-suave">
				Cómo ha cambiado el precio desde abril de 2014, el primer día publicado por Red
				Eléctrica. Sin impuestos y sin ajustar por la inflación.
			</p>

			{cifras && (
				<dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-linea pt-6 sm:grid-cols-4">
					<Cifra
						etiqueta="Día más caro"
						valor={numero(cifras.diaCaro.valor)}
						detalle={`${fechaConAnio(cifras.diaCaro.fecha)}, media en €/${unidad}`}
					/>
					<Cifra
						etiqueta="Día más barato"
						valor={numero(cifras.diaBarato.valor)}
						detalle={`${fechaConAnio(cifras.diaBarato.fecha)}, media en €/${unidad}`}
					/>
					<Cifra
						etiqueta="Hora más cara"
						valor={numero(cifras.horaCara.valor)}
						detalle={`${fechaConAnio(cifras.horaCara.fecha)}, de ${cifras.horaCara.hora} a ${
							cifras.horaCara.hora + 1
						} h, en €/${unidad}`}
					/>
					<Cifra
						etiqueta="Días con precios negativos"
						valor={cifras.negativos.length}
						detalle={
							cifras.negativos.length
								? `Con alguna hora por debajo de 0; el primero, el ${fechaConAnio(cifras.negativos[0])}`
								: "Ninguna hora por debajo de 0"
						}
					/>
				</dl>
			)}

			{resumen && (
				<section aria-labelledby="titulo-evolucion" className="mt-10 border-t border-linea pt-6">
					<div className="flex flex-wrap items-end justify-between gap-4">
						<h2 id="titulo-evolucion" className="font-display text-xl font-semibold">
							Precio medio {rango === "todo" ? "de cada mes" : "de cada día"}
						</h2>
						<Segmentado
							leyenda="Periodo"
							nombre="rango"
							valor={rango}
							onCambio={setRango}
							opciones={RANGOS}
						/>
					</div>
					<GraficoEvolucion
						key={rango}
						puntos={puntos}
						unidad={unidad}
						porMeses={rango === "todo"}
					/>
					<details className="group mt-6">
						<summary className="cursor-pointer list-none rounded-xs font-medium focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-tinta">
							<span className="mr-2 inline-block transition-transform group-open:rotate-90 motion-reduce:transition-none">
								›
							</span>
							Datos del gráfico
						</summary>
						<div className="mt-4 max-h-96 overflow-auto">
							<table className="w-full max-w-2xl text-left text-sm">
								<thead className="sticky top-0 bg-papel text-suave">
									<tr className="border-b border-linea">
										<th scope="col" className="py-2 pr-4 font-normal">
											{rango === "todo" ? "Mes" : "Día"}
										</th>
										<th scope="col" className="py-2 pr-4 text-right font-normal">
											Media
										</th>
										<th scope="col" className="py-2 pr-4 text-right font-normal">
											Hora más barata{rango === "todo" ? " (media)" : ""}
										</th>
										<th scope="col" className="py-2 text-right font-normal">
											Hora más cara{rango === "todo" ? " (media)" : ""}
										</th>
									</tr>
								</thead>
								<tbody>
									{puntos.toReversed().map((p) => (
										<tr key={p.desde} className="border-b border-linea/60">
											<th scope="row" className="py-1.5 pr-4 font-normal first-letter:uppercase">
												{p.etiqueta}
											</th>
											<td className="whitespace-nowrap py-1.5 pr-4 text-right font-medium tabular-nums">
												{precio(p.media)}
											</td>
											<td className="whitespace-nowrap py-1.5 pr-4 text-right tabular-nums">
												{precio(p.minimo)}
											</td>
											<td className="whitespace-nowrap py-1.5 text-right tabular-nums">
												{precio(p.maximo)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</details>
				</section>
			)}

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
						className="mt-4 rounded-md bg-tinta px-4 py-2 font-medium text-papel hover:bg-tinta/90 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta"
					>
						Reintentar
					</button>
				</div>
			)}

			{resumen && perfilesDibujados.length > 0 && (
				<section aria-labelledby="titulo-perfiles" className="mt-14 border-t border-linea pt-6">
					<h2 id="titulo-perfiles" className="font-display text-xl font-semibold">
						¿A qué hora es más barata?
					</h2>
					<p className="mt-2 max-w-prose text-suave">
						Cada barra es una hora del día: cuánto más cara o más barata es, de media
						en el año, que la media del día. Con la llegada de la solar, la hora más
						barata ha pasado de la madrugada al mediodía y las diferencias entre horas
						son mucho mayores.
					</p>
					<PerfilesAnuales perfiles={perfilesDibujados} />
				</section>
			)}

			{mensuales.length > 0 && (
				<section aria-labelledby="titulo-mismo-mes" className="mt-14 border-t border-linea pt-6">
					<h2 id="titulo-mismo-mes" className="font-display text-xl font-semibold">
						El mismo mes, año a año
					</h2>
					<p className="mt-2 max-w-prose text-suave">
						Comparar el mismo mes quita el efecto de la estación: el invierno suele ser
						más caro que la primavera.
					</p>
					<MismoMes mensuales={mensuales} unidad={unidad} />
				</section>
			)}

			{resumen && (
				<section aria-labelledby="titulo-anios" className="mt-14 overflow-x-auto border-t border-linea pt-6">
					<h2 id="titulo-anios" className="font-display text-xl font-semibold">
						Año a año
					</h2>
					<table className="mt-4 w-full max-w-3xl text-left text-sm sm:text-base">
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
								<Fragment key={anio.anio}>
									<tr className="border-b border-linea/60">
										<th scope="row" className="py-2 pr-4 font-medium">
											{anio.anio}
											{perfiles.get(Number(anio.anio)) && (
												<span className="block whitespace-nowrap text-sm font-normal text-suave">
													barata a las {perfiles.get(Number(anio.anio)).barata} h
												</span>
											)}
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
									{/* Los cambios regulatorios del año, debajo de su fila (la tabla va del más reciente al más antiguo) */}
									{cambiosEntre(`${anio.anio - 1}-12-31`, `${anio.anio}-12-31`)
										.reverse()
										.map((cambio) => (
											<tr key={cambio.fecha} className="border-b border-linea/60">
												<td colSpan={4} className="py-1.5 text-sm text-suave">
													<span aria-hidden="true" className="mr-2 inline-block h-2 w-2 rotate-45 bg-tinta align-middle" />
													{diaYMes(cambio.fecha)} de {anio.anio}: {cambio.titulo}
												</td>
											</tr>
										))}
								</Fragment>
							))}
						</tbody>
					</table>
				</section>
			)}

			<section aria-labelledby="comparar" className="mt-14 max-w-prose border-t border-linea pt-6">
				<h2 id="comparar" className="font-display text-xl font-semibold">
					Antes de comparar
				</h2>
				<p className="mt-2 text-suave">
					Es el precio del término de energía del PVPC con los peajes y cargos incluidos,
					sin impuestos y en euros de cada año, sin ajustar por la inflación. La forma de
					calcularlo ha cambiado varias veces, así que las comparaciones que cruzan estas
					fechas no comparan exactamente lo mismo:
				</p>
				<dl className="mt-4 space-y-4">
					{HITOS.map((hito) => (
						<div key={hito.fecha}>
							<dt className="font-medium">
								{hito.titulo}{" "}
								<span className="font-normal text-suave">
									({hito.hasta
										? `del ${fechaCorta(hito.fecha)} al ${fechaCorta(hito.hasta)}`
										: `desde el ${fechaCorta(hito.fecha)}`})
								</span>
							</dt>
							<dd className="mt-1">
								{hito.texto}{" "}
								<a
									href={hito.fuente.url}
									className="underline decoration-linea underline-offset-2 hover:decoration-tinta"
								>
									{hito.fuente.texto}
								</a>
								.
							</dd>
						</div>
					))}
				</dl>
			</section>
		</>
	);
}
