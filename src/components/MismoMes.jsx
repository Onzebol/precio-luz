import { useState } from "react";
import { cambiosEntre } from "../hitos";
import { formatearPrecio } from "../utils";

const MESES = [
	"enero",
	"febrero",
	"marzo",
	"abril",
	"mayo",
	"junio",
	"julio",
	"agosto",
	"septiembre",
	"octubre",
	"noviembre",
	"diciembre",
];

// El mes actual aún no ha terminado: su media es solo de los días que van
const mesCompleto = ({ hasta }) => {
	const [anio, mes, dia] = hasta.split("-").map(Number);
	// Día 0 del mes siguiente = último día de este mes
	return dia === new Date(anio, mes, 0).getDate();
};

// "un 12 % más que el año anterior"
const frenteAnterior = (media, anterior) => {
	const diferencia = Math.round(((media - anterior) / Math.abs(anterior)) * 100);
	if (diferencia === 0) return "igual que el año anterior";
	return `un ${Math.abs(diferencia)} % ${diferencia > 0 ? "más" : "menos"} que el año anterior`;
};

// Media de un mes concreto en cada año, para ver la evolución sin el efecto de la estación.
// mensuales: [{ desde, hasta, media }] en €/MWh, uno por mes, ordenados
export function MismoMes({ mensuales, unidad }) {
	const ultimo = mensuales.at(-1);
	const [mes, setMes] = useState(ultimo.desde.slice(5, 7));
	const barras = mensuales.filter((m) => m.desde.slice(5, 7) === mes);
	const [elegida, setElegida] = useState(null);

	const convertir = (valor) => (unidad === "MWh" ? valor : valor / 1000);
	const precio = (valor) => `${formatearPrecio(convertir(valor), unidad)}/${unidad}`;
	const maximo = Math.max(...barras.map((b) => b.media), 0);
	const minimo = Math.min(...barras.map((b) => b.media), 0);
	const rango = maximo - minimo || 1;
	const cero = (-minimo / rango) * 100;
	const nombreMes = MESES[Number(mes) - 1];
	const actual = barras[elegida ?? barras.length - 1];
	const indiceActual = barras.indexOf(actual);
	// Cambio regulatorio entre este mes y el del año anterior
	const cambios = (indice) =>
		indice > 0 ? cambiosEntre(barras[indice - 1].hasta, barras[indice].hasta) : [];

	return (
		<div className="mt-6">
			<label className="text-sm text-suave">
				Mes{" "}
				<select
					value={mes}
					onChange={(event) => {
						setMes(event.target.value);
						setElegida(null);
					}}
					className="ml-1 rounded-md border border-linea bg-white/60 px-2 py-1.5 font-medium text-tinta hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta"
				>
					{MESES.map((nombre, i) => (
						<option key={nombre} value={String(i + 1).padStart(2, "0")}>
							{nombre}
						</option>
					))}
				</select>
			</label>

			<p aria-live="polite" className="mt-4 min-h-[3rem] text-sm sm:text-base">
				<span className="inline-block font-semibold first-letter:uppercase">
					{nombreMes} de {actual.desde.slice(0, 4)}
				</span>
				{!mesCompleto(actual) && ` (hasta el día ${Number(actual.hasta.slice(8))})`}:{" "}
				{precio(actual.media)} de media
				{indiceActual > 0 && `, ${frenteAnterior(actual.media, barras[indiceActual - 1].media)}`}
				{cambios(indiceActual).map((cambio) => (
					<span key={cambio.fecha} className="block text-sm text-suave">
						Cambio desde el año anterior: {cambio.titulo} (
						{cambio.fecha.split("-").reverse().join("/")})
					</span>
				))}
			</p>

			<div
				className="relative mt-2 grid h-48 items-stretch gap-1"
				style={{ gridTemplateColumns: `repeat(${barras.length}, minmax(0, 1fr))` }}
			>
				{cero > 0 && (
					<span
						aria-hidden="true"
						className="pointer-events-none absolute inset-x-0 z-10 border-t border-tinta/60"
						style={{ bottom: `${cero}%` }}
					/>
				)}
				{barras.map((barra, i) => {
					const alto = (Math.abs(barra.media) / rango) * 100;
					return (
						<button
							key={barra.desde}
							type="button"
							aria-label={`${nombreMes} de ${barra.desde.slice(0, 4)}: ${precio(barra.media)}`}
							aria-pressed={i === indiceActual}
							onClick={() => setElegida(i)}
							onMouseEnter={() => setElegida(i)}
							onFocus={() => setElegida(i)}
							className="relative h-full min-w-0 touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta"
						>
							{/* Separador cuando entre este año y el anterior cambió la forma de calcular el precio */}
							{cambios(i).length > 0 && (
								<span
									aria-hidden="true"
									className="absolute -left-[3px] bottom-0 top-0 border-l border-suave"
								/>
							)}
							<span
								className={`absolute inset-x-0 mx-auto max-w-6 ${
									barra.media >= 0 ? "rounded-t-[4px]" : "rounded-b-[4px]"
								} ${i === indiceActual ? "bg-tinta" : "bg-tinta/40"}`}
								style={{
									bottom: `${barra.media >= 0 ? cero : cero - alto}%`,
									height: `${alto}%`,
								}}
							/>
						</button>
					);
				})}
			</div>
			<div
				aria-hidden="true"
				className="mt-1.5 grid gap-1 text-xs text-suave"
				style={{ gridTemplateColumns: `repeat(${barras.length}, minmax(0, 1fr))` }}
			>
				{barras.map((barra, i) => (
					<span key={barra.desde} className="text-center">
						{/* En el móvil no caben todos los años: uno de cada dos y siempre el último */}
						<span className={i % 2 && i !== barras.length - 1 ? "hidden sm:inline" : ""}>
							’{barra.desde.slice(2, 4)}
						</span>
					</span>
				))}
			</div>
			<p className="mt-2 text-xs text-suave">
				Años (’14 = 2014). La línea vertical marca un cambio en la forma de calcular el
				precio entre un año y el siguiente.
			</p>
		</div>
	);
}
