---
"invana": minor
---

Tool plugins: agents can reach the web, mail and science sources, once an install Admin enables them.

- Three tool plugins ship in the engine: `invana.tools.web` (`web.search` over a SearXNG instance, `web.fetch`, `web.download_and_extract`), `invana.tools.mail` (`mail.read`, `mail.send`) and `invana.tools.science` (`pubmed.search`, `uniprot.get`, `pubchem.get`). Each installs with its extra — `invana[tools-web]`, `[tools-mail]`, `[tools-science]` — and is off until an Admin enables it.
- The web tools honour robots.txt, and every row they return cites its URL.
- `mail.send` never sends on its own: the run waits on an approval in the inbox, and a declined send fails the step with *nothing was sent*.
- Secrets are read where the step runs, from `INVANA_SECRET_<NAME>` (`web_search`, `imap`, `smtp`) — never sent with the step.
- With `INVANA_EXECUTOR=procrastinate`, tool steps run in workers started by `invana worker` (the `invana[workers]` extra; Postgres only). `invana migrate` sets up the queue's tables. The default, `inline`, keeps every step in the engine process.
- The plugin registry is readable over the API — `GET /api/v1/plugins`, `/plugins/{name}`, `/task-types/{ref}` — and switched with `POST /plugins/{name}/enable` or `/disable`. The same from a terminal: `invana plugins list · show · enable · disable` and `invana tasks show <key>[@version]`.
- A plugin can ship a skill; the web plugin's *Collect a dataset from the web* is seeded into every Graph.
