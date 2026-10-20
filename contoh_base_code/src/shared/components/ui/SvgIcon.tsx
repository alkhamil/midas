/**
 * Render string SVG (hasil `sanitizeSvg`) sebagai ikon seukuran className.
 * Ukuran mengikuti class (default `h-5 w-5` ala ikon nav); warna/fill
 * mengikuti atribut asli SVG.
 */
interface SvgIconProps {
  svg: string;
  className?: string;
  /** Nama ikon — untuk identifikasi/testing (`data-icon-name`). */
  name?: string;
}

function SvgIcon({ svg, className = 'h-5 w-5', name }: SvgIconProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${className} [&>svg]:h-full [&>svg]:w-full`}
      data-icon-name={name}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export default SvgIcon;
