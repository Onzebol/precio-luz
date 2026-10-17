// Los precios los descarga de ESIOS un workflow programado (scripts/actualizar-datos.js)
// y se publican junto a la web, un JSON por mes: datos/AAAA/MM.json
export const pedirMes = (mes) =>
	// no-cache: revalida con el servidor para ver enseguida los precios de mañana
	fetch(`${import.meta.env.BASE_URL}datos/${mes.replace("-", "/")}.json`, {
		cache: "no-cache",
	}).then((response) => {
		// Mes del que aún no hay ningún día publicado. Pages responde 404; el servidor
		// de Vite, en cambio, devuelve index.html, por eso se mira también el tipo
		const esJson = response.headers.get("content-type")?.includes("json");
		if (response.status === 404 || (response.ok && !esJson)) return {};
		if (!response.ok) throw new Error(`Error ${response.status}`);
		return response.json();
	});
