---
"invana": minor
---

`invana init` is removed. `invana users create --superuser` creates an install Admin, the first one included, with the same prompts and the same `--non-interactive` flags. Nothing creates an account the operator did not name, and no account has a default password.

`docker compose up` runs a one-off `engine-migrate` container that applies pending migrations before the engine starts. It creates no users.
