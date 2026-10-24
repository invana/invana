/**
 * Graph roles, a Graph's members and what the signed-in member may change
 * (docs/for-developers/modules/identity-and-access/features/roles.md).
 *
 * Every member reads everything in a Graph; a role is the right to change one
 * **area** of it. `GET …/access` says, per area, which role changes it, who
 * holds that role and whether the caller does — so Studio draws an act
 * disabled, with who to ask, before anyone tries it.
 */

/** The five Graph roles, lowest to highest. `owner` implies the other four. */
export const GRAPH_ROLES = [
	"viewer",
	"contributor",
	"builder",
	"modeller",
	"owner",
] as const;
export type GraphRole = (typeof GRAPH_ROLES)[number];

/** What each role may change, in the product's words — the Members tab's key. */
export const ROLE_MAY: Record<GraphRole, string> = {
	viewer: "ask, read every product it can open",
	contributor: "projects, findings, observations, schedules",
	builder: "agents, skills, evals, tools",
	modeller: "models, publish, stitches, rules, guardrails",
	owner: "members, settings, approving breaking changes",
};

/** A part of a Graph one role changes. */
export type AccessAreaName = "ask" | "work" | "build" | "model" | "settings";

interface AccessArea {
	area: AccessAreaName;
	label: string;
	role: GraphRole;
	allowed: boolean;
	/** Usernames holding the role, owners included — who to ask. */
	holders: string[];
}

export interface GraphAccess {
	roles: GraphRole[];
	areas: AccessArea[];
}

export interface GraphMember {
	/** What rules, schedules, approvals and project staffing store a person by. */
	user_id: string;
	username: string;
	first_name: string;
	last_name: string | null;
	roles: GraphRole[];
	added_at: string;
}

/** Add a member: `user` is an email or a username; no roles means viewer. */
export interface GraphMemberAdd {
	user: string;
	roles: GraphRole[];
}
