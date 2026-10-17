import { useState } from "react";
import { INICIO_2_0TD } from "../utils";

const porcentaje = new Intl.NumberFormat("es-ES", {
	style: "percent",
	maximumFractionDigits: 0,
});

// Tailwind no trae grid-cols-24
const VEINTICUATRO = { gridTemplateColumns: "repeat(24, minmax(0, 1fr))" };

const describir = (hora, valor) =>
	`De ${String(hora).padStart(2, "0")} a ${String(hora + 1).padStart(2, "0")} h: ${
		Math.abs(valor) < 0.005
			? "como la media del día"
			: `${porcentaje.format(Math.abs(valor))} ${valor < 0 ? "por debajo" : "por encima"} de la media del día`
	}`;

function Perfil({ perfil, escala }) {
	const [elegida, setElegida] = useState(perfil.barata);
	// La línea de la media queda a la altura que corresponde dentro de la escala común
	const cero = (escala.abajo / (escala.arriba + escala.abajo)) * 100;
	const tarifa = `${perfil.anio}-12-31` < INICIO_2_0TD ? "tarifa 2.0A" : "tarifa 2.0TD";
	return (
		<figure className="min-w-0">
			<figcaption>
				<span className="font-display text-lg font-semibold">{perfil.anio}</span>{" "}
				<span className="text-sm text-suave">
					({tarifa}
					{perfil.meses < 12 ? `, ${perfil.meses} meses` : ""})
				</span>
				<span className="block text-sm">
					Hora más barata:{" "}
					<strong>
						de {perfil.barata} a {perfil.barata + 1} h
					</strong>
				</span>
			</figcaption>
			<p aria-live="polite" className="mt-2 h-10 text-xs text-suave sm:h-5">
				{describir(elegida, perfil.relativos[elegida])}
			</p>
			<div
				className="relative mt-1 grid h-36 gap-px"
				style={VEINTICUATRO}
			>
				<span
					aria-hidden="true"
					className="pointer-events-none absolute inset-x-0 z-10 border-t border-tinta/60"
					style={{ bottom: `${cero}%` }}
				/>
				{perfil.relativos.map((valor, hora) => {
					const alto = (Math.abs(valor) / (escala.arriba + escala.abajo)) * 100;
					const color =
						hora === perfil.barata
							? "bg-barato-intenso"
							: hora === elegida
								? "bg-tinta"
								: "bg-tinta/40";
					return (
						<button
							key={hora}
							type="button"
							aria-label={describir(hora, valor)}
							aria-pressed={hora === elegida}
							onClick={() => setElegida(hora)}
							onMouseEnter={() => setElegida(hora)}
							onFocus={() => setElegida(hora)}
							className="relative h-full min-w-0 touch-manipulation focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tinta"
						>
							<span
								className={`absolute inset-x-0 ${valor >= 0 ? "rounded-t-[2px]" : "rounded-b-[2px]"} ${color}`}
								style={{
									bottom: `${valor >= 0 ? cero : cero - alto}%`,
									height: `${alto}%`,
								}}
							/>
						</button>
					);
				})}
			</div>
			<div
				aria-hidden="true"
				className="mt-1 grid text-[11px] text-suave"
				style={VEINTICUATRO}
			>
				{Array.from({ length: 24 }, (_, hora) => (
					<span key={hora} className="text-center">
						{hora % 6 === 0 ? hora : ""}
					</span>
				))}
			</div>
		</figure>
	);
}

// Gráficos pequeños, uno por año y con la misma escala, en lugar de varias líneas
// superpuestas: así cada año se lee sin depender de distinguir colores
export function PerfilesAnuales({ perfiles }) {
	const escala = {
		arriba: Math.max(...perfiles.flatMap((p) => p.relativos), 0),
		abajo: -Math.min(...perfiles.flatMap((p) => p.relativos), 0),
	};
	return (
		<div className="mt-6 grid gap-x-8 gap-y-10 sm:grid-cols-3">
			{perfiles.map((perfil) => (
				<Perfil key={perfil.anio} perfil={perfil} escala={escala} />
			))}
		</div>
	);
}
