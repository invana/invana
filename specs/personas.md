# Personas

Who Invana's stories are for. A story's *As* names one of these; its front-matter `personas:` lists their keys. A
persona is a person's job — what they come to do. What they may do is their access, drawn as two lenses (below).

## The people

| Key | Persona | Comes to Invana to | Works mostly in | Usual access |
|---|---|---|---|---|
| `analyst` | **Analyst** | Ask the Graph questions, read answers, keep boards and share them | Explore | Operator |
| `decision-maker` | **Decision maker** — a policy maker, investor or marketer | Pursue a question: fork it into branches, weigh findings for and against, decide with a trail | Projects | Can work on projects |
| `modeller` | **Modeller** — a modeller or compliance lead | Give the data meaning: models, links between models, views of the graph, rules that must always hold | Model | Can shape the model |
| `researcher` | **Researcher** — a scientist | Test hypotheses against the evidence, reproducibly: every finding cites the loads and records behind it, and a study can be rerun and cited | Projects · Explore | Can work on projects |
| `investigator` | **Investigator** — fraud, crime or compliance | Work a case from its leads to a decision, every piece of evidence kept with its chain of custody — who brought it in, from which load, and who touched it | Projects · Explore | Can work on projects |
| `curator` | **Data curator** — a curator or lab | Bring records in, check them against the model and its standards, fix and trace them | Records | Can shape the model |
| `builder` | **Agent builder** | Build agents and skills, test them, read how they are doing | Agents | Can build agents · Admin |
| `owner` | **Graph owner** | Create a Graph, connect its database, invite its people and agents, set its access rules | Settings › This graph | Owner · Can manage people |
| `admin` | **Install admin** | Run the install: AI models, workers, plugins, each Graph's limits | Settings › Invana | Admin |

## Names not used for a persona

| Not a persona | Who it is | Why |
|---|---|---|
| User | **Analyst** | every persona is a user; the job is asking |
| Data modeler | **Modeller**, or **Data curator** when the work is gathering data | two jobs, two personas |
| Operator, as a job (*see what ran, what it touched, what it cost*) | **Agent builder** or **Install admin**, reading Runs | *Operator* is a lens — a member who can look and ask — never a job |
| Evaluator | **Agent builder** | proving a skill change is not worse is part of building it; evals are behind *Can build agents* |
| Admin, as *who may do what, everywhere* | **Graph owner** for a Graph's people and access · **Install admin** for the install | access is set per Graph; the install has no Graph admin |
| Platform engineer | **Install admin** | running the install is one job |

## How someone arrives

| Arrival | Starts with |
|---|---|
| Has a graph database | Connect it; an agent harvests its data model and drafts it |
| Has files | Upload them; an agent proposes the model they fit |
| Is trying it out | A starter Graph with demo data |
| Was invited | A Graph someone else created, opened at its first answer |

## The two lenses

Every story's *Who can* and every board is written for two lenses, so seven Graph roles stay two views.

| Lens | Who | Sees |
|---|---|---|
| **Admin** | The install admin, or a Graph owner who can manage people | Every act |
| **Operator** | A member with only the operator role — can look and ask | Looks, asks, opens boards, re-runs their own runs. Every other act is hidden, disabled with its reason, or *Ask &lt;owner&gt;*, as the feature's Access table says |

| Grant | Lets an Operator also |
|---|---|
| **Can work on projects** | Projects, tasks, findings, decisions |
| **Can build agents** | Agents, skills, tests, plans, templates |
| **Can shape the model** | Models, links between models, rules, views of the graph, loading data into the model |
| **Owner** | The Graph's settings, connection, AI providers — and the three grants above |
| **Can manage people** | Members, groups, access rules, other people's keys |

A grant between the two lenses is a criterion in the story, never a third lens on the canvas.
