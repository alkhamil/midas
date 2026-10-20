interface FormSkeletonProps {
  /** Jumlah baris field yang ditampilkan (default 6). */
  fields?: number;
  testId?: string;
}

/**
 * Skeleton untuk state loading form Edit/Create — meniru baris FormItem
 * `layout="horizontal"`: label (kiri) + input (kanan).
 */
function FormSkeleton({ fields = 6, testId }: FormSkeletonProps) {
  return (
    <div data-testid={testId} className="space-y-6">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-10 w-70 shrink-0 animate-pulse rounded-lg bg-muted" />
          <div className="h-10 flex-1 animate-pulse rounded-lg bg-muted" />
        </div>
      ))}
    </div>
  );
}

export default FormSkeleton;
