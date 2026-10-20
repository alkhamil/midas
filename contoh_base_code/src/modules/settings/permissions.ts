/** Permission keys modul Settings. */
export const SettingsPermissions = {
  view: 'settings.view',
} as const;

export type SettingsPermissionKey =
  (typeof SettingsPermissions)[keyof typeof SettingsPermissions];
