import { Card, Flex, Icon, Metric, Text } from "@tremor/react";

export function PriceCard({ icon, title, price, text, color }) {
	return (
		<Card decoration="top" decorationColor={color}>
			<Flex justifyContent="start" className="space-x-4">
				<Icon
					icon={icon}
					variant="solid"
					size="xl"
					color={color}
					aria-hidden="true"
				/>
				<div className="w-full">
					<Text>{title}</Text>
					<Flex
						justifyContent="start"
						alignItems="baseline"
						className="flex-wrap"
					>
						<Metric className="mr-3 tabular-nums">{price}</Metric>
						<Text>{text}</Text>
					</Flex>
				</div>
			</Flex>
		</Card>
	);
}
