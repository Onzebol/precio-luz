import { useState } from "react";
import {
	formatearPrecio,
	hayPeriodos,
	horaCorta,
	incrementarHora,
	periodoPeaje,
	rangoHoras,
	segmentosPeriodo,
} from "../utils";

const colorNivel = {
	bajo: "bg-barato",
	medio: "bg-medio",
	alto: "bg-caro",
};

// La barra seleccionada se distingue con un tono más oscuro de su mismo color
const colorNivelIntenso = {
	bajo: "bg-barato-intenso",
	medio: "bg-medio-intenso",
	alto: "bg-caro-intenso",
};

const textoNivel = {
	bajo: "precio bajo",
	medio: "precio medio",
	alto: "precio alto",
};

const fondoPeriodo = {
	valle: "bg-tinta/10 text-tinta",
	llano: "bg-tinta/25 text-tinta",
	punta: "bg-tinta/80 text-papel",
};

// Esqueleto con 24 barras grises mientras llegan los datos
export function FranjaCargando() {
	return (
		<div aria-hidden="true" className="mt-10">
			<div className="h-10" />
			<div className="flex h-56 items-end gap-[2px] sm:h-72 sm:gap-1">
				{Array.from({ length: 24 }, (_, i) => (
					<span
						key={i}
						className="block flex-1 rounded-t-[3px] bg-tinta/10 motion-safe:animate-pulse"
						style={{ height: `${35 + ((i * 37) % 50)}%` }}
					/>
				))}
			</div>
		</div>
	);
}

export function FranjaHoras({ precios, unidad, fecha, zona, indiceAhora, bloque }) {
	const indiceMinimo = precios.reduce(
		(minimo, item, i) => (item.Precio < precios[minimo].Precio ? i : minimo),
		0
	);
	const [seleccion, setSeleccion] = useState(indiceAhora ?? indiceMinimo);
	const valores = precios.map((item) => item.Precio);
	const maximo = Math.max(0, ...valores);
	const minimo = Math.min(0, ...valores);
	const rango = maximo - minimo || 1;
	// Altura (en %) de la línea de cero: 0 salvo que haya precios negativos
	const base = (-minimo / rango) * 100;
	// Antes de la tarifa 2.0TD no había periodos: no se pintan ni la banda ni su nombre
	const conPeriodos = hayPeriodos(fecha);
	const segmentos = conPeriodos ? segmentosPeriodo(precios, fecha, zona) : [];
	const elegida = precios[seleccion];
	const periodoElegido = periodoPeaje(elegida.Hora, fecha, zona);
	// Los días de cambio de hora tienen 23 o 25 horas
	const columnas = {
		gridTemplateColumns: `repeat(${precios.length}, minmax(0, 1fr))`,
	};

	return (
		<section aria-labelledby="titulo-franja" className="mt-10">
			<h2 id="titulo-franja" className="sr-only">
				Precio de cada hora
			</h2>
			<p aria-live="polite" className="h-6 text-sm sm:text-base">
				<span className="font-semibold">
					{rangoHoras(elegida.Hora, incrementarHora(elegida.Hora))}
				</span>{" "}
				{formatearPrecio(elegida.Precio, unidad, true)}/{unidad}
				{periodoElegido && `, periodo ${periodoElegido.text.toLowerCase()}`}
				{seleccion === indiceAhora && <span className="text-suave"> (ahora)</span>}
			</p>

			{/* Corchete sobre las horas del bloque elegido en el selector de duración */}
			<div
				aria-hidden="true"
				className="mt-3 grid h-3 gap-[2px] sm:gap-1"
				style={columnas}
			>
				{bloque && (
					<span
						className="rounded-t-[3px] border-2 border-b-0 border-tinta"
						style={{ gridColumn: `${bloque.inicio + 1} / span ${bloque.horas}` }}
					/>
				)}
			</div>
			<div
				className="relative mt-1 grid h-56 gap-[2px] sm:h-72 sm:gap-1"
				style={columnas}
			>
				{base > 0 && (
					<span
						aria-hidden="true"
						className="pointer-events-none absolute inset-x-0 z-10 border-t border-tinta/60"
						style={{ bottom: `${base}%` }}
					/>
				)}
				{precios.map((item, i) => {
					// Las barras crecen desde la línea de cero: hacia arriba o, si el precio es negativo, hacia abajo
					const alto = (Math.abs(item.Precio) / rango) * 100;
					const desde = item.Precio >= 0 ? base : base - alto;
					const cima = item.Precio >= 0 ? base + alto : base;
					const redondeo = item.Precio >= 0 ? "rounded-t-[3px]" : "rounded-b-[3px]";
					const elegidaAhora = i === seleccion;
					return (
						<button
							key={i}
							type="button"
							aria-pressed={elegidaAhora}
							aria-label={`${rangoHoras(item.Hora, incrementarHora(item.Hora))}: ${formatearPrecio(
								item.Precio,
								unidad,
								true
							)}/${unidad}, ${textoNivel[item.Nivel]}`}
							onClick={() => setSeleccion(i)}
							onMouseEnter={() => setSeleccion(i)}
							onFocus={() => setSeleccion(i)}
							className="relative h-full min-w-0 touch-manipulation rounded-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta"
						>
							{i === indiceAhora && (
								<span
									// En móvil la barra es estrecha: el texto va en vertical para no tapar las vecinas
									className="pointer-events-none absolute left-1/2 -translate-x-1/2 rotate-180 whitespace-nowrap text-xs font-medium leading-none text-tinta [writing-mode:vertical-rl] sm:rotate-0 sm:leading-normal sm:[writing-mode:horizontal-tb]"
									style={{ bottom: `calc(${cima}% + 6px)` }}
								>
									ahora
								</span>
							)}
							<span
								className={`absolute inset-x-0 ${redondeo} ${
									elegidaAhora
										? colorNivelIntenso[item.Nivel]
										: `${colorNivel[item.Nivel]} opacity-80`
								}`}
								style={{ bottom: `${desde}%`, height: `${alto}%` }}
							/>
						</button>
					);
				})}
			</div>

			<div
				aria-hidden="true"
				className="mt-1.5 grid gap-[2px] text-xs text-suave sm:gap-1"
				style={columnas}
			>
				{precios.map((item, i) => (
					<span key={i} className="text-center">
						{i % 3 === 0 ? horaCorta(item.Hora) : ""}
					</span>
				))}
			</div>

			{conPeriodos ? (
				<>
					<div
						aria-hidden="true"
						className="mt-3 grid gap-[2px] sm:gap-1"
						style={columnas}
					>
						{segmentos.map((segmento, i) => (
							<span
								key={i}
								className={`truncate rounded-[3px] px-1.5 py-1 text-xs font-medium ${
									fondoPeriodo[segmento.periodo.clave]
								}`}
								style={{ gridColumn: `span ${segmento.horas}` }}
							>
								{segmento.horas >= 2 ? segmento.periodo.text.toLowerCase() : ""}
							</span>
						))}
					</div>
					<p className="mt-2 text-xs text-suave">
						La banda inferior marca el periodo de peaje de cada hora.
					</p>
				</>
			) : (
				<p className="mt-3 text-xs text-suave">
					Hasta mayo de 2021 la tarifa era la 2.0A, sin periodos de peaje.
				</p>
			)}
		</section>
	);
}
