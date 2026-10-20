import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { setAppLanguage, type AppLanguage } from './index';

/** Bendera Indonesia (merah-putih horizontal). */
function FlagId() {
  return (
    <svg viewBox="0 0 18 12" className="h-full w-full" aria-hidden="true">
      <rect width="18" height="12" fill="#ffffff" />
      <rect width="18" height="6" fill="#e70011" />
    </svg>
  );
}

/** Bendera Inggris/UK yang disederhanakan (Union Jack). */
function FlagEn() {
  return (
    <svg viewBox="0 0 60 30" className="h-full w-full" aria-hidden="true">
      <rect width="60" height="30" fill="#012169" />
      <path d="M0 0L60 30M60 0L0 30" stroke="#ffffff" strokeWidth="6" />
      <path d="M0 0L60 30M60 0L0 30" stroke="#C8102E" strokeWidth="2" />
      <path d="M25 0h10v30H25zM0 10h60v10H0z" fill="#ffffff" />
      <rect x="27" width="6" height="30" fill="#C8102E" />
      <rect y="12" width="60" height="6" fill="#C8102E" />
    </svg>
  );
}

const OPTIONS: { value: AppLanguage; short: string; Flag: () => ReactElement }[] = [
  { value: 'id', short: 'ID', Flag: FlagId },
  { value: 'en', short: 'EN', Flag: FlagEn },
];

/** Switch bahasa custom (bendera ID/EN) — untuk menu dropdown avatar. */
function LanguageSwitch({ testId }: { testId?: string }) {
  const { i18n } = useTranslation();
  const current: AppLanguage = i18n.language?.startsWith('id') ? 'id' : 'en';
  return (
    <div
      data-testid={testId ?? 'language-switch'}
      role="group"
      className="flex shrink-0 items-center rounded-full border border-border bg-muted p-0.5"
    >
      {OPTIONS.map(({ value, short, Flag }) => {
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            data-testid={`${testId ?? 'language-switch'}-${value}`}
            aria-pressed={active}
            onClick={() => {
              if (!active) void setAppLanguage(value);
            }}
            className={[
              'flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
              active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            <span className="inline-flex h-3 w-[18px] shrink-0 overflow-hidden rounded-[3px] ring-1 ring-border/60">
              <Flag />
            </span>
            {short}
          </button>
        );
      })}
    </div>
  );
}

export default LanguageSwitch;
