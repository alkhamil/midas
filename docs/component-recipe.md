# Component recipe

- Every template declares a visibility contract: `parts` (each a canvas node in the master and every instance, with `shownWhen` over props; `canvas: false` needs a reason) and `playOnly` (each play-only behaviour with a reason). Static parts are nodes, and Play is a function of the node tree.
- Every element Play emits for a template maps to a node (`data-node-id`); an unmapped visible element fails `test/browser/parity.browser.test.mjs`.
- Before reporting a visual change, run `npm run test:browser --workspace @midas/studio` and look at the screenshots in `.artifacts/`; the canvas is the reference.
