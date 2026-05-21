import { ArrowLeft } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { InvitationsSection } from "../../components/settings/sections/InvitationsSection";
import { useAuth } from "../../hooks/useAuth";

export function GraphInvitationsPage() {
	const { username, graphSlug } = useParams<{
		username: string;
		graphSlug: string;
	}>();
	const { membershipForGraph } = useAuth();
	const navigate = useNavigate();
	const backToOverview = () => navigate(`/u/${username}/${graphSlug}`);

	if (!username || !graphSlug) return <Navigate to="/" replace />;
	const membership = membershipForGraph(username, graphSlug);

	return (
		<div className="h-full overflow-auto">
			<div className="max-w-3xl mx-auto px-6 py-10">
				<button
					type="button"
					onClick={backToOverview}
					className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors mb-8"
				>
					<ArrowLeft className="w-4 h-4" />
					<span>Back to overview</span>
				</button>

				<header className="mb-6">
					<h1 className="text-2xl font-semibold">
						Invitations &mdash;{" "}
						<span className="text-muted-foreground font-normal">
							{membership?.graph_name ?? graphSlug}
						</span>
					</h1>
				</header>

				<InvitationsSection username={username} graphSlug={graphSlug} />
			</div>
		</div>
	);
}
