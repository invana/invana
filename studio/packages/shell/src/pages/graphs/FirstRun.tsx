import {
	Alert,
	AlertDescription,
	Button,
	Card,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
	TypographyH2,
	TypographyMuted,
} from "@invana/ui";
import type { Graph } from "@invana-studio/core";
import { Database, FlaskConical, Table2 } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

/** The sample Graphs the first run offers, by slug, in the order it lists them. */
const SAMPLES = ["airways", "arabidopsis"] as const;

/**
 * The first run (SH-19): what a member with no Graph sees in place of the
 * Graphs list, and what `/graphs?first-run` shows anyone.
 *
 * It asks *what are you trying to decide?* and offers three ways in, each
 * one step that unlocks the rest:
 *
 * | Way in | Goes to |
 * |---|---|
 * | Connect a graph database | New Graph — the Modeller drafts a model from what is there |
 * | Start from data | Datasets |
 * | Try a sample Graph | airways or arabidopsis, when this install has one the member can open |
 *
 * A sample Graph is loaded by whoever runs the install; the card says so
 * rather than offering a button that cannot work.
 */
export function FirstRun({ graphs }: { graphs: readonly Graph[] }) {
	const navigate = useNavigate();
	const samples = SAMPLES.flatMap((slug) =>
		graphs.filter((g) => g.slug === slug && g.status === "active"),
	);

	return (
		<div className="h-full overflow-auto">
			<div className="mx-auto flex max-w-5xl flex-col gap-6 px-10 py-16">
				<div className="flex flex-col gap-2">
					<TypographyH2 className="border-0 pb-0">
						What are you trying to decide?
					</TypographyH2>
					<TypographyMuted>
						Think it through. Decide with evidence. Pick a way in; you can do
						the others later.
					</TypographyMuted>
				</div>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
					<WayIn
						icon={<Database className="size-5 text-primary" />}
						title="Connect a graph database"
						description="Neo4j, Memgraph, ArcadeDB, JanusGraph, Neptune — the Modeller drafts a model from what is there."
					>
						<Button onClick={() => navigate("/graphs/new")}>Connect</Button>
					</WayIn>
					<WayIn
						icon={<Table2 className="size-5 text-primary" />}
						title="Start from data"
						description="Bring files in from the CLI or the API, and watch every import land."
					>
						<Button variant="outline" onClick={() => navigate("/datasets")}>
							Open Datasets
						</Button>
					</WayIn>
					<WayIn
						icon={<FlaskConical className="size-5 text-primary" />}
						title="Try a sample Graph"
						description={
							samples.length
								? "Airways or arabidopsis, with a starter project to walk through."
								: "No sample Graph is loaded on this install yet. Whoever runs it can load airways or arabidopsis from the demos that ship with Invana."
						}
					>
						{samples.map((g) => (
							<Button
								key={g.id}
								variant="outline"
								onClick={() => navigate(`/u/${g.owner_username}/${g.slug}`)}
							>
								Open {g.name}
							</Button>
						))}
					</WayIn>
				</div>

				<Alert>
					<AlertDescription>
						Nothing here yet. Every product shows what unlocks it, and the
						set-up checklist keeps track as you go.
					</AlertDescription>
				</Alert>
			</div>
		</div>
	);
}

function WayIn({
	icon,
	title,
	description,
	children,
}: {
	icon: ReactNode;
	title: string;
	description: string;
	children: ReactNode;
}) {
	return (
		<Card className="flex flex-col">
			<CardHeader className="flex-1 gap-2">
				{icon}
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardFooter className="flex flex-wrap gap-2">{children}</CardFooter>
		</Card>
	);
}
