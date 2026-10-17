// Ikon berdasarkan nama. Untuk bundle kecil, impor ikon bernama (mis. ArrowLeftIcon) langsung.
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import type { IconProps } from './createIcon';
import { iconRegistry, type IconName } from './registry';

export function Icon({ name, ...props }: IconProps & { name: IconName }) {
  const Component = iconRegistry[name];
  return Component ? <Component {...props} /> : null;
}
