import { addDays, format, parseISO } from "date-fns";

export const euroFormatter = (value, minDigits = 2, maxDigits = 5) => {
	if (value === null || value === undefined) return "- €";
	return `${Intl.NumberFormat("es-ES", {
		style: "currency",
		currency: "EUR",
		minimumFractionDigits: minDigits,
		maximumFractionDigits: maxDigits,
	})
		.format(value)
		.toString()}`;
};

// Decimales a mostrar: el resumen redondea, el detalle muestra el precio completo
export const decimales = (unidad, detalle = false) => {
	if (unidad === "MWh") return 2;
	return detalle ? 5 : 3;
};

export const formatearPrecio = (valor, unidad, detalle = false) => {
	const digitos = decimales(unidad, detalle);
	return euroFormatter(valor, digitos, digitos);
};

export const incrementarHora = (value) => {
	const hora = value.split(":")[0];
	const horaSiguiente = parseInt(hora) + 1;
	return `${horaSiguiente.toString().padStart(2, "0")}:00`;
};

// "03:00" -> "03"
export const horaCorta = (value) => value.split(":")[0];

export const rangoHoras = (desde, hasta) =>
	`de ${horaCorta(desde)} a ${horaCorta(hasta)} h`;

export const ordenarPrecios = (data) => {
	return [...data].sort((a, b) => {
		if (a.Precio < b.Precio) return -1;
		if (a.Precio > b.Precio) return 1;
		return 0;
	});
};

export const periodos = {
	valle: { clave: "valle", text: "Valle" },
	llano: { clave: "llano", text: "Llano" },
	punta: { clave: "punta", text: "Punta" },
};

export const periodoPeaje = (value, fecha, province) => {
	const hora = parseInt(value.split(":")[0]);
	const dayOfWeek = fecha.getDay();
	const isWeekend = dayOfWeek === 6 || dayOfWeek === 0;
	if (isWeekend) return periodos.valle;
	if (province === "CYM") {
		if ([0, 1, 2, 3, 4, 5, 6, 7].indexOf(hora) !== -1) return periodos.valle;
		if ([8, 9, 10, 15, 16, 17, 18, 23].indexOf(hora) !== -1)
			return periodos.llano;
		if ([11, 12, 13, 14, 19, 20, 21, 22].indexOf(hora) !== -1)
			return periodos.punta;
	}
	if ([0, 1, 2, 3, 4, 5, 6, 7].indexOf(hora) !== -1) return periodos.valle;
	if ([8, 9, 14, 15, 16, 17, 22, 23].indexOf(hora) !== -1)
		return periodos.llano;
	if ([10, 11, 12, 13, 18, 19, 20, 21].indexOf(hora) !== -1)
		return periodos.punta;
};

// Agrupa las horas consecutivas con el mismo periodo de peaje
export const segmentosPeriodo = (data, fecha, province) => {
	const segmentos = [];
	data.forEach((item) => {
		const periodo = periodoPeaje(item.Hora, fecha, province);
		const ultimo = segmentos[segmentos.length - 1];
		if (ultimo && ultimo.periodo === periodo) ultimo.horas += 1;
		else segmentos.push({ periodo, horas: 1 });
	});
	return segmentos;
};

// Divide el rango entre el precio mínimo y el máximo en tercios: bajo, medio y alto
export const nivelesPrecio = (data) => {
	if (!data || data.length === 0) return [];
	const dataOrdered = ordenarPrecios(data);
	const precioMasBajo = dataOrdered[0];
	const precioMasAlto = dataOrdered[dataOrdered.length - 1];
	const diferencia = precioMasAlto.Precio - precioMasBajo.Precio;
	const tramo = diferencia / 3;
	return data.map((item) => {
		let nivel = "medio";
		if (item.Precio <= precioMasBajo.Precio + tramo) nivel = "bajo";
		if (item.Precio >= precioMasAlto.Precio - tramo) nivel = "alto";
		return { ...item, Nivel: nivel };
	});
};

// Horas seguidas alrededor de la más barata cuyo precio no se aleja del mínimo
// más de `margen` veces el rango del día (el "valle" que se ve en el gráfico)
export const tramoMasBarato = (data, margen = 0.15) => {
	if (!data || data.length === 0) return null;
	const precios = data.map((item) => item.Precio);
	const minimo = Math.min(...precios);
	const limite = minimo + margen * (Math.max(...precios) - minimo);
	let inicio = precios.indexOf(minimo);
	let fin = inicio;
	while (inicio > 0 && precios[inicio - 1] <= limite) inicio--;
	while (fin < precios.length - 1 && precios[fin + 1] <= limite) fin++;
	const tramo = precios.slice(inicio, fin + 1);
	return {
		desde: data[inicio].Hora,
		hasta: incrementarHora(data[fin].Hora),
		horas: tramo.length,
		minimo,
		maximo: Math.max(...tramo),
	};
};

// Duraciones que ofrece el selector "¿Cuánto dura lo que vas a poner?"
export const DURACIONES = [1, 2, 3, 4, 6, 8];

// Bloque de `horas` horas seguidas con el precio medio más bajo (en empate, el primero)
export const mejorBloque = (data, horas) => {
	if (!data || data.length < horas) return null;
	let mejor = null;
	for (let i = 0; i + horas <= data.length; i++) {
		const bloque = data.slice(i, i + horas);
		const media = bloque.reduce((total, item) => total + item.Precio, 0) / horas;
		if (mejor === null || media < mejor.media) {
			mejor = {
				inicio: i,
				horas,
				desde: bloque[0].Hora,
				hasta: incrementarHora(bloque[horas - 1].Hora),
				media,
			};
		}
	}
	return mejor;
};

// Fechas en hora local (toISOString usaría UTC y daría el día anterior de madrugada)
export const hoy = () => format(new Date(), "yyyy-MM-dd");
export const manana = () => format(addDays(new Date(), 1), "yyyy-MM-dd");

export const fechaLarga = (fecha) =>
	new Intl.DateTimeFormat("es-ES", {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(parseISO(fecha));

export const diaYMes = (fecha) =>
	new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" }).format(
		parseISO(fecha)
	);

export const StringToNumerLocale = (num, locale) => {
	const { format } = new Intl.NumberFormat(locale);
	const [, decimalSign] = /^0(.)1$/.exec(format(0.1));
	return +num
		// Se conserva el signo: hay horas con precio negativo
		.replace(new RegExp(`[^${decimalSign}\\d-]`, "g"), "")
		.replace(decimalSign, ".");
};
