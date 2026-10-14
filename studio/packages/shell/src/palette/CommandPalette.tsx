/**
 * ⌘K — search or ask, from any screen.
 *
 * `CommandPaletteProvider` sits once in `<StudioShell>`: it owns whether the
 * palette is open, binds ⌘K (Ctrl K off a Mac) to toggle it, and draws the
 * dialog. `SearchTrigger` is the header's way in, and renders nothing outside
 * the provider.
 *
 * The palette never filters on its own: `usePaletteGroups` decides what
 * matches and in which order (names first, then *Related*, then *Ask the
 * assistant*), so the kit's `Command` runs with `shouldFilter={false}`.
 * Choosing a row navigates and closes; the page beneath keeps its trail.
 */
import {
	Button,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
	Dialog,
	DialogContent,
	DialogTitle,
	Kbd,
} from "@invana/ui";
import { Search } from "lucide-react";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import { usePaletteGroups } from "./usePaletteGroups";

interface PaletteState {
	open: boolean;
	setOpen: (open: boolean) => void;
}

const PaletteContext = createContext<PaletteState | null>(null);

const IS_MAC =
	typeof navigator !== "undefined" &&
	/Mac|iPhone|iPad/.test(navigator.platform);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
			if (e.altKey || e.shiftKey) return;
			e.preventDefault();
			setOpen((o) => !o);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	return (
		<PaletteContext.Provider value={{ open, setOpen }}>
			{children}
			<CommandPalette open={open} onOpenChange={setOpen} />
		</PaletteContext.Provider>
	);
}

/** The header's ⌘K: a search field that opens the palette. */
export function SearchTrigger() {
	const palette = useContext(PaletteContext);
	if (!palette) return null;
	return (
		<Button
			variant="outline"
			size="sm"
			className="w-56 justify-start text-muted-foreground"
			onClick={() => palette.setOpen(true)}
		>
			<Search />
			Search or ask…
			<Kbd className="ml-auto">{IS_MAC ? "⌘K" : "Ctrl K"}</Kbd>
		</Button>
	);
}

function CommandPalette({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [query, setQuery] = useState("");
	const { groups, failed, searching } = usePaletteGroups(query, open);

	const close = (next: boolean) => {
		if (!next) setQuery("");
		onOpenChange(next);
	};

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent className="max-w-2xl overflow-hidden p-0">
				<DialogTitle className="sr-only">Search or ask</DialogTitle>
				<Command shouldFilter={false} loop>
					<CommandInput
						value={query}
						onValueChange={setQuery}
						placeholder="Search records, models, runs — or ask"
					/>
					<CommandList className="max-h-[60vh]">
						<CommandEmpty>
							{searching ? "Searching…" : `Nothing is called “${query}”`}
						</CommandEmpty>
						{groups.map((group) => (
							<CommandGroup key={group.heading} heading={group.heading}>
								{group.entries.map((entry) => (
									<CommandItem
										key={entry.key}
										value={entry.key}
										onSelect={() => {
											entry.run();
											close(false);
										}}
									>
										{entry.icon && <entry.icon />}
										<span className="truncate">{entry.label}</span>
										{entry.detail && (
											<CommandShortcut className="tracking-normal">
												{entry.detail}
											</CommandShortcut>
										)}
									</CommandItem>
								))}
							</CommandGroup>
						))}
					</CommandList>
					<p className="border-t px-3 py-2 text-sm text-muted-foreground">
						{failed.length
							? `Could not search ${failed.join(", ")}`
							: "names first · ↵ to open · esc to close"}
					</p>
				</Command>
			</DialogContent>
		</Dialog>
	);
}
