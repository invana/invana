# AC-04 · Tasks

What the designer, the coder and QA do to deliver [AC-04](story.md). The story governs; each role adds and edits only
its own rows (`.claude/skills/product-spec/format.md` › *Tasks*).

| ID | Owner | Title | Description | Story | Criteria | Boards | Depends on | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| AC-04-T2 | designer | The Sign in again hub | One `access.signin · Sign in again · <act>` state per act that asks for the password again, naming the act, what it will do and the state it returns to; its button leads to the act's result state; *Wrong password* returns to the same act; every act's password-again link points at its own hub state (platform-design-3 P03, E2E-004) | [AC-04](story.md) | AC-04.13 · AC-04.20 | access.signin · settings.policies · settings.people · settings.me · settings.plugins · settings.databases · settings.ai · agents.agents | — | done | [access.signin](https://claude.ai/artifact/PgtkC6KygGZz2u8fYq1LWX#artboard-access-signin) · `.agent-reports/designer/platform-design-3-P03.md` |
| AC-04-T1 | qa | Pass 1 · spec check | Story id, title and `feature:` match the folder; AC-04.3 – .7, .13, .14 match the feature's Refusals table; the spec check is green for AC-F02. Specs only, no build | [AC-04](story.md) | AC-04.1 – AC-04.16 | — | — | done | `.agent-reports/qa/specs-planes-P04a-qa.md` |
