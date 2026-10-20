import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import FileUploadField from './src/shared/components/ui/fields/FileUploadField';

void i18n.use(initReactI18next).init({ lng: 'en', resources: {} });

declare global {
  interface Window {
    __probeLog: string[];
    __openCalls: string[];
    __scenario: () => Promise<string[]>;
  }
}

window.__probeLog = [];
window.__openCalls = [];

function ProbeApp() {
  const [files, setFiles] = useState<File[] | null>(null);
  return (
    <div>
      <FileUploadField
        testId="probe-upload"
        multiple
        value={files}
        onChange={(next) => {
          window.__probeLog.push(`change:${Array.isArray(next) ? next.length : next ? 1 : 0}`);
          setFiles(Array.isArray(next) ? next : next ? [next] : null);
        }}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <I18nextProvider i18n={i18n}>
    <ProbeApp />
  </I18nextProvider>,
);

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function snap(): {
  progress: number | null;
  cards: number;
  names: string[];
  log: string[];
  opens: string[];
} {
  const bar = document.querySelector('[data-testid="probe-upload-progress"]');
  const cards = document.querySelectorAll('[data-testid^="probe-upload-file-"]');
  return {
    progress: bar ? Number(bar.getAttribute('aria-valuenow')) : null,
    cards: cards.length,
    names: [...cards].map((c) => c.querySelector('p')?.textContent ?? ''),
    log: [...window.__probeLog],
    opens: [...window.__openCalls],
  };
}

function dispatchFiles(names: string[]): void {
  const files = names.map((name) => new File([`${name}-content`], name));
  const input = document.querySelector(
    '[data-testid="probe-upload-input"]',
  ) as HTMLInputElement | null;
  if (!input) throw new Error('input missing');
  // FileList palsu array-like (jsdom tak punya DataTransfer).
  const list = { length: files.length, item: (i: number) => files[i] ?? null };
  files.forEach((f, i) => Object.defineProperty(list, i, { value: f, enumerable: true }));
  Object.defineProperty(input, 'files', { value: list, configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function click(testId: string): void {
  (document.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null)?.click();
}

window.__scenario = async (): Promise<string[]> => {
  const results: string[] = [];
  const check = (cond: boolean, tag: string, extra = ''): void => {
    results.push(`${cond ? 'ok' : 'MISS'} ${tag}${extra ? ` ${extra}` : ''}`);
  };
  let s = snap();
  check(s.cards === 0 && s.progress === null, 'initial-empty', JSON.stringify(s));

  dispatchFiles(['probe-a.txt']);
  let firstProgress = -1;
  let firstCard = -1;
  let progressGone = -1;
  const frames = new Set<number>();
  const t0 = Date.now();
  for (let i = 0; i < 80; i++) {
    await sleep(50);
    s = snap();
    const t = Date.now() - t0;
    if (s.progress !== null) {
      if (firstProgress === -1) firstProgress = t;
      frames.add(s.progress);
    }
    if (s.cards > 0 && firstCard === -1) firstCard = t;
    if (firstProgress !== -1 && s.progress === null && progressGone === -1) progressGone = t;
    if (firstCard !== -1 && progressGone !== -1) break;
  }
  check(firstProgress !== -1, 'progress-shown', `t=${firstProgress}`);
  check(firstCard !== -1, 'card-appended', `t=${firstCard}`);
  check(progressGone !== -1, 'progress-done', `t=${progressGone}`);
  check(firstCard >= progressGone, 'card-after-progress', `card@${firstCard} gone@${progressGone}`);
  check(frames.size >= 3, 'progress-frames', [...frames].join(','));
  check(s.log.length === 1 && s.names[0] === 'probe-a.txt', 'single-change', JSON.stringify(s.log));

  dispatchFiles(['probe-b.txt']);
  await sleep(250);
  s = snap();
  check(s.progress !== null, 'second-progress', JSON.stringify(s.progress));
  dispatchFiles(['probe-c.txt']);
  for (let i = 0; i < 80; i++) {
    await sleep(50);
    s = snap();
    if (s.progress === null && s.cards === 2) break;
  }
  check(s.cards === 2, 'no-append-during-upload', JSON.stringify(s.names));
  check(!s.names.includes('probe-c.txt'), 'intruder-ignored', JSON.stringify(s.names));
  check(s.log.length === 2, 'two-changes', JSON.stringify(s.log));

  try {
    const ids = [...document.querySelectorAll('[data-testid]')].map((el) =>
      el.getAttribute('data-testid'),
    );
    check(ids.includes('probe-upload-view-0'), 'view-btn-exists', JSON.stringify(ids));
    click('probe-upload-view-0');
  } catch (e) {
    check(false, 'view-click-throw', String(e).slice(0, 200));
  }
  await sleep(150);
  s = snap();
  check(s.opens.length === 1 && s.opens[0].startsWith('blob:'), 'view-blob', JSON.stringify(s.opens));

  click('probe-upload-delete-1');
  await sleep(150);
  s = snap();
  check(s.cards === 1 && s.names[0] === 'probe-a.txt', 'delete-removes', JSON.stringify(s.names));

  return results;
};
