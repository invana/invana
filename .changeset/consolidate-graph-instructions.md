---
"invana": minor
"studio": minor
---

Consolidate a graph's standing guidance into a single **Instructions** field; remove the unused instructions table (RFC-040).

A graph had two overlapping surfaces for "what this graph is for / how its agents should behave": a single `intent` mission-statement field (a required setup-wizard section) and a separate, named-and-prioritized `instructions` table. The table was never wired into any prompt or agent — it duplicated the field and confused the vocabulary.

This renames `Graph.intent` → **`Graph.instructions`** (a single, ChatGPT-/Claude-project-style custom-instructions block) and **removes the instructions table** entirely (its module, routes, admin view, `instruction.*` events, and the studio list UI + data layer). The setup wizard's required "Intent" section becomes "Instructions", and the settings rail collapses two icons into one.

Data-preserving migration `000000000020`: renames the column, migrates the `setup_state` wizard-completion key (`intent` → `instructions`) for existing graphs, and drops the table (reversible). No behavior change beyond vocabulary and the removal of the never-read table — the setup gate still requires Graph Info + Instructions.

(This also frees the word "intent" for the upcoming NL→query `user_intents` learning artifacts, RFC-038.)
