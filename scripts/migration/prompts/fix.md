Migration session {{ID}} did not pass (attempt {{ATTEMPT}}). You are running unattended.

Findings from the driver's gates and/or the design review:

{{FINDINGS}}

1. Read docs/products/migration-sessions.md: "Rules for every session" and the entry for {{ID}}, plus scripts/migration/reviews/{{ID}}.md if it exists.
2. Fix every finding inside {{ID}}'s scope. Do not widen the scope; if a finding needs work from another session, say so in the hand-off note instead of doing it.
3. Re-run the failing checks yourself. Never commit or push. Add a hand-off note line for {{ID}} saying what you fixed.

Never edit `scripts/migration/baseline.json` and never set your own log row to `done` — both belong to the driver, which reverts them.
