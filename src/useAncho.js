import { useEffect, useRef, useState } from "react";

// Ancho del contenedor, para dibujar a escala real y que el texto no se deforme
export const useAncho = () => {
	const ref = useRef(null);
	const [ancho, setAncho] = useState(0);
	useEffect(() => {
		const observador = new ResizeObserver(([entrada]) =>
			setAncho(Math.round(entrada.contentRect.width))
		);
		observador.observe(ref.current);
		return () => observador.disconnect();
	}, []);
	return [ref, ancho];
};
