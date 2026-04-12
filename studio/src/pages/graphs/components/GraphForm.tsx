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
import { useState } from "react";
import { CONNECTOR_OPTIONS } from "../../../types/graphs";
import type { GraphCreate, GraphUpdate } from "../../../types/graphs";

export interface GraphFormValues {
	name: string;
	description: string;
	uri: string;
	connector_class: string;
	username: string;
	password: string;
	read_only: boolean;
}

interface GraphFormProps {
	initialValues?: Partial<GraphFormValues>;
	isEdit?: boolean;
	isSubmitting?: boolean;
	onSubmit: (values: GraphCreate | GraphUpdate) => void;
	onCancel: () => void;
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
	onSubmit,
	onCancel,
}: GraphFormProps) {
	const [values, setValues] = useState<GraphFormValues>({
		...DEFAULT_VALUES,
		...initialValues,
	});
	const [errors, setErrors] = useState<
		Partial<Record<keyof GraphFormValues, string>>
	>({});

	const set = <K extends keyof GraphFormValues>(
		key: K,
		value: GraphFormValues[K],
	) => {
		setValues((prev) => ({ ...prev, [key]: value }));
		if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
	};

	const validate = (): boolean => {
		const next: typeof errors = {};
		if (!values.name.trim()) next.name = "Name is required";
		if (!values.uri.trim()) next.uri = "URI is required";
		if (!isEdit && !values.connector_class)
			next.connector_class = "Connector is required";
		setErrors(next);
		return Object.keys(next).length === 0;
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!validate()) return;

		if (isEdit) {
			const update: GraphUpdate = {
				name: values.name,
				description: values.description || undefined,
				uri: values.uri,
				read_only: values.read_only,
			};
			if (values.username || values.password) {
				update.auth = { username: values.username, password: values.password };
			}
			onSubmit(update);
		} else {
			const create: GraphCreate = {
				name: values.name,
				description: values.description || undefined,
				uri: values.uri,
				connector_class: values.connector_class,
				auth: { username: values.username, password: values.password },
				read_only: values.read_only,
			};
			onSubmit(create);
		}
	};

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
				{errors.name && (
					<p className="text-sm text-destructive">{errors.name}</p>
				)}
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
					<p className="text-sm text-destructive">{errors.connector_class}</p>
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
				{errors.uri && <p className="text-sm text-destructive">{errors.uri}</p>}
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
							<span className="text-muted-foreground text-xs ml-1">
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

			{/* Actions */}
			<div className="flex justify-end gap-3 pt-2">
				<Button
					type="button"
					variant="outline"
					onClick={onCancel}
					disabled={isSubmitting}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting
						? "Saving…"
						: isEdit
							? "Save Changes"
							: "Create Connection"}
				</Button>
			</div>
		</form>
	);
}
