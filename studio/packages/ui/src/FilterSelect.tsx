import { FilterChip } from "@invana/ui";

export interface FilterSelectOption {
	value: string;
	label: string;
}

/**
 * One `status ▾` chip that **selects**.
 *
 * The chip is the kit's `FilterChip`; what this adds is a native `<select>` laid
 * transparently over it, which is what brings keyboarding and the mobile picker
 * for free.
 *
 * **Kit candidate.** `FilterChip` is a button with no notion of options, so a
 * chip that opens a picker has nowhere in the kit to live yet. It is generic —
 * no Invana noun in the props — so it belongs in `@invana/ui` as a `FilterChip`
 * variant or a `FilterSelect` beside it, not here. Tracked in
 * `docs/for-developers/building-studio/design-kit-coverage.md`.
 */
export function FilterSelect({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: string;
	options: FilterSelectOption[];
	onChange: (value: string) => void;
}) {
	const current = options.find((o) => o.value === value);
	return (
		<span className="relative inline-flex">
			<FilterChip label={label} value={current?.label} active={value !== ""} />
			<select
				value={value}
				onChange={(e) => onChange(e.target.value)}
				aria-label={label}
				className="absolute inset-0 cursor-pointer opacity-0"
			>
				<option value="">{label}</option>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</span>
	);
}
