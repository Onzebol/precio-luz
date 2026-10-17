import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { parseISO } from "date-fns";
import { Controles } from "./components/Controles";
import { SelectorDuracion } from "./components/SelectorDuracion";
import { FranjaCargando, FranjaHoras } from "./components/FranjaHoras";
import { TablaHoras } from "./components/TablaHoras";
import { FichaPotencia } from "./components/FichaPotencia";
import { CalculadoraFactura } from "./components/CalculadoraFactura";
import { compararConHabitual, pedirMedias } from "./comparativas";
import { pedirMes } from "./datos";
import {
	DURACIONES,
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

// El histórico se descarga solo al abrirlo, para no engordar la carga de la vista de día
const Historico = lazy(() =>
	import("./components/Historico").then((modulo) => ({ default: modulo.Historico }))
);

// Primer día con PVPC en ESIOS
const FECHA_MINIMA = "2014-04-01";

class SinDatos extends Error {}

// Meses ya pedidos (promesas), compartidos por todos sus días
const meses = new Map();
const pedirDatos = (fecha) => {
	const mes = fecha.slice(0, 7);
	if (!meses.has(mes)) {
		meses.set(
			mes,
			pedirMes(mes).catch((error) => {
				meses.delete(mes);
				throw error;
			})
		);
	}
	const peticion = meses.get(mes);
	return peticion.then((dias) => {
		if (dias[fecha]) return dias[fecha];
		// El día puede publicarse más tarde (p. ej. mañana): se olvida el mes para volver a pedirlo
		if (meses.get(mes) === peticion) meses.delete(mes);
		throw new SinDatos();
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

// La vista, la fecha, la zona y la unidad viven en la URL para poder compartir el enlace
const leerParametros = () => {
	const parametros = new URLSearchParams(window.location.search);
	const fecha = parametros.get("fecha") ?? "";
	return {
		vista: parametros.get("vista") === "historico" ? "historico" : "dia",
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

const urlParametros = ({ vista, fecha, zona, unidad, duracion }) => {
	const parametros = new URLSearchParams();
	if (vista !== "dia") parametros.set("vista", vista);
	if (fecha !== hoy()) parametros.set("fecha", fecha);
	if (zona !== "PCB") parametros.set("zona", "cym");
	if (unidad !== "kWh") parametros.set("unidad", "mwh");
	if (duracion) parametros.set("duracion", duracion);
	const consulta = parametros.toString();
	return `${window.location.pathname}${consulta ? `?${consulta}` : ""}`;
};

// Cambiar de vista añade una entrada al historial (para que «Atrás» vuelva a la anterior);
// el resto de cambios solo reescriben la URL actual
const escribirParametros = (parametros) => {
	const vistaActual = leerParametros().vista;
	const metodo = parametros.vista === vistaActual ? "replaceState" : "pushState";
	window.history[metodo](null, "", urlParametros(parametros));
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

const listaAnios = (anios) =>
	new Intl.ListFormat("es-ES", { type: "conjunction" }).format(anios.map(String));

// "La media del día es un 23 % más baja que la de octubre en 2024 y 2025 (0,187 €/kWh)."
const fraseHabitual = (comparacion, fecha, unidad) => {
	const mes = new Intl.DateTimeFormat("es-ES", { month: "long" }).format(parseISO(fecha));
	const referencia = `${formatearPrecio(
		unidad === "MWh" ? comparacion.media : comparacion.media / 1000,
		unidad
	)}/${unidad}`;
	const anios = listaAnios(comparacion.anios);
	const porcentaje = Math.round(Math.abs(comparacion.diferencia) * 100);
	const comparado = {
		igual: <>está en línea con la de {mes}</>,
		barato: (
			<>
				es <strong>un {porcentaje} % más baja</strong> que la de {mes}
			</>
		),
		// A partir del doble, «6,9 veces» se entiende mejor que «un 589 % más alta»
		caro:
			comparacion.diferencia >= 1 ? (
				<>
					es{" "}
					<strong>
						{new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(
							1 + comparacion.diferencia
						)}{" "}
						veces
					</strong>{" "}
					la de {mes}
				</>
			) : (
				<>
					es <strong>un {porcentaje} % más alta</strong> que la de {mes}
				</>
			),
	}[comparacion.tendencia];
	return (
		<>
			La media del día {comparado} en {anios} ({referencia}).
			{comparacion.cambio && (
				<span className="text-suave">
					{" "}
					Ojo: desde el {diaYMes(comparacion.cambio.fecha)} de{" "}
					{comparacion.cambio.fecha.slice(0, 4)} el precio se calcula de otra forma:{" "}
					{comparacion.cambio.titulo}.
				</span>
			)}
		</>
	);
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
	const { vista, fecha, zona, unidad, duracion } = parametros;
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

	// «Atrás» y «Adelante» del navegador entre vistas: el estado se vuelve a leer de la URL
	useEffect(() => {
		const alNavegar = () => setParametros(leerParametros());
		window.addEventListener("popstate", alNavegar);
		return () => window.removeEventListener("popstate", alNavegar);
	}, []);

	const cambiarVista = (event, cambios) => {
		// Con modificadores (nueva pestaña, etc.) se deja actuar al enlace
		if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
			return;
		event.preventDefault();
		if (cambios.vista === vista && !cambios.fecha) return;
		actualizar(cambios);
		window.scrollTo(0, 0);
	};

	// Enlace a un día desde el histórico (mapa de calor): abre la vista de día sin recargar
	const enlaceDia = (dia) => {
		const cambios = { vista: "dia", fecha: dia };
		return {
			href: urlParametros({ ...parametros, ...cambios }),
			onClick: (event) => cambiarVista(event, cambios),
		};
	};
	const verDia = (dia) => {
		actualizar({ vista: "dia", fecha: dia });
		window.scrollTo(0, 0);
	};

	// Atajos de teclado (solo en la vista de día): ← y → cambian de día, H vuelve a hoy
	useEffect(() => {
		if (vista !== "dia") return;
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
	}, [vista]);

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
	// Media de cada mes, para comparar el día con lo habitual. Si no llega, simplemente no se compara
	const [medias, setMedias] = useState(null);
	useEffect(() => {
		let vigente = true;
		pedirMedias()
			.then((datos) => vigente && setMedias(datos))
			.catch(() => {});
		return () => {
			vigente = false;
		};
	}, []);

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
	// Las medias mensuales están en €/MWh
	const comparacion =
		hayPrecios && medias
			? compararConHabitual(
					medias,
					fechaMostrada,
					zona,
					unidad === "MWh" ? media : media * 1000
				)
			: null;

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
				<div className="flex flex-wrap items-center gap-x-6 gap-y-3">
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
					{/* Enlaces de verdad (se pueden abrir en otra pestaña); el clic normal cambia de vista sin recargar */}
					<nav aria-label="Vistas" className="flex gap-1 rounded-md border border-linea bg-white/60 p-0.5">
						{[
							{ valor: "dia", texto: "Día" },
							{ valor: "historico", texto: "Histórico" },
						].map((opcion) => (
							<a
								key={opcion.valor}
								href={urlParametros({ ...parametros, vista: opcion.valor })}
								aria-current={vista === opcion.valor ? "page" : undefined}
								onClick={(event) => cambiarVista(event, { vista: opcion.valor })}
								className="rounded-[5px] px-3 py-1.5 text-sm font-medium text-suave hover:text-tinta aria-[current=page]:bg-tinta aria-[current=page]:text-papel focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta"
							>
								{opcion.texto}
							</a>
						))}
					</nav>
				</div>
				<Controles
					fecha={fecha}
					fechaMinima={FECHA_MINIMA}
					fechaMaxima={manana()}
					onFecha={vista === "dia" ? (valor) => actualizar({ fecha: valor }) : undefined}
					zona={zona}
					onZona={(valor) => actualizar({ zona: valor })}
					unidad={unidad}
					onUnidad={(valor) => actualizar({ unidad: valor })}
				/>
			</header>

			<main id="contenido" className="mx-auto max-w-5xl px-4 pb-16 pt-12 sm:px-8 sm:pt-16">
				{vista === "historico" ? (
					<Suspense fallback={<p className="text-suave">Cargando histórico…</p>}>
						<Historico zona={zona} unidad={unidad} enlaceDia={enlaceDia} verDia={verDia} />
					</Suspense>
				) : (
					<>
						<div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
						<p className="text-suave first-letter:uppercase">{fechaLarga(fecha)}</p>
						{esHoy && hayManana && (
							<button
								type="button"
								onClick={() => actualizar({ fecha: manana() })}
								className="rounded-full bg-tinta px-3 py-1 text-sm font-medium text-papel hover:bg-tinta/90 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta"
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
										className="mt-4 rounded-md bg-tinta px-4 py-2 font-medium text-papel hover:bg-tinta/90 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta"
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
									className="mt-4 rounded-md bg-tinta px-4 py-2 font-medium text-papel hover:bg-tinta/90 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta"
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
							{comparacion && (
								<p className="mt-6 max-w-prose">
									{fraseHabitual(comparacion, fechaMostrada, unidad)}
								</p>
							)}
		
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
								{/* Valores vigentes (del año en curso), sea cual sea el día elegido */}
								<FichaPotencia anio={Number(hoy().slice(0, 4))} />
								{medias && <CalculadoraFactura medias={medias} zona={zona} />}
							</>
						)}
					</div>
					</>
				)}
			</main>

			<footer className="mx-auto max-w-5xl px-4 sm:px-8">
				<p className="border-t border-linea py-6 text-sm text-suave">
					Precio del término de energía de la tarifa PVPC (2.0TD; hasta mayo de 2021,
					2.0A) publicado por Red Eléctrica en ESIOS. No incluye impuestos.
				</p>
				{vista === "dia" && <p className="hidden pb-6 text-sm text-suave pointer-fine:block">
					Atajos de teclado: <kbd className="font-sans font-medium">←</kbd> y{" "}
					<kbd className="font-sans font-medium">→</kbd> cambian de día,{" "}
					<kbd className="font-sans font-medium">H</kbd> vuelve a hoy.
				</p>}
			</footer>
		</div>
	);
}
