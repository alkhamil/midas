# Component recipe

- Every template declares a visibility contract: `parts` (each a canvas node in the master and every instance, with `shownWhen` over props; `canvas: false` needs a reason) and `playOnly` (each play-only behaviour with a reason). Static parts are nodes, and Play is a function of the node tree.
- Text parts declare `typography: <role>` in the anatomy or the parts; the role is a `<role>Typography` token of the template, displayed through `typography`. No standalone fontSize or lineHeight variable in a template; a text part is bound to its typography variable, which aliases a Semantic style per Size mode.
- Every element Play emits for a template maps to a node (`data-node-id`); an unmapped visible element fails `test/browser/parity.browser.test.mjs`.
- Before reporting a visual change, run `npm run test:browser --workspace @midas/studio` and look at the screenshots in `.artifacts/`; the canvas is the reference.
