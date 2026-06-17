import { type FieldConfig, Form, ObjectField } from "@invana/forms";
import { Button } from "@invana/ui";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FormError } from "../../components/forms/FormError";
import { useCreateGraphMutation } from "../../hooks/queries/useGraphs";

function slugify(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64);
}

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

interface CreateGraphForm {
	graph: { name: string; slug: string; intent: string };
}

export function GraphCreatePage() {
	const navigate = useNavigate();
	const mutation = useCreateGraphMutation();

	const form = useForm<CreateGraphForm>({
		defaultValues: { graph: { name: "", slug: "", intent: "" } },
	});

	// ObjectField owns each field's onChange, so the name→slug auto-derivation
	// lives here via a watch subscription. We keep auto-filling the slug only
	// while it still matches the last value we generated — once the user types
	// their own slug it diverges and auto-fill stops. (Detecting that via the
	// event type is unreliable: our own setValue echoes back as a "change".)
	const lastAutoSlug = useRef("");
	useEffect(() => {
		const sub = form.watch((values, { name: field }) => {
			if (field !== "graph.name") return;
			const currentSlug = values.graph?.slug ?? "";
			if (currentSlug !== lastAutoSlug.current) return; // user edited slug
			const next = slugify(values.graph?.name ?? "");
			lastAutoSlug.current = next;
			form.setValue("graph.slug", next);
		});
		return () => sub.unsubscribe();
	}, [form]);

	const values = form.watch();
	const slug = values.graph?.slug ?? "";

	// Field config is recomputed each render so the slug field's description can
	// preview the live URL — ObjectField has no hook for dynamic descriptions.
	const fields: FieldConfig[] = [
		{
			name: "name",
			type: "text",
			label: "Name",
			placeholder: "Customer analysis",
		},
		{
			name: "slug",
			type: "text",
			label: "Slug",
			placeholder: "customer-analysis",
			description: `Lives at /u/<you>/${slug || "…"}`,
		},
		{
			name: "intent",
			type: "textarea",
			rows: 4,
			label: "Intent (optional)",
			placeholder: "What is this graph for? What questions should it answer?",
		},
	];

	// One field per row so they stack full-width (ObjectField pairs fields into
	// two columns by default).
	const rowConfig = [
		{ id: "name", fields: ["name"] },
		{ id: "slug", fields: ["slug"] },
		{ id: "intent", fields: ["intent"] },
	];

	const canSubmit =
		(values.graph?.name?.trim().length ?? 0) > 0 &&
		slug.length >= 2 &&
		SLUG_PATTERN.test(slug) &&
		!mutation.isPending;

	const onSubmit = form.handleSubmit((data) => {
		// ObjectField doesn't forward per-field rules, so validation runs here and
		// surfaces through each field's FormMessage via setError.
		form.clearErrors();
		const name = data.graph.name.trim();
		const nextSlug = data.graph.slug;
		let invalid = false;
		if (!name) {
			form.setError("graph.name", { message: "Name is required." });
			invalid = true;
		}
		if (nextSlug.length < 2) {
			form.setError("graph.slug", {
				message: "Slug must be at least 2 characters.",
			});
			invalid = true;
		} else if (!SLUG_PATTERN.test(nextSlug)) {
			form.setError("graph.slug", {
				message: "Use lowercase letters, digits, and single hyphens only.",
			});
			invalid = true;
		}
		if (invalid) return;

		mutation.mutate(
			{ name, slug: nextSlug, intent: data.graph.intent.trim() || null },
			{
				onSuccess: (graph) => {
					toast.success(`Graph "${graph.name}" created`);
					navigate(`/u/${graph.owner_username}/${graph.slug}`);
				},
				onError: (err) => toast.error(err.message),
			},
		);
	});

	return (
		<div className="h-full overflow-auto">
			<div className="max-w-lg mx-auto px-10 py-16">
				<button
					type="button"
					onClick={() => navigate("/graphs")}
					className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors mb-10"
				>
					<ArrowLeft className="w-4 h-4" />
					<span>Back</span>
				</button>

				<div className="mb-8">
					<h1 className="text-2xl font-bold">New Graph</h1>
					<p className="text-muted-foreground mt-1">
						Name it, give it an intent. You'll attach a database connection in
						the next step.
					</p>
				</div>

				<Form {...form}>
					<form onSubmit={onSubmit} className="flex flex-col gap-5">
						<ObjectField
							control={form.control}
							name="graph"
							fields={fields}
							rowConfig={rowConfig}
							labelPosition="top"
							size="md"
						/>

						<FormError error={mutation.error} />

						<div className="flex items-center gap-2 mt-2">
							<Button type="submit" disabled={!canSubmit}>
								{mutation.isPending ? "Creating…" : "Create Graph"}
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={() => navigate("/graphs")}
							>
								Cancel
							</Button>
						</div>
					</form>
				</Form>
			</div>
		</div>
	);
}
