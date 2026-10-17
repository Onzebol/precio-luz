import { potenciaDe } from "../potencia";

const euros = (valor, decimales) =>
	new Intl.NumberFormat("es-ES", {
		style: "currency",
		currency: "EUR",
		minimumFractionDigits: decimales,
		maximumFractionDigits: decimales,
	}).format(valor);

// Potencia del ejemplo: la más contratada en los hogares
const POTENCIA_EJEMPLO = 3.45;

// Lo que se paga por la potencia contratada, aparte del precio de cada hora
export function FichaPotencia({ anio }) {
	const potencia = potenciaDe(anio);
	const filas = [
		{ concepto: "Peajes de transporte y distribución", p1: potencia.peajes.p1, p2: potencia.peajes.p2 },
		{ concepto: "Cargos del sistema", p1: potencia.cargos.p1, p2: potencia.cargos.p2 },
		{ concepto: "Margen de comercialización", p1: potencia.margen, p2: null },
	];
	// Al mes (30 días), con la misma potencia contratada en P1 y en P2
	const ejemploMes =
		((potencia.total.p1 + potencia.total.p2) / 365) * 30 * POTENCIA_EJEMPLO;

	return (
		<details className="group mt-6 border-t border-linea pt-6">
			<summary className="cursor-pointer list-none rounded-xs font-display text-xl font-semibold focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-tinta">
				<span className="mr-2 inline-block transition-transform group-open:rotate-90 motion-reduce:transition-none">
					›
				</span>
				Precio de la potencia
			</summary>
			<div className="mt-4 max-w-2xl">
				<p>
					Además de la energía que consumes, la factura incluye un importe fijo por la
					potencia contratada, se consuma o no. Tiene dos periodos: <strong>P1</strong>{" "}
					(punta y llano: de lunes a viernes de 8 a 24 h) y <strong>P2</strong> (valle: de
					0 a 8 h y fines de semana). Precios de {potencia.anio}, sin impuestos.
				</p>

				<div className="mt-4 overflow-x-auto">
					<table className="w-full text-left text-sm sm:text-base">
						<caption className="sr-only">
							Término de potencia del PVPC en {potencia.anio}, en euros por kW
						</caption>
						<thead className="text-sm text-suave">
							<tr className="border-b border-linea">
								<th scope="col" className="py-2 pr-4 font-normal">
									€/kW y año
								</th>
								<th scope="col" className="py-2 pr-4 text-right font-normal">
									P1
								</th>
								<th scope="col" className="py-2 text-right font-normal">
									P2
								</th>
							</tr>
						</thead>
						<tbody>
							{filas.map((fila) => (
								<tr key={fila.concepto} className="border-b border-linea/60">
									<th scope="row" className="py-2 pr-4 font-normal">
										{fila.concepto}
									</th>
									<td className="py-2 pr-4 text-right">{euros(fila.p1, 2)}</td>
									<td className="py-2 text-right">{fila.p2 === null ? "—" : euros(fila.p2, 2)}</td>
								</tr>
							))}
							<tr className="border-b border-linea font-medium">
								<th scope="row" className="py-2 pr-4">
									Total al año
								</th>
								<td className="py-2 pr-4 text-right">{euros(potencia.total.p1, 2)}</td>
								<td className="py-2 text-right">{euros(potencia.total.p2, 2)}</td>
							</tr>
							<tr className="font-medium">
								<th scope="row" className="py-2 pr-4">
									Total al día
								</th>
								<td className="py-2 pr-4 text-right">{euros(potencia.total.p1 / 365, 4)}</td>
								<td className="py-2 text-right">{euros(potencia.total.p2 / 365, 4)}</td>
							</tr>
						</tbody>
					</table>
				</div>

				<p className="mt-4">
					Por ejemplo, con {POTENCIA_EJEMPLO.toLocaleString("es-ES")} kW contratados en los
					dos periodos son unos <strong>{euros(ejemploMes, 2)} al mes</strong> solo por la
					potencia, antes de impuestos.
				</p>
				<p className="mt-2 text-sm text-suave">
					El PVPC se puede contratar con 10 kW o menos. Los peajes y cargos se fijan cada
					año.
				</p>
				<ul className="mt-2 space-y-1 text-sm text-suave">
					{potencia.fuentes.map((fuente) => (
						<li key={fuente.url}>
							<a
								href={fuente.url}
								className="underline decoration-linea underline-offset-2 hover:decoration-tinta"
							>
								{fuente.texto}
							</a>
						</li>
					))}
				</ul>
			</div>
		</details>
	);
}
