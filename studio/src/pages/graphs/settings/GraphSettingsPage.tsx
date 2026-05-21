import { Navigate, useParams } from "react-router-dom";

// The standalone "settings landing" is gone — settings now lives as a docked
// panel opened from the gear icon. Hitting /u/:username/:graphSlug/settings
// directly redirects to the graph overview with the panel pre-opened.
export function GraphSettingsPage() {
	const { username, graphSlug } = useParams<{
		username: string;
		graphSlug: string;
	}>();
	if (!username || !graphSlug) return <Navigate to="/" replace />;
	return <Navigate to={`/u/${username}/${graphSlug}?settings=info`} replace />;
}
