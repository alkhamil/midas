import { useEffect, useState } from 'react';

export interface RelationOptionLoader {
  (search?: string, page?: number, size?: number): Promise<{ label: string; value: string }[]>;
}

interface RelationLabelProps {
  /** Loader options modul target (paging/relasi). */
  loader: RelationOptionLoader;
  /** Value tersimpan (id). */
  value: string;
  testId?: string;
}

/**
 * Label async untuk value relasi: fetch halaman besar lalu cocokkan value.
 * Gagal/tak ketemu → tampilkan value as-is (tak pernah kosong/crash).
 */
function RelationLabel({ loader, value, testId }: RelationLabelProps) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loader('', 1, 1000)
      .then((options) => {
        if (!alive) return;
        setLabel(options.find((o) => o.value === value)?.label ?? value);
      })
      .catch(() => {
        if (alive) setLabel(value);
      });
    return () => {
      alive = false;
    };
  }, [loader, value]);

  return <span data-testid={testId}>{label ?? value}</span>;
}

export default RelationLabel;
