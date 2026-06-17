import {
	type FieldConfig,
	Form,
	Input,
	Label,
	ObjectField,
	type RowConfig,
} from "@invana/forms";
import { Button } from "@invana/ui";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { FormError } from "../../../components/forms/FormError";
import { CONNECTOR_OPTIONS } from "../../../types/graphs";
import type { GraphConnectionCreate } from "../../../types/graphs";

export interface GraphFormValues {
	uri: string;
	connector_class: string;
	username: string;
	password: string;
	read_only: boolean;
	/** Optional manually-declared DB version (RFC-022) — fallback when undetected. */
	server_version: string;
}

type TestState =
	| { kind: "untested" }
	| { kind: "testing" }
	| {
			kind: "passed";
			latencyMs?: number;
			serverVersion?: string | null;
			compatibilityStatus?: string;
	  }
	| { kind: "failed"; error: string };

interface GraphFormProps {
	initialValues?: Partial<GraphFormValues>;
	isEdit?: boolean;
	isSubmitting?: boolean;
	/** Server-side error from the save mutation. Renders inline above the
	 *  submit button so it persists after the toast fades. */
	submitError?: Error | string | null;
	onSubmit: (values: GraphConnectionCreate) => void;
	onCancel: () => void;
	/** Returns {ok, latency_ms?, error?, server_version?, compatibility_status?}.
	 *  Required to enable Save. The version is detected from the DB (RFC-022). */
	onTest: (values: GraphConnectionCreate) => Promise<{
		ok: boolean;
		latency_ms?: number;
		error?: string;
		server_version?: string | null;
		compatibility_status?: string;
	}>;
}

const DEFAULT_VALUES: GraphFormValues = {
	uri: "",
	connector_class: "",
	username: "",
	password: "",
	read_only: false,
	server_version: "",
};

/** Fields the form generator renders. Edits to any of them invalidate a prior
 *  passing test, forcing a re-test before Save re-enables. */
const TEST_INVALIDATING = new Set([
	"connection.uri",
	"connection.username",
	"connection.password",
	"connection.connector_class",
]);

interface FormShape {
	connection: GraphFormValues;
}

export function GraphForm({
	initialValues,
	isEdit = false,
	isSubmitting = false,
	submitError = null,
	onSubmit,
	onCancel,
	onTest,
}: GraphFormProps) {
	const form = useForm<FormShape>({
		defaultValues: { connection: { ...DEFAULT_VALUES, ...initialValues } },
	});
	const [testState, setTestState] = useState<TestState>({ kind: "untested" });

	// ObjectField owns each field's onChange, so connection-relevant edits are
	// detected via a watch subscription and reset any prior passing test.
	useEffect(() => {
		const sub = form.watch((_values, { name }) => {
			if (name && TEST_INVALIDATING.has(name)) {
				setTestState((prev) =>
					prev.kind === "untested" ? prev : { kind: "untested" },
				);
			}
		});
		return () => sub.unsubscribe();
	}, [form]);

	const values = form.watch().connection;
	const connectorLabel =
		CONNECTOR_OPTIONS.find((o) => o.value === values.connector_class)?.label ??
		values.connector_class;

	// Connector is immutable on edit, so it's shown as a read-only field above
	// the generator rather than as a (disabled) select inside it.
	const fields: FieldConfig[] = [
		...(isEdit
			? []
			: [
					{
						name: "connector_class",
						type: "select" as const,
						label: "Connector",
						placeholder: "Select a connector",
						options: CONNECTOR_OPTIONS.map((o) => ({
							label: o.label,
							value: o.value,
						})),
					},
				]),
		{
			name: "uri",
			type: "text",
			label: "URI",
			placeholder: "bolt://localhost:7687",
		},
		{ name: "username", type: "text", label: "Username", placeholder: "neo4j" },
		{
			name: "password",
			type: "password",
			label: "Password",
			placeholder: "••••••••",
			description: isEdit
				? "Leave blank to keep the stored password."
				: undefined,
		},
		{
			name: "server_version",
			type: "text",
			label: "Database version (optional — auto-detected when possible)",
			placeholder: "e.g. 5.20.0",
			description:
				"Leave blank to detect from the database. Provide it manually for backends Invana can't introspect (e.g. Gremlin) so property types and compatibility resolve correctly.",
		},
		{ name: "read_only", type: "boolean", label: "Read-only connection" },
	];

	// One field per row so they stack full-width, except username/password which
	// share a row (ObjectField pairs fields into two columns by default).
	const rowConfig: RowConfig[] = [
		...(isEdit ? [] : [{ id: "connector", fields: ["connector_class"] }]),
		{ id: "uri", fields: ["uri"] },
		{ id: "auth", fields: ["username", "password"] },
		{ id: "version", fields: ["server_version"] },
		{ id: "read_only", fields: ["read_only"] },
	];

	const validate = (): boolean => {
		form.clearErrors();
		const v = form.getValues().connection;
		let ok = true;
		if (!v.uri.trim()) {
			form.setError("connection.uri", { message: "URI is required" });
			ok = false;
		}
		if (!v.connector_class) {
			form.setError("connection.connector_class", {
				message: "Connector is required",
			});
			ok = false;
		}
		return ok;
	};

	const buildCreatePayload = (): GraphConnectionCreate => {
		const v = form.getValues().connection;
		// On edit with no re-entered credentials, send empty auth so the server
		// preserves the stored auth (its `if payload.auth:` check skips re-encrypt).
		const credsTouched = !!v.username || !!v.password;
		return {
			uri: v.uri,
			connector_class: v.connector_class,
			auth:
				isEdit && !credsTouched
					? {}
					: { username: v.username, password: v.password },
			read_only: v.read_only,
			server_version: v.server_version.trim() || null,
		};
	};

	const handleTest = async () => {
		if (!validate()) return;
		setTestState({ kind: "testing" });
		try {
			const result = await onTest(buildCreatePayload());
			if (result.ok) {
				// Prefill the version field with what the DB reported, so the user can
				// see/keep it; if detection failed they type it in themselves (RFC-022).
				if (
					result.server_version &&
					!form.getValues().connection.server_version.trim()
				) {
					form.setValue("connection.server_version", result.server_version);
				}
				setTestState({
					kind: "passed",
					latencyMs: result.latency_ms,
					serverVersion: result.server_version,
					compatibilityStatus: result.compatibility_status,
				});
			} else {
				setTestState({
					kind: "failed",
					error: result.error ?? "Connection failed.",
				});
			}
		} catch (err) {
			setTestState({
				kind: "failed",
				error: err instanceof Error ? err.message : "Connection failed.",
			});
		}
	};

	const submitForm = form.handleSubmit(() => {
		if (!validate()) return;
		if (testState.kind !== "passed") return;

		// PUT /connection is full-replace and validates against GraphConnectionCreate
		// (connector_class required). connector_class is immutable on edit but must
		// still be in the body — buildCreatePayload echoes the prefilled value.
		onSubmit(buildCreatePayload());
	});

	const saveDisabled = isSubmitting || testState.kind !== "passed";

	return (
		<Form {...form}>
			<form onSubmit={submitForm} className="space-y-5" noValidate>
				{/* Connector is immutable on edit — render it read-only. */}
				{isEdit && (
					<div className="space-y-1.5">
						<Label htmlFor="connector_class_display">Connector</Label>
						<Input
							id="connector_class_display"
							value={connectorLabel}
							disabled
						/>
					</div>
				)}

				<ObjectField
					control={form.control}
					name="connection"
					fields={fields}
					rowConfig={rowConfig}
					labelPosition="top"
					size="md"
				/>

				{/* Test status banner */}
				{testState.kind === "passed" && (
					<div className="flex items-center gap-2 text-green-500">
						<CheckCircle2 className="w-4 h-4" />
						<span>
							Connection works
							{testState.serverVersion && (
								<span className="text-muted-foreground">
									{" "}
									· detected version{" "}
									<span className="font-mono">{testState.serverVersion}</span>
								</span>
							)}
							{testState.latencyMs !== undefined && (
								<span className="text-muted-foreground">
									{" "}
									· {testState.latencyMs} ms
								</span>
							)}
						</span>
					</div>
				)}
				{testState.kind === "passed" &&
					testState.compatibilityStatus &&
					testState.compatibilityStatus !== "supported" && (
						<p className="text-amber-600 dark:text-amber-400">
							{testState.compatibilityStatus === "unsupported"
								? "This version is below Invana's supported range — the connection will be read-only."
								: testState.compatibilityStatus === "untested"
									? "This version is newer than Invana's tested range — you'll be able to continue at your own risk after saving."
									: "Invana couldn't classify this version — the connection will start read-only."}
						</p>
					)}
				{testState.kind === "failed" && (
					<div className="flex items-start gap-2 text-destructive">
						<XCircle className="w-4 h-4 mt-0.5 shrink-0" />
						<span>{testState.error}</span>
					</div>
				)}
				{testState.kind === "untested" && (
					<p className="text-muted-foreground">
						Test the connection to enable {isEdit ? "Save Changes" : "Create"}.
					</p>
				)}

				<FormError error={submitError} />

				{/* Actions */}
				<div className="flex justify-between gap-3 pt-2">
					<Button
						type="button"
						variant="outline"
						onClick={handleTest}
						disabled={isSubmitting || testState.kind === "testing"}
					>
						{testState.kind === "testing" ? (
							<>
								<Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
								Testing…
							</>
						) : (
							"Test Connection"
						)}
					</Button>
					<div className="flex gap-3">
						<Button
							type="button"
							variant="outline"
							onClick={onCancel}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={saveDisabled}>
							{isSubmitting
								? "Saving…"
								: isEdit
									? "Save Changes"
									: "Create Connection"}
						</Button>
					</div>
				</div>
			</form>
		</Form>
	);
}
