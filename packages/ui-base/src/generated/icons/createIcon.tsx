// Pembuat komponen ikon.
// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan `npx @midas/cli sync` untuk memperbarui.
import type { SVGProps } from 'react';

export type IconStyle = "bold-duotone" | "outline";
export const iconStyles: IconStyle[] = ["bold-duotone", "outline"];
export const defaultIconStyle: IconStyle = "outline";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref' | 'children' | 'dangerouslySetInnerHTML'> {
  /** Gaya ikon dari design system (default "outline"). */
  variant?: IconStyle;
  /** Lebar & tinggi (px atau nilai CSS). Default 24. */
  size?: number | string;
  /** Teks aksesibel; tanpa title ikon dianggap dekoratif (aria-hidden). */
  title?: string;
  testId?: string;
}

type IconBody = { viewBox: string; body: string };
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export function createIcon(name: string, styles: Partial<Record<IconStyle, IconBody>>) {
  const fallback = (styles[defaultIconStyle] ? defaultIconStyle : Object.keys(styles)[0]) as IconStyle;
  function Icon({ variant = defaultIconStyle, size = 24, title, testId, ...rest }: IconProps) {
    const icon = styles[variant] ?? styles[fallback]!;
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={icon.viewBox}
        width={size}
        height={size}
        fill="none"
        role={title ? 'img' : undefined}
        aria-hidden={title ? undefined : true}
        data-icon={name}
        data-testid={testId}
        {...rest}
        dangerouslySetInnerHTML={{ __html: (title ? `<title>${escapeHtml(title)}</title>` : '') + icon.body }}
      />
    );
  }
  Icon.displayName = name;
  Icon.iconName = name;
  Icon.iconStyles = Object.keys(styles) as IconStyle[];
  return Icon;
}
