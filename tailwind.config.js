/** @type {import('tailwindcss').Config} */
export default {
	content: [
		"./index.html",
		"./src/**/*.{js,ts,jsx,tsx}",

		// Path to the Tremor module
		"./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
		"./node_modules/react-tailwindcss-datepicker/dist/index.esm.js",
	],
	theme: {
		extend: {},
	},
	plugins: [],
};
