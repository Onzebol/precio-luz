import { useState } from "react";
import {
	formatearPrecio,
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
			<div className="h-6" />
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

export function FranjaHoras({ precios, unidad, fecha, zona, indiceAhora }) {
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
	const segmentos = segmentosPeriodo(precios, fecha, zona);
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
				{formatearPrecio(elegida.Precio, unidad, true)}/{unidad}, periodo{" "}
				{periodoElegido.text.toLowerCase()}
				{seleccion === indiceAhora && <span className="text-suave"> (ahora)</span>}
			</p>

			<div
				className="relative mt-3 grid h-56 gap-[2px] sm:h-72 sm:gap-1"
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
									className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-tinta"
									style={{ bottom: `calc(${cima}% + 6px)` }}
								>
									ahora
								</span>
							)}
							<span
								className={`absolute inset-x-0 ${redondeo} ${colorNivel[item.Nivel]} ${
									elegidaAhora ? "opacity-100 ring-2 ring-inset ring-tinta" : "opacity-80"
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
		</section>
	);
}
