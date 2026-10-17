import { useEffect, useState } from "react";
import {
	AreaChart,
	Badge,
	Card,
	Dropdown,
	DropdownItem,
	Flex,
	Grid,
	Icon,
	Tab,
	TabList,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeaderCell,
	TableRow,
	Text,
} from "@tremor/react";
import {
	ArrowSmDownIcon,
	ArrowSmUpIcon,
	CalendarIcon,
	GlobeIcon,
	LightningBoltIcon,
	MinusIcon,
} from "@heroicons/react/outline";
import { format, parseISO } from "date-fns";
import { PriceCard } from "./components/PriceCard";
import Datepicker from "react-tailwindcss-datepicker";
import {
	StringToNumerLocale,
	colorearPrecios,
	euroFormatter,
	incrementarHora,
	ordenarPrecios,
	periodoPeaje,
} from "./utils";

const pedirDatos = (date, signal) => {
	return fetch(
		`https://api.esios.ree.es/archives/70/download_json?date=${date}`,
		{
			headers: {
				"x-api-key":
					"***REMOVED***",
			},
			signal,
		}
	)
		.then((response) => {
			if (!response.ok) throw new Error(`Error ${response.status}`);
			return response.json();
		})
		.then(function (data) {
			if (!Array.isArray(data?.PVPC) || data.PVPC.length === 0)
				throw new Error("Sin datos");
			return data.PVPC.map((item) => {
				const pcb = "PCB" in item ? item.PCB : item.GEN;
				const cym = "CYM" in item ? item.CYM : item.GEN;
				return {
					Hora: `${item.Hora.split("-")[0]}:00`,
					PCB: StringToNumerLocale(pcb, "es"),
					CYM: StringToNumerLocale(cym, "es"),
				};
			});
		});
};

const filterData = (data, province, unity) => {
	if (data === null) return null;
	return data.map((item) => {
		const price = province == "PCB" ? item.PCB : item.CYM;
		return {
			Hora: item.Hora,
			Precio: unity == "MWh" ? price : price / 1000,
		};
	});
};

const sinDatos = (data) => data === null || data.length === 0;

const precioMasBajo = (data) => {
	if (sinDatos(data)) return { price: null, text: "" };
	const first = ordenarPrecios(data)[0];
	return {
		price: first.Precio,
		text: `de ${first.Hora} a ${incrementarHora(first.Hora)}`,
	};
};

const precioMasAlto = (data) => {
	if (sinDatos(data)) return { price: null, text: "" };
	const last = ordenarPrecios(data)[data.length - 1];
	return {
		price: last.Precio,
		text: `de ${last.Hora} a ${incrementarHora(last.Hora)}`,
	};
};

const precioMedio = (data) => {
	if (sinDatos(data)) return { price: null, text: "" };
	const totalPrecio = data.reduce(
		(accumulator, currentValue) => accumulator + currentValue.Precio,
		0
	);
	return {
		price: totalPrecio / data.length,
		text: "",
	};
};

// Fecha de hoy en hora local (toISOString usaría UTC y daría el día anterior de madrugada)
const hoy = () => format(new Date(), "yyyy-MM-dd");

export default function App() {
	const [unity, setUnity] = useState("kWh");
	const [province, setProvince] = useState("PCB");
	const [selectedView, setSelectedView] = useState("1");
	const [data, setData] = useState(null);
	const [estado, setEstado] = useState("cargando");
	const [lowPrice, setLowPrice] = useState({ price: null, text: "" });
	const [hightPrice, setHightPrice] = useState({ price: null, text: "" });
	const [middlePrice, setMiddletPrice] = useState({ price: null, text: "" });
	const [dataFiltered, setDataFiltered] = useState(null);
	const [date, setDate] = useState({
		startDate: hoy(),
		endDate: hoy(),
	});

	const numDigits = unity === "kWh" ? 5 : 2;
	// parseISO interpreta "YYYY-MM-DD" en hora local, a diferencia de new Date()
	const fechaSeleccionada = parseISO(date.startDate);

	useEffect(() => {
		const controller = new AbortController();
		setEstado("cargando");
		setData(null);
		pedirDatos(date.startDate, controller.signal)
			.then((data) => {
				setData(data);
				setEstado("ok");
			})
			.catch((error) => {
				if (error.name === "AbortError") return;
				setEstado("error");
			});
		return () => controller.abort();
	}, [date]);

	useEffect(() => {
		const dataFiltered = filterData(data, province, unity);
		setDataFiltered(dataFiltered);
		setLowPrice(precioMasBajo(dataFiltered));
		setHightPrice(precioMasAlto(dataFiltered));
		setMiddletPrice(precioMedio(dataFiltered));
	}, [data, unity, province]);

	const handleChangeDate = (selectedDate) => {
		if (!selectedDate?.startDate) return;
		setDate(selectedDate);
	};

	return (
		<>
			<main className="bg-slate-50 p-6 sm:p-10">
				<h1 className="text-lg font-medium text-gray-700">Precio de la luz</h1>
				<Text>Información del precio de la luz obtenida de REE</Text>
				<Grid numColsLg={3} className="mt-6 gap-6">
					<Card decoration="top" decorationColor="stone">
						<Flex justifyContent="start" className="space-x-4">
							<Icon
								icon={CalendarIcon}
								variant="solid"
								size="xl"
								color="stone"
								aria-hidden="true"
							/>
							<div className="w-full">
								<label
									htmlFor="inputDate"
									className="text-sm font-normal text-gray-500"
								>
									Selecciona una fecha
								</label>
								<Datepicker
									inputId="inputDate"
									i18n={"es"}
									startWeekOn="mon"
									value={date}
									onChange={handleChangeDate}
									asSingle={true}
									useRange={false}
									minDate={new Date("2014-03-31")}
									maxDate={new Date()}
								/>
							</div>
						</Flex>
					</Card>
					<Card decoration="top" decorationColor="purple">
						<Flex justifyContent="start" className="space-x-4">
							<Icon
								icon={GlobeIcon}
								variant="solid"
								size="xl"
								color="purple"
								aria-hidden="true"
							/>
							<div className="w-full" role="group" aria-labelledby="etiquetaZona">
								<Text id="etiquetaZona">Selecciona la zona</Text>
								<Dropdown value={province} onValueChange={setProvince}>
									<DropdownItem
										value="PCB"
										text={"Península, Canarias y Baleares"}
									/>
									<DropdownItem value="CYM" text={"Ceuta y Melilla"} />
								</Dropdown>
							</div>
						</Flex>
					</Card>
					<Card decoration="top" decorationColor="yellow">
						<Flex justifyContent="start" className="space-x-4">
							<Icon
								icon={LightningBoltIcon}
								variant="solid"
								size="xl"
								color="yellow"
								aria-hidden="true"
							/>
							<div
								className="w-full"
								role="group"
								aria-labelledby="etiquetaUnidad"
							>
								<Text id="etiquetaUnidad">Selecciona una unidad de medida</Text>
								<Dropdown value={unity} onValueChange={setUnity}>
									<DropdownItem value="kWh" text={"Kilovatios hora (kWh)"} />
									<DropdownItem value="MWh" text={"Megavatios hora (MWh)"} />
								</Dropdown>
							</div>
						</Flex>
					</Card>
				</Grid>

				<div aria-live="polite" className="mt-6">
					{estado === "cargando" && <Text>Cargando precios…</Text>}
					{estado === "error" && (
						<Text color="red">
							No hay precios disponibles para esta fecha. Prueba con otro día
							o vuelve a intentarlo más tarde.
						</Text>
					)}
				</div>

				<Grid numColsLg={3} className="mt-6 gap-6">
					<PriceCard
						icon={ArrowSmDownIcon}
						title={`Precio más bajo del ${unity}`}
						price={euroFormatter(lowPrice.price, numDigits, numDigits)}
						text={lowPrice?.text}
						color="green"
					/>
					<PriceCard
						icon={MinusIcon}
						title={`Precio medio del ${unity}`}
						price={euroFormatter(middlePrice.price, numDigits, numDigits)}
						text={middlePrice?.text}
						color="amber"
					/>
					<PriceCard
						icon={ArrowSmUpIcon}
						title={`Precio más alto del ${unity}`}
						price={euroFormatter(hightPrice.price, numDigits, numDigits)}
						text={hightPrice?.text}
						color="red"
					/>
				</Grid>

				<TabList
					defaultValue="1"
					onValueChange={(value) => setSelectedView(value)}
					className="mt-6"
				>
					<Tab value="1" text="Gráfica" />
					<Tab value="2" text="Detalles" />
				</TabList>

				{selectedView === "1" ? (
					<>
						<AreaChart
							data={dataFiltered ?? []}
							index="Hora"
							categories={["Precio"]}
							colors={["blue"]}
							valueFormatter={euroFormatter}
							showLegend={false}
							className="mt-6"
						/>
					</>
				) : (
					<Table className="mt-6">
						<TableHead>
							<TableRow>
								<TableHeaderCell>Hora</TableHeaderCell>
								<TableHeaderCell className="text-right">{`Precio ${unity}`}</TableHeaderCell>
								<TableHeaderCell className="text-right">
									Periodo
								</TableHeaderCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{colorearPrecios(dataFiltered).map((item) => {
								const periodo = periodoPeaje(
									item.Hora,
									fechaSeleccionada,
									province
								);
								return (
									<TableRow key={item.Hora} className={item.Color}>
										<TableCell>{`de ${item.Hora} a ${incrementarHora(
											item.Hora
										)}`}</TableCell>
										<TableCell className="text-right">
											{euroFormatter(item.Precio, numDigits, numDigits)}
											<span className="sr-only">{` (precio ${item.Nivel})`}</span>
										</TableCell>
										<TableCell className="text-right">
											<Badge icon={periodo.icon} size="xs" color={periodo.color}>
												{periodo.text}
											</Badge>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				)}
			</main>
		</>
	);
}
