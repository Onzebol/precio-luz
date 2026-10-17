import { useEffect, useMemo, useState } from "react";
import { parseISO } from "date-fns";
import { Controles } from "./components/Controles";
import { SelectorDuracion } from "./components/SelectorDuracion";
import { FranjaCargando, FranjaHoras } from "./components/FranjaHoras";
import { TablaHoras } from "./components/TablaHoras";
import {
	DURACIONES,
	StringToNumerLocale,
	diaYMes,
	fechaLarga,
	formatearPrecio,
	hoy,
	incrementarHora,
	manana,
	nivelesPrecio,
	ordenarPrecios,
	rangoHoras,
	tramoMasBarato,
	mejorBloque,
} from "./utils";

const FECHA_MINIMA = "2014-03-31";

class SinDatos extends Error {}

const pedirDatos = (date, signal) => {
	return fetch(
		`https://api.esios.ree.es/archives/70/download_json?date=${date}`,
		{
			headers: {
				"x-api-key":
					"***REMOVED***",
			},
			signal,
		}
	)
		.then((response) => {
			if (!response.ok) throw new Error(`Error ${response.status}`);
			return response.json();
		})
		.then(function (data) {
			// Para días sin publicar, la API responde 200 con un mensaje en lugar de PVPC
			if (!Array.isArray(data?.PVPC) || data.PVPC.length === 0)
				throw new SinDatos();
			return data.PVPC.map((item) => {
				const pcb = "PCB" in item ? item.PCB : item.GEN;
				const cym = "CYM" in item ? item.CYM : item.GEN;
				return {
					Hora: `${item.Hora.split("-")[0]}:00`,
					PCB: StringToNumerLocale(pcb, "es"),
					CYM: StringToNumerLocale(cym, "es"),
				};
			});
		});
};

const filterData = (data, province, unity) => {
	if (data === null) return null;
	return data.map((item) => {
		const price = province == "PCB" ? item.PCB : item.CYM;
		return {
			Hora: item.Hora,
			Precio: unity == "MWh" ? price : price / 1000,
		};
	});
};

// La fecha, la zona y la unidad viven en la URL para poder compartir el enlace
const leerParametros = () => {
	const parametros = new URLSearchParams(window.location.search);
	const fecha = parametros.get("fecha") ?? "";
	return {
		fecha:
			/^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha >= FECHA_MINIMA && fecha <= manana()
				? fecha
				: hoy(),
		zona: parametros.get("zona") === "cym" ? "CYM" : "PCB",
		unidad: parametros.get("unidad") === "mwh" ? "MWh" : "kWh",
		duracion: DURACIONES.includes(Number(parametros.get("duracion")))
			? Number(parametros.get("duracion"))
			: null,
	};
};

const escribirParametros = ({ fecha, zona, unidad, duracion }) => {
	const parametros = new URLSearchParams();
	if (fecha !== hoy()) parametros.set("fecha", fecha);
	if (zona !== "PCB") parametros.set("zona", "cym");
	if (unidad !== "kWh") parametros.set("unidad", "mwh");
	if (duracion) parametros.set("duracion", duracion);
	const consulta = parametros.toString();
	window.history.replaceState(
		null,
		"",
		`${window.location.pathname}${consulta ? `?${consulta}` : ""}`
	);
};

const fraseTramo = (tramo, unidad) => {
	const minimo = formatearPrecio(tramo.minimo, unidad);
	const maximo = formatearPrecio(tramo.maximo, unidad);
	if (tramo.horas === 1)
		return `Es la única hora con el precio cerca del mínimo del día: ${minimo}/${unidad}.`;
	if (minimo === maximo)
		return `Durante esas ${tramo.horas} horas el precio se mantiene en ${minimo}/${unidad}.`;
	return `Durante esas ${tramo.horas} horas el precio se mantiene entre ${minimo.replace(
		/\s*€$/,
		""
	)} y ${maximo}/${unidad}.`;
};

const fraseMasBarata = (fecha, tramo) => {
	const rango = rangoHoras(tramo.desde, tramo.hasta);
	if (fecha === hoy()) return `Hoy la luz está más barata ${rango}`;
	if (fecha === manana()) return `Mañana la luz estará más barata ${rango}`;
	return `El ${diaYMes(fecha)} la luz estuvo más barata ${rango}`;
};

function Dato({ etiqueta, precio, unidad, detalle }) {
	// "0,091 €" -> "0,091", la unidad se pinta aparte y más pequeña
	const numero = formatearPrecio(precio, unidad).replace(/\s*€$/, "");
	return (
		<div>
			<dt className="text-sm text-suave">{etiqueta}</dt>
			<dd className="font-display text-2xl font-semibold sm:text-3xl">
				{numero}
				<span className="ml-1 font-sans text-sm font-normal text-suave">
					€/{unidad}
				</span>
			</dd>
			{detalle && <dd className="text-sm text-suave">{detalle}</dd>}
		</div>
	);
}

export default function App() {
	const [parametros, setParametros] = useState(leerParametros);
	const { fecha, zona, unidad, duracion } = parametros;
	const [data, setData] = useState(null);
	const [estado, setEstado] = useState("cargando");
	const [intento, setIntento] = useState(0);

	const actualizar = (cambios) =>
		setParametros((anteriores) => ({ ...anteriores, ...cambios }));

	useEffect(() => {
		escribirParametros(parametros);
	}, [parametros]);

	useEffect(() => {
		const controller = new AbortController();
		setEstado("cargando");
		setData(null);
		pedirDatos(fecha, controller.signal)
			.then((data) => {
				setData(data);
				setEstado("ok");
			})
			.catch((error) => {
				if (error.name === "AbortError") return;
				setEstado(error instanceof SinDatos ? "sin-datos" : "error");
			});
		return () => controller.abort();
	}, [fecha, intento]);

	// parseISO interpreta "YYYY-MM-DD" en hora local, a diferencia de new Date()
	const fechaSeleccionada = parseISO(fecha);
	const precios = useMemo(
		() => nivelesPrecio(filterData(data, zona, unidad)),
		[data, zona, unidad]
	);
	const hayPrecios = estado === "ok" && precios.length > 0;
	const ordenados = hayPrecios ? ordenarPrecios(precios) : [];
	const minimo = ordenados[0];
	const maximo = ordenados[ordenados.length - 1];
	const media = hayPrecios
		? precios.reduce((total, item) => total + item.Precio, 0) / precios.length
		: null;
	const tramo = hayPrecios ? tramoMasBarato(precios) : null;
	const bloque = hayPrecios && duracion ? mejorBloque(precios, duracion) : null;

	const esHoy = fecha === hoy();
	const horaActual = new Date().getHours();
	const indiceAhora =
		hayPrecios && esHoy
			? precios.findIndex((item) => parseInt(item.Hora) === horaActual)
			: -1;

	let titular = "Precio de la luz";
	if (hayPrecios) titular = fraseMasBarata(fecha, tramo);
	if (estado === "sin-datos") titular = `Aún no hay precios para el ${diaYMes(fecha)}`;
	if (estado === "error") titular = "No se han podido cargar los precios";

	return (
		<div className="min-h-screen font-sans text-tinta">
			<a
				href="#contenido"
				className="sr-only rounded-md bg-tinta px-3 py-2 text-papel focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
			>
				Saltar al contenido
			</a>

			<header className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-x-10 gap-y-6 px-4 pt-6 sm:px-8 sm:pt-10">
				<p className="flex items-center gap-2 font-display text-lg font-semibold">
					<svg
						aria-hidden="true"
						viewBox="0 0 32 32"
						className="h-7 w-7 shrink-0"
					>
						<rect width="32" height="32" rx="7" fill="#17262B" />
						<path d="M18 3 7 18h7l-2 11 11-15h-7z" fill="#facc15" />
					</svg>
					Precio de la luz
				</p>
				<Controles
					fecha={fecha}
					fechaMinima={FECHA_MINIMA}
					fechaMaxima={manana()}
					onFecha={(valor) => actualizar({ fecha: valor })}
					zona={zona}
					onZona={(valor) => actualizar({ zona: valor })}
					unidad={unidad}
					onUnidad={(valor) => actualizar({ unidad: valor })}
				/>
			</header>

			<main id="contenido" className="mx-auto max-w-5xl px-4 pb-16 pt-12 sm:px-8 sm:pt-16">
				<p className="text-suave first-letter:uppercase">{fechaLarga(fecha)}</p>
				<h1
					aria-live="polite"
					className="mt-2 max-w-[18ch] text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl"
				>
					{titular}
				</h1>

				{estado === "cargando" && (
					<>
						<p className="mt-4 text-suave">Cargando precios…</p>
						<FranjaCargando />
					</>
				)}

				{estado === "sin-datos" && (
					<div className="mt-4 max-w-prose">
						<p>
							{fecha === manana()
								? "Red Eléctrica publica los precios del día siguiente hacia las 20:30. Vuelve a mirar después de esa hora."
								: "Red Eléctrica no tiene precios publicados para este día. Elige otra fecha."}
						</p>
						{!esHoy && (
							<button
								type="button"
								onClick={() => actualizar({ fecha: hoy() })}
								className="mt-4 rounded-md bg-tinta px-4 py-2 font-medium text-papel hover:bg-tinta/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta"
							>
								Ver los precios de hoy
							</button>
						)}
					</div>
				)}

				{estado === "error" && (
					<div className="mt-4 max-w-prose">
						<p>Comprueba tu conexión a internet y vuelve a intentarlo.</p>
						<button
							type="button"
							onClick={() => setIntento((n) => n + 1)}
							className="mt-4 rounded-md bg-tinta px-4 py-2 font-medium text-papel hover:bg-tinta/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta"
						>
							Reintentar
						</button>
					</div>
				)}

				{hayPrecios && (
					<>
						<p className="mt-4 max-w-prose text-suave">{fraseTramo(tramo, unidad)}</p>

						<dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-linea pt-6 sm:grid-cols-4">
							{indiceAhora !== -1 && (
								<Dato
									etiqueta="Ahora"
									precio={precios[indiceAhora].Precio}
									unidad={unidad}
									detalle={rangoHoras(
										precios[indiceAhora].Hora,
										incrementarHora(precios[indiceAhora].Hora)
									)}
								/>
							)}
							<Dato
								etiqueta="Hora más barata"
								precio={minimo.Precio}
								unidad={unidad}
								detalle={rangoHoras(minimo.Hora, incrementarHora(minimo.Hora))}
							/>
							<Dato etiqueta="Media del día" precio={media} unidad={unidad} />
							<Dato
								etiqueta="Hora más cara"
								precio={maximo.Precio}
								unidad={unidad}
								detalle={rangoHoras(maximo.Hora, incrementarHora(maximo.Hora))}
							/>
						</dl>

						<SelectorDuracion
							duracion={duracion}
							onDuracion={(valor) => actualizar({ duracion: valor })}
							bloque={bloque}
							unidad={unidad}
							horasDia={precios.length}
						/>

						<FranjaHoras
							key={`${fecha}-${zona}`}
							precios={precios}
							unidad={unidad}
							fecha={fechaSeleccionada}
							zona={zona}
							indiceAhora={indiceAhora === -1 ? null : indiceAhora}
							bloque={bloque}
						/>

						<TablaHoras
							precios={precios}
							unidad={unidad}
							fecha={fechaSeleccionada}
							zona={zona}
						/>
					</>
				)}
			</main>

			<footer className="mx-auto max-w-5xl px-4 sm:px-8">
				<p className="border-t border-linea py-6 text-sm text-suave">
					Precio del término de energía de la tarifa PVPC (2.0TD) publicado por
					Red Eléctrica en ESIOS. No incluye impuestos.
				</p>
			</footer>
		</div>
	);
}
