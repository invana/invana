/**
 * *Add functions* — the catalogue grouped by namespace, searched in place.
 * Picking functions and adding them writes a step line per function under
 * `## Steps`; the need lives in the prose, and the next draw maps it. A
 * function the plan already names is checked and cannot be picked twice.
 */

import {
	BoundChip,
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
} from "@invana/ui";
import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { namespaceOf } from "../functions/shared";
import type { CatalogueEntry } from "../plans/types";

export function AddFunctionsPicker({
	entries,
	named,
	onAdd,
}: {
	entries: CatalogueEntry[];
	/** The functions the plan already calls. */
	named: string[];
	onAdd: (functions: string[]) => void;
}) {
	const [open, setOpen] = useState(false);
	const [picked, setPicked] = useState<string[]>([]);
	const groups = new Map<string, CatalogueEntry[]>();
	for (const e of entries) {
		const ns = namespaceOf(e.step_key);
		groups.set(ns, [...(groups.get(ns) ?? []), e]);
	}
	const toggle = (key: string) =>
		setPicked((p) =>
			p.includes(key) ? p.filter((k) => k !== key) : [...p, key],
		);
	const close = () => {
		setOpen(false);
		setPicked([]);
	};

	return (
		<Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
			<PopoverTrigger asChild>
				<Button size="sm" variant="outline">
					<Plus /> Add functions
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-[28rem] p-0">
				<Command>
					<CommandInput placeholder={`Search ${entries.length} functions`} />
					<CommandList>
						<CommandEmpty>No function matches.</CommandEmpty>
						{[...groups].map(([ns, rows]) => (
							<CommandGroup
								key={ns}
								heading={`${ns}.* · ${[...new Set(rows.map((r) => r.bound))].join(" · ")}`}
							>
								{rows.map((e) => {
									const has = named.includes(e.step_key);
									const on = has || picked.includes(e.step_key);
									return (
										<CommandItem
											key={e.step_key}
											value={e.step_key}
											keywords={[e.summary, ns]}
											disabled={has}
											onSelect={() => toggle(e.step_key)}
										>
											<Check className={on ? "opacity-100" : "opacity-0"} />
											<span className="truncate font-mono">{e.step_key}</span>
											<span className="ms-auto shrink-0 ps-3">
												<BoundChip bound={e.bound} />
											</span>
										</CommandItem>
									);
								})}
							</CommandGroup>
						))}
					</CommandList>
				</Command>
				<div className="flex items-center gap-2 border-t p-2">
					<span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
						{picked.length
							? `+ ${picked.join(", ")} — a step line each, under Steps`
							: "Pick the functions this skill needs"}
					</span>
					<Button size="sm" variant="ghost" onClick={close}>
						Cancel
					</Button>
					<Button
						size="sm"
						disabled={picked.length === 0}
						onClick={() => {
							onAdd(picked);
							close();
						}}
					>
						<Check /> Add {picked.length || ""}
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
