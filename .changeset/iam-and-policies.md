---
"invana": minor
---

**IAM: who may do what, in one place.** IAM is a sixth product in the launcher, on the Agents shell —
Home · People, Groups, Agents · Policies, Tokens. A **policy** is statements (actions × resources,
grouped by layer, with `fields` · `depth` · `until` conditions) and limits; people, groups, agents
and tokens hold it.

| Kind | What it is |
|---|---|
| managed | the Graph roles — viewer · contributor · builder · modeller · owner · **iam-admin** (new) — read-only |
| custom | written by an iam-admin, or drafted by the assistant from a sentence |
| inline | on one token, narrowing it |
| boundary | the most anyone in the Graph may do |

A new or edited policy shows its **impact** before it saves — who gains, who loses, which skills
would break — and every save is a version. **Test access** answers *may X do Y to Z* with every
layer's verdict, without running anything. `invana iam list · show · apply` keeps policies in files.

**Effective access** is skill needs ∩ the agent's policies ∩ the person who started the run ∩ the
world ∩ the boundary. Every step is checked **before it dispatches**; a refusal names the policy and
is a ledger row refused by `grant`. An agent's Access tab lists the policies it holds and attaches
one — the same act as in IAM. Existing agents keep what their envelopes allowed; a new agent holds
`viewer`.

**Tokens** minted in IAM are bound to the Graph and may be **narrowed** by an inline policy, never
wider than their holder — for yourself or for a **service account** (a member with no sign-in).
A narrowed token reaches only the routes its policy allows: one narrowed to `data.version.draft`
can push a **draft** dataset version, which its owner publishes, and nothing else.

Breaking: changing members now needs the `iam-admin` role (the Graph's creator holds it);
`POST /api/v1/datasets/{publisher}/{name}/versions/drafts` and `…/versions/{v}/publish` are new.
