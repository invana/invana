import {
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Switch,
} from "@invana/forms";
import { Button } from "@invana/ui";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
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

export function GraphForm({
	initialValues,
	isEdit = false,
	isSubmitting = false,
	submitError = null,
	onSubmit,
	onCancel,
	onTest,
}: GraphFormProps) {
	const [values, setValues] = useState<GraphFormValues>({
		...DEFAULT_VALUES,
		...initialValues,
	});
	const [errors, setErrors] = useState<
		Partial<Record<keyof GraphFormValues, string>>
	>({});
	const [testState, setTestState] = useState<TestState>({ kind: "untested" });

	const set = <K extends keyof GraphFormValues>(
		key: K,
		value: GraphFormValues[K],
	) => {
		setValues((prev) => ({ ...prev, [key]: value }));
		if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
		// Any connection-relevant change invalidates a previous test result.
		if (
			key === "uri" ||
			key === "username" ||
			key === "password" ||
			key === "connector_class"
		) {
			setTestState({ kind: "untested" });
		}
	};

	const validate = (): boolean => {
		const next: typeof errors = {};
		if (!values.uri.trim()) next.uri = "URI is required";
		if (!values.connector_class) next.connector_class = "Connector is required";
		setErrors(next);
		return Object.keys(next).length === 0;
	};

	const buildCreatePayload = (): GraphConnectionCreate => {
		// On edit with no re-entered credentials, send empty auth so the server
		// preserves the stored auth (its `if payload.auth:` check skips re-encrypt).
		const credsTouched = !!values.username || !!values.password;
		return {
			uri: values.uri,
			connector_class: values.connector_class,
			auth:
				isEdit && !credsTouched
					? {}
					: { username: values.username, password: values.password },
			read_only: values.read_only,
			server_version: values.server_version.trim() || null,
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
				if (result.server_version && !values.server_version.trim()) {
					setValues((prev) => ({
						...prev,
						server_version: result.server_version ?? "",
					}));
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

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!validate()) return;
		if (testState.kind !== "passed") return;

		// PUT /connection is full-replace and validates against GraphConnectionCreate
		// (connector_class required). connector_class is immutable on edit but must
		// still be in the body — buildCreatePayload echoes the prefilled value.
		onSubmit(buildCreatePayload());
	};

	const saveDisabled = isSubmitting || testState.kind !== "passed";

	return (
		<form onSubmit={handleSubmit} className="space-y-5" noValidate>
			{/* Connector Class */}
			<div className="space-y-1.5">
				<Label htmlFor="connector_class">
					Connector <span className="text-destructive">*</span>
				</Label>
				{isEdit ? (
					<Input
						id="connector_class"
						value={
							CONNECTOR_OPTIONS.find((o) => o.value === values.connector_class)
								?.label ?? values.connector_class
						}
						disabled
					/>
				) : (
					<Select
						value={values.connector_class}
						onValueChange={(v) => set("connector_class", v)}
						disabled={isSubmitting}
					>
						<SelectTrigger id="connector_class">
							<SelectValue placeholder="Select a connector" />
						</SelectTrigger>
						<SelectContent>
							{CONNECTOR_OPTIONS.map((opt) => (
								<SelectItem key={opt.value} value={opt.value}>
									{opt.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}
				{errors.connector_class && (
					<p className="text-destructive">{errors.connector_class}</p>
				)}
			</div>

			{/* URI */}
			<div className="space-y-1.5">
				<Label htmlFor="uri">
					URI <span className="text-destructive">*</span>
				</Label>
				<Input
					id="uri"
					placeholder="bolt://localhost:7687"
					value={values.uri}
					onChange={(e) => set("uri", e.target.value)}
					disabled={isSubmitting}
				/>
				{errors.uri && <p className="text-destructive">{errors.uri}</p>}
			</div>

			{/* Auth */}
			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-1.5">
					<Label htmlFor="username">Username</Label>
					<Input
						id="username"
						placeholder="neo4j"
						value={values.username}
						onChange={(e) => set("username", e.target.value)}
						autoComplete="username"
						disabled={isSubmitting}
					/>
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="password">
						Password
						{isEdit && (
							<span className="text-muted-foreground ml-1">
								(leave blank to keep)
							</span>
						)}
					</Label>
					<Input
						id="password"
						type="password"
						placeholder="••••••••"
						value={values.password}
						onChange={(e) => set("password", e.target.value)}
						autoComplete={isEdit ? "current-password" : "new-password"}
						disabled={isSubmitting}
					/>
				</div>
			</div>

			{/* Database version (optional — auto-detected on connect when possible) */}
			<div className="space-y-1.5">
				<Label htmlFor="server_version">
					Database version
					<span className="text-muted-foreground ml-1">
						(optional — auto-detected when possible)
					</span>
				</Label>
				<Input
					id="server_version"
					placeholder="e.g. 5.20.0"
					value={values.server_version}
					onChange={(e) => set("server_version", e.target.value)}
					disabled={isSubmitting}
				/>
				<p className="text-xs text-muted-foreground">
					Leave blank to detect from the database. Provide it manually for
					backends Invana can't introspect (e.g. Gremlin) so property types and
					compatibility resolve correctly.
				</p>
			</div>

			{/* Read Only */}
			<div className="flex items-center gap-3">
				<Switch
					id="read_only"
					checked={values.read_only}
					onCheckedChange={(v) => set("read_only", v)}
					disabled={isSubmitting}
				/>
				<Label htmlFor="read_only" className="cursor-pointer">
					Read-only connection
				</Label>
			</div>

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
					<p className="text-amber-600 dark:text-amber-400 text-sm">
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
	);
}
