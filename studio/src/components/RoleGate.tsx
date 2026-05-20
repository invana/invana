import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

type Capability = "admin" | "builder" | "member" | "superuser";

interface RoleGateProps {
	require: Capability;
	children: ReactNode;
	fallback?: ReactNode;
}

/**
 * Conditional rendering for role-gated UI. Use for hiding nav links / disabling
 * mutation buttons. Server-side dependencies still enforce the actual gate.
 *
 * Per RFC-017, "admin"/"builder"/"member" are scoped to the current Graph,
 * read from the URL params (/u/:username/:slug). "superuser" is global.
 */
export function RoleGate({
	require,
	children,
	fallback = null,
}: RoleGateProps) {
	const { isSuperuser, isAuthenticated, rolesForGraph } = useAuth();
	const { username, slug } = useParams<{ username?: string; slug?: string }>();
	const { isAdmin, isBuilder, isMember } = rolesForGraph(username, slug);

	const allowed =
		(require === "superuser" && isSuperuser) ||
		(require === "admin" && isAdmin) ||
		(require === "builder" && isBuilder) ||
		(require === "member" && (isMember || isAuthenticated));

	return <>{allowed ? children : fallback}</>;
}
