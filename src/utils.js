export const euroFormatter = (value, minDigits = 2, maxDigits = 5) => {
	if (value === 0) return "- €";
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
