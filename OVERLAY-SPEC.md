# Overlay System Spec - Figma / Subframe Style

## Goal
Overlay lives in world but NEVER affects auto-layout. Like Figma prototype open-overlay.

## Data Model
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

## Canvas Behavior (Edit Mode)
- Overlay instances live in world but are excluded from layout calculations and document tree.
- Overlay tree is separate from document tree.
- Only peek/show when parent trigger or its descendants are selected (Subframe behavior).
- Position for peek = placeOverlayPos(worldBox(trigger), overlayBox, position, offset).
- Dragging peek updates action.offset, not world x,y.

## Preview Behavior (Live Mode)
- resolveOpenTarget() returns overlayInstanceId as isolated root (x:0,y:0).
- buildScene() builds ONLY that subtree so gap/padding/W/H stay intact.
- Final position is calculated from live DOM rect of trigger, not static world x,y:
  `placeOverlayPos(DOMRect(triggerEl), overlaySize, position, offset)` and rendered via portal to document.body.

## Editing Rules
- Editing overlay instance edits its overrides (per-trigger) - keeps it dynamic.
- Editing main component edits default for all triggers without overrides.
- Overlay has its own layout context, not attached to parent frame layout.

## Implementation Notes
- Filter isOverlay nodes from kids() and runLayout()
- overlayPeek() checks selection to show/hide
- placeOverlayOnCanvas creates instance with isOverlay:true but excluded from layout
- In preview, treat overlay as detached isolated tree
