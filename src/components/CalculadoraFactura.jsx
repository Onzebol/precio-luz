import { useState } from "react";
import { parseISO } from "date-fns";
import { FUENTES_FACTURA, PERIODOS, estimarFactura } from "../factura";
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
// medias: { "AAAA-MM": [PCB, CYM, punta, llano, valle de PCB, ídem de CYM] } en €/MWh
// (datos/medias.json; los periodos solo existen desde la tarifa 2.0TD)
export function CalculadoraFactura({ medias, zona }) {
	const actual = hoy().slice(0, 7);
	// Meses del año en curso con precios; el mes actual solo si no hay otro (aún va por la mitad)
	const meses = Object.keys(medias)
		.filter((mes) => mes.startsWith(actual.slice(0, 4)))
		.sort();
	const completos = meses.filter((mes) => mes < actual);
	const [mes, setMes] = useState((completos.length ? completos : meses).at(-1));
	const [potencia, setPotencia] = useState("3,45");
	// Un reparto habitual en un hogar: casi la mitad del consumo en valle
	const [consumo, setConsumo] = useState({ punta: "70", llano: "70", valle: "110" });

	// Admite coma decimal, como se escribe en español; vacío cuenta como 0
	const numero = (texto) => Number(String(texto).replace(",", ".") || 0);
	const potenciaKw = numero(potencia);
	const consumos = Object.fromEntries(PERIODOS.map((p) => [p, numero(consumo[p])]));
	const valido =
		potenciaKw > 0 && potenciaKw <= 15 && PERIODOS.every((p) => consumos[p] >= 0) && mes;
	// Posición de punta, llano y valle de la zona en medias.json
	const inicio = zona === "CYM" ? 5 : 2;
	const preciosKwh = Object.fromEntries(
		PERIODOS.map((p, i) => [p, mes ? medias[mes][inicio + i] / 1000 : 0])
	);
	const factura = valido ? estimarFactura({ mes, potenciaKw, consumos, preciosKwh }) : null;
	// kWh sin decimales sobrantes; precios siempre con 3
	const kwh = (valor) => valor.toLocaleString("es-ES", { maximumFractionDigits: 3 });
	const precioKwh = (valor) =>
		valor.toLocaleString("es-ES", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

	const filas = factura && [
		["Potencia", factura.potencia, `${potencia} kW durante ${factura.dias} días`],
		...PERIODOS.map((p) => [
			`Energía en ${p}`,
			factura.energias[p],
			`${kwh(consumos[p])} kWh a ${precioKwh(preciosKwh[p])} €/kWh de media`,
		]),
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
					potencia y los impuestos vigentes cada día. El consumo de punta, llano y valle
					viene desglosado en la factura.
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
					{/* Como en la factura: el consumo de cada periodo por separado */}
					<fieldset className="basis-full">
						<legend className={etiqueta}>Consumo del mes (kWh)</legend>
						<div className="flex flex-wrap gap-x-4 gap-y-3">
							{PERIODOS.map((p) => (
								<div key={p}>
									<label htmlFor={`factura-${p}`} className="mb-1 block text-sm first-letter:uppercase">
										{p}
									</label>
									<input
										id={`factura-${p}`}
										type="text"
										inputMode="decimal"
										autoComplete="off"
										value={consumo[p]}
										onChange={(event) =>
											setConsumo((anterior) => ({ ...anterior, [p]: event.target.value }))
										}
										className={`${campo} w-24`}
									/>
								</div>
							))}
						</div>
					</fieldset>
				</form>

				{!valido && (
					<p className="mt-4 text-caro-intenso">
						Escribe una potencia entre 0 y 15 kW y el consumo de cada periodo en kWh.
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
							Es una aproximación: el consumo de cada periodo se valora al precio medio de
							ese periodo en el mes, así que dentro de cada uno pagarás algo más si
							consumes en sus horas caras. Supone la misma potencia en P1 y P2, no tiene
							en cuenta los festivos (todo el día es valle) y no incluye los descuentos
							del bono social.
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
