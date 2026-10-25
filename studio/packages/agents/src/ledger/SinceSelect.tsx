/** The window a ledger read takes — `Last 7 days`, as a select. */

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@invana/forms";

export function SinceSelect({
	value,
	options,
	onChange,
}: {
	value: string;
	options: { value: string; label: string }[];
	onChange: (value: string) => void;
}) {
	return (
		<Select value={value} onValueChange={onChange}>
			<SelectTrigger className="w-40" aria-label="Window">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{options.map((o) => (
					<SelectItem key={o.value} value={o.value}>
						{o.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
