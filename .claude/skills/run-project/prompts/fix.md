Phase {{ID}} of project `{{PROJECT}}` ({{FILE}}) did not pass (fix round {{ATTEMPT}}). You are running unattended.

Findings from the runner's gates and QA:

{{FINDINGS}}

1. Read {{FILE}}: "Rules for every session" and the entry for {{ID}}, and the QA report the findings name.
2. Read `.claude/skills/run-project/prompts/team.md` › *Fix rounds*: group the findings by file; groups that share no file go to up to 2 sub-agents in parallel; cross-group findings stay with you. Fix every finding inside {{ID}}'s scope. A finding that needs another phase's work goes in a hand-off note instead; one that needs a file your role does not write (a doc for the coder, code for the product-manager) is raised with the `recommend` skill.
3. Re-run the failing checks. Add a hand-off note row for {{ID}} saying what you fixed.

{{COMMIT}}
