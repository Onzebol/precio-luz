// Descarga de ESIOS los precios PVPC que faltan y los guarda normalizados en
// public/datos/AAAA/MM.json, un fichero por mes que la web lee como estático.
//
// Uso: ESIOS_API_KEY=... node scripts/actualizar-datos.js [--desde AAAA-MM-DD]
// Sin --desde, empieza en el día siguiente al último guardado (o en 2014-04-01,
// el primer día con PVPC en ESIOS, si aún no hay datos) y llega hasta mañana.
//
// Al terminar regenera public/datos/resumen.json (agregados para el histórico).
// Con --solo-resumen no descarga nada y no necesita la API key.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseISO } from "date-fns";
import { INICIO_2_0TD, StringToNumerLocale, periodoPeaje } from "../src/utils.js";

const FECHA_MINIMA = "2014-04-01";
const CARPETA = join(import.meta.dirname, "..", "public", "datos");
const PETICIONES_SIMULTANEAS = 6;

const soloResumen = process.argv.includes("--solo-resumen");
const claveApi = process.env.ESIOS_API_KEY;
if (!claveApi && !soloResumen) {
	console.error("Falta la variable de entorno ESIOS_API_KEY");
	process.exit(1);
}

class SinDatos extends Error {}

// Fecha de hoy en España, independiente de la zona horaria de la máquina
const hoyEnEspana = () =>
	new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());

// Suma días a una fecha "AAAA-MM-DD" trabajando en UTC, sin desplazamientos por horario de verano
const desplazarDia = (fecha, dias) => {
	const dia = new Date(`${fecha}T00:00:00Z`);
	dia.setUTCDate(dia.getUTCDate() + dias);
	return dia.toISOString().slice(0, 10);
};

const rutaMes = (mes) => join(CARPETA, mes.slice(0, 4), `${mes.slice(5, 7)}.json`);

const pedirDia = async (fecha) => {
	const respuesta = await fetch(
		`https://api.esios.ree.es/archives/70/download_json?date=${fecha}`,
		{ headers: { "x-api-key": claveApi } }
	);
	if (!respuesta.ok) throw new Error(`Error ${respuesta.status} en ${fecha}`);
	const data = await respuesta.json();
	// Para días sin publicar, la API responde 200 con un mensaje en lugar de PVPC
	if (!Array.isArray(data?.PVPC) || data.PVPC.length === 0) throw new SinDatos();
	// Algunos días antiguos traen solo GEN en lugar de PCB/CYM
	return data.PVPC.map((item) => ({
		Hora: `${item.Hora.split("-")[0]}:00`,
		PCB: StringToNumerLocale("PCB" in item ? item.PCB : item.GEN, "es"),
		CYM: StringToNumerLocale("CYM" in item ? item.CYM : item.GEN, "es"),
	}));
};

const pedirConReintentos = async (fecha, intentos = 3) => {
	for (let intento = 1; ; intento++) {
		try {
			return await pedirDia(fecha);
		} catch (error) {
			if (error instanceof SinDatos || intento === intentos) throw error;
			await new Promise((resolver) => setTimeout(resolver, 2000 * intento));
		}
	}
};

// Lee todos los meses guardados: { "AAAA-MM": { "AAAA-MM-DD": [...] } }
const leerMeses = async () => {
	const meses = {};
	await mkdir(CARPETA, { recursive: true });
	// Solo las carpetas de año: en la raíz está también resumen.json
	const anios = (await readdir(CARPETA, { withFileTypes: true }))
		.filter((entrada) => entrada.isDirectory())
		.map((entrada) => entrada.name);
	for (const anio of anios) {
		for (const fichero of await readdir(join(CARPETA, anio))) {
			const mes = `${anio}-${fichero.replace(".json", "")}`;
			meses[mes] = JSON.parse(await readFile(rutaMes(mes), "utf8"));
		}
	}
	return meses;
};

// Un día por línea: el fichero sigue siendo legible y los diffs de git, pequeños
const escribirMes = async (mes, dias) => {
	const lineas = Object.keys(dias)
		.sort()
		.map((fecha) => `${JSON.stringify(fecha)}:${JSON.stringify(dias[fecha])}`);
	await mkdir(join(CARPETA, mes.slice(0, 4)), { recursive: true });
	await writeFile(rutaMes(mes), `{\n${lineas.join(",\n")}\n}\n`);
};

const ZONAS = ["PCB", "CYM"];

const redondear = (valor) => Math.round(valor * 100) / 100;

// Hora del reloj (0-23) de cada posición del día. En primavera (23 horas) la API ya
// se salta la etiqueta 02:00, pero en otoño (25 horas) numera seguido de 00:00 a
// 24:00: las posiciones 2 y 3 son las dos 02:00 y el resto va una hora adelantado
const horaReloj = (precios, indice) =>
	precios.length === 25
		? indice < 3
			? indice
			: indice - 1
		: Number(precios[indice].Hora.slice(0, 2));

// Por zona: [media, mínimo, máximo, hora del mínimo, hora del máximo]
const resumirDia = (precios) =>
	ZONAS.flatMap((zona) => {
		const valores = precios.map((hora) => hora[zona]);
		const minimo = Math.min(...valores);
		const maximo = Math.max(...valores);
		const media = valores.reduce((suma, valor) => suma + valor, 0) / valores.length;
		return [
			redondear(media),
			minimo,
			maximo,
			horaReloj(precios, valores.indexOf(minimo)),
			horaReloj(precios, valores.indexOf(maximo)),
		];
	});

// Por zona, el precio medio de cada hora del reloj (24 valores) en el mes
const perfilMes = (dias) =>
	Object.fromEntries(
		ZONAS.map((zona) => {
			const sumas = Array(24).fill(0);
			const cuentas = Array(24).fill(0);
			for (const precios of Object.values(dias)) {
				precios.forEach((hora, indice) => {
					sumas[horaReloj(precios, indice)] += hora[zona];
					cuentas[horaReloj(precios, indice)]++;
				});
			}
			return [zona, sumas.map((suma, hora) => redondear(suma / cuentas[hora]))];
		})
	);

// Precio medio de las horas de punta, llano y valle del mes (periodos de la 2.0TD; no
// contempla festivos nacionales, como en la web)
const mediasPeriodo = (dias, zona) => {
	const sumas = { punta: 0, llano: 0, valle: 0 };
	const cuentas = { punta: 0, llano: 0, valle: 0 };
	for (const [fecha, precios] of Object.entries(dias)) {
		precios.forEach((hora, indice) => {
			const reloj = `${String(horaReloj(precios, indice)).padStart(2, "0")}:00`;
			const { clave } = periodoPeaje(reloj, parseISO(fecha), zona);
			sumas[clave] += hora[zona];
			cuentas[clave]++;
		});
	}
	return ["punta", "llano", "valle"].map((clave) => redondear(sumas[clave] / cuentas[clave]));
};

// Precio medio de las 3 horas seguidas más baratas de cada día del mes (sin cruzar la
// medianoche): lo que paga quien programa la lavadora y compañía en el mejor momento
const HORAS_BARATAS = 3;
const mediaHorasBaratas = (dias, zona) => {
	const mejores = Object.values(dias).map((precios) => {
		let mejor = Infinity;
		for (let i = 0; i + HORAS_BARATAS <= precios.length; i++) {
			const bloque = precios.slice(i, i + HORAS_BARATAS);
			mejor = Math.min(mejor, bloque.reduce((suma, hora) => suma + hora[zona], 0) / HORAS_BARATAS);
		}
		return mejor;
	});
	return redondear(mejores.reduce((suma, valor) => suma + valor, 0) / mejores.length);
};

// Se recalcula entero a partir de los meses: así siempre cuadra con ellos.
// Un día y un mes por línea, como en los ficheros mensuales
const escribirResumen = async (meses) => {
	const conDias = Object.keys(meses)
		.filter((mes) => Object.keys(meses[mes]).length)
		.sort();
	const dias = conDias.flatMap((mes) =>
		Object.keys(meses[mes])
			.sort()
			.map((fecha) => `${JSON.stringify(fecha)}:${JSON.stringify(resumirDia(meses[mes][fecha]))}`)
	);
	const perfiles = conDias.map(
		(mes) => `${JSON.stringify(mes)}:${JSON.stringify(perfilMes(meses[mes]))}`
	);
	await writeFile(
		join(CARPETA, "resumen.json"),
		`{\n"dias":{\n${dias.join(",\n")}\n},\n"perfiles":{\n${perfiles.join(",\n")}\n}\n}\n`
	);
	// Versión mínima para la vista de día (unos 8 KB): media de cada mes por zona,
	// [PCB, CYM], calculada como la media de las medias diarias. Desde la tarifa 2.0TD
	// siguen, para la calculadora, las medias de punta, llano y valle de PCB y luego de
	// CYM, y la media de las 3 horas seguidas más baratas de cada día de PCB y de CYM
	const medias = conDias.map((mes) => {
		const diarias = Object.values(meses[mes]).map(resumirDia);
		const media = (posicion) =>
			redondear(diarias.reduce((suma, dia) => suma + dia[posicion], 0) / diarias.length);
		const valores = [media(0), media(5)];
		if (`${mes}-01` >= INICIO_2_0TD) {
			valores.push(...ZONAS.flatMap((zona) => mediasPeriodo(meses[mes], zona)));
			valores.push(...ZONAS.map((zona) => mediaHorasBaratas(meses[mes], zona)));
		}
		return `${JSON.stringify(mes)}:${JSON.stringify(valores)}`;
	});
	await writeFile(join(CARPETA, "medias.json"), `{\n${medias.join(",\n")}\n}\n`);
};

const meses = await leerMeses();
if (soloResumen) {
	await escribirResumen(meses);
	console.log("Resumen regenerado");
	process.exit(0);
}

const guardadas = Object.values(meses).flatMap((dias) => Object.keys(dias)).sort();
const argumentoDesde = process.argv.indexOf("--desde");
const desde =
	argumentoDesde !== -1
		? process.argv[argumentoDesde + 1]
		: guardadas.length
			? desplazarDia(guardadas.at(-1), 1)
			: FECHA_MINIMA;
const hasta = desplazarDia(hoyEnEspana(), 1);

const pendientes = [];
for (let fecha = desde; fecha <= hasta; fecha = desplazarDia(fecha, 1)) pendientes.push(fecha);
console.log(`Días a descargar: ${pendientes.length} (${desde} → ${hasta})`);

const cambiados = new Set();
const sinDatos = [];
const errores = [];
let siguiente = 0;
const trabajador = async () => {
	while (siguiente < pendientes.length) {
		const fecha = pendientes[siguiente++];
		try {
			const precios = await pedirConReintentos(fecha);
			const mes = fecha.slice(0, 7);
			meses[mes] = { ...meses[mes], [fecha]: precios };
			cambiados.add(mes);
		} catch (error) {
			if (error instanceof SinDatos) sinDatos.push(fecha);
			else errores.push(`${fecha}: ${error.message}`);
		}
	}
};
await Promise.all(Array.from({ length: PETICIONES_SIMULTANEAS }, trabajador));

for (const mes of cambiados) await escribirMes(mes, meses[mes]);
// Siempre, aunque no haya días nuevos: así un cambio en el formato se aplica en la siguiente ejecución
await escribirResumen(meses);

console.log(`Días guardados: ${pendientes.length - sinDatos.length - errores.length}`);
if (sinDatos.length) console.log(`Sin datos publicados: ${sinDatos.sort().join(", ")}`);
if (errores.length) {
	console.error(`Errores:\n${errores.join("\n")}`);
	process.exit(1);
}
