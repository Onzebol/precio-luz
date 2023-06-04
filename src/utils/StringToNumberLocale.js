export function StringToNumerLocale (num, locale) {
	const { format } = new Intl.NumberFormat(locale);
	const [, decimalSign] = /^0(.)1$/.exec(format(0.1));
	return +num
	.replace(new RegExp(`[^${decimalSign}\\d]`, 'g'), '')
	.replace(decimalSign, '.');
}
