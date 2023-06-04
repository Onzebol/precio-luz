export const euroFormatter = (value) =>
	`${Intl.NumberFormat("es-ES", {
		style: "currency",
		currency: "EUR",
		maximumFractionDigits: 5,
	})
		.format(value)
		.toString()}`;

export const incrementarHora = (value) => {
	const hora = value.split(":")[0];
	const horaSiguiente = parseInt(hora) + 1;
	return `${horaSiguiente.toString().padStart(2, "0")}:00`;
};
