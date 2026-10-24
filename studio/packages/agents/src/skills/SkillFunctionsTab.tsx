/**
 * A skill › **Functions** — every function the plan on screen names (the
 * published plan, or the draft's), with its bound, what it does and the steps
 * that call it. A row opens the function's page. The bound and summary are the
 * catalogue's, never a copy.
 */

import {
	BoundChip,
	EmptyState,
	Spinner,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	TypographyInlineCode,
} from "@invana/ui";
import { useSkillOpen } from "./skillOpen";
import { planFunctions, type SkillPage } from "./useSkillPage";

export function SkillFunctionsTab({ page }: { page: SkillPage }) {
	const open = useSkillOpen();
	const { plan } = page;
	if (page.planLoading || page.catalogueLoading)
		return (
			<div className="flex justify-center p-6">
				<Spinner />
			</div>
		);
	const fns = planFunctions(plan);
	if (fns.length === 0)
		return (
			<EmptyState
				className="py-8"
				title="No functions yet"
				description="The plan names its functions once the steps say what the skill does."
			/>
		);
	const nodes = plan?.nodes ?? [];

	return (
		<div className="p-3.5">
			<Table density="compact">
				<TableHeader>
					<TableRow>
						<TableHead>Function</TableHead>
						<TableHead>Bound</TableHead>
						<TableHead className="w-full">What it does</TableHead>
						<TableHead className="whitespace-nowrap">Steps</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{fns.map((f) => {
						const entry = page.catalogue.get(f);
						const steps = nodes
							.map((n, i) => (n.task === f ? i + 1 : null))
							.filter((i): i is number => i !== null);
						return (
							<TableRow
								key={f}
								className={open ? "cursor-pointer" : undefined}
								onClick={() => open?.func(f)}
							>
								<TableCell className="whitespace-nowrap">
									<TypographyInlineCode>{f}</TypographyInlineCode>
								</TableCell>
								<TableCell>
									{entry ? <BoundChip bound={entry.bound} /> : "—"}
								</TableCell>
								<TableCell>
									{entry?.summary ?? (
										<span className="text-muted-foreground">
											not in this engine's catalogue
										</span>
									)}
								</TableCell>
								<TableCell className="whitespace-nowrap font-mono">
									{steps.join(", ")}
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}
