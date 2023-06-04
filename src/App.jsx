import { useEffect, useState } from "react";
import {
	Card,
	DateRangePicker,
	Dropdown,
	DropdownItem,
	Flex,
	Grid,
	Icon,
	Metric,
	Tab,
	TabList,
	Text,
	Title,
	Toggle,
	ToggleItem,
} from "@tremor/react";
import { ChartView } from "./components/ChartView";
import { da, es } from "date-fns/locale";
import {
	ArrowSmDownIcon,
	ArrowSmUpIcon,
	CalendarIcon,
	GlobeAltIcon,
	GlobeIcon,
	LightningBoltIcon,
} from "@heroicons/react/outline";
import { StringToNumerLocale } from "./utils/StringToNumberLocale";
import { PriceCard } from "./components/PriceCard";
import Datepicker from "react-tailwindcss-datepicker";
import { euroFormatter, incrementarHora } from "./utils";

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

const ordenarPrecios = (data) => {
	return [...data].sort((a, b) => {
		if (a.Precio < b.Precio) return -1;
		if (a.Precio > b.Precio) return 1;
		return 0;
	});
};

const precioMasBajo = (data) => {
	if (data === null) return { price: "0,00 €", text: "" };
	const first = ordenarPrecios(data)[0];
	return {
		price: euroFormatter(first.Precio),
		text: `de ${first.Hora} a ${incrementarHora(first.Hora)}`,
	};
};

const precioMasAlto = (data) => {
	if (data === null) return { price: "0,00 €", text: "" };
	const last = ordenarPrecios(data)[data.length - 1];
	return {
		price: euroFormatter(last.Precio),
		text: `de ${last.Hora} a ${incrementarHora(last.Hora)}`,
	};
};

export default function App() {
	const [unity, setUnity] = useState("kWh");
	const [province, setProvince] = useState("PCB");
	const [selectedView, setSelectedView] = useState("1");
	const [data, setData] = useState(null);
	const [lowPrice, setLowPrice] = useState({ price: "0.00 €", text: "" });
	const [hightPrice, setHightPrice] = useState({ price: "0.00 €", text: "" });
	const [dataFiltered, setDataFiltered] = useState(null);
	const [date, setDate] = useState({
		startDate: new Date().toISOString().split("T")[0],
		endDate: new Date().toISOString().split("T")[0],
	});

	useEffect(() => {
		pedirDatos(date.startDate).then((data) => setData(data));
	}, [date]);

	useEffect(() => {
		const dataFiltered = filterData(data, province, unity);
		setDataFiltered(dataFiltered);
		setLowPrice(precioMasBajo(dataFiltered));
		setHightPrice(precioMasAlto(dataFiltered));
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
						<Grid numColsLg={2} className="mt-6 gap-6">
							<PriceCard
								icon={ArrowSmDownIcon}
								title={`Precio más bajo del ${unity}`}
								price={lowPrice?.price}
								text={lowPrice?.text}
								color="green"
							/>
							<PriceCard
								icon={ArrowSmUpIcon}
								title={`Precio más alto del ${unity}`}
								price={hightPrice?.price}
								text={hightPrice?.text}
								color="red"
							/>
						</Grid>

						<div className="mt-6">
							<ChartView data={dataFiltered} />
						</div>
					</>
				) : (
					<Card className="mt-6">
						<div className="h-96" />
					</Card>
				)}
			</main>
		</>
	);
}
