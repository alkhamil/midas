interface LoadingOverlayProps {
  /** Teks loading; bisa diubah sesuai kebutuhan. */
  message?: string;
  testId?: string;
}

function LoadingOverlay({ message = 'Please wait a moment...', testId }: LoadingOverlayProps) {
  return (
    <div
      data-testid={testId}
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/30"
    >
      <div className="flex items-center gap-3 rounded-md bg-background px-6 py-4 shadow-xl w-sm">
        <svg
          className="h-10 w-10 shrink-0 animate-spin text-primary"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="text-sm font-medium text-foreground">{message}</span>
      </div>
    </div>
  );
}

export default LoadingOverlay;
