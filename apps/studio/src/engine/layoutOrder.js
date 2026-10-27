// Child order of an auto layout frame. The canvas uses this as the one source of truth for the order its children are laid out in.

/** Whether a node is a frame that lays its children out (auto layout). */
const isAutoFrame = n => !!n && n.type === 'frame' && !!n.layout && n.layout !== 'none';

/**
 * The order the children of an auto layout frame follow in the flow. A frame imported from Figma stores its children back to front
 * (`layoutFlip`): they are laid out in reverse list order. `kids` = the children in list order. Children of other frames are returned as they are.
 */
export const layoutOrder = (parent, kids) => parent?.layoutFlip && isAutoFrame(parent) ? [...kids].reverse() : kids;
