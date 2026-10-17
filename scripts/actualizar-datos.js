// Descarga de ESIOS los precios PVPC que faltan y los guarda normalizados en
// public/datos/AAAA/MM.json, un fichero por mes que la web lee como estático.
//
// Uso: ESIOS_API_KEY=... node scripts/actualizar-datos.js [--desde AAAA-MM-DD]
// Sin --desde, empieza en el día siguiente al último guardado (o en 2014-04-01,
// el primer día con PVPC en ESIOS, si aún no hay datos) y llega hasta mañana.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { StringToNumerLocale } from "../src/utils.js";

const FECHA_MINIMA = "2014-04-01";
const CARPETA = join(import.meta.dirname, "..", "public", "datos");
const PETICIONES_SIMULTANEAS = 6;

const claveApi = process.env.ESIOS_API_KEY;
if (!claveApi) {
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
	for (const anio of await readdir(CARPETA)) {
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

const meses = await leerMeses();
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

console.log(`Días guardados: ${pendientes.length - sinDatos.length - errores.length}`);
if (sinDatos.length) console.log(`Sin datos publicados: ${sinDatos.sort().join(", ")}`);
if (errores.length) {
	console.error(`Errores:\n${errores.join("\n")}`);
	process.exit(1);
}
