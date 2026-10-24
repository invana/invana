---
"invana": minor
---

**An agent and a skill are each built and read on one page.** *New agent* opens a draft agent on its
page — the builder — and *Create agent* makes it live through the eval gate. *New skill* opens an
untitled draft whose instructions are the document; its Flow shows what each line became.

| Page | Tabs |
|---|---|
| An agent | Overview · Runs · Instructions · Soul · Model · Flow · Access · Limits · Deploy · Evals · History |
| A skill | Instructions · Flow · Functions · Agents · Usage · Exceptions · Evals · Tests · History |

The open tab is in the URL (`?tab=`), so a link or a reload opens the same tab. Agents gains a
**Drafts** filter. Engine: agents have a `draft` status; `POST …/agents/{id}/create` makes a draft
live; `GET …/agents/{id}/overview` serves an agent's dashboard numbers; a skill's draft lists the
lines its draw could not map, its plan lists its handlers, and `GET …/skills/{id}/exceptions`
serves its replan numbers.

**A function has a page** — Contract · Used by · Calls — with its calls, p95 and failed rate over 30
days and the skills that need it: `GET …/catalogue/{step_key}` and `…/catalogue/{step_key}/calls`.
The Graph-less `GET /api/v1/task-types/{ref}` is removed. Retire takes a *Why*, shown in History.
An agent's Overview reads *served* as Fleet does — succeeded over settled runs — so one agent shows
one served rate everywhere.
