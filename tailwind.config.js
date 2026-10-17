/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			colors: {
				// Papel de factura, tinta pizarra y los tres niveles de precio
				papel: "#E9EEEB",
				tinta: "#17262B",
				suave: "#55666B",
				linea: "#C7D1CD",
				barato: "#2E8B63",
				medio: "#B8790F",
				caro: "#C4473A",
			},
			fontFamily: {
				sans: ["Barlow", "system-ui", "sans-serif"],
				display: ['"Barlow Semi Condensed"', "Barlow", "system-ui", "sans-serif"],
			},
		},
	},
	plugins: [],
};
