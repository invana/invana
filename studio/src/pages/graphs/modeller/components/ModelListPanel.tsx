import { ScrollArea } from "@invana/ui";
import { ChevronRight } from "lucide-react";
import type { GraphModelSummary } from "../../../../types/models";
import { PERSONA_OPTIONS } from "../../../../types/models";

interface Props {
	models: GraphModelSummary[];
	onSelect: (modelId: string) => void;
}

function personaLabel(persona: string): string {
	return PERSONA_OPTIONS.find((o) => o.value === persona)?.label ?? persona;
}

export function ModelListPanel({ models, onSelect }: Props) {
	return (
		<div className="flex h-full flex-col">
			<div className="px-3 py-2 border-b border-border">
				<span className="text-base font-semibold uppercase tracking-wide text-muted-foreground">
					Models
				</span>
			</div>
			<ScrollArea className="flex-1">
				<div className="flex flex-col py-1">
					{models.map((m) => (
						<button
							type="button"
							key={m.id}
							onClick={() => onSelect(m.id)}
							className="flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-accent/50 transition-colors"
						>
							<div className="min-w-0">
								<div className="font-medium truncate">{m.name}</div>
								<div className="text-xs text-muted-foreground truncate">
									{personaLabel(m.persona)}
									{m.active_version ? ` · v${m.active_version.version}` : ""}
								</div>
							</div>
							<ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
						</button>
					))}
				</div>
			</ScrollArea>
		</div>
	);
}
