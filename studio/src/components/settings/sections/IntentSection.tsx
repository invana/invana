import { Form, FormField, TextareaField } from "@invana/forms";
import { Button, Skeleton } from "@invana/ui";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
	useGraphQuery,
	useUpdateGraphMutation,
} from "../../../hooks/queries/useGraphs";
import { FormError } from "../../forms/FormError";

interface Props {
	username: string;
	graphSlug: string;
	onSaved?: () => void;
}

interface FormShape {
	intent: string;
}

export function IntentSection({ username, graphSlug, onSaved }: Props) {
	const { data: graph, isLoading } = useGraphQuery(username, graphSlug);
	const mutation = useUpdateGraphMutation();
	const form = useForm<FormShape>({ defaultValues: { intent: "" } });

	// Sync the form once the graph loads (and after it refetches post-save).
	useEffect(() => {
		if (graph) form.reset({ intent: graph.intent ?? "" });
	}, [graph, form]);

	const submitForm = form.handleSubmit((values) => {
		mutation.mutate(
			{
				username,
				graphSlug,
				data: { intent: values.intent.trim() || null },
			},
			{
				onSuccess: () => {
					toast.success("Intent saved");
					onSaved?.();
				},
				onError: (err) => toast.error(err.message),
			},
		);
	});

	if (isLoading) return <Skeleton className="h-32 w-full" />;
	if (!graph) return <p className="text-muted-foreground">Graph not found.</p>;

	// A single full-width textarea: ObjectField lays its fields out in a
	// two-column grid (`md:grid-cols-2`), so a lone field renders at half width.
	// Use the generator's `TextareaField` directly, wired to react-hook-form via
	// `FormField`, so it spans the panel.
	return (
		<Form {...form}>
			<form onSubmit={submitForm} className="space-y-4" noValidate>
				<FormField
					control={form.control}
					name="intent"
					render={({ field }) => (
						<TextareaField
							description="A short statement of what this graph is for and what questions it should answer. Used to ground agents and prompts."
							placeholder="Describe the purpose of this graph…"
							rows={8}
							labelPosition="top"
							size="md"
							value={field.value}
							onChange={field.onChange}
						/>
					)}
				/>
				<FormError error={mutation.error} />
				<div className="flex gap-2">
					<Button type="submit" disabled={mutation.isPending}>
						{mutation.isPending ? "Saving…" : "Save Intent"}
					</Button>
				</div>
			</form>
		</Form>
	);
}
