import {
	BooleanField,
	Form,
	FormField,
	InputField,
	PasswordField,
	SelectField,
} from "@invana/forms";
import { Button, Card, Skeleton, StatusDot } from "@invana/ui";
import {
	CONNECTOR_OPTIONS,
	type GraphConnectionCreate,
	type GraphConnectionRead,
	graphsApi,
	useGraphConnectionQuery,
	usePutGraphConnectionMutation,
} from "@invana-studio/core";
import { ActButton } from "@invana-studio/shell";
import { FormError } from "@invana-studio/ui";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

interface Props {
	username: string;
	graphSlug: string;
}

interface ConnectionShape {
	connector_class: string;
	uri: string;
	username: string;
	password: string;
	database: string;
	server_version: string;
	read_only: boolean;
}

type TestState =
	| { kind: "untested" }
	| { kind: "testing" }
	| { kind: "passed"; latencyMs?: number; serverVersion?: string | null }
	| { kind: "failed"; error: string };

/** A change to any of these makes a passing test stale. */
const TESTED: (keyof ConnectionShape)[] = [
	"connector_class",
	"uri",
	"username",
	"password",
	"database",
];

const connectorLabel = (cls: string) =>
	CONNECTOR_OPTIONS.find((o) => o.value === cls)?.label ?? cls;

/**
 * Graph settings › **Database** — the one graph database this Graph reads
 * (`modeller.settings.database`, connect-a-database.md).
 *
 * The connection is always editable: a summary card — the engine and its
 * version, the connector and URI, whether it is connected — then the fields.
 * Four rules show where they bite rather than in a paragraph:
 *
 * | Rule | How it shows |
 * |---|---|
 * | Test gates Save | *Save* stays disabled until *Test connection* passes; any edit to what was tested resets it |
 * | The connector is fixed after the first save | a select only while there is no connection |
 * | The password is never read back | the field is blank; blank keeps the stored one, for the test too |
 * | The modeller's property types come from the server | the Capabilities row under the form |
 *
 * *Introspect* reads what the database holds — the physical mirror, never the
 * model (introspect-a-database.md).
 */
export function DatabaseTab({ username, graphSlug }: Props) {
	const { data: connection, isLoading } = useGraphConnectionQuery(
		username,
		graphSlug,
	);

	if (isLoading) {
		return (
			<div className="flex flex-col gap-3">
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-9 w-full" />
				<Skeleton className="h-9 w-full" />
			</div>
		);
	}

	return (
		<>
			{connection ? <ConnectionSummary connection={connection} /> : null}
			<ConnectionForm
				// A saved connection remounts the form on its new values.
				key={connection?.updated_at ?? "new"}
				username={username}
				graphSlug={graphSlug}
				connection={connection ?? null}
			/>
			{connection ? <Capabilities connection={connection} /> : null}
		</>
	);
}

/** The engine and version, the connector and URI, and the connection's state. */
function ConnectionSummary({
	connection,
}: {
	connection: GraphConnectionRead;
}) {
	const connected = connection.status === "ACTIVE";
	return (
		<Card className="flex flex-row items-center justify-between gap-4 p-4 shadow-none">
			<div className="min-w-0">
				<p className="font-medium">
					{connectorLabel(connection.connector_class)}{" "}
					{connection.server_version ?? ""}
				</p>
				<p className="truncate font-mono text-muted-foreground">
					{connection.connector_class} · {connection.uri}
				</p>
			</div>
			<span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
				<StatusDot tone={connected ? "success" : "warning"} />
				{connected ? "active" : connection.status.toLowerCase()}
				{connected && connection.latency_ms !== null
					? ` · ${connection.latency_ms} ms`
					: ""}
			</span>
		</Card>
	);
}

function ConnectionForm({
	username,
	graphSlug,
	connection,
}: Props & { connection: GraphConnectionRead | null }) {
	const mutation = usePutGraphConnectionMutation();
	const [test, setTest] = useState<TestState>({ kind: "untested" });
	const [introspecting, setIntrospecting] = useState(false);
	const form = useForm<ConnectionShape>({
		defaultValues: {
			connector_class: connection?.connector_class ?? "",
			uri: connection?.uri ?? "",
			username: connection?.auth_username ?? "",
			password: "",
			database: connection?.database ?? "",
			server_version: connection?.server_version ?? "",
			read_only: connection?.read_only ?? false,
		},
	});

	useEffect(() => {
		const sub = form.watch((_values, { name }) => {
			if (name && TESTED.includes(name))
				setTest((prev) =>
					prev.kind === "untested" ? prev : { kind: "untested" },
				);
		});
		return () => sub.unsubscribe();
	}, [form]);

	const payload = (): GraphConnectionCreate | null => {
		form.clearErrors();
		const v = form.getValues();
		if (!v.connector_class)
			form.setError("connector_class", { message: "Connector is required." });
		if (!v.uri.trim()) form.setError("uri", { message: "URI is required." });
		if (!v.connector_class || !v.uri.trim()) return null;
		return {
			uri: v.uri.trim(),
			connector_class: v.connector_class,
			database: v.database.trim() || null,
			// A blank password stands for the stored one.
			auth:
				v.username || v.password
					? { username: v.username, password: v.password }
					: {},
			read_only: v.read_only,
			server_version: v.server_version.trim() || null,
		};
	};

	const runTest = async () => {
		const body = payload();
		if (!body) return;
		setTest({ kind: "testing" });
		try {
			const r = await graphsApi.testConnection(username, graphSlug, body);
			if (r.ok) {
				if (r.server_version && !form.getValues().server_version.trim())
					form.setValue("server_version", r.server_version);
				setTest({
					kind: "passed",
					latencyMs: r.latency_ms,
					serverVersion: r.server_version,
				});
			} else {
				setTest({ kind: "failed", error: r.error ?? "Connection failed." });
			}
		} catch (err) {
			setTest({
				kind: "failed",
				error: err instanceof Error ? err.message : "Connection failed.",
			});
		}
	};

	const submit = form.handleSubmit(() => {
		const body = payload();
		if (!body || test.kind !== "passed") return;
		mutation.mutate(
			{ username, graphSlug, data: body },
			{
				onSuccess: () => toast.success("Connection saved"),
				onError: (err) => toast.error(err.message),
			},
		);
	});

	const introspect = async () => {
		setIntrospecting(true);
		try {
			await graphsApi.introspectConnection(username, graphSlug);
			toast.success(
				"Reading the database — the physical mirror refreshes when it lands.",
			);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Introspection failed.");
		} finally {
			setIntrospecting(false);
		}
	};

	return (
		<Form {...form}>
			<form onSubmit={submit} className="flex flex-col gap-4" noValidate>
				{connection ? null : (
					<FormField
						control={form.control}
						name="connector_class"
						render={({ field }) => (
							<SelectField
								label="Connector"
								placeholder="Select a connector"
								labelPosition="top"
								size="md"
								options={CONNECTOR_OPTIONS.map((o) => ({
									label: o.label,
									value: o.value,
								}))}
								value={field.value}
								onChange={field.onChange}
							/>
						)}
					/>
				)}
				<FormField
					control={form.control}
					name="uri"
					render={({ field }) => (
						<InputField
							label="URI"
							placeholder="bolt://localhost:7687"
							labelPosition="top"
							size="md"
							value={field.value}
							onChange={field.onChange}
						/>
					)}
				/>
				<FormField
					control={form.control}
					name="username"
					render={({ field }) => (
						<InputField
							label="User"
							placeholder="neo4j"
							labelPosition="top"
							size="md"
							value={field.value}
							onChange={field.onChange}
						/>
					)}
				/>
				<FormField
					control={form.control}
					name="password"
					render={({ field }) => (
						<PasswordField
							label="Password"
							placeholder={connection ? "••••••••" : ""}
							description={
								connection
									? "Stored encrypted. Leave blank to keep it."
									: "Stored encrypted."
							}
							labelPosition="top"
							size="md"
							value={field.value}
							onChange={field.onChange}
						/>
					)}
				/>
				<FormField
					control={form.control}
					name="database"
					render={({ field }) => (
						<InputField
							label="Database (optional)"
							placeholder="Connector default"
							description="Which database on this server to read. Gremlin backends address one graph per endpoint and ignore it."
							labelPosition="top"
							size="md"
							value={field.value}
							onChange={field.onChange}
						/>
					)}
				/>
				<FormField
					control={form.control}
					name="server_version"
					render={({ field }) => (
						<InputField
							label="Server version (optional)"
							placeholder="Detected when the test passes"
							description="Give it for a backend Invana cannot read it from, so property types resolve."
							labelPosition="top"
							size="md"
							value={field.value}
							onChange={field.onChange}
						/>
					)}
				/>
				<FormField
					control={form.control}
					name="read_only"
					render={({ field }) => (
						<BooleanField
							label="Read-only connection"
							control="checkbox"
							value={field.value}
							onChange={field.onChange}
						/>
					)}
				/>

				<TestLine test={test} />
				<FormError error={mutation.error} />

				<div className="flex items-center gap-2">
					<ActButton
						area="settings"
						type="submit"
						disabled={mutation.isPending || test.kind !== "passed"}
					>
						{mutation.isPending ? "Saving…" : "Save"}
					</ActButton>
					<Button
						type="button"
						variant="outline"
						onClick={runTest}
						disabled={test.kind === "testing"}
					>
						{test.kind === "testing" ? (
							<>
								<Loader2 className="animate-spin" />
								Testing…
							</>
						) : (
							"Test connection"
						)}
					</Button>
					{connection ? (
						<ActButton
							area="model"
							variant="outline"
							className="ml-auto"
							onClick={introspect}
							disabled={introspecting}
							title="Read what the database actually holds — the mirror, never the model"
						>
							{introspecting ? "Reading…" : "Introspect"}
						</ActButton>
					) : null}
				</div>
			</form>
		</Form>
	);
}

/** Where the test stands, under the fields. */
function TestLine({ test }: { test: TestState }) {
	if (test.kind === "passed")
		return (
			<p className="flex items-center gap-2 text-success">
				<CheckCircle2 className="size-4" />
				Connection works
				{test.serverVersion ? ` · ${test.serverVersion}` : ""}
				{test.latencyMs !== undefined ? ` · ${test.latencyMs} ms` : ""}
			</p>
		);
	if (test.kind === "failed")
		return (
			<p className="flex items-start gap-2 text-destructive">
				<XCircle className="mt-0.5 size-4 shrink-0" />
				{test.error}
			</p>
		);
	if (test.kind === "untested")
		return (
			<p className="text-muted-foreground">Test the connection to save it.</p>
		);
	return null;
}

/**
 * What this server version can hold (capabilities.md) — the property types the
 * model editor offers come from it, so it stays beside the connection.
 */
function Capabilities({ connection }: { connection: GraphConnectionRead }) {
	const [open, setOpen] = useState(false);
	const types = connection.supported_property_types;
	return (
		<Card className="flex flex-col gap-2 p-3 shadow-none">
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}
				className="flex w-full items-center gap-2 text-left"
			>
				<span className="font-medium">Capabilities</span>
				<span className="text-muted-foreground">
					{types.length
						? `${types.length} property types`
						: "not reported — the modeller offers its full vocabulary"}
				</span>
				<span className="ml-auto text-muted-foreground">
					{open ? "hide" : "show"}
				</span>
			</button>
			{open ? (
				<div className="flex flex-col gap-2 text-sm">
					<p className="font-mono text-muted-foreground">
						{types.length ? types.join(" · ") : "— no property types reported"}
					</p>
					<p className="font-mono text-muted-foreground">
						{connection.capabilities.length
							? connection.capabilities.join(" · ")
							: "— no features reported"}
					</p>
				</div>
			) : null}
		</Card>
	);
}
