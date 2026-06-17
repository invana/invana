---
"invana": patch
---

Fix 500 on login/refresh/me for accounts whose email uses a special-use TLD (e.g. the `hi@invana.local` bootstrap default).

`UserOut.email` was typed `EmailStr`, which re-validated the stored address on every response. `email-validator` rejects reserved/special-use domains like `.local`, so building the response for the default `admin` / `hi@invana.local` superuser raised a validation error → HTTP 500. Because a 500 bypasses the CORS middleware, the browser reported it as a misleading "Origin not allowed by Access-Control-Allow-Origin" error on the sign-in form.

`UserOut.email` is now a plain `str | None` — it is an output DTO serializing an already-validated, already-stored value. Input is still validated by `RegisterRequest` (`EmailStr`); CLI/bootstrap paths trust the operator-supplied address.
