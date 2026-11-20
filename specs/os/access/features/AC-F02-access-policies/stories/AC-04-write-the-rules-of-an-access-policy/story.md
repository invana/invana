---
id: AC-04
title: Write the rules of an Access Policy
feature: AC-F02
status: idea
milestone: MVP
personas: [admin]
boards: [settings.policies, access.signin]
---

# AC-04 · Write the rules of an Access Policy

**As** an Admin **I want** an Access Policy written as rules — Allow, Ask or Deny; Read, Write or Run; on a named
resource — **so that** an agent gets exactly what a job needs and nothing more.

Tasks: [task.md](task.md) · Feature: [AC-F02](../../feature.md)

## Who can

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | Read a policy's rules and versions; write a new or a copied policy; edit and delete a custom policy; *Copy* any policy; apply a policy file an import or a Team pack brought in; approve another Admin's change when a second Admin's yes is set. Saving asks them to sign in again | A built-in policy has no *Edit*, *Rename* or *Delete* — *Copy to change*; their own waiting change has no *Approve* |
| Operator | Nothing here without Read on `access/policies`; a person who may import brings in an import whose policy files wait for a person with Edit on Access. A person who holds Read but not Edit on Access reads a policy's rules and versions | *No access* — *Needs Read on Access — ask Priya or Lee*; with Read, *New policy*, *Edit*, *Copy*, *Apply* and *Delete* disabled — *Needs Edit on Access — ask Priya or Lee* |

## Flow

```mermaid
flowchart TD
  r([A policy]) --> k{"Built in?"}
  k -->|yes| bi["Rules read · Copy to change"] --> cp["A custom copy, owned by the Admin who copied it"] --> e
  k -->|no| ed{"Is the reader an Admin?"}
  ed -->|no| ask["Edit disabled · names the Admins"]
  ed -->|yes| e["Edit · each rule: effect · verb · resource"]
  r -->|an imported policy file| e
  e --> v{"Every rule in the grammar · every name exists · the policy name free?"}
  v -->|no| ref["Refused in place, naming the rule or the name"]
  ref --> e
  v -->|yes| imp(["AC-06 · who it changes, then Save"])
  imp --> pw{"Sign in again"}
  pw -->|wrong| pw
  pw -->|right| two{"A second Admin's yes is set?"}
  two -->|no| sv(["Saved · a new version · History"])
  two -->|yes| wait["Waiting for a second Admin · the version before stays in force"]
  wait -->|another Admin approves| sv
  wait -->|declined| dec(["Dropped · History"])
  wait -->|the saver tries to approve| self["Refused · another Admin approves"]
  e -->|from a key| ks["Refused · it needs a person's session"]
  r --> h["History — every saved version"]
  r -->|Delete · a custom policy| dl{"Attached to any agent?"}
  dl -->|yes| hl["Lists its agents · they lose it on confirm"]
  dl -->|no| gone(["Deleted"])
  hl --> gone
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AC-04.1 | A policy | it is opened | each rule reads as a sentence — *Allow reading Customer in every graph database*, *Ask before running any web tool*, *Deny writing any data* — Deny first, then Ask, then Allow; the exact form — effect · verb · resource — is one click deeper |
| AC-04.2 | An Admin adding a rule | they pick it | the effect is one of Allow · Ask · Deny and starts at Ask; the verb is Read or Write on `data/…` · `memory/…` · `project/…` · `fs/…` · `net/…`, Run on `skill/…` · `workflow/…` · `agent/…` · `plugin/…` · `tool/…` · `cmd/…`; the resource is picked from what exists, with `*` for a whole segment; the rule has no team or other condition |
| AC-04.3 | A rule | its resource type is unknown, its verb does not fit the resource, or its effect is not Allow · Ask · Deny | the save is refused in place, naming the rule |
| AC-04.4 | A rule | its resource puts `*` inside a segment — `data/sales*/Order` | the save is refused in place, naming the rule; `*` stands only for a whole segment |
| AC-04.5 | A rule | it names a graph database, kind, project, skill, workflow, agent, plugin or tool that does not exist | the save is refused in place, naming the rule and the missing name |
| AC-04.6 | A new policy | its name is already used | it is refused in place, naming the policy |
| AC-04.7 | A built-in policy | it is opened | it reads *Built in*, owned by the system user; there is no *Edit*, *Rename* or *Delete*; *Copy to change* makes a custom draft |
| AC-04.8 | A custom policy attached to agents | it is deleted | the agents are listed first, and lose it on confirm |
| AC-04.9 | A saved policy | its *History* is read | every version: who saved it, when, why, its rule count |
| AC-04.10 | Rules on the policies an agent holds | a step is checked | what no rule reaches is denied; where rules disagree, Deny over Ask over Allow, across every policy attached to the agent; the answer is the same whoever is behind the run |
| AC-04.11 | A rule on `data/*/Customer` | a step reads Customer in any graph database | the rule reaches it; `data/*/*` reaches every kind in every graph database |
| AC-04.12 | A person with Read on `access/policies` but not Edit on Access | they open a custom policy | it reads; *Edit*, *Copy* and *Delete* are disabled, naming Edit on Access and who can grant it; without Read it reads *No access*, naming Read on `access/policies` and who can grant it |
| AC-04.13 | An Admin | they save a policy | they sign in again first — the password or the SSO, and the second factor; nothing changes until they do, and a failed sign-in changes nothing |
| AC-04.14 | A change to a policy — from Studio, the API, a key or a policy file applied from the command line | it is made | every path is held to the same checks; with a key it is refused, naming that it needs a person's session |
| AC-04.15 | An Admin at the command line | they apply a policy file | who it changes prints first, then the custom policy is created or its next version saved, held to every check Studio is; a file naming a built-in policy is refused, naming it |
| AC-04.16 | A saved version | the next step of any run is checked | it is checked against the new version; a step already done keeps the version it ran under, named in *How it got here* |
| AC-04.17 | A person brings in an import or a Team pack holding an Access Policy file | it lands | the policy reads *Waiting to apply* and decides nothing; *Apply* by a person without Edit on Access is refused, naming Edit on Access and who can grant it; by a person with it, *Apply* shows who it changes, then saves it |
| AC-04.18 | A second Admin's yes is set on | an Admin saves a policy | the version reads *Waiting for a second Admin* and the version before stays in force; every other Admin finds it in *Needs you*; another Admin's yes puts it in force and History names both; the saver's own *Approve* is refused, naming that another Admin approves |
| AC-04.19 | A second Admin's yes is off — the default | an Admin saves a policy | it is in force at the next check, with no second yes |
| AC-04.20 | Any act that asks for the password again — save a policy, delete one | *Sign in again* opens | it names the act (*Save the policy*), what it will do and the state it returns to; a right password returns there with the result — the version saved, *Waiting for a second Admin* when one is set; a wrong password returns to the same *Sign in again* with the message, and nothing changes |
| AC-04.21 | An Admin | they confirm *Delete* on a custom policy | the agents that lose it were listed first; the policy leaves the list as *Deleted* and History records who and when |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| A policy — its rules | Admin | settings.policies · New | — | settings.policies · Loading | settings.policies | settings.policies · Rule refused | — | settings.policies · Built in |
| A policy — its rules | Operator | — | — | — | — | — | — | settings.policies · No access |
| Sign in again · Save the policy | Admin | — | — | — | access.signin · Sign in again · Save the policy | access.signin · Sign in again · Save the policy · Wrong password | — | — |
| Sign in again · Save the policy | Operator | — | — | — | — | — | — | settings.policies · No access |
| Saved | Admin | — | — | — | settings.policies · Saved | — | — | — |
| Saved | Operator | — | — | — | — | — | — | settings.policies · No access |
| Waiting for a second Admin | Admin | — | — | settings.policies · Loading | settings.policies · Waiting for a second Admin | settings.policies · Approve refused | — | — |
| Waiting for a second Admin | Operator | — | — | — | — | — | — | settings.policies · No access |
| An imported policy file | Admin | — | — | — | settings.policies · Waiting to apply | settings.policies · Rule refused | — | — |
| An imported policy file | Operator | — | — | — | — | — | — | settings.policies · No access |
| Delete a policy | Admin | — | — | — | settings.policies · Delete · Agents that lose it | — | — | — |
| Delete a policy | Operator | — | — | — | — | — | — | settings.policies · No access |
| Deleted | Admin | — | — | — | settings.policies · Deleted | — | — | — |
| Deleted | Operator | — | — | — | — | — | — | settings.policies · No access |
| A policy — History | Admin | — | — | settings.policies · Loading | settings.policies · History | settings.policies · Could not load | — | — |
| A policy — History | Operator | — | — | — | — | — | — | settings.policies · No access |

The *New policy* steps — *1 Start* onward — are drawn in [AC-49](../AC-49-make-a-policy-from-an-access-template/story.md).
