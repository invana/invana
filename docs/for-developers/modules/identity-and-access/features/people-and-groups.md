# People and groups

The principals of a Graph in one place: its members, its **service accounts** (a person with no sign-in
that owns tokens for scripts) and its **groups**, with the policies each holds.

| | |
|---|---|
| Index | [11.9](../../../README.md#11--identity-and-access) · Slice **I01** |
| Module | [Identity and access](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [membership](membership.md) · [roles](roles.md) · [policies](policies.md) · [tokens](tokens.md) · products: iam.md IAM-08 |

Product spec: [AC-F03 · People and access](../../../../../specs/os/access/features/AC-F03-groups-keys-and-holders/feature.md) — AC-09; the story, its criteria, journey, states and product decisions live there. This file keeps the engine shape and the rows not moved.

## Surfaces

| Surface | Shape |
|---|---|
| `iam.people` | Page *People* — *Members of airways, and service accounts — a person with no sign-in that owns tokens for scripts*; kind tabs, table name · email · groups · policies · tokens · signs in with; *Add person* · *New service account* |
| `iam.groups` | Page *Groups* — *Attach a policy once, to a team*; table group · people · agents · policies; *New group* |
| Group page | `?page=iam_group:<name>`: members (person or agent, *Add member*, remove) and the policies it holds (*Attach a policy*) |
| `GET …/iam/people` | `Page[PersonRow]` (`f.kind` person · service): `user_id` · `username` · `name` · `email?` · `kind` · `groups[]` · `policies[]` · `tokens` · `signs_in_with` |
| `POST …/iam/service-accounts` | `{username, description?}` → `PersonRow` |
| `GET·POST …/iam/groups` · `GET·PATCH·DELETE …/iam/groups/{name}` | `GroupRow` `{id, name, description, people[], agents[], policies[], people_count, agents_count}`; a group's read adds `members[]` and `held[]` `{attachment_id, name, kind, summary}` — the attachment is what *Detach* removes |
| `POST …/iam/groups/{name}/members` · `DELETE …/iam/groups/{name}/members/{id}` | `{member_kind: person·agent, member_id}` |

## Engine

| Thing | Shape |
|---|---|
| `users.is_service_account` | true for a service account; its `password_hash` is unusable and `email` is null |
| `groups` | `id` · `graph_id` · `name` (unique per Graph) · `description` · `created_by_id?` · `created_at` |
| `group_members` | `group_id` · `member_kind` person·agent · `member_id` · `added_by_id?` · `added_at`; unique per group and member |
| Managers | `apps/iam/managers`: `GroupManager` · `ServiceAccountManager`; people reads compose members, groups, holdings and tokens |
| Events | `group.create` · `group.update` · `group.delete` · `group.member.add` · `group.member.remove` · `service_account.create` |

## Decisions

| # | Decision |
|---|---|
| PG1 | A service account is a `users` row with `is_service_account` and no usable password, created inside one Graph and a member of it holding `viewer`. Its username is global, like any username. Only tokens act as it. |
| PG4 | A person's Graph roles stay on their membership (`graph_members.roles`): holding a managed policy directly is that set. A group's managed policies are attachments. A person's effective roles are both, unioned. |
| PG5 | *Add person* is the membership act ([membership](membership.md)) and needs iam-admin; Graph settings › Members keeps its table and reaches the same routes. |
| PG7 | A service account's description is `users.preferences.description`; a person has none. |

## Not building

| Not building | Because |
|---|---|
| Service accounts across Graphs | a service account is made in one Graph; another Graph adds it as a member |
