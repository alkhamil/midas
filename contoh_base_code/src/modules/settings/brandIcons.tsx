import {
  Aperture,
  Box,
  Command,
  Database,
  Globe,
  Hexagon,
  Layers,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/** Ikon brand yang bisa dipilih untuk sidebar. */
export const BRAND_ICONS: { name: string; Icon: LucideIcon }[] = [
  { name: 'Box', Icon: Box },
  { name: 'Command', Icon: Command },
  { name: 'Layers', Icon: Layers },
  { name: 'Hexagon', Icon: Hexagon },
  { name: 'Aperture', Icon: Aperture },
  { name: 'Globe', Icon: Globe },
  { name: 'Zap', Icon: Zap },
  { name: 'Database', Icon: Database },
];

export function BrandIcon({ name, className }: { name: string; className?: string }) {
  const found = BRAND_ICONS.find((item) => item.name === name);
  const Icon = found ? found.Icon : Box;
  return <Icon className={className} />;
}
