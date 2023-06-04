import { AreaChart, Card, Flex, Icon, Text, Title } from "@tremor/react";
import { InformationCircleIcon } from "@heroicons/react/outline";
import { euroFormatter } from "../utils";

export function ChartView({ data }) {
	return (
		<Card>
			<div className="md:flex justify-between">
				<div>
					<Flex
						justifyContent="start"
						className="space-x-0.5"
						alignItems="center"
					>
						<Title>Término de facturación de energía activa del PVPC</Title>
						<Icon
							icon={InformationCircleIcon}
							variant="simple"
							tooltip="Información obtenida de REE"
						/>
					</Flex>
					<Text> Daily increase or decrease per domain </Text>
				</div>
			</div>
			<AreaChart
				data={data}
				index="Hora"
				categories={["Precio"]}
				colors={["blue"]}
				valueFormatter={euroFormatter}
				showLegend={false}
				className="h-96 mt-8"
			/>
		</Card>
	);
}
