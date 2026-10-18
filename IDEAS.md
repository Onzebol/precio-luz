# Ideas pendientes

Mejoras pensadas para más adelante, de más a menos útil. Cuando se monte una, se borra de aquí y se documenta en el README y en CLAUDE.md.

## Vista de día

### Cuánto cuesta poner un aparato

Responder a «¿cuánto me cuesta poner la lavadora ahora y cuánto a la mejor hora?»: por ejemplo, «La lavadora (≈1 kWh, 2 h) cuesta 0,21 € ahora y 0,07 € si empiezas a las 14:00».

- Consumos y duraciones típicos por uso (lavadora, lavavajillas, secadora, horno, carga del coche), con fuente (IDAE u OCU), editables.
- Usa `mejorBloque` con la duración del aparato y el precio de las horas desde ahora.
- Encaja junto al `SelectorDuracion` (el aparato fijaría la duración).

### Precio final con impuestos

Interruptor «con impuestos» que muestre el precio de la energía como se paga: con impuesto eléctrico e IVA, usando los tramos con fecha de `factura.js`. Ojo: el IVA reducido depende de la potencia contratada; habría que elegir uno por defecto (el general) y explicarlo.

### Comparar con ayer

Una línea fina sobre las barras de `FranjaHoras` con los precios del día anterior (o de hoy, cuando se ve mañana). `cargarDia` ya precarga el día anterior, así que no cuesta peticiones nuevas.

## Histórico

### ¿Me compensa el PVPC frente a una tarifa fija?

Se introduce el precio por kWh (y, si lo tiene, el de cada periodo) de una oferta del mercado libre y se compara mes a mes con el PVPC del último año. `medias.json` ya tiene las medias por periodo; con un reparto de consumo típico (o el de la calculadora) basta.

## Otros

### Descargar los datos en CSV

Botón para descargar el día (y quizá el mes) en CSV: hora, precio PCB, precio CYM, periodo. Se genera en el navegador a partir de lo que ya está cargado, sin cambios en los datos publicados.

### Imagen y metadatos para compartir

`og:title`, `og:description`, `og:image` y `twitter:card` en `index.html`, con una imagen fija (1200×630) con el rayo y el nombre, para que el enlace se vea bien en WhatsApp y en redes. Como la web es estática, la imagen no puede cambiar con el día.

### Aviso si falta el año nuevo en `POTENCIA`

Que el workflow falle (o abra una issue) si en enero `POTENCIA` de `src/potencia.js` no tiene el año en curso, para que no se quede sin actualizar en silencio.

## Descartadas por ahora (cuestan bastante más)

- **Notificaciones** («ya están los precios de mañana», «empieza la hora barata»): las push necesitan un servidor que las envíe, y ahora todo es estático.
- **Mix de generación y renovables**, para explicar por qué baja o sube el precio: obligaría a descargar más indicadores de ESIOS y a guardarlos como los precios.
