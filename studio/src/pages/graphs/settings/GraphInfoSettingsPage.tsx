import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { InfoSection } from "../../../components/settings/sections/InfoSection";

export function GraphInfoSettingsPage() {
	const { username, graphSlug } = useParams<{
		username: string;
		graphSlug: string;
	}>();
	const navigate = useNavigate();
	const backToOverview = () => navigate(`/u/${username}/${graphSlug}`);

	if (!username || !graphSlug) return null;

	return (
		<div className="h-full overflow-auto">
			<div className="max-w-3xl mx-auto px-10 py-12">
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
						/u/{username}/{graphSlug} · settings
					</p>
					<h1 className="text-2xl font-bold mt-1">Info</h1>
				</div>

				<InfoSection username={username} graphSlug={graphSlug} />
			</div>
		</div>
	);
}
