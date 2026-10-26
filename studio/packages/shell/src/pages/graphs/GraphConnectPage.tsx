import { Input, Label } from "@invana/forms";
import { Button } from "@invana/ui";
import {
	CONNECTOR_OPTIONS,
	type GraphConnectionCreate,
	useConnectGraphMutation,
	useConnectTestMutation,
} from "@invana-studio/core";
import { FormError } from "@invana-studio/ui";
import { CheckCircle2, Sparkles, XCircle } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

/** The engine cards, in the order the connect form shows them. */
const ENGINES: { connector: string; name: string; languages: string }[] = [
	{ connector: CONNECTOR_OPTIONS[0].value, name: "Neo4j", languages: "Cypher" },
	{
		connector: CONNECTOR_OPTIONS[1].value,
		name: "Memgraph",
		languages: "Cypher",
	},
	{
		connector: CONNECTOR_OPTIONS[2].value,
		name: "ArcadeDB",
		languages: "Cypher · Gremlin",
	},
	{
		connector: CONNECTOR_OPTIONS[3].value,
		name: "JanusGraph",
		languages: "Gremlin",
	},
	{
		connector: CONNECTOR_OPTIONS[4].value,
		name: "Amazon Neptune",
		languages: "Gremlin",
	},
	{
		connector: CONNECTOR_OPTIONS[5].value,
		name: "TinkerGraph",
		languages: "Gremlin",
	},
];

type Test =
	| { kind: "untested" }
	| { kind: "testing" }
	| { kind: "passed"; serverVersion?: string | null; latencyMs?: number }
	| { kind: "failed"; error: string };

/**
 * `/graphs/new` — the connect form. It names nothing it can derive: the
 * engine names the Graph from the database or the URI host, reads what the
 * database holds and drafts a model, and this page lands on that draft.
 */
export function GraphConnectPage() {
	const navigate = useNavigate();
	const connect = useConnectGraphMutation();
	const testMutation = useConnectTestMutation();
	const [connector, setConnector] = useState<string>(ENGINES[0].connector);
	const [uri, setUri] = useState("");
	const [user, setUser] = useState("");
	const [password, setPassword] = useState("");
	const [test, setTest] = useState<Test>({ kind: "untested" });

	const payload = (): GraphConnectionCreate => ({
		uri: uri.trim(),
		connector_class: connector,
		database: null,
		auth: { username: user, password },
		read_only: false,
	});

	const touch = () => setTest({ kind: "untested" });
	const ready = uri.trim().length > 0;

	const runTest = () => {
		setTest({ kind: "testing" });
		testMutation.mutate(payload(), {
			onSuccess: (r) =>
				setTest(
					r.ok
						? {
								kind: "passed",
								serverVersion: r.server_version,
								latencyMs: r.latency_ms,
							}
						: { kind: "failed", error: r.error ?? "Connection failed." },
				),
			onError: (err) => setTest({ kind: "failed", error: err.message }),
		});
	};

	const submit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!ready) return;
		connect.mutate(payload(), {
			onSuccess: ({ graph, model_id }) =>
				navigate(
					`/u/${graph.owner_username}/${graph.slug}/modeller/models?model=${model_id}&model_open=1&models_view=schema&right=assistant`,
				),
		});
	};

	return (
		<div className="h-full overflow-auto">
			<form onSubmit={submit} className="mx-auto max-w-6xl px-10 py-10">
				<h1 className="text-xl font-semibold">Connect a database</h1>
				<p className="mt-1 mb-6 text-muted-foreground">
					A new Graph starts here. Point Invana at a graph database; it reads
					what is there and drafts a model you can review.
				</p>

				<div className="mb-6 grid grid-cols-3 gap-2">
					{ENGINES.map((e) => (
						<button
							key={e.connector}
							type="button"
							aria-pressed={connector === e.connector}
							onClick={() => {
								setConnector(e.connector);
								touch();
							}}
							className={`rounded-sm border px-3 py-2.5 text-left ${
								connector === e.connector
									? "border-primary ring-1 ring-primary"
									: "hover:bg-accent"
							}`}
						>
							<span className="block font-medium">{e.name}</span>
							<span className="block text-sm text-muted-foreground">
								{e.languages}
							</span>
						</button>
					))}
				</div>

				<div className="flex flex-col gap-4">
					<div className="space-y-1.5">
						<Label htmlFor="connect-uri">URI</Label>
						<Input
							id="connect-uri"
							className="font-mono"
							value={uri}
							placeholder="bolt://localhost:7687"
							onChange={(e) => {
								setUri(e.target.value);
								touch();
							}}
						/>
					</div>
					<div className="grid grid-cols-2 gap-2.5">
						<div className="space-y-1.5">
							<Label htmlFor="connect-user">User</Label>
							<Input
								id="connect-user"
								value={user}
								autoComplete="username"
								onChange={(e) => {
									setUser(e.target.value);
									touch();
								}}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="connect-password">Password</Label>
							<Input
								id="connect-password"
								type="password"
								value={password}
								autoComplete="current-password"
								onChange={(e) => {
									setPassword(e.target.value);
									touch();
								}}
							/>
						</div>
					</div>
				</div>

				{test.kind === "passed" ? (
					<div className="mt-4 flex items-center gap-2 text-success">
						<CheckCircle2 className="h-4 w-4" />
						<span>
							Connection works
							{test.serverVersion ? (
								<span className="text-muted-foreground">
									{" "}
									· <span className="font-mono">{test.serverVersion}</span>
								</span>
							) : null}
							{test.latencyMs !== undefined ? (
								<span className="text-muted-foreground">
									{" "}
									· {test.latencyMs} ms
								</span>
							) : null}
						</span>
					</div>
				) : null}
				{test.kind === "failed" ? (
					<div className="mt-4 flex items-start gap-2 text-destructive">
						<XCircle className="mt-0.5 h-4 w-4 shrink-0" />
						<span>{test.error}</span>
					</div>
				) : null}
				<FormError error={connect.error} className="mt-4" />

				<div className="mt-5 flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={runTest}
						disabled={!ready || test.kind === "testing" || connect.isPending}
					>
						{test.kind === "testing" ? "Testing…" : "Test"}
					</Button>
					<Button type="submit" disabled={!ready || connect.isPending}>
						<Sparkles className="mr-1.5 h-4 w-4" />
						{connect.isPending ? "Connecting…" : "Connect and draft a model"}
					</Button>
				</div>
			</form>
		</div>
	);
}
