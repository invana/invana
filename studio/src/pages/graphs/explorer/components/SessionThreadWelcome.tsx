import { ArrowDown } from "lucide-react";
import { CAPABILITIES } from "./sessionCapabilities";

/**
 * Inline helper shown in a fresh session's empty thread (RFC-045). Instead of a
 * bare box, it introduces what a session is for — asking questions to explore
 * the graph — and lists what you can do, the same capabilities as the first-run
 * tutorial modal (content shared via {@link CAPABILITIES}). Deliberately muted:
 * it's a quiet hint, not a headline, and it points at the composer below.
 *
 * Its own scroll container (not the thread's Radix `ScrollArea`, whose
 * table-wrapped viewport defeats `min-h-full`) so the block centres vertically
 * when it fits and scrolls from the top when it doesn't.
 */
export function SessionThreadWelcome() {
	return (
		<div className="min-h-0 flex-1 overflow-y-auto">
			<div className="flex min-h-full flex-col justify-center gap-3 p-3 text-muted-foreground">
				<p className="font-medium">Explore your graph in this session</p>
				<ul className="space-y-2">
					{CAPABILITIES.map((c) => (
						<li key={c.title} className="flex items-center gap-2.5">
							<c.icon className="h-4 w-4 shrink-0" />
							<span>
								<span className="font-medium text-foreground/80">
									{c.title}.
								</span>{" "}
								{c.short}
							</span>
						</li>
					))}
				</ul>
				<p className="flex items-center gap-1.5">
					<ArrowDown className="h-3.5 w-3.5 shrink-0" />
					Ask a question below to get started.
				</p>
			</div>
		</div>
	);
}
