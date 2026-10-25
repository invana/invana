/**
 * The IAM endpoints under `/api/v1/u/{owner}/{graph}/iam`: the overview,
 * policies (their versions, holders, impact and limits), the assistant's
 * draft, test access, people and service accounts, groups and their members,
 * the agents' access, and tokens. Each call is one `request` on the shared
 * client and returns the engine's shape unchanged. A list takes the list
 * contract (`?q=`, a filter by its plain field name — `kind` — and paging).
 *
 * Adding a member, re-roling one and removing one stay on the Graph's own
 * `…/members` (core's `membersApi`).
 */

import { type ListQuery, listQueryToApi, request } from "@invana-studio/core";
import type {
	AccessCheckRead,
	AccessCheckRequest,
	AgentAccessList,
	AttachRequest,
	EffectiveQuery,
	EffectiveRead,
	GroupCreate,
	GroupList,
	GroupMemberAdd,
	GroupRead,
	GroupUpdate,
	HolderList,
	HolderRow,
	IamTokenCreate,
	IamTokenCreated,
	IamTokenList,
	ImpactRead,
	ImpactRequest,
	LimitsRead,
	OverviewRead,
	PeopleList,
	PersonRow,
	PolicyCreate,
	PolicyDraftRequest,
	PolicyList,
	PolicyRead,
	PolicySave,
	PolicyUpdate,
	PolicyVersionRead,
	RefusalList,
	ServiceAccountCreate,
} from "./types";

const base = (username: string, graphSlug: string) =>
	`/api/v1/u/${username}/${graphSlug}/iam`;

const json = (body: unknown) => ({ body: JSON.stringify(body) });

const post = (body: unknown) => ({ method: "POST", ...json(body) });

const seg = encodeURIComponent;

export const iamApi = {
	/** Home's tiles: the counts per section. */
	overview: (username: string, graphSlug: string) =>
		request<OverviewRead>(`${base(username, graphSlug)}/overview`),

	// ── policies ──────────────────────────────────────────────────────────

	/** One page of policies — `kind` and `status` filters, `kinds` counted. */
	policies: (username: string, graphSlug: string, query: ListQuery = {}) =>
		request<PolicyList>(
			`${base(username, graphSlug)}/policies${listQueryToApi(query)}`,
		),

	policy: (username: string, graphSlug: string, name: string) =>
		request<PolicyRead>(`${base(username, graphSlug)}/policies/${seg(name)}`),

	/** A new policy, written as a draft. */
	createPolicy: (username: string, graphSlug: string, data: PolicyCreate) =>
		request<PolicyRead>(`${base(username, graphSlug)}/policies`, post(data)),

	/** Change the draft. */
	updatePolicy: (
		username: string,
		graphSlug: string,
		name: string,
		data: PolicyUpdate,
	) =>
		request<PolicyRead>(`${base(username, graphSlug)}/policies/${seg(name)}`, {
			method: "PATCH",
			...json(data),
		}),

	removePolicy: (username: string, graphSlug: string, name: string) =>
		request<void>(`${base(username, graphSlug)}/policies/${seg(name)}`, {
			method: "DELETE",
		}),

	/** Save the draft as the policy's next version. */
	savePolicy: (
		username: string,
		graphSlug: string,
		name: string,
		data: PolicySave = {},
	) =>
		request<PolicyRead>(
			`${base(username, graphSlug)}/policies/${seg(name)}/save`,
			post(data),
		),

	policyVersions: (username: string, graphSlug: string, name: string) =>
		request<PolicyVersionRead[]>(
			`${base(username, graphSlug)}/policies/${seg(name)}/versions`,
		),

	/** Who holds a policy — `kind` filter, `kinds` counted. */
	holders: (
		username: string,
		graphSlug: string,
		name: string,
		query: ListQuery = {},
	) =>
		request<HolderList>(
			`${base(username, graphSlug)}/policies/${seg(name)}/holders${listQueryToApi(query)}`,
		),

	attach: (
		username: string,
		graphSlug: string,
		name: string,
		data: AttachRequest,
	) =>
		request<HolderRow>(
			`${base(username, graphSlug)}/policies/${seg(name)}/holders`,
			post(data),
		),

	/** Detach one holder, by the attachment's id. */
	detach: (username: string, graphSlug: string, name: string, id: string) =>
		request<void>(
			`${base(username, graphSlug)}/policies/${seg(name)}/holders/${seg(id)}`,
			{ method: "DELETE" },
		),

	/** Who gains and who loses if these statements were saved. */
	impact: (
		username: string,
		graphSlug: string,
		name: string,
		data: ImpactRequest,
	) =>
		request<ImpactRead>(
			`${base(username, graphSlug)}/policies/${seg(name)}/impact`,
			post(data),
		),

	/** The policy's limits against the engine's reading now. */
	limits: (username: string, graphSlug: string, name: string) =>
		request<LimitsRead>(
			`${base(username, graphSlug)}/policies/${seg(name)}/limits`,
		),

	/** Draft with the assistant: one sentence in, a draft policy out. */
	draftPolicy: (
		username: string,
		graphSlug: string,
		data: PolicyDraftRequest,
	) =>
		request<PolicyRead>(
			`${base(username, graphSlug)}/policies/drafts`,
			post(data),
		),

	/** Test access: may this principal do this act on this resource, layer by layer. */
	test: (username: string, graphSlug: string, data: AccessCheckRequest) =>
		request<AccessCheckRead>(`${base(username, graphSlug)}/test`, post(data)),

	// ── people and groups ─────────────────────────────────────────────────

	/** Members and service accounts — `kind` person · service. */
	people: (username: string, graphSlug: string, query: ListQuery = {}) =>
		request<PeopleList>(
			`${base(username, graphSlug)}/people${listQueryToApi(query)}`,
		),

	createServiceAccount: (
		username: string,
		graphSlug: string,
		data: ServiceAccountCreate,
	) =>
		request<PersonRow>(
			`${base(username, graphSlug)}/service-accounts`,
			post(data),
		),

	groups: (username: string, graphSlug: string, query: ListQuery = {}) =>
		request<GroupList>(
			`${base(username, graphSlug)}/groups${listQueryToApi(query)}`,
		),

	group: (username: string, graphSlug: string, name: string) =>
		request<GroupRead>(`${base(username, graphSlug)}/groups/${seg(name)}`),

	createGroup: (username: string, graphSlug: string, data: GroupCreate) =>
		request<GroupRead>(`${base(username, graphSlug)}/groups`, post(data)),

	updateGroup: (
		username: string,
		graphSlug: string,
		name: string,
		data: GroupUpdate,
	) =>
		request<GroupRead>(`${base(username, graphSlug)}/groups/${seg(name)}`, {
			method: "PATCH",
			...json(data),
		}),

	removeGroup: (username: string, graphSlug: string, name: string) =>
		request<void>(`${base(username, graphSlug)}/groups/${seg(name)}`, {
			method: "DELETE",
		}),

	addGroupMember: (
		username: string,
		graphSlug: string,
		name: string,
		data: GroupMemberAdd,
	) =>
		request<GroupRead>(
			`${base(username, graphSlug)}/groups/${seg(name)}/members`,
			post(data),
		),

	/** Remove one member, by the membership's id. */
	removeGroupMember: (
		username: string,
		graphSlug: string,
		name: string,
		id: string,
	) =>
		request<void>(
			`${base(username, graphSlug)}/groups/${seg(name)}/members/${seg(id)}`,
			{ method: "DELETE" },
		),

	// ── agents ────────────────────────────────────────────────────────────

	/** Every agent's access — `kind` authored · seeded. */
	agents: (username: string, graphSlug: string, query: ListQuery = {}) =>
		request<AgentAccessList>(
			`${base(username, graphSlug)}/agents${listQueryToApi(query)}`,
		),

	/** What an agent may do, layer by layer, for one start, world and run. */
	effective: (
		username: string,
		graphSlug: string,
		id: string,
		query: EffectiveQuery = {},
	) => {
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(query))
			if (value) params.set(key, value);
		const qs = params.toString();
		return request<EffectiveRead>(
			`${base(username, graphSlug)}/agents/${seg(id)}/effective${qs ? `?${qs}` : ""}`,
		);
	},

	/** The agent's refused ledger rows. */
	refusals: (
		username: string,
		graphSlug: string,
		id: string,
		query: ListQuery = {},
	) =>
		request<RefusalList>(
			`${base(username, graphSlug)}/agents/${seg(id)}/refusals${listQueryToApi(query)}`,
		),

	// ── tokens ────────────────────────────────────────────────────────────

	tokens: (username: string, graphSlug: string, query: ListQuery = {}) =>
		request<IamTokenList>(
			`${base(username, graphSlug)}/tokens${listQueryToApi(query)}`,
		),

	/** Mint a token; its secret is in this response only. */
	createToken: (username: string, graphSlug: string, data: IamTokenCreate) =>
		request<IamTokenCreated>(`${base(username, graphSlug)}/tokens`, post(data)),

	revokeToken: (username: string, graphSlug: string, id: string) =>
		request<void>(`${base(username, graphSlug)}/tokens/${seg(id)}`, {
			method: "DELETE",
		}),
};
