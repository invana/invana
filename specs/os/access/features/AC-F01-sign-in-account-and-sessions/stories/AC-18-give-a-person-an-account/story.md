---
id: AC-18
title: Give a person an account
feature: AC-F01
status: idea
personas: [admin]
boards: []
---

# AC-18 · Give a person an account

**As** an Admin **I want** to make an account for a person, or set a new password for one who lost theirs,
**so that** only the people I name can sign in, and nobody signs in with a default password.

Tasks: [task.md](task.md) · Feature: [AC-F01](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Make a person's account — email, username, name, password and role — from the command line or, signed in, from the API with the password again; set a new password for an account from the command line | — |
| Operator | — | Making an account through the API is refused, naming the Admin role; the sign-in card reads *Ask your admin for an account* (AC-01.8) |

## Flow

```mermaid
flowchart TD
  a([An Admin at the shell, or signed in]) --> c["Make an account: email · username · name · password · role"]
  c -->|email or username taken| t["Refused, naming which is taken"] --> c
  c -->|username breaks the rules| u["Refused, naming the rule"] --> c
  c -->|password too short| pw["Refused, naming the minimum"] --> c
  c -->|made| ok(["The person signs in (AC-01)"])
  a --> r["Set a new password for an account"]
  r -->|no such account| nf["Says no account has that email or username"]
  r -->|set| rs(["The person signs in with it · their keys keep working · a lock clears"])
  a -->|not an Admin, or with a key| no(["Refused"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AC-18.1 | Someone at the shell | they run `invana users create` with an email, a username, a name and a password | the account is made as an Operator, and the person can sign in with them (AC-01.2) |
| AC-18.2 | An empty deployment | `invana users create --role admin` is run | the first Admin is made; no account exists that the person at the shell did not name, and none has a default password |
| AC-18.3 | An Admin signed in | they make an account through the API, entering their password again | it is made with the role they chose, and History records who made it |
| AC-18.4 | An email or a username already in the deployment | an account is made with it | it is refused, naming which one is taken |
| AC-18.5 | A username that breaks the rules, or a password shorter than the deployment's minimum | an account is made with it | it is refused, naming the rule (AC-02.5 · AC-02.3) |
| AC-18.6 | Someone at the shell | they run `invana users update-password` for an email or a username | the password is set; the person's other sessions end, their keys keep working (AC-02.4) and a lock on their email clears (AC-34.7) |
| AC-18.7 | An email or a username no account has | a new password is set for it | it says no account has it, and changes nothing |
| AC-18.8 | An Operator or a Modeller, or any call made with a key | an account is made through the API | it is refused — making an account is an Admin's, from a session |

## Screens

No Studio surface: accounts are made from the command line or the API. A service user is made in the Directory
([AC-33](../../../AC-F03-directory/stories/AC-33-make-a-service-user-for-automation/story.md)).

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Make an account | Admin | — | — | — | — | — | — | — |
| Make an account | Operator | — | — | — | — | — | — | — |
