/**
 * The Agents openers, when the host provides them. The skill page also opens
 * as a declared page outside the Agents workbook, where there is no
 * `AgentsOpenContext`; there a link that cannot open is drawn as plain text.
 */

import { useContext } from "react";
import { type AgentsOpen, AgentsOpenContext } from "../open";

export function useSkillOpen(): AgentsOpen | null {
	return useContext(AgentsOpenContext);
}
