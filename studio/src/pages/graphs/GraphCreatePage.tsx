import { Button, Input, Label, Textarea } from "@invana/ui";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCreateGraphMutation } from "../../hooks/queries/useGraphs";

function slugify(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64);
}

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function GraphCreatePage() {
	const navigate = useNavigate();
	const mutation = useCreateGraphMutation();

	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [slugDirty, setSlugDirty] = useState(false);
	const [intent, setIntent] = useState("");

	const handleNameChange = (next: string) => {
		setName(next);
		if (!slugDirty) {
			setSlug(slugify(next));
		}
	};

	const slugError =
		slug.length === 0
			? null
			: slug.length < 2
				? "Slug must be at least 2 characters."
				: !SLUG_PATTERN.test(slug)
					? "Use lowercase letters, digits, and single hyphens only."
					: null;

	const canSubmit =
		name.trim().length > 0 &&
		slug.length >= 2 &&
		!slugError &&
		!mutation.isPending;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!canSubmit) return;
		mutation.mutate(
			{
				name: name.trim(),
				slug,
				intent: intent.trim() || null,
			},
			{
				onSuccess: (graph) => {
					toast.success(`Graph "${graph.name}" created`);
					navigate(`/u/${graph.owner_username}/${graph.slug}`);
				},
				onError: (err) => toast.error(err.message),
			},
		);
	};

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

				<form onSubmit={handleSubmit} className="flex flex-col gap-5">
					<div className="flex flex-col gap-2">
						<Label htmlFor="graph-name">Name</Label>
						<Input
							id="graph-name"
							value={name}
							onChange={(e) => handleNameChange(e.target.value)}
							placeholder="Customer analysis"
							autoFocus
							maxLength={255}
						/>
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="graph-slug">Slug</Label>
						<Input
							id="graph-slug"
							value={slug}
							onChange={(e) => {
								setSlug(e.target.value.toLowerCase());
								setSlugDirty(true);
							}}
							placeholder="customer-analysis"
							maxLength={64}
						/>
						{slugError ? (
							<p className="text-destructive">{slugError}</p>
						) : (
							<p className="text-muted-foreground">
								Lives at{" "}
								<span className="font-mono">/u/&lt;you&gt;/{slug || "…"}</span>
							</p>
						)}
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="graph-intent">Intent (optional)</Label>
						<Textarea
							id="graph-intent"
							value={intent}
							onChange={(e) => setIntent(e.target.value)}
							placeholder="What is this graph for? What questions should it answer?"
							rows={4}
							maxLength={10000}
						/>
					</div>

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
			</div>
		</div>
	);
}
