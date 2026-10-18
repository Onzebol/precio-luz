import { useState } from "react";
import { parseISO } from "date-fns";
import { APARATOS_PROGRAMABLES, FUENTES_FACTURA, PERIODOS, estimarFactura } from "../factura";
import { hoy } from "../utils";
import { Segmentado } from "./Controles";

const euros = (valor) =>
	new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(valor);
const porcentaje = (tipo) =>
	new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 2 }).format(tipo);
const nombreMes = (mes) =>
	new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(
		parseISO(`${mes}-01`)
	);
// kWh sin decimales sobrantes; precios siempre con 3
const kwh = (valor) => valor.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const precioKwh = (valor) =>
	valor.toLocaleString("es-ES", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
// Admite coma decimal, como se escribe en español; vacío cuenta como 0
const numero = (texto) => Number(String(texto).replace(",", ".") || 0);

const etiqueta = "mb-1 block text-sm text-suave";
const campo =
	"block max-w-full rounded-md border border-linea bg-white/60 px-3 py-1.5 font-medium text-tinta hover:bg-white focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta";

function Campo({ id, texto, valor, onCambio, ancho = "w-24" }) {
	return (
		<div>
			<label htmlFor={id} className="mb-1 block text-sm">
				{texto}
			</label>
			<input
				id={id}
				type="text"
				inputMode="decimal"
				autoComplete="off"
				value={valor}
				onChange={(event) => onCambio(event.target.value)}
				className={`${campo} ${ancho}`}
			/>
		</div>
	);
}

// Factura aproximada de un mes del año en curso con los precios reales de ese mes.
// medias: { "AAAA-MM": [PCB, CYM, punta/llano/valle de PCB, ídem de CYM, horas baratas
// de PCB y de CYM] } en €/MWh (datos/medias.json; desde la tarifa 2.0TD)
export function CalculadoraFactura({ medias, zona }) {
	const actual = hoy().slice(0, 7);
	// Meses del año en curso con precios; el mes actual solo si no hay otro (aún va por la mitad)
	const meses = Object.keys(medias)
		.filter((mes) => mes.startsWith(actual.slice(0, 4)))
		.sort();
	const completos = meses.filter((mes) => mes < actual);
	const [mes, setMes] = useState((completos.length ? completos : meses).at(-1));
	const [potencia, setPotencia] = useState({ p1: "3,45", p2: "3,45" });
	// Un reparto habitual en un hogar: casi la mitad del consumo en valle
	const [consumo, setConsumo] = useState({ punta: "70", llano: "70", valle: "110" });
	const [modo, setModo] = useState("media");
	const [programados, setProgramados] = useState(
		() => new Set(["lavadora", "lavavajillas", "secadora"])
	);

	const potencias = { p1: numero(potencia.p1), p2: numero(potencia.p2) };
	const consumos = Object.fromEntries(PERIODOS.map((p) => [p, numero(consumo[p])]));
	const consumoTotal = PERIODOS.reduce((suma, p) => suma + consumos[p], 0);
	const valido =
		[potencias.p1, potencias.p2].every((kw) => kw > 0 && kw <= 15) &&
		PERIODOS.every((p) => consumos[p] >= 0) &&
		mes;
	// Posiciones de la zona en medias.json
	const inicio = zona === "CYM" ? 5 : 2;
	const preciosKwh = Object.fromEntries(
		PERIODOS.map((p, i) => [p, mes ? medias[mes][inicio + i] / 1000 : 0])
	);
	const precioBaratoKwh = mes ? medias[mes][zona === "CYM" ? 9 : 8] / 1000 : 0;
	// Consumo estimado de cada aparato: su peso medio en los hogares por el consumo del mes
	const aparatos = APARATOS_PROGRAMABLES.map((aparato) => ({
		...aparato,
		kwh: aparato.peso * consumoTotal,
	}));
	const programadoKwh =
		modo === "baratas"
			? aparatos.filter((a) => programados.has(a.clave)).reduce((suma, a) => suma + a.kwh, 0)
			: 0;

	const comun = { mes, potencias, consumos, preciosKwh };
	const factura = valido
		? estimarFactura({ ...comun, programadoKwh, precioBaratoKwh })
		: null;
	// Para el ahorro: la misma factura sin programar nada
	const conMedia = valido && modo === "baratas" ? estimarFactura(comun) : null;
	const proporcion = consumoTotal ? 1 - Math.min(programadoKwh / consumoTotal, 1) : 1;

	const filas = factura && [
		[
			"Potencia",
			factura.potencia,
			`${potencia.p1} kW en P1 y ${potencia.p2} kW en P2, ${factura.dias} días`,
		],
		...PERIODOS.map((p) => [
			`Energía en ${p}`,
			factura.energias[p],
			`${kwh(consumos[p] * proporcion)} kWh a ${precioKwh(preciosKwh[p])} €/kWh de media`,
		]),
		...(programadoKwh > 0
			? [
					[
						"Energía de los aparatos programados",
						factura.energias.programado,
						`${kwh(programadoKwh)} kWh a ${precioKwh(precioBaratoKwh)} €/kWh, la media de las 3 horas más baratas de cada día`,
					],
				]
			: []),
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

	const alternar = (clave) =>
		setProgramados((anteriores) => {
			const nuevos = new Set(anteriores);
			if (nuevos.has(clave)) nuevos.delete(clave);
			else nuevos.add(clave);
			return nuevos;
		});

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
					potencia y los impuestos vigentes cada día. La potencia de P1 y P2 y el consumo
					de punta, llano y valle vienen en la factura.
				</p>
				<form
					className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-4"
					onSubmit={(event) => event.preventDefault()}
				>
					<div className="basis-full">
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
					<fieldset>
						<legend className={etiqueta}>Potencia contratada (kW)</legend>
						<div className="flex flex-wrap gap-x-4 gap-y-3">
							{["p1", "p2"].map((p) => (
								<Campo
									key={p}
									id={`factura-${p}`}
									texto={p === "p1" ? "P1 (punta y llano)" : "P2 (valle)"}
									valor={potencia[p]}
									onCambio={(valor) => setPotencia((anterior) => ({ ...anterior, [p]: valor }))}
									ancho="w-28"
								/>
							))}
						</div>
					</fieldset>
					{/* Como en la factura: el consumo de cada periodo por separado */}
					<fieldset>
						<legend className={etiqueta}>Consumo del mes (kWh)</legend>
						<div className="flex flex-wrap gap-x-4 gap-y-3">
							{PERIODOS.map((p) => (
								<Campo
									key={p}
									id={`factura-${p}`}
									texto={p.charAt(0).toUpperCase() + p.slice(1)}
									valor={consumo[p]}
									onCambio={(valor) => setConsumo((anterior) => ({ ...anterior, [p]: valor }))}
								/>
							))}
						</div>
					</fieldset>
					<div className="basis-full">
						<Segmentado
							leyenda="Cómo usas los aparatos"
							nombre="factura-modo"
							valor={modo}
							onCambio={setModo}
							opciones={[
								{ valor: "media", texto: "Cuando toca" },
								{ valor: "baratas", texto: "En las horas baratas" },
							]}
						/>
					</div>
					{modo === "baratas" && (
						<fieldset className="basis-full">
							<legend className={etiqueta}>
								Aparatos que programas para las 3 horas seguidas más baratas del día
							</legend>
							<div className="flex flex-wrap gap-x-5 gap-y-2">
								{aparatos.map((aparato) => (
									<label key={aparato.clave} className="flex items-center gap-2">
										<input
											type="checkbox"
											checked={programados.has(aparato.clave)}
											onChange={() => alternar(aparato.clave)}
											className="h-4 w-4 accent-tinta"
										/>
										{aparato.nombre}
										<span className="text-sm text-suave">~{kwh(aparato.kwh)} kWh</span>
									</label>
								))}
							</div>
						</fieldset>
					)}
				</form>

				{!valido && (
					<p className="mt-4 text-caro-intenso">
						Escribe una potencia entre 0 y 15 kW en P1 y P2, y el consumo de cada periodo
						en kWh.
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
						{conMedia && (
							<p className="mt-3 font-medium">
								{conMedia.total - factura.total >= 0.005
									? `Ahorras unos ${euros(conMedia.total - factura.total)} frente a usarlos cuando toca (${euros(conMedia.total)}).`
									: "Marca algún aparato para ver cuánto ahorras."}
							</p>
						)}
						<p className="mt-4 text-sm text-suave">
							Es una aproximación: el consumo de cada periodo se valora al precio medio de
							ese periodo en el mes, así que dentro de cada uno pagarás algo más si
							consumes en sus horas caras. No tiene en cuenta los descuentos del bono
							social.
							{modo === "baratas" &&
								" El consumo de cada aparato es su peso medio en los hogares españoles (IDAE, SPAHOUSEC III, 2021) aplicado a tu consumo; el tuyo puede ser otro."}
							{mes === actual && " El mes en curso usa los precios de los días que van."}
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
