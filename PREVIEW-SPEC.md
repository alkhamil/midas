# Preview System Spec - Midas

## 1. Problem Statement
Current live preview translates canvas components to interactive DOM by:
- Cloning nodes into new array
- Manually resolving variable modes, variants, state mappings
- Re-running custom `runLayout` engine
- Re-implementing paint, stroke, mask
- Handling edge cases via `overlayInstanceId`, `visualTarget`, `pinBox`, `retargetIconLayers`

Result: 2 sources of truth (WebGL canvas vs DOM preview). Causes 3 bugs:
1. Preview not full-website (centered gray canvas)
2. Designer-intended state (selected/focused) reset to default
3. Overlay edits in hidden canvas not visible + W/H/gap/padding broken

80% of code is duplicating editor logic.

## 2. Goal
Frame = Component. State = Variable. Preview = Render same frame, state can change.
- No clone
- No second layout engine
- Single source of truth for state

## 3. Architecture Proposal

### 3.1 Split Renderers
- `editor-renderer`: Current WebGPU/WebGL, optimized for drag/zoom/select.
- `preview-renderer`: Pure DOM + native CSS Flexbox. No custom layout engine.

Mapping:
```
editor layout: 'vertical' -> preview: display:flex; flex-direction:column
editor gap: 16 -> preview: gap:16px
editor padding: 16 -> preview: padding:16px
editor layoutSizingH: 'fill' -> preview: flex:1 / width:100%
editor layoutSizingH: 'hug' -> preview: width:fit-content
```
Browser does layout. W/H/gap/padding always correct.

### 3.2 Components as Functions, Not Boxes
Current: `instance -> find variant id -> find component -> clone children -> apply mapping`

Proposed:
```js
function useComponentStyle(componentId, state) {
  return getVariable(`--${componentId}-${state}`);
}

function Button({ id, state, label }) {
  const style = useComponentStyle('Button', state);
  return <div style={style}>{label}</div>
}
```
State mapping (fill, stroke, radius) becomes CSS variables:
```html
<div style="background: var(--button-fill-hover)">
```
Remove `overridesFor()` + `applyMapping()`.

### 3.3 State Management
Current: `runtime Map + canvasState + effStateOf + freshSt`

Proposed: Single global proxy
```js
const states = proxy({}); // { [nodeId]: 'hover' | 'pressed' | 'selected' | ... }

// Initial value = canvasState (designer intent)
states[instanceId] = ctx.canvasState(instanceId) || 'default';

// Interaction
onPointerEnter -> states[id] = 'hover'
onPointerDown -> states[id] = 'pressed'
onClick -> states[id] = 'selected'
```
DOM re-renders reactively. No empty-state hack.

### 3.4 Overlay System - The Right Way

#### Concept: Like Figma + Subframe
Overlay lives in world but does NOT affect layout.

**Data Model:**
```ts
Trigger.action = {
  type: 'open-overlay' | 'open-dropdown' | 'open-popover',
  targetComponentId,
  position: 'bottom-start' | 'top-end' | ...,
  offset: { x, y },
  overlayInstanceId // per-trigger instance, holds overrides
}

OverlayInstance = {
  id,
  isOverlay: true,
  overlayTrigger: triggerId,
  overrides: { text, fill, ... } // dynamic per-trigger, not main component
}
```

**Canvas (Edit Mode):**
- Document Tree: excludes `isOverlay` nodes from `runLayout`
- Overlay Tree: separate layer. `overlayPeek()` shows overlay only when trigger or its descendants are selected.
- Position for peek: `placeOverlayPos(worldBox(trigger), overlayBox, position, offset)`
- Dragging peek updates `action.offset`, not node x/y.

**Preview (Live Mode):**
- `resolveOpenTarget()` returns `overlayInstanceId` as isolated root `x:0,y:0`
- `buildScene(target)` builds ONLY that subtree, so its own auto-layout (gap/padding) stays intact
- Final position calculated from live DOM: `placeOverlayPos(DOMRect(triggerEl), overlaySize, position, offset)` and rendered via portal to `document.body`

This keeps dynamic editing (instance, not main) while fixing layout bugs.

## 4. Implementation Phases

### Phase 1 - Quick Fix (1-2 days, no rewrite)
1. Root preview: `background:#fff`, `display:block`, `width:100%`, `minHeight:100%`
2. State: `canvasState` is initial truth. Runtime only overrides on interaction. Remove `empty:true` hack.
3. Layout: For overlay roots, don't overwrite w/h with host w/h. Preserve `padding, gap, layoutMode` from variant.
4. Overlay: In `openLayer`, call `buildScene(target)` then `renderScene`, instead of direct `renderScene(target)`.

### Phase 2 - Full Rewrite (1 week)
1. Delete `buildScene` cloning. Use `doc.nodes` directly.
2. Replace `ctx.layout(nodes)` with native flex in preview-renderer.
3. Replace `overridesFor + applyMapping` with CSS variables `var(--name)`.
4. Replace `runtime Map` with `proxy` state.
5. Replace hidden-canvas coordinate hack with detached overlay tree + portal positioning.

## 5. Acceptance Criteria
- [ ] Frame selected in canvas opens as full website preview, no gray canvas visible
- [ ] Instance set to `selected` in canvas stays `selected` in preview until interacted
- [ ] Editing overlay instance in hidden canvas reflects immediately in preview
- [ ] W/H/gap/padding of overlay instance matches editor
- [ ] Multiple triggers using same component can have different content (dynamic)
- [ ] Overlay position follows trigger when trigger moves, via `position + offset`

## 6. Non-Goals
- No WebGL in preview
- No re-implementation of auto-layout in preview
- No `overlayInstance` at coordinate 9999,9999

## 7. POC (150 lines)
If needed, create minimal POC:
- 1 frame, 1 button with states default/hover/pressed/selected
- State via `proxy`
- Style via CSS variables
- Dropdown via portal + `placeOverlayPos(DOMRect)`
- No clone, no runLayout, no hidden canvas
