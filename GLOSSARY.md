# Glossary

**Template**: a built-in, data-only description of a React component contract (Ant Design-structured): its anatomy, props, tokens, states and events. Lives in the template registry. Holds no engine logic.

**Schema**: the typed definition of a template. Validated at startup; an invalid schema throws.

**Anatomy**: the named parts (slots) that make up a template's rendered structure, e.g. `iconStart`, `label`, `iconEnd` for Button.

**Slot**: one named position in the anatomy. A slot has a type (text, icon, ...) and may be optional.

**Managed slot**: a slot Behavior inserts or removes on each instance from its props (e.g. `iconStart` from `hasIcon` and `iconPlacement`). Its layer is marked "managed by Behavior".

**Master**: the main component on the canvas. It holds only the binding (template and collections), never per-instance prop values.

**Instance**: a use of a master on the canvas. It holds the prop values (mode selections, booleans, icon choice).

**Binding**: the link from a component to a template (component -> `templateId`), and from each variable-prop to a variable collection (`collectionId`).

**Dimension**: a prop that varies over variable collection modes (e.g. `variant`, `size`). Dimensions are locked by the schema.

**Variable-prop**: a prop whose value is a mode of a variable collection (a dimension). Each one is bound to one collection.

**Non-visual prop**: a prop whose value is a literal, not a variable mode (e.g. `label`, `hasIcon`, `loading`, `disabled`).

**Mode**: one value of a variable collection (e.g. `primary` in a `Variant` collection). A bound collection's modes are the prop's values as-is. Custom modes are allowed.

**Token**: a resolved design value a template reads (e.g. `fontSize`, `gap`, `bg`), taken from the bound collection's variables in the selected modes.

**Behavior version**: the `version` field of the `behavior` data key. Files whose version or shape does not match fail to open with an explicit error.
