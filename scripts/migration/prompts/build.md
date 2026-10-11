Execute migration session {{ID}} from docs/products/migration-sessions.md. You are running unattended; nobody will answer questions.

1. Read docs/products/migration-sessions.md: "Rules for every session", the entry for {{ID}}, and the log row and hand-off notes of every session {{ID}} needs. Read docs/products/migration-plan.md only for the sections the entry links.
2. Read only the files the entry lists under "Read". Skim others only when a step needs it.
3. Do the steps in order. Do not start any other session's work. Never push, never open a PR, never commit — the driver commits.
4. Run the entry's exit checks yourself; fix what you can inside this session's scope.
5. When a decision is genuinely ambiguous, pick the option the product docs (docs/products/*.md) and CLAUDE.md support, and record it in your hand-off note.
6. If you cannot finish inside this session's scope, set {{ID}}'s log row to `blocked` with the reason and stop.
7. When done, leave the log row status as it is (the driver marks `done` after its own gates and the design review) and add a hand-off note row for {{ID}}: what a later session must know that the code does not say.

Standing rules: tokens, never currency, anywhere. Record exact model versions on runs. Templates stay out of prompts. Studio UI is composed from @invana/* and tokens only. Do not run graph-database tests unless INVANA_ALLOW_GRAPH_TESTS=1 is set in your environment.
