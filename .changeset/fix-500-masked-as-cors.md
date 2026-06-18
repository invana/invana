---
"invana": patch
---

API: stop unhandled 500s from surfacing as CORS errors in the browser.

When a route raised a non-`HTTPException`, Starlette's outermost
`ServerErrorMiddleware` produced the `500` *above* `CORSMiddleware`, so the
response carried no `Access-Control-Allow-Origin` header. The browser then
discarded it and reported a misleading "blocked by CORS" error, hiding the real
failure. A new `CatchAllExceptionMiddleware` mounted directly beneath CORS now
converts unhandled exceptions into a JSON `500` response, so CORS headers are
applied and the studio sees the true status and body. The exception is still
logged and recorded on its request span.
