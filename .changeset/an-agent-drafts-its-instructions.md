---
"invana": minor
---

An agent's instructions have a draft, a publish and a rollback.

- `PATCH …/agents/{id}/draft` `{instructions}` writes the unpublished text (`agents.instructions_draft`); `DELETE …/agents/{id}/draft` discards it. Runs keep reading the published instructions.
- `POST …/agents/{id}/publish` `{why}` moves the draft into `instructions` as the next agent version, an `agent.update` with its diff and why. It is refused when no draft is open.
- `POST …/agents/{id}/rollback` `{version, why}` restores the instructions as they were at that version, as a new version whose event carries `restored_from`. It is refused while a draft is open, when that text is already current, or when the edit that held it predates recorded diffs.
- `PATCH …/agents/{id}` `{instructions}` still writes directly.
