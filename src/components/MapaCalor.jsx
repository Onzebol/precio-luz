import { useEffect, useMemo, useRef, useState } from "react";
import { parseISO } from "date-fns";
import { pedirMes } from "../datos";
import { desplazarDia, formatearPrecio, horaReloj } from "../utils";
import { Segmentado } from "./Controles";
import { useAncho } from "../useAncho";

// Rampas calculadas en OKLab. Precio: de casi blanco a la tinta. Frente a la media:
// azul (más barata) y rojo (más cara) con el neutro en medio; no se usan el verde y el
// rojo de los niveles de precio porque con daltonismo rojo-verde no se distinguen
const SECUENCIAL = ["#f5f7f6", "#ccd0d1", "#a4abac", "#7d8789", "#596568", "#374448", "#17262b"];
const DIVERGENTE = [
	"#16709a", "#5891b1", "#8db2c8", "#c0d4df",
	"#f5f7f6",
	"#e7c7bf", "#d59789", "#c06755", "#a8321c",
];
const TINTA = "#17262B";

const ALTO_FILA = 10;
const HORAS = 24;

const MODOS = [
	{ valor: "media", texto: "Frente a la media del día" },
	{ valor: "precio", texto: "Precio" },
];

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const nombreDia = (fecha) =>
	new Intl.DateTimeFormat("es-ES", {
		weekday: "short",
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(parseISO(fecha));

// Meses ya pedidos (promesas); los de otros años o zonas se reaprovechan
const meses = new Map();
const pedirMesGuardado = (mes) => {
	if (!meses.has(mes)) {
		meses.set(
			mes,
			pedirMes(mes).catch((error) => {
				meses.delete(mes);
				throw error;
			})
		);
	}
	return meses.get(mes);
};

// Días del periodo: un año natural o los últimos 365 días con datos
const diasDelPeriodo = (periodo, ultimoDia) => {
	const desde = periodo === "ultimo" ? desplazarDia(ultimoDia, -364) : `${periodo}-01-01`;
	const hasta = periodo === "ultimo" || ultimoDia < `${periodo}-12-31` ? ultimoDia : `${periodo}-12-31`;
	const dias = [];
	for (let fecha = desde; fecha <= hasta; fecha = desplazarDia(fecha, 1)) dias.push(fecha);
	return dias;
};

// Por día, el precio de cada hora del reloj (null si no existe: la 02:00 del cambio de
// hora de primavera o un día sin datos). Las dos 02:00 de otoño se promedian
const filasDelPeriodo = (dias, datos, zona) =>
	dias.map((fecha) => {
		const precios = datos[fecha];
		if (!precios) return { fecha, horas: Array(HORAS).fill(null), media: null };
		const sumas = Array(HORAS).fill(0);
		const cuentas = Array(HORAS).fill(0);
		precios.forEach((hora, indice) => {
			sumas[horaReloj(precios, indice)] += hora[zona];
			cuentas[horaReloj(precios, indice)]++;
		});
		const media = precios.reduce((suma, hora) => suma + hora[zona], 0) / precios.length;
		return { fecha, horas: sumas.map((suma, h) => (cuentas[h] ? suma / cuentas[h] : null)), media };
	});

const percentil = (ordenados, q) => ordenados[Math.floor(q * (ordenados.length - 1))];

// Escala por tramos. Los extremos se recortan a los percentiles 2 y 98 para que unas
// pocas horas excepcionales no dejen todo el resto del mismo color
const crearEscala = (filas, modo) => {
	if (modo === "precio") {
		const valores = filas.flatMap((f) => f.horas).filter((v) => v !== null).sort((a, b) => a - b);
		const desde = percentil(valores, 0.02);
		const hasta = percentil(valores, 0.98);
		const tramos = SECUENCIAL.length;
		return {
			desde,
			hasta,
			color: (valor) =>
				SECUENCIAL[Math.min(tramos - 1, Math.max(0, Math.floor(((valor - desde) / (hasta - desde || 1)) * tramos)))],
		};
	}
	const diferencias = filas
		.flatMap((f) => f.horas.map((v) => (v === null ? null : Math.abs(v - f.media))))
		.filter((v) => v !== null)
		.sort((a, b) => a - b);
	const limite = percentil(diferencias, 0.98) || 1;
	const lado = (DIVERGENTE.length - 1) / 2;
	return {
		desde: -limite,
		hasta: limite,
		color: (valor, media) =>
			DIVERGENTE[lado + Math.max(-lado, Math.min(lado, Math.round(((valor - media) / limite) * lado)))],
	};
};

// Etiquetas del eje X: el día 1 de cada mes, saltando las que no caben
const marcasMeses = (filas, ancho) => {
	const marcas = filas
		.map((f, i) => ({ i, fecha: f.fecha }))
		.filter(({ fecha }) => fecha.endsWith("-01"))
		.map(({ i, fecha }) => {
			const mes = Number(fecha.slice(5, 7));
			return { i, texto: mes === 1 ? fecha.slice(0, 4) : MESES_CORTOS[mes - 1] };
		});
	const cada = Math.ceil(30 / (ancho / Math.max(marcas.length, 1)));
	return marcas.filter((_, k) => k % cada === 0);
};

// Se dibuja al ancho real del lienzo, con la densidad de la pantalla, para que se vea nítido
const dibujar = (lienzo, filas, escala, elegida) => {
	const ancho = lienzo.clientWidth;
	const ratio = window.devicePixelRatio || 1;
	const alto = HORAS * ALTO_FILA;
	lienzo.width = Math.round(ancho * ratio);
	lienzo.height = Math.round(alto * ratio);
	const ctx = lienzo.getContext("2d");
	ctx.scale(ratio, ratio);
	ctx.clearRect(0, 0, ancho, alto);
	const n = filas.length;
	// Bordes enteros para que no queden rendijas entre columnas
	const x = (i) => Math.round((i * ancho) / n);
	filas.forEach((fila, i) => {
		fila.horas.forEach((valor, h) => {
			if (valor === null) return;
			ctx.fillStyle = escala.color(valor, fila.media);
			ctx.fillRect(x(i), h * ALTO_FILA, x(i + 1) - x(i), ALTO_FILA);
		});
	});
	if (!elegida) return;
	// Recuadro de la casilla elegida, con un mínimo de ancho para que se vea en columnas de 1 px
	const centro = (x(elegida.i) + x(elegida.i + 1)) / 2;
	const anchoMarca = Math.max(x(elegida.i + 1) - x(elegida.i), 6);
	ctx.strokeStyle = TINTA;
	ctx.lineWidth = 2;
	ctx.strokeRect(centro - anchoMarca / 2, elegida.h * ALTO_FILA - 1, anchoMarca, ALTO_FILA + 2);
	ctx.strokeStyle = "#ffffff";
	ctx.lineWidth = 1;
	ctx.strokeRect(centro - anchoMarca / 2 - 1.5, elegida.h * ALTO_FILA - 2.5, anchoMarca + 3, ALTO_FILA + 5);
};

// periodos: años con datos, del más reciente al más antiguo. ultimoDia: último día publicado
export function MapaCalor({ periodos, ultimoDia, zona, unidad, enlaceDia, verDia }) {
	const [periodo, setPeriodo] = useState("ultimo");
	const [modo, setModo] = useState("media");
	const [intento, setIntento] = useState(0);
	// Última carga terminada; si es de otro periodo o intento, se está cargando
	const [resultado, setResultado] = useState(null);
	const vigente = resultado?.periodo === periodo && resultado.intento === intento;

	useEffect(() => {
		let actual = true;
		const dias = diasDelPeriodo(periodo, ultimoDia);
		const mesesPeriodo = [...new Set(dias.map((fecha) => fecha.slice(0, 7)))];
		Promise.all(mesesPeriodo.map(pedirMesGuardado))
			.then((datos) => {
				if (actual) setResultado({ periodo, intento, dias, datos: Object.assign({}, ...datos) });
			})
			.catch(() => actual && setResultado({ periodo, intento, error: true }));
		return () => {
			actual = false;
		};
	}, [periodo, ultimoDia, intento]);

	// Mientras carga otro periodo se sigue mostrando el anterior
	const filas = useMemo(
		() => (resultado?.dias ? filasDelPeriodo(resultado.dias, resultado.datos, zona) : null),
		[resultado, zona]
	);
	const escala = useMemo(() => (filas ? crearEscala(filas, modo) : null), [filas, modo]);

	const [ref, ancho] = useAncho();
	const lienzo = useRef(null);
	// La casilla bajo el ratón manda sobre la fijada (con clic, toque o teclado)
	const [fijada, setFijada] = useState(null);
	const [previa, setPrevia] = useState(null);
	const enRango = (casilla) => (casilla && filas && casilla.i < filas.length ? casilla : null);
	const elegida = enRango(previa) ?? enRango(fijada);

	useEffect(() => {
		// ancho solo hace falta para volver a dibujar al cambiar el tamaño
		if (lienzo.current && filas && ancho) dibujar(lienzo.current, filas, escala, elegida);
	}, [filas, escala, ancho, elegida]);

	const precio = (valor) =>
		`${formatearPrecio(unidad === "MWh" ? valor : valor / 1000, unidad)}/${unidad}`;

	const casillaEn = (event) => {
		const caja = event.currentTarget.getBoundingClientRect();
		const i = Math.floor(((event.clientX - caja.left) / caja.width) * filas.length);
		const h = Math.floor(((event.clientY - caja.top) / caja.height) * HORAS);
		return { i: Math.max(0, Math.min(filas.length - 1, i)), h: Math.max(0, Math.min(HORAS - 1, h)) };
	};

	const alTeclear = (event) => {
		if (!filas) return;
		const actual = enRango(fijada) ?? { i: filas.length - 1, h: 12 };
		const movimientos = {
			ArrowLeft: { i: -1 },
			ArrowRight: { i: 1 },
			ArrowUp: { h: -1 },
			ArrowDown: { h: 1 },
			PageUp: { i: -7 },
			PageDown: { i: 7 },
		};
		let nueva;
		if (movimientos[event.key]) {
			const { i = 0, h = 0 } = movimientos[event.key];
			nueva = {
				i: Math.max(0, Math.min(filas.length - 1, actual.i + i)),
				h: Math.max(0, Math.min(HORAS - 1, actual.h + h)),
			};
		} else if (event.key === "Home") nueva = { ...actual, i: 0 };
		else if (event.key === "End") nueva = { ...actual, i: filas.length - 1 };
		else if (event.key === "Enter" && enRango(fijada)) {
			verDia(filas[actual.i].fecha);
			return;
		} else return;
		event.preventDefault();
		setPrevia(null);
		setFijada(nueva);
	};

	const detalle = (() => {
		if (!elegida) return null;
		const fila = filas[elegida.i];
		const valor = fila.horas[elegida.h];
		const horas = `de ${String(elegida.h).padStart(2, "0")} a ${String(elegida.h + 1).padStart(2, "0")} h`;
		if (valor === null)
			return { fecha: fila.fecha, texto: `${nombreDia(fila.fecha)}, ${horas}: sin precio` };
		const diferencia = valor - fila.media;
		const respecto =
			Math.abs(diferencia) < 0.005
				? "igual que la media del día"
				: `${precio(Math.abs(diferencia))} ${diferencia < 0 ? "por debajo" : "por encima"} de la media del día`;
		return { fecha: fila.fecha, texto: `${nombreDia(fila.fecha)}, ${horas}: ${precio(valor)} (${respecto})` };
	})();

	const error = vigente && resultado.error;

	return (
		<div ref={ref}>
			<div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-4">
				<label className="block">
					<span className="mb-1 block text-sm text-suave">Periodo</span>
					<select
						value={periodo}
						onChange={(event) => setPeriodo(event.target.value)}
						className="h-[38px] rounded-md border border-linea bg-white/60 px-2 font-medium focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta"
					>
						<option value="ultimo">Últimos 12 meses</option>
						{periodos.map((anio) => (
							<option key={anio} value={anio}>
								{anio}
							</option>
						))}
					</select>
				</label>
				<Segmentado leyenda="Color" nombre="modo-mapa" valor={modo} onCambio={setModo} opciones={MODOS} />
			</div>

			<p aria-live="polite" className="mt-4 min-h-12 text-sm sm:min-h-6">
				{detalle ? (
					<>
						<span className="first-letter:uppercase">{detalle.texto}</span>{" "}
						<a
							{...enlaceDia(detalle.fecha)}
							className="whitespace-nowrap font-medium underline decoration-linea underline-offset-2 hover:decoration-tinta"
						>
							Ver el día
						</a>
					</>
				) : (
					<span className="text-suave">
						Pasa el ratón por encima o toca una casilla para ver su precio (con un clic se queda fijada); con el teclado, las flechas.
					</span>
				)}
			</p>

			{error ? (
				<div className="mt-2">
					<p>No se han podido cargar los precios de este periodo.</p>
					<button
						type="button"
						onClick={() => setIntento((n) => n + 1)}
						className="mt-3 rounded-md bg-tinta px-4 py-2 font-medium text-papel hover:bg-tinta/90 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta"
					>
						Reintentar
					</button>
				</div>
			) : (
				<div className="mt-2 flex gap-2">
					{/* Horas del día en el eje Y, de 0 arriba a 23 abajo */}
					<div aria-hidden="true" className="relative w-6 shrink-0 text-right text-[11px] text-suave" style={{ height: HORAS * ALTO_FILA }}>
						{[0, 6, 12, 18].map((h) => (
							<span key={h} className="absolute right-0 leading-none" style={{ top: h * ALTO_FILA }}>
								{h} h
							</span>
						))}
					</div>
					<div className="min-w-0 flex-1">
						<div
							role="img"
							tabIndex={0}
							aria-label={`Mapa de calor: precio de cada hora (filas, de 0 a 23 h) de cada día (columnas)${
								filas ? `, del ${nombreDia(filas[0].fecha)} al ${nombreDia(filas.at(-1).fecha)}` : ""
							}. Usa las flechas para recorrerlo e Intro para abrir el día.`}
							onKeyDown={alTeclear}
							onPointerMove={(event) => filas && event.pointerType === "mouse" && setPrevia(casillaEn(event))}
							onPointerLeave={() => setPrevia(null)}
							onPointerDown={(event) => filas && setFijada(casillaEn(event))}
							className={`relative touch-pan-y rounded-xs focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-tinta ${
								vigente ? "" : "opacity-50"
							} ${filas ? "cursor-crosshair" : ""}`}
							style={{ height: HORAS * ALTO_FILA }}
						>
							<canvas ref={lienzo} className="block h-full w-full" />
							{!filas && (
								<span className="absolute inset-0 grid place-items-center text-sm text-suave">Cargando…</span>
							)}
						</div>
						<div aria-hidden="true" className="relative mt-1 h-4 text-[11px] text-suave">
							{filas &&
								marcasMeses(filas, ancho).map(({ i, texto }) => (
									<span key={i} className="absolute" style={{ left: `${(i / filas.length) * 100}%` }}>
										{texto}
									</span>
								))}
						</div>
					</div>
				</div>
			)}

			{escala && !error && (
				<div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-suave">
					<span>{modo === "precio" ? `${precio(escala.desde)} o menos` : `${precio(escala.hasta)} más barata`}</span>
					<span aria-hidden="true" className="flex">
						{(modo === "precio" ? SECUENCIAL : DIVERGENTE).map((color) => (
							<span key={color} className="h-3 w-5" style={{ backgroundColor: color }} />
						))}
					</span>
					<span>{modo === "precio" ? `${precio(escala.hasta)} o más` : `${precio(escala.hasta)} más cara`}</span>
				</div>
			)}
		</div>
	);
}
