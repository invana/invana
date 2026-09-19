/**
 * The icon names a dashboard spec may use.
 *
 * `@invana/dashboard` carries **strings** in the spec and takes the components
 * as a prop, so the package pulls in no icon set of its own and a spec stays
 * JSON. Unknown names render nothing, which is why this map is small and
 * shared rather than assembled per surface.
 */

import {
	ChevronLeft,
	ChevronRight,
	FileText,
	MoreHorizontal,
} from "lucide-react";

export const DASHBOARD_ICONS = {
	prev: ChevronLeft,
	next: ChevronRight,
	file: FileText,
	more: MoreHorizontal,
};
