import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export interface SelectDropdownPosition {
  top: number;
  left: number;
  width: number;
}

/**
 * Positions a dropdown rendered via a portal at the anchor element's
 * viewport rect, so it is never clipped by an overflow/scroll ancestor
 * (e.g. selects inside a horizontally-scrollable table).
 * Repositions on scroll (capture) and resize while open.
 */
export function useSelectDropdown<T extends HTMLElement>(
  open: boolean,
  anchorRef: RefObject<T | null>,
  minWidth = 224,
  estimatedHeight = 240,
): {
  position: SelectDropdownPosition | null;
  dropdownRef: RefObject<HTMLDivElement | null>;
} {
  const [position, setPosition] = useState<SelectDropdownPosition | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const measuredRef = useRef(false);

  useEffect(() => {
    if (open) measuredRef.current = false;
  }, [open]);

  const update = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dropdownHeight = dropdownRef.current?.offsetHeight ?? estimatedHeight;
    const dropdownAbove = window.innerHeight - rect.bottom < dropdownHeight + 8;
    const top = dropdownAbove ? Math.max(8, rect.top - dropdownHeight) : rect.bottom;
    const next = {
      top,
      left: rect.left,
      width: Math.max(rect.width, minWidth),
    };
    setPosition((prev) =>
      prev && prev.top === next.top && prev.left === next.left && prev.width === next.width
        ? prev
        : next,
    );
  }, [anchorRef, minWidth, estimatedHeight]);

  useEffect(() => {
    // Position is measured from the DOM and must react to open/scroll/resize —
    // this is external-state sync, not React state derived from other state.
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPosition(null);
      return;
    }
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, update]);

  // Re-measure once the portal has rendered so "above" positioning uses the
  // real dropdown height instead of the 240px estimate.
  useEffect(() => {
    if (open && dropdownRef.current && !measuredRef.current) {
      measuredRef.current = true;
      update();
    }
  });

  return { position, dropdownRef };
}
