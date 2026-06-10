# RFC-023: Remove graph roles & invitations — flatten to binary membership

**Status**: Accepted
**Author**: Invana Team
**Date**: 2026-06-10
**Related**:
- **RFC-017** (Graph as primary container) — defines `Graph`, `GraphMember`, `created_by_id`. This RFC
  keeps `GraphMember` but strips its `role` axis.
- **RFC-018** (Domain audit events) — removes the `member.role_change` / `invitation.*` event actions
  this RFC's deleted flows used to emit.
- **MVP §1.3 (Invitations)** and **§1.4 (Roles)** — this RFC **removes both sections** from MVP scope.
  Supersedes their `[~]` lines.
- **Layer-1 detail** [`mvp/layer-1-identity-access.md`](layer-1-identity-access.md) — the role matrix
  documented there is retired by this RFC.

## Problem / intent

The MVP shipped a graph-scoped RBAC model: every `Graph` has `GraphMember` rows, each carrying a
`graph_role` enum (`developer | analyst | admin`); a one-shot **Invitation** flow attaches new members
at a chosen role; and three tiered dependencies (`require_graph_admin` / `require_graph_builder` /
`require_graph_member`) gate the API, mirrored on the frontend by `RoleGate` + `useAuth().isAdmin/
isBuilder`. Admin-only settings sections (Connection, Intent, LLMs, Skills, Instructions, Datasets)
are hidden from non-admins.

For the current product stage this is more access machinery than the product needs. Multi-user
collaboration with differentiated roles is not a near-term goal; the per-graph role matrix, the invite
issue/redeem/revoke surface, and the role-tiered gating add weight to every feature without earning it.

**Intent:** collapse access to a single binary — **you are a member of a graph, or you are not** — and
delete the invitations feature outright. A member has full access to everything in the graph; there is
no "lower" role. The `GraphMember` table survives as the access-control join (so the gate that protects
every graph-scoped route stays intact); only its `role` dimension and the invite flow that populated it
at varying roles are removed.

## Decisions

1. **Keep `GraphMember`; drop `role`.** `GraphMember` remains the user↔graph access join. Membership is
   binary: a row means full access. The `role` column and the `graph_role` enum are dropped. Today the
   only way a row is created is graph creation (creator → member), so post-RFC a graph is effectively
   owner-only until a future RFC reintroduces a sharing mechanism. We deliberately keep the table rather
   than collapse to a raw `created_by_id == user` check, so reintroducing sharing later doesn't require
   re-plumbing every route's auth dependency.

2. **Collapse the three tiered deps to one.** `require_graph_admin` and `require_graph_builder` are
   removed. `get_graph_membership` and `require_graph_member` stay — they answer "is this user a member
   of this graph?" (now the only question). Every call site currently using `require_graph_admin` /
   `require_graph_builder` is rewritten to `require_graph_member`. **Access does not get more
   permissive than before** in practice: the only non-owner members today are invitees, and the invite
   flow is being removed — so the realistic membership set is `{owner}`, for whom admin == member.

3. **Delete invitations entirely.** `Invitation` model + table, all `/invitations` routes + services,
   the `POST /auth/register?invite=<token>` accept path, and the studio Invitations UI are removed.
   Registration becomes invite-free (see Decision 7).

4. **Remove role gating from the frontend.** `RoleGate`, `useAuth().isAdmin/isBuilder/isAnalyst`, and
   the `GraphRole` type are deleted. `membershipForGraph()` stays (binary). The `adminOnly` flag on
   settings sections is removed — a member sees every section. `RoleGate require="superuser"` usages
   (platform-admin link) are replaced by a direct `user.is_superuser` check; `is_superuser` is
   **unchanged** by this RFC (platform-level admin / `/admin` gate is orthogonal to graph roles).

5. **Retire role/invitation audit actions.** Remove `member.role_change`, `invitation.create`,
   `invitation.accept`, `invitation.delete`, and the `invitation` target kind from `events/actions.py`.
   `member.add` / `member.remove` are retained only if a member-management path still emits them; with
   invitations gone and creation implicit, `member.add` fires once at graph creation (keep) and
   `member.remove` has no caller (remove). The Events section's "Members" filter option stays (covers
   `member.add`); the `invitation` icon mapping is removed.

6. **Account-deletion guard simplifies.** The "refuse to delete a user who owns a Graph with *other*
   members" guard (`_owns_shared_graph`) becomes dead once non-owner members can't exist. **Resolved:**
   replace it with the rule — *a user who owns any Graph must delete those graphs first* (`DELETE
   /auth/me` returns **409** while any owned graph exists). No cascade of graphs on user delete. The
   sole-superuser guard is unchanged.

7. **Registration is superuser-provisioned, not public.** MVP §1.1 described `/auth/register` as
   "invite-gated". With invitations gone, **resolved:** self-service registration is disabled.
   `/auth/register` is gated behind `require_superuser` (a logged-in platform admin provisions
   accounts); unauthenticated callers get **401/403**. The studio public `RegisterPage` + `/register`
   route are removed. A first-class admin "create user" UI is a follow-up; for now a superuser
   provisions via the gated API / `/admin`.

## Schema / migration

- Drop column `graph_members.role`; drop the `graph_role` enum type.
- Drop table `invitations` (and its indexes `ix_invitations_token_hash`, `ix_invitations_email`).
- New Alembic revision (forward-only). The initial redesign migration `00000000000a` is **not**
  edited — history stays immutable; the new revision drops the column/enum/table.

## Surface inventory (what changes)

**Backend — delete:**
- `Invitation` model + `GraphRole` enum (`graphs/models.py`); `role` field on `GraphMember`.
- Invitation + member-role schemas (`auth/schemas.py`: `GraphMemberRoleUpdate`, `Invitation*`); strip
  `role` from `GraphMemberOut` / `GraphMembershipOut`.
- `/members/{user_id}` PATCH+DELETE and all `/invitations` routes (`graphs/routes.py`); keep `GET
  /members` (now a flat list) or drop it — **drop**, since there's no management UI left.
- `update_graph_member_role`, `remove_graph_member`, `_is_sole_graph_admin`, `create_invitation`,
  `list_graph_invitations`, `delete_invitation` (`graphs/services.py`); `register_with_invite` +
  invitation token helpers (`auth/services.py`).
- `require_graph_admin`, `require_graph_builder` (`graphs/deps.py`).
- `GraphMemberView` (role column) edits, `InvitationView` (`server/admin/views.py`).
- Role/invitation event actions (`events/actions.py`).

**Backend — rewrite:**
- All `require_graph_admin|builder` call sites → `require_graph_member` (datasets, events,
  instructions, llm_providers, skills, server/routes/{models,query,schemas}).
- `auth/services.py` `_list_memberships` / `_user_out` → drop `role` from payload.
- `auth/routes.py` register → drop `invite` param (per Decision 7).
- Account-deletion guard (Decision 6).

**Frontend — delete:**
- `MembersSection.tsx`, `InvitationsSection.tsx`, `MembersInvitationsSection.tsx`.
- `services/api/graph-membership.ts` (or strip to nothing).
- `RoleGate.tsx`; `GraphRole`, `GraphMember`, `Invitation`, `InvitationCreateResponse` types.
- `RegisterPage` invite handling; UserMenu "Graph members" + "Invitations" links.

**Frontend — rewrite:**
- `useAuth.ts`: drop `rolesForGraph`/`isAdmin/isBuilder`; keep `membershipForGraph` (binary).
- `useGraphLeftNav.tsx`: remove `adminOnly` + `isAdmin` filter; remove `members` rail section.
- `SettingsPanel.tsx` + `useSettingsPanel.ts`: remove `members` section.
- `EventsSection.tsx`: drop `invitation` icon mapping.
- `types/auth.ts` `AuthUser.graphs`: `GraphMembership` keeps graph identity, loses `role`.

## Non-goals

- Reintroducing any sharing/collaboration mechanism (future RFC).
- Touching platform-level `is_superuser` / `/admin` gating.
- Editing historical migrations.

## Resolved questions

1. **Registration policy** (Decision 7) — **superuser-provisioned.** `/auth/register` behind
   `require_superuser`; public `RegisterPage` removed.
2. **Account deletion on owned graphs** (Decision 6) — **block until graphs deleted** (409); no
   cascade.
3. **Keep `GET /members`?** — **dropped.** No management UI remains; a future "who's here" view can
   reintroduce a flat read endpoint.
