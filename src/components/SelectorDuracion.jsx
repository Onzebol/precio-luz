import { Segmentado } from "./Controles";
import { DURACIONES, formatearPrecio, horaCorta, rangoHoras } from "../utils";

const fraseBloque = (bloque, unidad) => {
	const horas = bloque.horas === 1 ? "1 hora" : `${bloque.horas} horas`;
	return `Para ${horas}, lo más barato es empezar a las ${horaCorta(
		bloque.desde
	)} h (${rangoHoras(bloque.desde, bloque.hasta)}): ${formatearPrecio(
		bloque.media,
		unidad
	)}/${unidad} de media.`;
};

export function SelectorDuracion({ duracion, onDuracion, bloque, unidad, horasDia }) {
	return (
		<div className="mt-10">
			<Segmentado
				leyenda="¿Cuánto dura lo que vas a poner?"
				nombre="duracion"
				valor={duracion}
				onCambio={onDuracion}
				opciones={DURACIONES.filter((horas) => horas <= horasDia).map((horas) => ({
					valor: horas,
					texto: `${horas} h`,
				}))}
			/>
			<p aria-live="polite" className="mt-3 max-w-prose">
				{bloque && (
					<>
						{fraseBloque(bloque, unidad)}{" "}
						<button
							type="button"
							onClick={() => onDuracion(null)}
							className="rounded-sm text-suave underline underline-offset-2 hover:text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta"
						>
							Quitar
						</button>
					</>
				)}
			</p>
		</div>
	);
}
