import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { LogOut, Settings } from 'lucide-react';
import { useClickOutside } from '../../hooks';
import LanguageSwitch from '../../i18n/LanguageSwitch';

export interface AvatarUserData {
  name: string;
  roleName?: string;
}

interface AvatarUserProps {
  user: AvatarUserData | null;
  onLogout?: () => void;
  settingsPath?: string;
  settingsLabel?: string;
  logoutLabel?: string;
  testId?: string;
}

function AvatarUser({
  user,
  onLogout,
  settingsPath = '/settings',
  settingsLabel,
  logoutLabel,
  testId,
}: AvatarUserProps) {
  const { t } = useTranslation();
  const resolvedSettingsLabel = settingsLabel ?? t('settings.title');
  const resolvedLogoutLabel = logoutLabel ?? t('auth.logout');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownAbove, setDropdownAbove] = useState(false);
  const dropdownRef = useClickOutside<HTMLDivElement>(
    useCallback(() => setDropdownOpen(false), []),
  );

  const firstName = user?.name.split(' ')[0] ?? 'User';
  const initial = user ? user.name.charAt(0).toUpperCase() : 'U';

  return (
    <div data-testid={testId} className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          if (!dropdownOpen && dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            setDropdownAbove(window.innerHeight - rect.bottom < 200);
          }
          setDropdownOpen(!dropdownOpen);
        }}
        className="flex cursor-pointer items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-muted"
      >
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-tight text-foreground">Hi, {firstName}</p>
          <p className="text-xs leading-tight text-muted-foreground">
            {user?.roleName ?? 'User'}
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
          {initial}
        </div>
      </button>

      {dropdownOpen && (
        <div
          className={[
            'absolute right-0 z-50 w-60 rounded-lg border border-border bg-background py-1 shadow-xl',
            dropdownAbove ? 'bottom-full mb-2' : 'top-full mt-2',
          ].join(' ')}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-base font-bold text-primary">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{user?.name ?? 'User'}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.roleName ?? 'User'}
              </p>
            </div>
          </div>
          <div className="my-1 border-t border-border" />
          <div className="flex items-center justify-between gap-2 px-4 py-2">
            <span className="whitespace-nowrap text-sm text-muted-foreground">{t('auth.language')}</span>
            <LanguageSwitch testId={testId ? `${testId}-language` : undefined} />
          </div>
          <div className="my-1 border-t border-border" />
          <NavLink
            to={settingsPath}
            end
            onClick={() => setDropdownOpen(false)}
            className={({ isActive }) =>
              [
                'flex items-center gap-2 px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted',
                isActive ? 'bg-muted font-medium' : '',
              ].join(' ')
            }
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
            {resolvedSettingsLabel}
          </NavLink>
          {onLogout && (
            <>
              <div className="my-1 border-t border-border" />
              <button
                onClick={onLogout}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
              >
                <LogOut className="h-4 w-4 text-muted-foreground" />
                {resolvedLogoutLabel}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default AvatarUser;
