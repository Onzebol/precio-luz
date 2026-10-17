import { useState } from "react";
import { parseISO } from "date-fns";
import { FUENTES_FACTURA, estimarFactura } from "../factura";
import { hoy } from "../utils";

const euros = (valor) =>
	new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(valor);
const porcentaje = (tipo) =>
	new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 2 }).format(tipo);
const nombreMes = (mes) =>
	new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(
		parseISO(`${mes}-01`)
	);

const etiqueta = "mb-1 block text-sm text-suave";
const campo =
	"block max-w-full rounded-md border border-linea bg-white/60 px-3 py-1.5 font-medium text-tinta hover:bg-white focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta";

// Factura aproximada de un mes del año en curso con los precios reales de ese mes.
// medias: { "AAAA-MM": [PCB, CYM] } en €/MWh (datos/medias.json)
export function CalculadoraFactura({ medias, zona }) {
	const actual = hoy().slice(0, 7);
	// Meses del año en curso con precios; el mes actual solo si no hay otro (aún va por la mitad)
	const meses = Object.keys(medias)
		.filter((mes) => mes.startsWith(actual.slice(0, 4)))
		.sort();
	const completos = meses.filter((mes) => mes < actual);
	const [mes, setMes] = useState((completos.length ? completos : meses).at(-1));
	const [potencia, setPotencia] = useState("3,45");
	const [consumo, setConsumo] = useState("250");

	// Admite coma decimal, como se escribe en español
	const numero = (texto) => Number(String(texto).replace(",", "."));
	const potenciaKw = numero(potencia);
	const consumoKwh = numero(consumo);
	const valido = potenciaKw > 0 && potenciaKw <= 15 && consumoKwh >= 0 && mes;
	const precioMedioKwh = mes ? medias[mes][zona === "CYM" ? 1 : 0] / 1000 : 0;
	const factura = valido
		? estimarFactura({ mes, potenciaKw, consumoKwh, precioMedioKwh })
		: null;

	const filas = factura && [
		["Potencia", factura.potencia, `${potencia} kW durante ${factura.dias} días`],
		[
			"Energía",
			factura.energia,
			`${consumo} kWh a ${precioMedioKwh.toLocaleString("es-ES", { maximumFractionDigits: 3 })} €/kWh de media`,
		],
		["Financiación del bono social", factura.bonoSocial, null],
		[
			"Impuesto eléctrico",
			factura.impuesto,
			`${factura.tiposImpuesto.map(porcentaje).join(" y ")}${
				factura.minimoAplicado ? ", con el mínimo de 1 €/MWh" : ""
			}`,
		],
		["Alquiler del contador", factura.contador, null],
		["IVA", factura.iva, factura.tiposIva.map(porcentaje).join(" y ")],
	];

	return (
		<details className="group mt-6 border-t border-linea pt-6">
			<summary className="cursor-pointer list-none rounded-xs font-display text-xl font-semibold focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-tinta">
				<span className="mr-2 inline-block transition-transform group-open:rotate-90 motion-reduce:transition-none">
					›
				</span>
				Calcula tu factura
			</summary>
			<div className="mt-4 max-w-2xl">
				<p>
					Estimación de una factura mensual del PVPC con los precios reales del mes, la
					potencia y los impuestos vigentes cada día.
				</p>
				<form
					className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-4"
					onSubmit={(event) => event.preventDefault()}
				>
					<div>
						<label htmlFor="factura-mes" className={etiqueta}>
							Mes
						</label>
						<select
							id="factura-mes"
							value={mes}
							onChange={(event) => setMes(event.target.value)}
							className={campo}
						>
							{meses.map((m) => (
								<option key={m} value={m}>
									{nombreMes(m)}
									{m === actual ? " (en curso)" : ""}
								</option>
							))}
						</select>
					</div>
					<div>
						<label htmlFor="factura-potencia" className={etiqueta}>
							Potencia contratada (kW)
						</label>
						<input
							id="factura-potencia"
							type="text"
							inputMode="decimal"
							autoComplete="off"
							value={potencia}
							onChange={(event) => setPotencia(event.target.value)}
							className={`${campo} w-32`}
						/>
					</div>
					<div>
						<label htmlFor="factura-consumo" className={etiqueta}>
							Consumo del mes (kWh)
						</label>
						<input
							id="factura-consumo"
							type="text"
							inputMode="decimal"
							autoComplete="off"
							value={consumo}
							onChange={(event) => setConsumo(event.target.value)}
							className={`${campo} w-32`}
						/>
					</div>
				</form>

				{!valido && (
					<p className="mt-4 text-caro-intenso">
						Escribe una potencia entre 0 y 15 kW y un consumo en kWh.
					</p>
				)}

				{factura && (
					<div aria-live="polite">
						<table className="mt-6 w-full text-left text-sm sm:text-base">
							<caption className="sr-only">Factura estimada de {nombreMes(mes)}</caption>
							<tbody>
								{filas.map(([concepto, importe, detalle]) => (
									<tr key={concepto} className="border-b border-linea/60">
										<th scope="row" className="py-2 pr-4 font-normal">
											{concepto}
											{detalle && <span className="block text-sm text-suave">{detalle}</span>}
										</th>
										<td className="whitespace-nowrap py-2 text-right">{euros(importe)}</td>
									</tr>
								))}
								<tr>
									<th scope="row" className="pt-3 pr-4 font-display text-xl font-semibold">
										Total
									</th>
									<td className="whitespace-nowrap pt-3 text-right font-display text-2xl font-semibold">
										{euros(factura.total)}
									</td>
								</tr>
							</tbody>
						</table>
						<p className="mt-4 text-sm text-suave">
							Es una aproximación: la energía se valora al precio medio del mes, así que
							si consumes más en las horas caras pagarás algo más (y menos si consumes en
							las baratas). Supone la misma potencia en P1 y P2 y no incluye los
							descuentos del bono social.
							{mes === actual && " El mes en curso usa el precio medio de los días que van."}
						</p>
						<ul className="mt-2 space-y-1 text-sm text-suave">
							{FUENTES_FACTURA.map((fuente) => (
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
				)}
			</div>
		</details>
	);
}
