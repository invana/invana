---
id: AC-02
title: Keep my account, username and sessions in order
feature: AC-F01
status: idea
personas: [analyst, owner, builder]
boards: [settings.me]
---

# AC-02 · Keep my account, username and sessions in order

**As** a member **I want** my name, password and username — the address my Graphs' links start with — in one place,
and to sign out a device I do not trust **so that** losing a laptop is not a password change and a prayer, and my
links mean something.

Tasks: [task.md](task.md) · Feature: [AC-F01](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Their own account: name, password, username, sign out here or everywhere, delete it | Another person's account is not in Studio |
| Operator | Their own account: name, password, username, sign out here or everywhere, delete it | Another person's account is not in Studio |

## Flow

```mermaid
flowchart TD
  s([Settings › You › Profile and keys]) --> p["Profile: name · email · time zone"]
  p --> pw["Change password"]
  pw --> pv{"Meets the minimum?"}
  pv -->|no| pf["Says the minimum length"]
  pv -->|yes| po(["Changed · every other session ends"])
  p --> u["Username · its rules · when it can next change"]
  u --> uc{"Inside the cooldown?"}
  uc -->|yes| ud["Refused · the date it unlocks"]
  uc -->|no| uv{"Valid and free?"}
  uv -->|no| ur["The rule it broke, or that it is taken"]
  uv -->|yes| uw{"Old links stop working — confirm?"}
  uw -->|yes| ok(["Changed"])
  p --> se["Sign out here · Sign out everywhere"]
  se --> sd(["Signed out · sign in again on the next call"])
  p --> dl["Delete my account · confirm"]
  dl --> gone(["Deleted outright"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AC-02.1 | A signed-in person | they open *Settings › You › Profile and keys* | their name, email and time zone read, with their username, where they are signed in, and their keys (AC-10) |
| AC-02.2 | The profile | the person changes their first or last name | it saves; a first name is required, a last name is not |
| AC-02.3 | A new password shorter than the install's minimum | it is saved | it is refused, saying the minimum length |
| AC-02.4 | A password change | it saves | every other session ends on its next call; the person's keys keep working |
| AC-02.5 | A new username | it breaks a rule — not 2–64 characters, not lowercase letters, digits and single hyphens, a hyphen at either end, or `u` | it is refused, naming the rule |
| AC-02.6 | A new username typed with capitals | it is read | the field shows it folded to lowercase, as it will be saved |
| AC-02.7 | A username already taken on the install | it is saved | it is refused, saying it is taken |
| AC-02.8 | A username changed inside the cooldown | it is saved | it is refused, naming the date it unlocks |
| AC-02.9 | A valid, free username | the person confirms, after being told old links stop working | it changes; new links work at once; old ones are not found and never forward |
| AC-02.10 | A signed-in person | they press *Sign out everywhere* | every device returns to sign-in on its next call |
| AC-02.11 | A signed-in person | they press *Sign out here* | this device returns to sign-in; the others stay signed in |
| AC-02.12 | A session whose short-lived token expired mid-act | the person acts | it is renewed underneath and the act completes |
| AC-02.13 | A retired renewing token | it is used again | it is refused, and History records it (AC-F06) |
| AC-02.14 | A session that cannot be renewed | the person acts | they are told why, sign in again, and return where they were |
| AC-02.15 | A person with a live session | they reach the sign-in page | it says *Restoring your session…* and goes where they were heading — only to an address inside Studio — never asking for the password |
| AC-02.16 | A stored session that is not valid | the sign-in page opens | the stored session is dropped and the sign-in form shows |
| AC-02.17 | A person removed from a Graph while working in it | their next call is made | it is refused, and Studio says their access changed |
| AC-02.18 | A signed-in person | they delete their account, confirming | it is deleted outright; it cannot be done with a key |
| AC-02.19 | A failed sign-in or a sign-up with a used email | the message is read | it never says whether the account exists |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Profile | Admin | settings.me | — | settings.me · Loading | settings.me | settings.me · Could not save | — | — |
| Profile | Operator | settings.me | — | settings.me · Loading | settings.me | settings.me · Could not save | — | — |
| Username | Admin | — | — | — | settings.me · Username | settings.me · Inside the cooldown | — | — |
| Username | Operator | — | — | — | settings.me · Username | settings.me · Inside the cooldown | — | — |
| Password and sessions | Admin | — | — | — | settings.me · Sessions | settings.me · Too short | — | — |
| Password and sessions | Operator | — | — | — | settings.me · Sessions | settings.me · Too short | — | — |
