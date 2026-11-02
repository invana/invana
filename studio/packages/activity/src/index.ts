/**
 * `@invana-studio/activity` — the Activity product's public surface: its
 * `ProductDefinition`, the bodies of its own section tabs (Schedules, Events,
 * Inbox, Rules, Channels) and what it borrows from its host
 * (shell.md › Activity).
 *
 * Its sections table is the shell's `ACTIVITY_SECTIONS`, which the agents
 * package's Runs, Approvals and Ledger pages read too; the app's product host
 * composes those pages beside these. Nothing outside this package reaches
 * past this file.
 */

export {
	ActivitySectionBody,
	type ActivityShellSection,
} from "./ActivitySectionBody";
export { ActivityProductSlotsContext } from "./ActivitySlots";
export { activity } from "./product";
