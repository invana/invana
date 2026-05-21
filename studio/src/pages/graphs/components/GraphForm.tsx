import {
	Button,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Switch,
	Textarea,
} from "@invana/ui";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { FormError } from "../../../components/forms/FormError";
import { CONNECTOR_OPTIONS } from "../../../types/graphs";
import type { GraphConnectionCreate } from "../../../types/graphs";

export interface GraphFormValues {
	name: string;
	description: string;
	uri: string;
	connector_class: string;
	username: string;
	password: string;
	read_only: boolean;
}

type TestState =
	| { kind: "untested" }
	| { kind: "testing" }
	| { kind: "passed"; latencyMs?: number }
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
	/** Returns {ok, latency_ms?, error?}. Required to enable Save. */
	onTest: (
		values: GraphConnectionCreate,
	) => Promise<{ ok: boolean; latency_ms?: number; error?: string }>;
}

const DEFAULT_VALUES: GraphFormValues = {
	name: "",
	description: "",
	uri: "",
	connector_class: "",
	username: "",
	password: "",
	read_only: false,
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
		if (!values.name.trim()) next.name = "Name is required";
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
			name: values.name,
			description: values.description || undefined,
			uri: values.uri,
			connector_class: values.connector_class,
			auth:
				isEdit && !credsTouched
					? {}
					: { username: values.username, password: values.password },
			read_only: values.read_only,
		};
	};

	const handleTest = async () => {
		if (!validate()) return;
		setTestState({ kind: "testing" });
		try {
			const result = await onTest(buildCreatePayload());
			if (result.ok) {
				setTestState({ kind: "passed", latencyMs: result.latency_ms });
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
			{/* Name */}
			<div className="space-y-1.5">
				<Label htmlFor="name">
					Name <span className="text-destructive">*</span>
				</Label>
				<Input
					id="name"
					placeholder="My Neo4j Instance"
					value={values.name}
					onChange={(e) => set("name", e.target.value)}
					disabled={isSubmitting}
				/>
				{errors.name && <p className="text-destructive">{errors.name}</p>}
			</div>

			{/* Description */}
			<div className="space-y-1.5">
				<Label htmlFor="description">Description</Label>
				<Textarea
					id="description"
					placeholder="Optional description"
					rows={2}
					value={values.description}
					onChange={(e) => set("description", e.target.value)}
					disabled={isSubmitting}
				/>
			</div>

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
						{testState.latencyMs !== undefined && (
							<span className="text-muted-foreground">
								{" "}
								· {testState.latencyMs} ms
							</span>
						)}
					</span>
				</div>
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
