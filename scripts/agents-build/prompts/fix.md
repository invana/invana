Phase {{ID}} of docs/products/agents-build-sessions.md did not pass (attempt {{ATTEMPT}}). You are running unattended.

Findings from the driver's gates and/or the design review:

{{FINDINGS}}

1. Read docs/products/agents-build-sessions.md: "Rules for every session" and the entry for {{ID}}, plus scripts/agents-build/reviews/{{ID}}.md if it exists.
2. Read scripts/migration/prompts/team.md › *Fix rounds*: group the findings by file and hand groups that share no file to up to 3 sub-agents in parallel; keep cross-group findings yourself. Fix every finding inside {{ID}}'s scope. A finding that needs another phase's work goes in the hand-off note instead.
3. Re-run the failing checks and re-shoot the boards a review finding names. Never commit or push. Add a hand-off note line for {{ID}} saying what you fixed.

Never edit scripts/migration/baseline.json and never set your own row to `done`.
