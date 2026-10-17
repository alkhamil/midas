import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { DangerCircleIcon as CircleAlert, FileTextIcon as FileText } from '../../../generated/icons';
import RowActionButton from '../RowActionButton';

interface FileUploadFieldProps {
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  error?: string;
  accept?: string;
  multiple?: boolean;
  value: File | File[] | null;
  onChange: (files: File | File[] | null) => void;
  className?: string;
  testId?: string;
  'data-testid'?: string;
}

const zoneSizeStyles: Record<string, string> = {
  sm: 'p-4 text-xs',
  md: 'p-6 text-sm',
  lg: 'p-8 text-base',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileUploadField({
  size = 'md',
  disabled = false,
  error,
  accept,
  multiple = false,
  value,
  onChange,
  className = '',
  testId,
  'data-testid': dataTestId,
}: FileUploadFieldProps) {
  const { t } = useTranslation();
  const resolvedTestId = dataTestId ?? testId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  // Progress simulasi client-side (mock-only: tanpa upload nyata).
  const [progress, setProgress] = useState<number | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Counter sinkron (updater setState berjalan saat render, jadi tak bisa dipakai deteksi selesai).
  const progressValue = useRef<number>(0);
  // Object URL untuk view file (direvoke saat unmount / kedaluwarsa).
  const objectUrls = useRef<string[]>([]);
  // Label file yang sedang diunggah (kartu baru ditempel setelah progress beres).
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  // Ref nilai terkini agar commit setelah upload tak menghidupkan file yang sempat dihapus.
  const valueRef = useRef(value);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  function startProgress(onDone: () => void) {
    if (progressTimer.current) clearInterval(progressTimer.current);
    progressValue.current = 0;
    setProgress(0);
    progressTimer.current = setInterval(() => {
      const next = progressValue.current + 25;
      if (next >= 100) {
        if (progressTimer.current) clearInterval(progressTimer.current);
        progressTimer.current = null;
        progressValue.current = 0;
        setProgress(null);
        setPendingLabel(null);
        onDone();
        return;
      }
      progressValue.current = next;
      setProgress(next);
    }, 150);
  }

  function handleFiles(fileList: FileList | null) {
    // Abaikan file baru selama upload sebelumnya belum beres.
    if (!fileList || fileList.length === 0 || disabled || progressTimer.current) return;
    const incoming = Array.from(fileList);
    setPendingLabel(
      incoming.length > 1
        ? t('upload.fileCount', { count: incoming.length })
        : (incoming[0]?.name ?? ''),
    );
    startProgress(() => {
      if (multiple) {
        const existing = Array.isArray(valueRef.current) ? valueRef.current : [];
        onChange([...existing, ...incoming]);
      } else {
        const first = incoming[0];
        if (first) onChange(first);
      }
    });
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (!disabled) setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function handleRemove(index?: number) {
    if (multiple && Array.isArray(value) && index !== undefined) {
      const rest = value.filter((_, i) => i !== index);
      onChange(rest.length > 0 ? rest : null);
      return;
    }
    onChange(null);
  }

  function handleView(file: File) {
    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    window.open(url, '_blank', 'noopener');
    // Revoke tertunda agar tab baru sempat memuat; unmount merevoke sisanya.
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
      objectUrls.current = objectUrls.current.filter((u) => u !== url);
    }, 60000);
  }

  const files: File[] = multiple
    ? ((value as File[] | null) ?? [])
    : value
      ? [value as File]
      : [];
  const uploading = progress !== null;

  return (
    <div data-testid={resolvedTestId} className={className}>
      <div
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={[
          'relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors',
          error
            ? 'border-danger'
            : dragging
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-muted-foreground',
          disabled || uploading ? 'cursor-not-allowed bg-muted' : '',
          zoneSizeStyles[size],
        ].join(' ')}
      >
        {error && (
          <span className="absolute top-2 right-3">
            <CircleAlert className="h-3.5 w-3.5" />
          </span>
        )}
        {uploading ? (
          <div className="flex w-full flex-col items-center gap-2">
            <span className="text-foreground">
              {t('upload.uploading', { target: pendingLabel ?? '' })}
            </span>
            <div
              data-testid={resolvedTestId ? `${resolvedTestId}-progress` : undefined}
              className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{progress}%</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-8 w-8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16.5V9.75m0 0l-3 3m3-3l3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
              />
            </svg>
            <span>{t('upload.dropHint')}</span>
          </div>
        )}
      </div>
      <input
        data-testid={resolvedTestId ? `${resolvedTestId}-input` : undefined}
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />
      {files.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          {files.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              data-testid={resolvedTestId ? `${resolvedTestId}-file-${i}` : undefined}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3"
            >
              <FileText className="h-8 w-8 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
              <RowActionButton
                action="view"
                testId={resolvedTestId ? `${resolvedTestId}-view-${i}` : undefined}
                title={t('upload.viewFile', { name: file.name })}
                onClick={() => handleView(file)}
              />
              {!disabled && (
                <RowActionButton
                  action="delete"
                  testId={resolvedTestId ? `${resolvedTestId}-delete-${i}` : undefined}
                  title={t('upload.removeFile', { name: file.name })}
                  onClick={() => handleRemove(multiple ? i : undefined)}
                />
              )}
            </div>
          ))}
        </div>
      )}
      {error && (
        <p
          data-testid={resolvedTestId ? `${resolvedTestId}-error` : undefined}
          className="mt-1 text-xs text-danger"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default FileUploadField;
