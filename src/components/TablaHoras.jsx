import { formatearPrecio, hayPeriodos, incrementarHora, periodoPeaje, rangoHoras } from "../utils";

const puntoNivel = {
	bajo: { color: "bg-barato", texto: "bajo" },
	medio: { color: "bg-medio", texto: "medio" },
	alto: { color: "bg-caro", texto: "alto" },
};

export function TablaHoras({ precios, unidad, fecha, zona }) {
	// Antes de la tarifa 2.0TD no había periodos de peaje
	const conPeriodos = hayPeriodos(fecha);
	return (
		<details className="group mt-14 border-t border-linea pt-6">
			<summary className="cursor-pointer list-none rounded-xs font-display text-xl font-semibold focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-tinta">
				<span className="mr-2 inline-block transition-transform group-open:rotate-90 motion-reduce:transition-none">
					›
				</span>
				Precios hora a hora
			</summary>
			<div className="mt-4 overflow-x-auto">
				<table className="w-full max-w-2xl text-left text-sm sm:text-base">
					<thead className="text-sm text-suave">
						<tr className="border-b border-linea">
							<th scope="col" className="py-2 pr-4 font-normal">
								Hora
							</th>
							<th scope="col" className="py-2 pr-4 text-right font-normal">
								Precio (€/{unidad})
							</th>
							<th scope="col" className="py-2 pr-4 font-normal">
								Nivel
							</th>
							{conPeriodos && (
								<th scope="col" className="py-2 font-normal">
									Periodo
								</th>
							)}
						</tr>
					</thead>
					<tbody>
						{precios.map((item, i) => (
							<tr key={i} className="border-b border-linea/60">
								<td className="whitespace-nowrap py-2 pr-4">
									{rangoHoras(item.Hora, incrementarHora(item.Hora))}
								</td>
								<td className="whitespace-nowrap py-2 pr-4 text-right font-medium">
									{formatearPrecio(item.Precio, unidad, true)}
								</td>
								<td className="whitespace-nowrap py-2 pr-4">
									<span
										aria-hidden="true"
										className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${
											puntoNivel[item.Nivel].color
										}`}
									/>
									{puntoNivel[item.Nivel].texto}
								</td>
								{conPeriodos && (
									<td className="py-2">{periodoPeaje(item.Hora, fecha, zona).text}</td>
								)}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</details>
	);
}
