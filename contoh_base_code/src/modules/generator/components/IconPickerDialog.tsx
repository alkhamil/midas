import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, TextField } from '../../../shared/components/ui';
import ModuleMenuIcon, { LUCIDE_ICON_NAMES } from './ModuleMenuIcon';

interface IconPickerDialogProps {
  open: boolean;
  /** Nama ikon terpilih saat ini (null = ikon default). */
  initial: string | null;
  onClose: () => void;
  onSave: (name: string | null) => void;
}

const MAX_SHOWN = 240;

function IconPickerDialog({ open, initial, onClose, onSave }: IconPickerDialogProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(initial);

  const query = search.trim().toLowerCase();
  const matches = useMemo(
    () =>
      query === ''
        ? LUCIDE_ICON_NAMES
        : LUCIDE_ICON_NAMES.filter((name) => name.toLowerCase().includes(query)),
    [query],
  );
  const shown = matches.slice(0, MAX_SHOWN);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('menuIcon.title')}
      maxWidth="lg"
      testId="menu-icon-dialog"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          {selected !== null && (
            <Button
              variant="secondary"
              onClick={() => {
                onSave(null);
                onClose();
              }}
            >
              {t('menuIcon.useDefault')}
            </Button>
          )}
          <Button
            onClick={() => {
              onSave(selected);
              onClose();
            }}
          >
            {t('menuIcon.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col stack-gap">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
            {selected ? (
              <ModuleMenuIcon name={selected} className="h-6 w-6" />
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <TextField
              data-testid="menu-icon-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('menuIcon.searchPlaceholder')}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('menuIcon.countNote', { shown: shown.length, total: matches.length })}
        </p>
        <ul
          data-testid="menu-icon-grid"
          className="grid max-h-96 grid-cols-6 gap-2 overflow-y-auto rounded-lg border border-border bg-surface p-3 sm:grid-cols-8"
        >
          {shown.map((name) => {
            const active = selected === name;
            return (
              <li key={name}>
                <button
                  type="button"
                  title={name}
                  data-testid={`menu-icon-pick-${name}`}
                  onClick={() => setSelected(name)}
                  className={`flex w-full cursor-pointer flex-col items-center gap-1 rounded-md border px-1 py-2 transition-colors ${
                    active
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-transparent text-foreground hover:bg-muted'
                  }`}
                >
                  <ModuleMenuIcon name={name} className="h-5 w-5" />
                  <span className="w-full truncate text-center text-[10px] leading-tight">
                    {name}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {matches.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('menuIcon.noMatch')}</p>
        )}
      </div>
    </Dialog>
  );
}

export default IconPickerDialog;
