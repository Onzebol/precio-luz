import { TabList, ToggleItem } from "@tremor/react";
import { useState } from "react";

const filters = [
	["PCB", "Península, Canarias y Baleares"],
	["CYM", "Ceuta y Melilla"],
];

export function Tabs() {
	const [tab, setTab] = useState("PCB");

	return (
		<TabList
			defaultValue={tab}
			onValueChange={(value) => setTab(value)}
			className="mt-10"
		>
			{filters.map((filter, index) => {
				console.log(filter);
				return <ToggleItem key={index} value={filter[0]} text={filter[1]} />;
			})}
		</TabList>
	);
}
