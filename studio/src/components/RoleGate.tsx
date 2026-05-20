import type { ReactNode } from "react";
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
 */
export function RoleGate({
	require,
	children,
	fallback = null,
}: RoleGateProps) {
	const { isSuperuser, isAdmin, isBuilder, isAuthenticated } = useAuth();

	const allowed =
		(require === "superuser" && isSuperuser) ||
		(require === "admin" && isAdmin) ||
		(require === "builder" && isBuilder) ||
		(require === "member" && isAuthenticated);

	return <>{allowed ? children : fallback}</>;
}
