import { useEffect, useState } from "react";
import {
	AreaChart,
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
	Title,
} from "@tremor/react";
import {
	ArrowSmDownIcon,
	ArrowSmUpIcon,
	CalendarIcon,
	GlobeIcon,
	LightningBoltIcon,
	MinusIcon,
} from "@heroicons/react/outline";
import { PriceCard } from "./components/PriceCard";
import Datepicker from "react-tailwindcss-datepicker";
import {
	StringToNumerLocale,
	colorearPrecios,
	euroFormatter,
	incrementarHora,
	ordenarPrecios,
} from "./utils";

const pedirDatos = (date) => {
	return fetch(
		`https://api.esios.ree.es/archives/70/download_json?date=${date}`,
		{
			headers: {
				"x-api-key":
					"396965232d3d5672983b040914f8392c41662b689fb6acba15beb3c59918a571",
			},
		}
	)
		.then((response) => response.json())
		.then(function (data) {
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

const precioMasBajo = (data) => {
	if (data === null) return { price: "0,00 €", text: "" };
	const first = ordenarPrecios(data)[0];
	return {
		price: first.Precio,
		text: `de ${first.Hora} a ${incrementarHora(first.Hora)}`,
	};
};

const precioMasAlto = (data) => {
	if (data === null) return { price: "0,00 €", text: "" };
	const last = ordenarPrecios(data)[data.length - 1];
	return {
		price: last.Precio,
		text: `de ${last.Hora} a ${incrementarHora(last.Hora)}`,
	};
};

const precioMedio = (data) => {
	if (data === null) return { price: "0,00 €", text: "" };
	const totalPrecio = data.reduce(
		(accumulator, currentValue) => accumulator + currentValue.Precio,
		0
	);
	console.log(totalPrecio);
	return {
		price: totalPrecio / data.length,
		text: "",
	};
};

export default function App() {
	const [unity, setUnity] = useState("kWh");
	const [province, setProvince] = useState("PCB");
	const [selectedView, setSelectedView] = useState("1");
	const [data, setData] = useState(null);
	const [lowPrice, setLowPrice] = useState({ price: "0.00 €", text: "" });
	const [hightPrice, setHightPrice] = useState({ price: "0.00 €", text: "" });
	const [middlePrice, setMiddletPrice] = useState({
		price: "0.00 €",
		text: "",
	});
	const [dataFiltered, setDataFiltered] = useState(null);
	const [date, setDate] = useState({
		startDate: new Date().toISOString().split("T")[0],
		endDate: new Date().toISOString().split("T")[0],
	});

	const numDigits = unity === "kWh" ? 5 : 2;

	useEffect(() => {
		pedirDatos(date.startDate).then((data) => setData(data));
	}, [date]);

	useEffect(() => {
		const dataFiltered = filterData(data, province, unity);
		setDataFiltered(dataFiltered);
		setLowPrice(precioMasBajo(dataFiltered));
		setHightPrice(precioMasAlto(dataFiltered));
		setMiddletPrice(precioMedio(dataFiltered));
	}, [data, unity, province]);

	const handleChangeDate = (selectedDate) => {
		setDate(selectedDate);
	};

	return (
		<>
			<main className="bg-slate-50 p-6 sm:p-10">
				<Title>Precio de la luz</Title>
				<Text>Información del precio de la luz obtenida de REE</Text>
				<Grid numColsLg={3} className="mt-6 gap-6">
					<Card decoration="top" decorationColor="stone">
						<Flex justifyContent="start" className="space-x-4">
							<Icon
								icon={CalendarIcon}
								variant="solid"
								size="xl"
								color="stone"
							/>
							<div className="w-full">
								<Text>Selecciona una fecha</Text>
								<Datepicker
									inputId="inputDate"
									i18n={"es"}
									startWeekOn="mon"
									value={date}
									onChange={handleChangeDate}
									asSingle={true}
									useRange={false}
									minDate={new Date("2014-03-31")}
									maxDate={new Date().toISOString().split("T")[0]}
								/>
							</div>
						</Flex>
					</Card>
					<Card decoration="top" decorationColor="purple">
						<Flex justifyContent="start" className="space-x-4">
							<Icon icon={GlobeIcon} variant="solid" size="xl" color="purple" />
							<div className="w-full">
								<Text>Selecciona unas provincias</Text>
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
							/>
							<div className="w-full">
								<Text>Selecciona una unidad de medida</Text>
								<Dropdown value={unity} onValueChange={setUnity}>
									<DropdownItem value="kWh" text={"Kilovatios hora (kWh)"} />
									<DropdownItem value="MWh" text={"Megavatios hora (MWh)"} />
								</Dropdown>
							</div>
						</Flex>
					</Card>
				</Grid>
				<Grid numColsLg={3} className="mt-6 gap-6">
					<PriceCard
						icon={ArrowSmDownIcon}
						title={`Precio más bajo del ${unity}`}
						price={euroFormatter(lowPrice?.price, numDigits, numDigits)}
						text={lowPrice?.text}
						color="green"
					/>
					<PriceCard
						icon={MinusIcon}
						title={`Precio medio del ${unity}`}
						price={euroFormatter(middlePrice?.price, numDigits, numDigits)}
						text={middlePrice?.text}
						color="amber"
					/>
					<PriceCard
						icon={ArrowSmUpIcon}
						title={`Precio más alto del ${unity}`}
						price={euroFormatter(hightPrice?.price, numDigits, numDigits)}
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
							data={dataFiltered}
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
							</TableRow>
						</TableHead>
						<TableBody>
							{colorearPrecios(dataFiltered).map((item) => (
								<TableRow key={item.Hora} className={item.Color}>
									<TableCell>{`de ${item.Hora} a ${incrementarHora(
										item.Hora
									)}`}</TableCell>
									<TableCell className="text-right">
										{euroFormatter(item.Precio, numDigits, numDigits)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</main>
		</>
	);
}
