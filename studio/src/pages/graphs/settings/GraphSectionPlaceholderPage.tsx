import { Button } from "@invana/ui";
import { ArrowLeft, Construction } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

interface Props {
	title: string;
	description: string;
	slice: string;
}

export function GraphSectionPlaceholderPage({
	title,
	description,
	slice,
}: Props) {
	const { username, slug } = useParams<{ username: string; slug: string }>();
	const navigate = useNavigate();
	const backToOverview = () => navigate(`/u/${username}/${slug}`);

	return (
		<div className="h-full overflow-auto">
			<div className="max-w-2xl mx-auto px-10 py-12">
				<button
					type="button"
					onClick={backToOverview}
					className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors mb-8"
				>
					<ArrowLeft className="w-4 h-4" />
					<span>Back to overview</span>
				</button>

				<div className="mb-8">
					<p className="text-muted-foreground font-mono">
						/u/{username}/{slug} · settings
					</p>
					<h1 className="text-2xl font-bold mt-1">{title}</h1>
					<p className="text-muted-foreground mt-1">{description}</p>
				</div>

				<div className="border border-border rounded-lg p-8 flex flex-col items-center gap-4 text-center">
					<Construction className="w-10 h-10 text-muted-foreground" />
					<div>
						<p className="font-medium">Lands in {slice}</p>
						<p className="text-muted-foreground mt-1">
							For now, you can skip this section from the overview wizard.
						</p>
					</div>
					<Button variant="outline" onClick={backToOverview}>
						Back to overview
					</Button>
				</div>
			</div>
		</div>
	);
}
