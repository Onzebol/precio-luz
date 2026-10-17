import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		react(),
		// Permite instalar la web como aplicación (ordenador y móvil) y que funcione sin conexión
		VitePWA({
			registerType: "autoUpdate",
			includeAssets: ["favicon.svg", "apple-touch-icon.png"],
			manifest: {
				name: "Precio de la luz",
				short_name: "Precio luz",
				description:
					"Precio horario de la luz en España (PVPC): las horas más baratas del día y los periodos de peaje.",
				lang: "es",
				start_url: "/precio-luz/",
				scope: "/precio-luz/",
				display: "standalone",
				background_color: "#E9EEEB",
				theme_color: "#E9EEEB",
				icons: [
					{ src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
					{ src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
					{
						src: "maskable-512x512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
				],
			},
			workbox: {
				runtimeCaching: [
					{
						// Precios (datos/AAAA/MM.json): siempre de la red; la copia guardada solo se usa sin conexión
						urlPattern: ({ url }) => url.pathname.startsWith("/precio-luz/datos/"),
						handler: "NetworkFirst",
						options: {
							cacheName: "precios",
							networkTimeoutSeconds: 5,
							expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 60 },
							cacheableResponse: { statuses: [0, 200] },
						},
					},
					{
						urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
						handler: "StaleWhileRevalidate",
						options: { cacheName: "google-fonts-css" },
					},
					{
						urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
						handler: "CacheFirst",
						options: {
							cacheName: "google-fonts",
							expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
							cacheableResponse: { statuses: [0, 200] },
						},
					},
				],
			},
		}),
	],
	base: "/precio-luz/",
});
