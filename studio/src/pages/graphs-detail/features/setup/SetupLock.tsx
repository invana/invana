import { SETUP_STEP_BY_KEY } from "@/pages/graphs-detail/features/setup/setupSteps";
import { useSettingsPanel } from "@/pages/graphs-detail/shell/useSettingsPanel";
import { type Graph, type SetupGate, missingForGate } from "@/types/graphs";
import { Button, EmptyState, EmptyStateLock } from "@invana/ui";
import { ArrowRight, Lock } from "lucide-react";

const GATE_SENTENCE: Record<SetupGate, string> = {
	connected: "a database is connected",
	grounded: "a model is published and the graph holds records",
	answering: "an LLM provider is configured",
};

interface Props {
	/** The Graph, when it has loaded. Without it the lock still names the gate —
	 *  it never guesses which steps are outstanding. */
	graph?: Graph;
	/** Which gate holds this surface shut. */
	gate: SetupGate;
	/** What is behind the lock, in the product's own words — `Ask`, `Explorer`. */
	surface: string;
}

/**
 * A surface that is not open yet, and the gate that opens it
 * (setup.md SU13 · graph-detail-page.md G28).
 *
 * It replaced one banner that could only say the graph was not ready and never
 * what for. `EmptyState`'s `locks` is the point: naming the step that unlocks a
 * surface turns an empty screen into a sequence, and the button lands on the
 * panel that owns that step rather than on "setup" in general.
 */
export function SetupLock({ graph, gate, surface }: Props) {
	const { setSection } = useSettingsPanel();
	const missing = graph ? missingForGate(graph, gate) : [];
	const first = missing[0];
	const firstMeta = first ? SETUP_STEP_BY_KEY[first] : undefined;

	return (
		<div className="flex h-full w-full items-center justify-center p-4">
			<EmptyState
				icon={<Lock className="size-5 text-muted-foreground" />}
				title={`${surface} opens when ${GATE_SENTENCE[gate]}`}
				description="Setup is read off this graph's own facts — finish the step and this fills itself in."
				locks={missing.map((section) => (
					<EmptyStateLock key={section}>
						{SETUP_STEP_BY_KEY[section].label}
					</EmptyStateLock>
				))}
				actions={
					firstMeta ? (
						<Button
							size="sm"
							onClick={() =>
								setSection(firstMeta.settingsSection, firstMeta.settingsTab)
							}
						>
							{firstMeta.label}
							<ArrowRight className="size-3.5" />
						</Button>
					) : (
						<Button
							size="sm"
							variant="outline"
							onClick={() => setSection("info")}
						>
							Open setup
							<ArrowRight className="size-3.5" />
						</Button>
					)
				}
			/>
		</div>
	);
}
