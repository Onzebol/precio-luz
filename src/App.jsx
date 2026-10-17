import { useEffect, useMemo, useState } from "react";
import { parseISO } from "date-fns";
import { Controles } from "./components/Controles";
import { SelectorDuracion } from "./components/SelectorDuracion";
import { FranjaCargando, FranjaHoras } from "./components/FranjaHoras";
import { TablaHoras } from "./components/TablaHoras";
import {
	DURACIONES,
	StringToNumerLocale,
	desplazarDia,
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

const pedirDatos = (date) => {
	return fetch(
		`https://api.esios.ree.es/archives/70/download_json?date=${date}`,
		{
			headers: {
				"x-api-key":
					"***REMOVED***",
			},
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

// Días ya pedidos (promesas), para que volver a un día o avanzar al precargado sea instantáneo.
// Solo se guardan los aciertos: si falla (p. ej. mañana aún sin publicar) se borra para reintentar
const cache = new Map();
const cargarDia = (fecha) => {
	if (!cache.has(fecha)) {
		cache.set(
			fecha,
			pedirDatos(fecha).catch((error) => {
				cache.delete(fecha);
				throw error;
			})
		);
	}
	return cache.get(fecha);
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
	// Datos que se están mostrando y a qué día pertenecen: se conservan mientras carga el siguiente
	const [datos, setDatos] = useState(null);
	const [intento, setIntento] = useState(0);
	// Resultado de la última carga terminada; si no corresponde al día e intento actuales, se está cargando
	const [resultado, setResultado] = useState(null);
	const estado =
		resultado?.fecha === fecha && resultado.intento === intento
			? resultado.tipo
			: "cargando";

	const actualizar = (cambios) =>
		setParametros((anteriores) => ({ ...anteriores, ...cambios }));

	useEffect(() => {
		escribirParametros(parametros);
	}, [parametros]);

	// Atajos de teclado: ← y → cambian de día, H vuelve a hoy
	useEffect(() => {
		const alPulsar = (event) => {
			if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey)
				return;
			// En campos de formulario (fecha, botones de opción) las flechas ya tienen su función
			if (event.target.closest("input, select, textarea, [contenteditable]")) return;
			let cambio = null;
			if (event.key === "ArrowLeft") cambio = (fecha) => desplazarDia(fecha, -1);
			if (event.key === "ArrowRight") cambio = (fecha) => desplazarDia(fecha, 1);
			if (event.key === "h" || event.key === "H") cambio = () => hoy();
			if (!cambio) return;
			event.preventDefault();
			setParametros((anteriores) => {
				const fecha = cambio(anteriores.fecha);
				if (fecha < FECHA_MINIMA || fecha > manana()) return anteriores;
				return { ...anteriores, fecha };
			});
		};
		window.addEventListener("keydown", alPulsar);
		return () => window.removeEventListener("keydown", alPulsar);
	}, []);

	useEffect(() => {
		// Si se cambia de día antes de que llegue la respuesta, se descarta
		let vigente = true;
		cargarDia(fecha)
			.then((data) => {
				if (!vigente) return;
				setDatos({ fecha, data });
				setResultado({ fecha, intento, tipo: "ok" });
				// Precarga los días vecinos para que las flechas respondan al momento
				[desplazarDia(fecha, -1), desplazarDia(fecha, 1)]
					.filter((dia) => dia >= FECHA_MINIMA && dia <= manana())
					.forEach((dia) => cargarDia(dia).catch(() => {}));
			})
			.catch((error) => {
				if (!vigente) return;
				setDatos(null);
				setResultado({
					fecha,
					intento,
					tipo: error instanceof SinDatos ? "sin-datos" : "error",
				});
			});
		return () => {
			vigente = false;
		};
	}, [fecha, intento]);

	// Mientras se ve el día de hoy, comprueba si ya están publicados los precios de mañana
	// (Red Eléctrica los publica hacia las 20:15). Si aún no están, espera a las 20:15
	// y a partir de ahí reintenta cada 10 minutos
	const [hayManana, setHayManana] = useState(false);
	useEffect(() => {
		if (fecha !== hoy()) return;
		let vigente = true;
		let temporizador;
		const siguienteIntento = () => {
			const ahora = new Date();
			const publicacion = new Date(ahora);
			publicacion.setHours(20, 15, 0, 0);
			return Math.max(publicacion - ahora, 10 * 60 * 1000);
		};
		const comprobar = () =>
			cargarDia(manana())
				.then(() => vigente && setHayManana(true))
				.catch(() => {
					if (vigente) temporizador = setTimeout(comprobar, siguienteIntento());
				});
		comprobar();
		return () => {
			vigente = false;
			clearTimeout(temporizador);
		};
	}, [fecha]);

	// Mientras carga otro día se sigue mostrando el anterior (atenuado si tarda)
	const fechaMostrada = datos?.fecha ?? fecha;
	const actualizando = estado === "cargando" && datos !== null;
	// parseISO interpreta "YYYY-MM-DD" en hora local, a diferencia de new Date()
	const fechaSeleccionada = parseISO(fechaMostrada);
	const precios = useMemo(
		() => nivelesPrecio(filterData(datos?.data ?? null, zona, unidad)),
		[datos, zona, unidad]
	);
	const hayPrecios =
		(estado === "ok" || actualizando) && datos !== null && precios.length > 0;
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
		hayPrecios && fechaMostrada === hoy()
			? precios.findIndex((item) => parseInt(item.Hora) === horaActual)
			: -1;

	let titular = "Precio de la luz";
	if (hayPrecios) titular = fraseMasBarata(fechaMostrada, tramo);
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
				<div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
					<p className="text-suave first-letter:uppercase">{fechaLarga(fecha)}</p>
					{esHoy && hayManana && (
						<button
							type="button"
							onClick={() => actualizar({ fecha: manana() })}
							className="rounded-full bg-tinta px-3 py-1 text-sm font-medium text-papel hover:bg-tinta/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta"
						>
							Ver los precios de mañana
						</button>
					)}
				</div>
				{/* Al cambiar de día se mantiene el contenido; solo se atenúa si la carga pasa de 150 ms */}
				<div
					aria-busy={actualizando}
					className={`transition-opacity duration-200 motion-reduce:transition-none ${
						actualizando ? "opacity-50 delay-150" : "opacity-100"
					}`}
				>
					<h1
						aria-live="polite"
						className="mt-2 max-w-[18ch] text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl"
					>
						{titular}
					</h1>
	
					{estado === "cargando" && !datos && (
						<>
							<p className="mt-4 text-suave">Cargando precios…</p>
							<FranjaCargando />
						</>
					)}
	
					{estado === "sin-datos" && (
						<div className="mt-4 max-w-prose">
							<p>
								{fecha === manana()
									? "Red Eléctrica publica los precios del día siguiente hacia las 20:15. Vuelve a mirar después de esa hora."
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
								key={`${fechaMostrada}-${zona}`}
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
				</div>
			</main>

			<footer className="mx-auto max-w-5xl px-4 sm:px-8">
				<p className="border-t border-linea py-6 text-sm text-suave">
					Precio del término de energía de la tarifa PVPC (2.0TD) publicado por
					Red Eléctrica en ESIOS. No incluye impuestos.
				</p>
				<p className="hidden pb-6 text-sm text-suave [@media(pointer:fine)]:block">
					Atajos de teclado: <kbd className="font-sans font-medium">←</kbd> y{" "}
					<kbd className="font-sans font-medium">→</kbd> cambian de día,{" "}
					<kbd className="font-sans font-medium">H</kbd> vuelve a hoy.
				</p>
			</footer>
		</div>
	);
}
