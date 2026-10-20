import { useTranslation } from 'react-i18next';
import { Button, Card, TextField } from '../../../shared/components/ui';
import { ThemeSettingsPanel } from '../../../shared/theme';
import { useAppSettings } from '../store';
import { BRAND_ICONS, BrandIcon } from '../brandIcons';

/** Halaman Pengaturan: aplikasi (nama + brand icon sidebar) dan thema. */
function SettingsPage() {
  const { t } = useTranslation();
  const { appName, brandIcon, updateSettings, resetSettings } = useAppSettings();

  return (
    <div className="page-padding flex flex-col section-gap">
      <Card testId="settings-application" title={t('settings.application')}>
        <p className="mb-3 text-sm text-muted-foreground">{t('settings.applicationDesc')}</p>
        <div className="flex flex-col field-gap">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              {t('settings.appName')}
            </label>
            <TextField
              data-testid="settings-app-name"
              value={appName}
              maxLength={40}
              placeholder={t('settings.appNamePlaceholder')}
              onChange={(e) => {
                const next = e.target.value;
                updateSettings({ appName: next.trim() ? next : 'App' });
              }}
            />
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-foreground">{t('settings.brandIcon')}</p>
            <div className="flex flex-wrap gap-2">
              {BRAND_ICONS.map(({ name, Icon }) => {
                const active = brandIcon === name;
                return (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    aria-label={name}
                    aria-pressed={active}
                    data-testid={`settings-brand-${name}`}
                    onClick={() => updateSettings({ brandIcon: name })}
                    className={[
                      'flex h-11 w-11 items-center justify-center rounded-lg border transition-colors',
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-foreground hover:bg-muted',
                    ].join(' ')}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <BrandIcon name={brandIcon} className="h-4 w-4 text-primary" />
              {appName}
            </p>
          </div>
        </div>
      </Card>

      <Card testId="settings-theme" title={t('settings.theme')}>
        <ThemeSettingsPanel testId="settings-theme-panel" />
      </Card>

      <div>
        <Button
          variant="secondary"
          testId="settings-reset"
          onClick={resetSettings}
        >
          {t('settings.reset')}
        </Button>
      </div>
    </div>
  );
}

export default SettingsPage;
