import { useEffect, useRef, useState } from "react";
import { HITOS, cambiosEntre } from "../hitos";
import { desplazarDia, formatearPrecio } from "../utils";

// Colores del @theme de src/index.css (en SVG se usan como atributos, no como clases)
const TINTA = "#17262B";
const SUAVE = "#55666B";
const LINEA = "#C7D1CD";
const PAPEL = "#E9EEEB";

const ALTO = 280;
// Arriba quedan dos filas para los nombres de los cambios regulatorios
const MARGEN = { arriba: 40, derecha: 10, abajo: 26, izquierda: 44 };

// Posición en el tiempo (días). Date.UTC solo sirve aquí para medir distancias entre fechas
const dia = (fecha) =>
	Date.UTC(+fecha.slice(0, 4), +fecha.slice(5, 7) - 1, +fecha.slice(8, 10)) / 864e5;

// Marcas del eje Y en números redondos (1, 2 o 5 por una potencia de 10)
const marcasY = (minimo, maximo, cuantas = 5) => {
	const bruto = (maximo - minimo) / cuantas || 1;
	const potencia = 10 ** Math.floor(Math.log10(bruto));
	const paso = [1, 2, 5, 10].find((m) => m * potencia >= bruto) * potencia;
	// Desde la marca por debajo del mínimo hasta la primera que cubre el máximo
	const marcas = [];
	for (let i = Math.floor(minimo / paso); ; i++) {
		marcas.push(i * paso);
		if (i * paso >= maximo) return marcas;
	}
};

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Marcas del eje X: años (vista por meses) o meses (vista por días), saltando las que no caben
const marcasX = (desde, hasta, porMeses, ancho) => {
	const marcas = [];
	const [anio, mes] = [+desde.slice(0, 4), +desde.slice(5, 7)];
	for (let a = anio, m = mes; ; ) {
		// Siguiente 1 de enero o siguiente día 1
		if (porMeses) a++;
		else if (++m > 12) [a, m] = [a + 1, 1];
		const fecha = `${a}-${String(porMeses ? 1 : m).padStart(2, "0")}-01`;
		if (fecha > hasta) break;
		marcas.push({
			fecha,
			texto: porMeses ? String(a) : m === 1 ? String(a) : MESES_CORTOS[m - 1],
		});
	}
	const hueco = ancho / Math.max(marcas.length, 1);
	const cada = Math.ceil(36 / hueco);
	return marcas.filter((_, i) => i % cada === 0);
};

// Ancho del contenedor, para dibujar a escala real y que el texto no se deforme
const useAncho = () => {
	const ref = useRef(null);
	const [ancho, setAncho] = useState(0);
	useEffect(() => {
		const observador = new ResizeObserver(([entrada]) =>
			setAncho(Math.round(entrada.contentRect.width))
		);
		observador.observe(ref.current);
		return () => observador.disconnect();
	}, []);
	return [ref, ancho];
};

// puntos: [{ desde, hasta, etiqueta, media, minimo, maximo }] en €/MWh, ordenados por fecha
export function GraficoEvolucion({ puntos, unidad, porMeses }) {
	const [ref, ancho] = useAncho();
	const [elegido, setElegido] = useState(null);

	const convertir = (valor) => (unidad === "MWh" ? valor : valor / 1000);
	const precio = (valor) => `${formatearPrecio(convertir(valor), unidad)}/${unidad}`;

	const inicio = puntos[0].desde;
	const fin = puntos.at(-1).desde;
	const anchoPlot = Math.max(ancho - MARGEN.izquierda - MARGEN.derecha, 1);
	const altoPlot = ALTO - MARGEN.arriba - MARGEN.abajo;
	const x = (fecha) =>
		MARGEN.izquierda + ((dia(fecha) - dia(inicio)) / (dia(fin) - dia(inicio) || 1)) * anchoPlot;

	// El eje empieza en 0 o, si hay precios negativos, justo en el más bajo: una marca
	// redonda por debajo desperdiciaría media altura por unos céntimos negativos
	const yMin = Math.min(0, ...puntos.map((p) => convertir(p.minimo)));
	const ticks = marcasY(yMin, Math.max(...puntos.map((p) => convertir(p.maximo)))).filter(
		(valor) => valor >= yMin
	);
	const yMax = ticks.at(-1);
	// yValor recibe el valor ya en la unidad elegida (marcas del eje); y, en €/MWh (datos)
	const yValor = (valor) =>
		MARGEN.arriba + altoPlot - ((valor - yMin) / (yMax - yMin || 1)) * altoPlot;
	const y = (valor) => yValor(convertir(valor));
	const decimalesEje = unidad === "MWh" || ticks[1] - ticks[0] >= 1 ? 0 : 2;
	const textoEje = (valor) =>
		new Intl.NumberFormat("es-ES", {
			minimumFractionDigits: decimalesEje,
			maximumFractionDigits: decimalesEje,
		}).format(valor);

	const linea = puntos.map((p, i) => `${i ? "L" : "M"}${x(p.desde)},${y(p.media)}`).join("");
	const banda = `${puntos.map((p, i) => `${i ? "L" : "M"}${x(p.desde)},${y(p.maximo)}`).join("")}${puntos
		.toReversed()
		.map((p) => `L${x(p.desde)},${y(p.minimo)}`)
		.join("")}Z`;

	// Cambios regulatorios visibles; los nombres se reparten en dos filas para no pisarse
	const finFilas = [-Infinity, -Infinity];
	const hitos = HITOS.filter((h) => h.fecha <= fin && (h.hasta ?? h.fecha) >= inicio).map(
		(hito) => {
			const desde = x(hito.fecha < inicio ? inicio : hito.fecha);
			const hasta = hito.hasta ? x(hito.hasta > fin ? fin : hito.hasta) : null;
			const anchoTexto = hito.corto.length * 6.2;
			const izquierda = Math.min(desde, MARGEN.izquierda + anchoPlot - anchoTexto);
			const fila = izquierda > finFilas[0] ? 0 : 1;
			finFilas[fila] = izquierda + anchoTexto + 6;
			return { hito, desde, hasta, izquierda, fila };
		}
	);

	// Punto más cercano al puntero en horizontal
	const alMover = (event) => {
		const caja = event.currentTarget.getBoundingClientRect();
		const px = event.clientX - caja.left;
		let mejor = 0;
		puntos.forEach((p, i) => {
			if (Math.abs(x(p.desde) - px) < Math.abs(x(puntos[mejor].desde) - px)) mejor = i;
		});
		setElegido(mejor);
	};

	const alPulsar = (event) => {
		const pasos = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };
		if (!(event.key in pasos)) return;
		event.preventDefault();
		setElegido((actual) =>
			Math.min(puntos.length - 1, Math.max(0, (actual ?? puntos.length - 1) + pasos[event.key]))
		);
	};

	const punto = elegido !== null ? puntos[Math.min(elegido, puntos.length - 1)] : null;
	const ultimo = puntos.at(-1);
	// Cambios regulatorios dentro del periodo del punto, su primer día incluido
	const cambiosPunto = punto ? cambiosEntre(desplazarDia(punto.desde, -1), punto.hasta) : [];

	return (
		<figure className="mt-8">
			<div
				ref={ref}
				// Con el teclado: ← y → recorren los puntos, Inicio y Fin van a los extremos
				tabIndex={0}
				role="group"
				aria-label={`Gráfico del precio medio ${porMeses ? "de cada mes" : "de cada día"}. Usa las flechas para recorrerlo.`}
				onKeyDown={alPulsar}
				onFocus={() => setElegido((actual) => actual ?? puntos.length - 1)}
				onBlur={() => setElegido(null)}
				className="relative rounded-md focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-tinta"
			>
				{ancho > 0 && (
					<svg
						width={ancho}
						height={ALTO}
						aria-hidden="true"
						className="block touch-pan-y select-none"
						onPointerMove={alMover}
						onPointerDown={alMover}
						onPointerLeave={(event) => event.pointerType === "mouse" && setElegido(null)}
					>
						{/* Medidas temporales (excepción ibérica): zona sombreada */}
						{hitos
							.filter((h) => h.hasta !== null)
							.map((h) => (
								<rect
									key={h.hito.fecha}
									x={h.desde}
									y={MARGEN.arriba}
									width={Math.max(h.hasta - h.desde, 1)}
									height={altoPlot}
									fill={TINTA}
									fillOpacity={0.05}
								/>
							))}

						{ticks.map((valor) => (
							<g key={valor}>
								<line
									x1={MARGEN.izquierda}
									x2={MARGEN.izquierda + anchoPlot}
									y1={yValor(valor)}
									y2={yValor(valor)}
									stroke={valor === 0 ? SUAVE : LINEA}
									strokeWidth={1}
								/>
								<text
									x={MARGEN.izquierda - 6}
									y={yValor(valor)}
									dy="0.32em"
									textAnchor="end"
									fontSize={12}
									fill={SUAVE}
									className="tabular-nums"
								>
									{textoEje(valor)}
								</text>
							</g>
						))}

						{marcasX(inicio, fin, porMeses, anchoPlot).map((marca) => (
							<text
								key={marca.fecha}
								x={x(marca.fecha)}
								y={ALTO - 6}
								textAnchor="middle"
								fontSize={12}
								fill={SUAVE}
							>
								{marca.texto}
							</text>
						))}

						{/* Cambios regulatorios: línea fina, rombo y nombre corto arriba */}
						{hitos.map((h) => (
							<g key={h.hito.fecha}>
								{h.hasta === null && (
									<line
										x1={h.desde}
										x2={h.desde}
										y1={MARGEN.arriba - 4}
										y2={MARGEN.arriba + altoPlot}
										stroke={SUAVE}
										strokeWidth={1}
									/>
								)}
								<rect
									x={h.desde - 3}
									y={MARGEN.arriba - 7}
									width={6}
									height={6}
									fill={TINTA}
									transform={`rotate(45 ${h.desde} ${MARGEN.arriba - 4})`}
								/>
								<text
									x={h.izquierda}
									y={8 + h.fila * 14}
									dy="0.32em"
									fontSize={11}
									fill={SUAVE}
								>
									{h.hito.corto}
								</text>
							</g>
						))}

						<path d={banda} fill={TINTA} fillOpacity={0.1} />
						<path
							d={linea}
							fill="none"
							stroke={TINTA}
							strokeWidth={2}
							strokeLinejoin="round"
							strokeLinecap="round"
						/>

						{punto ? (
							<g>
								<line
									x1={x(punto.desde)}
									x2={x(punto.desde)}
									y1={MARGEN.arriba}
									y2={MARGEN.arriba + altoPlot}
									stroke={TINTA}
									strokeWidth={1}
								/>
								<circle
									cx={x(punto.desde)}
									cy={y(punto.media)}
									r={4}
									fill={TINTA}
									stroke={PAPEL}
									strokeWidth={2}
								/>
							</g>
						) : (
							<circle
								cx={x(ultimo.desde)}
								cy={y(ultimo.media)}
								r={4}
								fill={TINTA}
								stroke={PAPEL}
								strokeWidth={2}
							/>
						)}

						{/* Superficie que recibe el puntero: todo el área de dibujo, no solo la línea */}
						<rect
							x={MARGEN.izquierda}
							y={0}
							width={anchoPlot}
							height={ALTO}
							fill="transparent"
						/>
					</svg>
				)}

				{punto && (
					<div
						className="pointer-events-none absolute top-10 z-10 w-max max-w-60 rounded-md border border-linea bg-white px-3 py-2 text-sm shadow-xs"
						style={
							x(punto.desde) > ancho / 2
								? { right: ancho - x(punto.desde) + 10 }
								: { left: x(punto.desde) + 10 }
						}
					>
						<p className="font-display text-lg font-semibold leading-tight">
							{precio(punto.media)}
						</p>
						<p className="text-suave">{punto.etiqueta}</p>
						<p className="mt-1 text-suave">
							{porMeses ? "Horas más barata y más cara, de media: " : "Hora más barata y más cara: "}
							{formatearPrecio(convertir(punto.minimo), unidad)} y {formatearPrecio(convertir(punto.maximo), unidad)}
						</p>
						{cambiosPunto.map((cambio) => (
							<p key={cambio.fecha} className="mt-1 font-medium">
								{cambio.titulo}
							</p>
						))}
					</div>
				)}
			</div>

			{/* Lectura para lectores de pantalla del punto elegido con el teclado */}
			<p aria-live="polite" className="sr-only">
				{punto &&
					`${punto.etiqueta}: media ${precio(punto.media)}, entre ${precio(punto.minimo)} y ${precio(punto.maximo)}`}
			</p>

			<figcaption className="mt-3 max-w-prose text-sm text-suave">
				La línea es el precio medio {porMeses ? "de cada mes" : "de cada día"}; la banda va de
				la hora más barata a la más cara del día{porMeses ? " (su media en el mes)" : ""}.
				{hitos.some((h) => h.hasta !== null) && " La zona sombreada es la excepción ibérica."}{" "}
				Último dato: {ultimo.etiqueta},{" "}
				{precio(ultimo.media)}.
			</figcaption>
		</figure>
	);
}
