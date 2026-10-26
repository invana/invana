/**
 * The Modeller's footer (modeller.md › The Modeller's status bar): on the
 * left the model with a draft — `<model> · vN active · vM draft · N staged` —
 * and whether it validates, then `N types across M models` on the right.
 * Without a draft, the left is the models count alone.
 *
 * The shell's `footer` takes its two sides separately, so one component draws
 * either.
 */

export interface ModellerStatusBarProps {
	username: string;
	graphSlug: string;
	side: "left" | "right";
}

export function ModellerStatusBar(_props: ModellerStatusBarProps) {
	return null;
}
