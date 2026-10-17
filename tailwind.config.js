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
				barato: { DEFAULT: "#2E8B63", intenso: "#1B6646" },
				medio: { DEFAULT: "#B8790F", intenso: "#8A5A06" },
				caro: { DEFAULT: "#C4473A", intenso: "#962D22" },
			},
			fontFamily: {
				sans: ["Barlow", "system-ui", "sans-serif"],
				display: ['"Barlow Semi Condensed"', "Barlow", "system-ui", "sans-serif"],
			},
		},
	},
	plugins: [],
};
