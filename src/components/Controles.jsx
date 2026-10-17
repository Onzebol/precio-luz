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
