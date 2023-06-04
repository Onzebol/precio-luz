import {
	ArrowSmDownIcon,
	ArrowSmRightIcon,
	ArrowSmUpIcon,
} from "@heroicons/react/outline";

export const euroFormatter = (value, minDigits = 2, maxDigits = 5) => {
	if (value === null) return "- €";
	return `${Intl.NumberFormat("es-ES", {
		style: "currency",
		currency: "EUR",
		minimumFractionDigits: minDigits,
		maximumFractionDigits: maxDigits,
	})
		.format(value)
		.toString()}`;
};

export const incrementarHora = (value) => {
	const hora = value.split(":")[0];
	const horaSiguiente = parseInt(hora) + 1;
	return `${horaSiguiente.toString().padStart(2, "0")}:00`;
};

export const ordenarPrecios = (data) => {
	return [...data].sort((a, b) => {
		if (a.Precio < b.Precio) return -1;
		if (a.Precio > b.Precio) return 1;
		return 0;
	});
};

export const periodoPeaje = (value, fecha, province) => {
	const hora = parseInt(value.split(":")[0]);
	const dayOfWeek = fecha.getDay();
	const isWeekend = dayOfWeek === 6 || dayOfWeek === 0;
	if (isWeekend) return pediodos.valle;
	if (province === "CYM") {
		if ([0, 1, 2, 3, 4, 5, 6, 7].indexOf(hora) !== -1) return pediodos.valle;
		if ([8, 9, 10, 15, 16, 17, 18, 23].indexOf(hora) !== -1)
			return pediodos.llano;
		if ([11, 12, 13, 14, 19, 20, 21, 22].indexOf(hora) !== -1)
			return pediodos.punta;
	}
	if ([0, 1, 2, 3, 4, 5, 6, 7].indexOf(hora) !== -1) return pediodos.valle;
	if ([8, 9, 14, 15, 16, 17, 22, 23].indexOf(hora) !== -1)
		return pediodos.llano;
	if ([10, 11, 12, 13, 18, 19, 20, 21].indexOf(hora) !== -1)
		return pediodos.punta;
};

export const pediodos = {
	valle: { icon: ArrowSmDownIcon, text: "Periodo valle", color: "green" },
	llano: { icon: ArrowSmRightIcon, text: "Periodo llano", color: "amber" },
	punta: { icon: ArrowSmUpIcon, text: "Periodo punta", color: "red" },
};

export const colorearPrecios = (data) => {
	const dataOrdered = ordenarPrecios(data);
	const precioMasBajo = dataOrdered[0];
	const precioMasAlto = dataOrdered[dataOrdered.length - 1];
	const diferencia = precioMasAlto.Precio - precioMasBajo.Precio;
	const tramo = diferencia / 3;
	return data.map((item) => {
		let color = "bg-orange-100/60";
		if (item.Precio <= precioMasBajo.Precio + tramo) color = "bg-green-100/60";
		if (item.Precio >= precioMasAlto.Precio - tramo) color = "bg-red-100/60";
		return {
			Hora: item.Hora,
			Precio: item.Precio,
			Color: color,
		};
	});
};

export const StringToNumerLocale = (num, locale) => {
	const { format } = new Intl.NumberFormat(locale);
	const [, decimalSign] = /^0(.)1$/.exec(format(0.1));
	return +num
		.replace(new RegExp(`[^${decimalSign}\\d]`, "g"), "")
		.replace(decimalSign, ".");
};
