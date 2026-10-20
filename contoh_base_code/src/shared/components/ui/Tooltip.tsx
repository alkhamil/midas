import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content?: ReactNode;
  children?: ReactNode;
  placement?: 'top' | 'bottom';
  maxWidth?: number;
  minWidth?: number;
  className?: string;
  testId?: string;
}

interface TooltipPosition {
  right: number;
  top?: number;
  bottom?: number;
}

function Tooltip({
  content,
  children,
  placement = 'top',
  maxWidth = 300,
  minWidth = 255,
  className = '',
  testId,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const show = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        right: window.innerWidth - rect.right - 16,
        ...(placement === 'top'
          ? { bottom: window.innerHeight - rect.top + 8 }
          : { top: rect.bottom + 8 }),
      });
    }
    setVisible(true);
  };

  const hide = () => {
    setVisible(false);
  };

  const handleClick = () => {
    if (visible) {
      hide();
    } else {
      show();
    }
  };

  const isTop = placement === 'top';

  const tooltip =
    visible && content && position ? (
      <div
        role="tooltip"
        data-testid={testId}
        style={{
          maxWidth,
          minWidth,
          right: position.right,
          ...(position.bottom !== undefined ? { bottom: position.bottom } : { top: position.top }),
        }}
        className="fixed right-0 z-999"
      >
        <div className="rounded-lg bg-foreground px-3 py-2 text-left text-xs font-medium leading-4 text-background shadow-[0_4px_6px_-2px_rgba(16,24,40,0.03),0_12px_16px_-4px_rgba(16,24,40,0.08)] break-all">
          {content}
        </div>
        <span
          className={`absolute h-2 w-2 rotate-45 bg-foreground ${
            isTop ? '-bottom-1' : '-top-1'
          } right-4`}
        />
      </div>
    ) : null;

  return (
    <span
      ref={triggerRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onClick={handleClick}
    >
      {children}
      {tooltip && createPortal(tooltip, document.body)}
    </span>
  );
}

export default Tooltip;
