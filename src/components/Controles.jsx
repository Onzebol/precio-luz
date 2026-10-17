import { desplazarDia } from "../utils";

function BotonDia({ etiqueta, atajo, deshabilitado, onClick, children }) {
	return (
		<button
			type="button"
			aria-label={etiqueta}
			aria-keyshortcuts={atajo.tecla}
			title={`${etiqueta} (${atajo.texto})`}
			disabled={deshabilitado}
			onClick={onClick}
			className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md border border-linea bg-white/60 text-tinta hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/60 ${anillo}`}
		>
			<svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none">
				{children}
			</svg>
		</button>
	);
}

const anillo =
	"focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta";

export function Segmentado({ leyenda, nombre, opciones, valor, onCambio }) {
	return (
		<fieldset className="min-w-0">
			<legend className="mb-1 text-sm text-suave">{leyenda}</legend>
			<div className="inline-flex max-w-full rounded-md border border-linea bg-white/60 p-0.5">
				{opciones.map((opcion) => (
					<label key={opcion.valor} className="min-w-0">
						<input
							type="radio"
							className="peer sr-only"
							name={nombre}
							value={opcion.valor}
							checked={valor === opcion.valor}
							onChange={() => onCambio(opcion.valor)}
						/>
						<span className="block cursor-pointer rounded-[5px] px-3 py-1.5 text-sm font-medium text-suave hover:text-tinta peer-checked:bg-tinta peer-checked:text-papel peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-tinta">
							{opcion.texto}
						</span>
					</label>
				))}
			</div>
		</fieldset>
	);
}

export function Controles({
	fecha,
	fechaMinima,
	fechaMaxima,
	onFecha,
	zona,
	onZona,
	unidad,
	onUnidad,
}) {
	return (
		<div className="flex flex-wrap items-end gap-x-6 gap-y-4">
			<div>
				<label htmlFor="fecha" className="mb-1 block text-sm text-suave">
					Día
				</label>
				<div className="flex gap-1">
					<BotonDia
						etiqueta="Día anterior"
						atajo={{ tecla: "ArrowLeft", texto: "tecla ←" }}
						deshabilitado={fecha <= fechaMinima}
						onClick={() => onFecha(desplazarDia(fecha, -1))}
					>
						<path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
					</BotonDia>
					<input
						id="fecha"
						name="fecha"
						type="date"
						autoComplete="off"
						min={fechaMinima}
						max={fechaMaxima}
						value={fecha}
						onChange={(event) => event.target.value && onFecha(event.target.value)}
						className={`h-[38px] rounded-md border border-linea bg-white/60 px-3 font-medium text-tinta hover:bg-white ${anillo}`}
					/>
					<BotonDia
						etiqueta="Día siguiente"
						atajo={{ tecla: "ArrowRight", texto: "tecla →" }}
						deshabilitado={fecha >= fechaMaxima}
						onClick={() => onFecha(desplazarDia(fecha, 1))}
					>
						<path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
					</BotonDia>
				</div>
			</div>
			<Segmentado
				leyenda="Zona"
				nombre="zona"
				valor={zona}
				onCambio={onZona}
				opciones={[
					{ valor: "PCB", texto: "Península, Canarias y Baleares" },
					{ valor: "CYM", texto: "Ceuta y Melilla" },
				]}
			/>
			<Segmentado
				leyenda="Unidad"
				nombre="unidad"
				valor={unidad}
				onCambio={onUnidad}
				opciones={[
					{ valor: "kWh", texto: "€/kWh" },
					{ valor: "MWh", texto: "€/MWh" },
				]}
			/>
		</div>
	);
}
