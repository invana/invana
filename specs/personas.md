# Personas

Who Invana's stories are for. A story's *As* names one of these; its front-matter `personas:` lists their keys. A
persona is a person's job — what they come to do. What they may do is the Access Policies attached to them and their
teams, drawn as two lenses (below).

## The people

| Key | Persona | Comes to Invana to | Works mostly in | Usual Access template, attached by an Admin over *Read only* |
|---|---|---|---|---|
| `analyst` | **Analyst** | Ask Graph Data questions, read answers, keep boards and share them | Explore | Explore |
| `decision-maker` | **Decision maker** — a policy maker, investor or marketer | Pursue a question: fork it into branches, weigh findings for and against, decide with a trail | Projects | Explore |
| `modeller` | **Modeller** — a modeller or compliance lead | Give the data meaning in every graph database: models, meaning and sensitive properties, links between models, rules that must always hold | Model | Shape the model |
| `researcher` | **Researcher** | Test hypotheses against the evidence, reproducibly: every finding cites the loads and records behind it, and a study can be rerun and cited | Projects · Explore | Explore |
| `investigator` | **Investigator** — an auditor or case worker | Work a case from its leads to a decision, every piece of evidence kept with its chain of custody — who brought it in, from which load, and who touched it | Projects · Explore | Explore |
| `curator` | **Data curator** | Bring records in, check them against the model and its standards, fix and trace them | Records | Shape the model |
| `builder` | **Agent builder** | Build agents, skills and workflows, test them, read how they are doing | Agents | Build agents |
| `admin` | **Admin** | Run the deployment: connect graph databases and set their mode, add people and teams, write Access Policies and attach them, run AI models, workers, plugins and limits, watch the Control Plane | Settings › General | Run the deployment · Super user |
## Names not used for a persona

| Not a persona | Who it is | Why |
|---|---|---|
| User | **Analyst** | every persona is a user; the job is asking |
| Data modeler | **Modeller**, or **Data curator** when the work is gathering data | two jobs, two personas |
| Operator, as a job (*see what ran, what it touched, what it cost*) | **Agent builder** or **Admin**, reading Runs | *Operator* is a lens — read only — never a job |
| Evaluator | **Agent builder** | proving a skill change is not worse is part of building it |
| Install admin · Platform engineer · an owner of one part of the deployment | **Admin** | there is one deployment, run by its Admins; no part of it has an owner of its own |

## How someone arrives

| Arrival | Starts with |
|---|---|
| Has a graph database | An Admin connects it; an agent harvests its data model and drafts it |
| Has files | Upload them; an agent proposes the model they fit |
| Is trying it out | A deployment with demo data |
| Was added | A deployment someone else set up, with the agents they may use, opened at their first answer |

## The two lenses

There are no roles: what a person may do is their Access Policies, read against [the permission
catalogue](os/access/features/AC-F02-access-policies/feature.md#the-permission-catalogue). Every story's *Who can* and every board are drawn for two lenses.

| Lens | Who | Sees |
|---|---|---|
| **Admin** — full access | A person whose policies allow every act the story names — *Super user*, or the Access template that fits | Every act |
| **Operator** — read only | A person whose policies allow reading and nothing more — *Read only*, every newcomer's policy | Every place and act; each act disabled, naming the permission and who can grant it, or *Ask &lt;approver&gt;*; data a policy denies withheld, never shown |

A person between the two — one permission but not another — is a criterion in the story, never a third lens on the
canvas.
