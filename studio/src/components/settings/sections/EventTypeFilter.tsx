import {
	Badge,
	Button,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	Popover,
	PopoverContent,
	PopoverTrigger,
	RichSelect,
	type RichSelectOption,
} from "@invana/ui";
import {
	AlertCircle,
	Boxes,
	Cable,
	Check,
	Database,
	FileStack,
	Layers,
	Lightbulb,
	ListFilter,
	type LucideIcon,
	MessagesSquare,
	Sparkles,
	UserCircle,
	Users,
	Wand2,
	X,
} from "lucide-react";
import { useState } from "react";
import { EVENT_CATEGORIES } from "./eventCatalog";

/** Per-category glyph for the rich-select rows. */
const CATEGORY_ICON: Record<string, LucideIcon> = {
	graph: Database,
	connection: Cable,
	llm: Sparkles,
	skill: Wand2,
	model: Boxes,
	dataset: FileStack,
	member: Users,
	setup: Lightbulb,
	query: Layers,
	session: MessagesSquare,
	auth: UserCircle,
	system: AlertCircle,
};

interface Props {
	/** Selected exact `action` strings. Empty = no filter ("All"). */
	value: string[];
	onChange: (next: string[]) => void;
}

/**
 * Multi-select event-type filter. Two paths feed one selection set:
 *
 * - A `RichSelect` (multi/checkbox) dropdown of categories — the coarse
 *   filter; a row toggles its whole group.
 * - A searchable popover listing every individual event type for precise
 *   selection.
 *
 * Both are multi-select and stay in sync because they share one selection set
 * of exact `action` strings, sent to the read API's repeatable `action` query
 * param so server-side pagination stays correct.
 */
export function EventTypeFilter({ value, onChange }: Props) {
	const [open, setOpen] = useState(false);
	const selected = new Set(value);

	function toggle(action: string) {
		const next = new Set(selected);
		if (next.has(action)) next.delete(action);
		else next.add(action);
		onChange([...next]);
	}

	// Rich-select view of the coarse category filter. A category is "checked"
	// only when every type under it is selected; toggling a row adds/removes
	// that whole group.
	const checkedCategories = EVENT_CATEGORIES.filter((c) =>
		c.types.every((t) => selected.has(t.action)),
	).map((c) => c.key);

	const categoryOptions: RichSelectOption[] = EVENT_CATEGORIES.map((cat) => {
		const inCat = cat.types.filter((t) => selected.has(t.action)).length;
		return {
			value: cat.key,
			label: cat.label,
			icon: CATEGORY_ICON[cat.key],
			description: `${cat.types.length} event ${
				cat.types.length === 1 ? "type" : "types"
			}`,
			badge: inCat > 0 ? `${inCat}/${cat.types.length}` : undefined,
		};
	});

	function onCategoriesChange(next: string | string[]) {
		const nextKeys = new Set(Array.isArray(next) ? next : [next]);
		const wasChecked = new Set(checkedCategories);
		const result = new Set(selected);
		for (const cat of EVENT_CATEGORIES) {
			const now = nextKeys.has(cat.key);
			if (now && !wasChecked.has(cat.key))
				for (const t of cat.types) result.add(t.action);
			else if (!now && wasChecked.has(cat.key))
				for (const t of cat.types) result.delete(t.action);
		}
		onChange([...result]);
	}

	return (
		<div className="flex flex-wrap items-center gap-1">
			<RichSelect
				multiple
				label="Categories"
				options={categoryOptions}
				value={checkedCategories}
				onChange={onCategoriesChange}
				renderValue={(sel) =>
					`Categories${sel.length > 0 ? ` (${sel.length})` : ""}`
				}
				triggerClassName="h-7"
			/>

			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button variant="outline" size="sm" className="h-7 gap-1.5">
						<ListFilter className="w-3.5 h-3.5" />
						Event types
						{value.length > 0 && (
							<Badge variant="secondary">{value.length}</Badge>
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent align="start" className="w-[28rem] p-0">
					<Command>
						<CommandInput placeholder="Search event types…" />
						<CommandList>
							<CommandEmpty>No matching event types.</CommandEmpty>
							{EVENT_CATEGORIES.map((cat) => (
								<CommandGroup key={cat.key} heading={cat.label}>
									{cat.types.map((t) => {
										const isSel = selected.has(t.action);
										return (
											<CommandItem
												key={t.action}
												value={t.action}
												keywords={[t.label, cat.label]}
												onSelect={() => toggle(t.action)}
											>
												<Check
													className={`mr-2 w-3.5 h-3.5 shrink-0 ${
														isSel ? "opacity-100" : "opacity-0"
													}`}
												/>
												<span className="font-mono truncate">{t.action}</span>
												<span className="ml-auto pl-3 text-muted-foreground shrink-0">
													{t.label}
												</span>
											</CommandItem>
										);
									})}
								</CommandGroup>
							))}
						</CommandList>
					</Command>
					{value.length > 0 && (
						<div className="flex items-center justify-between border-t border-border px-2 py-1.5">
							<span className="text-muted-foreground">
								{value.length} selected
							</span>
							<Button
								variant="ghost"
								size="sm"
								className="gap-1"
								onClick={() => onChange([])}
							>
								<X className="w-3.5 h-3.5" />
								Clear
							</Button>
						</div>
					)}
				</PopoverContent>
			</Popover>
		</div>
	);
}
