import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, useToast } from '../../../shared/components/ui';
import type { GeneratedFile, GeneratorConfig } from '../types';

interface OutputPanelProps {
  files: GeneratedFile[];
  config: GeneratorConfig;
  onBack: () => void;
}

function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function OutputPanel({ files, config, onBack }: OutputPanelProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [selectedPath, setSelectedPath] = useState(files[0]?.path ?? '');
  const selected = files.find((file) => file.path === selectedPath) ?? files[0];

  async function handleCopy(): Promise<void> {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.content);
      showToast({ variant: 'success', message: t('generate.copied') });
    } catch {
      showToast({ variant: 'error', message: t('generate.copyFailed') });
    }
  }

  function handleDownload(): void {
    if (!selected) return;
    const filename = selected.path.split('/').pop() ?? 'file.txt';
    downloadTextFile(filename, selected.content);
  }

  function handleExportConfig(): void {
    downloadTextFile(
      `${config.moduleName.toLowerCase() || 'module'}-config.json`,
      JSON.stringify(config, null, 2),
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={onBack}>
          {t('common.back')}
        </Button>
        <span className="text-sm text-muted-foreground">
          {t('generate.filesReady', { count: files.length })}
        </span>
        <span className="flex-1" />
        <Button variant="secondary" onClick={handleExportConfig}>
          Export config (JSON)
        </Button>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-4">
        <ul className="max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-surface p-2">
          {files.map((file) => (
            <li key={file.path}>
              <button
                type="button"
                onClick={() => setSelectedPath(file.path)}
                title={file.path}
                className={[
                  'block w-full truncate rounded-md px-2 py-1.5 text-left font-mono text-xs transition-colors',
                  file.path === selected?.path
                    ? 'bg-primary/15 font-medium text-primary'
                    : 'text-foreground hover:bg-muted',
                ].join(' ')}
              >
                {file.path}
              </button>
            </li>
          ))}
        </ul>

        <div className="min-w-0 rounded-lg border border-border">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2">
            <p className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
              {selected?.path}
            </p>
            <Button size="sm" variant="secondary" onClick={handleCopy}>
              Copy
            </Button>
            <Button size="sm" variant="secondary" onClick={handleDownload}>
              Download
            </Button>
          </div>
          <pre className="max-h-[55vh] overflow-auto p-4 font-mono text-xs leading-relaxed text-foreground">
            {selected?.content}
          </pre>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Download menyimpan per file (nama file saja, tanpa folder). Lihat INTEGRATION.md untuk
        langkah pemasangan modul ke repo.
      </p>
    </div>
  );
}

export default OutputPanel;
