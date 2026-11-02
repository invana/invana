/**
 * Settings' sections, read by the rail (`product.tsx`), each page's frame and
 * the record pages' crumbs. Only what is built is listed.
 */
import { Plug } from "lucide-react";

export const PLUGINS = {
	label: "Plugins",
	icon: Plug,
	description:
		"Every plugin this install loaded — the functions each declares, and whether it may run",
};
