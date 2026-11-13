# Personas

Who Invana's stories are for. A story's *As* names one of these; its front-matter `personas:` lists their keys. A
persona is a person's job — what they come to do. What they may do is their role and the agents they may use, drawn as
two lenses (below).

## The people

| Key | Persona | Comes to Invana to | Works mostly in | Usual role |
|---|---|---|---|---|
| `analyst` | **Analyst** | Ask the Graph questions, read answers, keep boards and share them | Explore | Operator |
| `decision-maker` | **Decision maker** — a policy maker, investor or marketer | Pursue a question: fork it into branches, weigh findings for and against, decide with a trail | Projects | Operator |
| `modeller` | **Modeller** — a modeller or compliance lead | Give the data meaning across every graph database: models, meaning and sensitive properties, links and identity match rules, rules that must always hold | Model | Modeller |
| `researcher` | **Researcher** | Test hypotheses against the evidence, reproducibly: every finding cites the loads and records behind it, and a study can be rerun and cited | Projects · Explore | Operator |
| `investigator` | **Investigator** — an auditor or case worker | Work a case from its leads to a decision, every piece of evidence kept with its chain of custody — who brought it in, from which load, and who touched it | Projects · Explore | Operator |
| `curator` | **Data curator** | Bring records in, check them against the model and its standards, fix and trace them | Records | Modeller |
| `builder` | **Agent builder** | Build agents, skills and workflows, test them, read how they are doing | Agents | Modeller |
| `admin` | **Admin** | Run the deployment: connect graph databases and set their mode, add people and teams, grant agents, write Access Policies, run AI models, workers, plugins and limits, watch the Control Plane | Settings › Invana | Admin |

## Names not used for a persona

| Not a persona | Who it is | Why |
|---|---|---|
| User | **Analyst** | every persona is a user; the job is asking |
| Data modeler | **Modeller**, or **Data curator** when the work is gathering data | two jobs, two personas |
| Operator, as a job (*see what ran, what it touched, what it cost*) | **Agent builder** or **Admin**, reading Runs | *Operator* is a role — a person who looks, asks and decides — never a job |
| Evaluator | **Agent builder** | proving a skill change is not worse is part of building it |
| Graph owner · Install admin · Platform engineer | **Admin** | there is one deployment, run by its Admins; no part of it has an owner of its own |

## How someone arrives

| Arrival | Starts with |
|---|---|
| Has a graph database | An Admin connects it; an agent harvests its data model and drafts it |
| Has files | Upload them; an agent proposes the model they fit |
| Is trying it out | A deployment with demo data |
| Was added | A deployment someone else set up, with the agents they may use, opened at their first answer |

## The two lenses

Every story's *Who can* names the three roles — Operator · Modeller · Admin — and every board is drawn for two lenses.

| Lens | Who | Sees |
|---|---|---|
| **Admin** | A person with the Admin role | Every act |
| **Operator** | A person with the Operator role — looks, asks and decides through the agents they may use | Looks, asks, opens boards, re-runs their own runs. Every other act is hidden, disabled with its reason, or *Ask &lt;approver&gt;*, as the feature's Access table says |

What each role may do is the one role × feature table in the [Access Plane](os/access/product.md). A Modeller's acts
between the two lenses are criteria in the story, never a third lens on the canvas.
