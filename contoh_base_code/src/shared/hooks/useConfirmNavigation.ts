import { useEffect } from 'react';
import { useBlocker, type Blocker } from 'react-router';

export function useConfirmNavigation(isDirty: boolean): Blocker {
  const blocker = useBlocker(isDirty);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return blocker;
}
