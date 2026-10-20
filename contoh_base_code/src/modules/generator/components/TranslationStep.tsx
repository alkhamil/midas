import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, TextField } from '../../../shared/components/ui';
import type { GeneratorConfig, ModuleI18nDict } from '../types';
import { buildModuleLocales, flattenLocale, mergeLocales, unflattenLocale } from '../engine/i18nGenerator';

interface TranslationStepProps {
  config: GeneratorConfig;
  i18n: ModuleI18nDict | undefined;
  onI18nChange: (next: ModuleI18nDict | undefined) => void;
}

/** Bahasa target step ini (sementara: Indonesia). */
const TARGET_LANG = 'id' as const;

function JsonPreview({ title, value, testId }: { title: string; value: string; testId: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1 text-sm font-medium text-foreground">{title}</p>
      <pre
        data-testid={testId}
        className="max-h-96 overflow-auto rounded-lg border border-border bg-surface p-3 font-mono text-xs text-foreground"
      >
        {value}
      </pre>
    </div>
  );
}

function TranslationStep({ config, i18n, onI18nChange }: TranslationStepProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const locales = useMemo(() => {
    try {
      return buildModuleLocales(config);
    } catch {
      return null;
    }
  }, [config]);

  const enFlat = useMemo(() => (locales ? flattenLocale(locales.en) : {}), [locales]);
  const enKeys = useMemo(() => Object.keys(enFlat), [enFlat]);

  // Terjemahan tersimpan (hanya key milik modul ini).
  const storedId = useMemo(() => {
    if (!locales) return {};
    const kept: Record<string, string> = {};
    for (const [key, value] of Object.entries(i18n?.[TARGET_LANG] ?? {})) {
      if (key === locales.base || key.startsWith(`${locales.base}.`)) kept[key] = value;
    }
    return kept;
  }, [i18n, locales]);

  // Preview id efektif (= yang ditulis Generate-to-repo: en ditimpa terjemahan).
  const effectiveId = useMemo(
    () => (locales ? mergeLocales(locales.en, unflattenLocale(storedId)) : null),
    [locales, storedId],
  );

  const query = search.trim().toLowerCase();
  const visibleKeys = useMemo(
    () =>
      query === ''
        ? enKeys
        : enKeys.filter(
            (key) => key.toLowerCase().includes(query) || enFlat[key]?.toLowerCase().includes(query),
          ),
    [enKeys, enFlat, query],
  );
  const filledCount = useMemo(
    () => enKeys.filter((key) => (storedId[key] ?? '').trim() !== '').length,
    [enKeys, storedId],
  );

  function handleInput(key: string, value: string): void {
    if (!locales) return;
    const next: ModuleI18nDict = { ...i18n };
    const nextId = { ...next[TARGET_LANG] };
    if (value.trim() === '') {
      delete nextId[key];
    } else {
      nextId[key] = value;
    }
    if (Object.keys(nextId).length > 0) {
      next[TARGET_LANG] = nextId;
    } else {
      delete next[TARGET_LANG];
    }
    onI18nChange(next.en || next.id ? next : undefined);
  }

  if (!locales || !effectiveId) {
    return <Alert variant="error" message={t('translation.buildFailed')} />;
  }

  return (
    <div className="flex flex-col stack-gap">
      <Alert variant="info" message={t('translation.manualNote')} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-72">
          <TextField
            data-testid="translation-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('translation.searchPlaceholder')}
          />
        </div>
        <span className="pb-2 text-sm text-muted-foreground">
          {filledCount === enKeys.length && enKeys.length > 0
            ? t('translation.allDone', { count: enKeys.length })
            : t('translation.filled', { filled: filledCount, total: enKeys.length })}
        </span>
      </div>
      <div>
        <p className="mb-1 text-sm font-medium text-foreground">{t('translation.idLabel')}</p>
        <ul className="flex max-h-96 flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-surface p-3">
          {visibleKeys.map((key) => (
            <li key={key} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-xs text-muted-foreground">{key}</span>
                <span className="text-xs text-foreground">{enFlat[key]}</span>
              </div>
              <TextField
                data-testid={`translation-field-${key}`}
                value={storedId[key] ?? ''}
                onChange={(e) => handleInput(key, e.target.value)}
                placeholder={enFlat[key]}
              />
            </li>
          ))}
          {visibleKeys.length === 0 && (
            <li className="text-sm text-muted-foreground">{t('translation.noMatch')}</li>
          )}
        </ul>
      </div>
      <div className="flex flex-col gap-4 lg:flex-row">
        <JsonPreview
          title={t('translation.previewEn')}
          value={JSON.stringify(locales.en, null, 2)}
          testId="translation-en-preview"
        />
        <JsonPreview
          title={t('translation.previewId')}
          value={JSON.stringify(effectiveId, null, 2)}
          testId="translation-id-preview"
        />
      </div>
    </div>
  );
}

export default TranslationStep;
