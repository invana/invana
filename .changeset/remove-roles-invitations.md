---
"invana": minor
"studio": minor
---

Remove graph roles & invitations — flatten to binary membership (RFC-023).

Per-graph roles (`developer`/`analyst`/`admin`) and the entire invitation flow are removed. Access is now binary: a `GraphMember` row means full access to the graph. `GraphMember` is kept as the access join (every graph-scoped route still gates on `require_graph_member`), but its `role` column, the `graph_role` enum, and the `require_graph_admin`/`require_graph_builder` tiers are gone — all former admin/builder routes collapse to `require_graph_member`.

The invitations feature (model/table, `/invitations` routes & services, the `POST /auth/register?invite=` accept path, and all Studio Invitations/Members UI) is deleted. Self-service registration is removed: `/auth/register` is now superuser-gated (accounts are provisioned by a platform admin) and the public `RegisterPage`/`/register` route is gone. Account deletion now refuses (409) while the user owns any graph — delete the graphs first.

Studio: `RoleGate`, `useAuth().isAdmin/isBuilder`, and admin-only settings-section gating are removed — a member sees every section. Migration `000000000015` drops `graph_members.role`, the `graph_role` enum, and the `invitations` table.
