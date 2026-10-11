import { AlertCircle } from "lucide-react";

interface Props {
	/** Error to render. `null` / `undefined` / falsy → nothing rendered. */
	error?: Error | string | null;
	className?: string;
}

/**
 * Inline form-error banner. Lives next to the submit button so server-side
 * validation errors (e.g. "slug already taken") stay visible after the toast
 * fades. Pass a mutation's `mutation.error` directly, or a string for local
 * validation messages.
 *
 * The toast handler (`onError: toast.error(...)`) stays useful for visibility
 * when the user has scrolled away from the form — this is the persistent
 * counterpart, not a replacement.
 */
export function FormError({ error, className }: Props) {
	if (!error) return null;
	const message = typeof error === "string" ? error : error.message;
	if (!message) return null;
	return (
		<div
			role="alert"
			className={`flex items-start gap-2 p-3 rounded-md border border-destructive/40 bg-destructive/10 text-destructive ${className ?? ""}`}
		>
			<AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
			<p className="leading-snug">{message}</p>
		</div>
	);
}
