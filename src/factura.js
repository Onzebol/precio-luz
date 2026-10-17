import { potenciaDe } from "./potencia";

// Conceptos regulados de la factura que no vienen de ESIOS. Cada tramo rige desde su
// fecha hasta el siguiente. En 2026 los impuestos cambiaron a mitad de año (RDL 7/2026):
// hay que añadir aquí cualquier rebaja o subida nueva
const IMPUESTO_ELECTRICO = [
	// Ley 38/1992, art. 99: 5,11269632 % con un mínimo de 1 €/MWh (usos domésticos)
	{ desde: "2026-01-01", tipo: 0.0511269632 },
	// RDL 7/2026, art. 40: rebaja temporal, desactivada el 1 de junio por el IPC
	{ desde: "2026-03-22", tipo: 0.005 },
	{ desde: "2026-06-01", tipo: 0.0511269632 },
];
const MINIMO_IMPUESTO_MWH = 1;

const IVA = [
	{ desde: "2026-01-01", tipo: 0.21 },
	// RDL 7/2026: 10 % con potencia contratada inferior a 10 kW, hasta el 31 de mayo
	{ desde: "2026-03-22", tipo: 0.1, potenciaMenorQue: 10 },
	{ desde: "2026-06-01", tipo: 0.21 },
];

// Financiación del bono social, €/año por suministro (Orden TED/634/2026 desde el 26/06/2026)
const BONO_SOCIAL = [
	{ desde: "2026-01-01", anual: 6.979247 },
	{ desde: "2026-06-26", anual: 9.011295 },
];

// Contador monofásico con telegestión (Orden IET/1491/2013, precio transitorio aún vigente)
const ALQUILER_CONTADOR_MES = 0.81;

export const FUENTES_FACTURA = [
	{
		texto: "Impuesto eléctrico: Ley 38/1992, art. 99",
		url: "https://www.boe.es/buscar/act.php?id=BOE-A-1992-28741",
	},
	{
		texto: "Rebajas temporales de IVA e impuesto eléctrico (RDL 7/2026)",
		url: "https://sede.agenciatributaria.gob.es/Sede/todas-noticias/2026/marzo/23/medidas-materia-tributacion.html",
	},
	{
		texto: "Financiación del bono social: Orden TED/634/2026",
		url: "https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-13759",
	},
	{
		texto: "Alquiler del contador: Orden IET/1491/2013",
		url: "https://www.boe.es/buscar/doc.php?id=BOE-A-2013-8561",
	},
];

const vigente = (tramos, fecha) => tramos.filter((tramo) => tramo.desde <= fecha).at(-1) ?? tramos[0];

// Los tipos reducidos de IVA solo valían por debajo de cierta potencia; si no, el general
const tipoIva = (dia, potenciaKw) => {
	const tramo = vigente(IVA, dia);
	return tramo.potenciaMenorQue && potenciaKw >= tramo.potenciaMenorQue ? 0.21 : tramo.tipo;
};

const diasDelMes = (mes) => {
	const [anio, numero] = mes.split("-").map(Number);
	// Día 0 del mes siguiente = último día de este
	const total = new Date(anio, numero, 0).getDate();
	return Array.from({ length: total }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`);
};

export const PERIODOS = ["punta", "llano", "valle"];

// Factura estimada de un mes. El consumo de cada periodo (kWh) se valora al precio medio
// de ese periodo en el mes (€/kWh): dentro de un periodo, quien consume más en sus horas
// caras pagará algo más. Cada concepto se calcula día a día con los valores vigentes ese
// día y se suma
export const estimarFactura = ({ mes, potenciaKw, consumos, preciosKwh }) => {
	const dias = diasDelMes(mes);
	const potencia = potenciaDe(Number(mes.slice(0, 4)));
	const total = { potencia: 0, energia: 0, bonoSocial: 0, impuesto: 0, contador: 0, iva: 0 };
	const energias = Object.fromEntries(
		PERIODOS.map((periodo) => [periodo, consumos[periodo] * preciosKwh[periodo]])
	);
	const consumoDia = PERIODOS.reduce((suma, periodo) => suma + consumos[periodo], 0) / dias.length;
	let minimoAplicado = false;
	for (const dia of dias) {
		const potenciaDia = (potenciaKw * (potencia.total.p1 + potencia.total.p2)) / 365;
		const energiaDia = PERIODOS.reduce((suma, periodo) => suma + energias[periodo], 0) / dias.length;
		const bonoDia = vigente(BONO_SOCIAL, dia).anual / 365;
		const impuestoPorcentaje =
			vigente(IMPUESTO_ELECTRICO, dia).tipo * (potenciaDia + energiaDia + bonoDia);
		const impuestoMinimo = (consumoDia / 1000) * MINIMO_IMPUESTO_MWH;
		const impuestoDia = Math.max(impuestoPorcentaje, impuestoMinimo);
		if (impuestoMinimo > impuestoPorcentaje) minimoAplicado = true;
		// El contador no es suministro eléctrico: paga IVA pero no impuesto eléctrico
		const contadorDia = (ALQUILER_CONTADOR_MES * 12) / 365;
		total.potencia += potenciaDia;
		total.energia += energiaDia;
		total.bonoSocial += bonoDia;
		total.impuesto += impuestoDia;
		total.contador += contadorDia;
		total.iva +=
			tipoIva(dia, potenciaKw) * (potenciaDia + energiaDia + bonoDia + impuestoDia + contadorDia);
	}
	return {
		...total,
		total: Object.values(total).reduce((suma, valor) => suma + valor, 0),
		energias,
		dias: dias.length,
		// El impuesto eléctrico no llegaba a 1 €/MWh y se cobró ese mínimo (algún día o todos)
		minimoAplicado,
		// Tipos aplicados (si cambiaron dentro del mes, aparecen todos)
		tiposIva: [...new Set(dias.map((dia) => tipoIva(dia, potenciaKw)))],
		tiposImpuesto: [...new Set(dias.map((dia) => vigente(IMPUESTO_ELECTRICO, dia).tipo))],
	};
};
