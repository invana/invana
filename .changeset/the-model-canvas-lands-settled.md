---
"studio": patch
---

The model canvas lands settled (docs/for-developers/modules/connect-and-model/features/model-editor.md ME12).

Opening a model ran its force layout **animated**, so the types drifted into place for ten seconds or more — on a retina canvas the drawing was still moving long after the data had arrived, which reads as a page that never finishes loading. The authoring canvas now runs the same `animate: false` config the read-only one already used: the layout runs to completion, the camera fits once, and the first frame is the final one. Both canvases share one force config rather than two identical copies.
