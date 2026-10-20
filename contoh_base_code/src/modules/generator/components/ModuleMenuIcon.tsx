import { Database, icons } from 'lucide-react';

const FALLBACK_NAME = 'Database';

/** Daftar nama ikon lucide-react yang bisa dipilih (diurut abjad). */
export const LUCIDE_ICON_NAMES: readonly string[] = Object.keys(icons).sort((a, b) =>
  a.localeCompare(b),
);

/** Cek nama ikon dikenal (untuk sanitasi sebelum emit kode). */
export function isKnownLucideIcon(name: string): boolean {
  return Object.hasOwn(icons, name);
}

interface ModuleMenuIconProps {
  name?: string | null;
  className?: string;
}

/** Ikon menu modul dari nama lucide; fallback `Database` bila tak dikenal. */
function ModuleMenuIcon({ name, className }: ModuleMenuIconProps) {
  const key = name?.trim() ?? '';
  const Known = (isKnownLucideIcon(key) ? icons[key as keyof typeof icons] : Database) as typeof Database;
  return <Known className={className} />;
}

export default ModuleMenuIcon;
export { FALLBACK_NAME as MODULE_MENU_ICON_FALLBACK };
