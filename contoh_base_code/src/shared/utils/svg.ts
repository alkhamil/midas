/**
 * Sanitasi kode SVG tempelan (mis. copy dari Figma) agar aman di-render
 * sebagai ikon menu. Browser-only (memakai DOMParser/XMLSerializer).
 */

const MAX_SVG_BYTES = 32 * 1024;

/** Elemen gambar yang diizinkan; selain ini (script/style/foreignObject/…) dibuang. */
const ALLOWED_ELEMENTS = new Set([
  'svg',
  'g',
  'path',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'rect',
  'use',
  'defs',
  'clipPath',
  'mask',
  'linearGradient',
  'radialGradient',
  'stop',
  'pattern',
  'symbol',
  'title',
  'desc',
  'text',
  'tspan',
]);

function stripDangerousAttributes(element: Element): void {
  // Mundur: NamedNodeMap live, hapus saat iterasi maju akan melewatkan atribut.
  for (let i = element.attributes.length - 1; i >= 0; i -= 1) {
    const attr = element.attributes[i];
    const name = attr.name.toLowerCase();
    // Event handler (onclick, onload, …) + URL javascript: + style inline.
    if (
      name.startsWith('on') ||
      name === 'style' ||
      ((name === 'href' || name === 'src' || name.endsWith(':href')) &&
        /^\s*javascript:/i.test(attr.value))
    ) {
      element.removeAttribute(attr.name);
    }
  }
}

/**
 * Parse + bersihkan satu dokumen `<svg>`; kembalikan string SVG aman.
 * Atribut gambar (fill, stroke, viewBox, …) dipertahankan apa adanya.
 * Throw Error bila bukan SVG valid atau melebihi batas ukuran.
 */
export function sanitizeSvg(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) throw new Error('SVG code is required.');
  if (trimmed.length > MAX_SVG_BYTES) throw new Error('SVG code cannot exceed 32 KB.');
  const doc = new DOMParser().parseFromString(trimmed, 'image/svg+xml');
  const root = doc.documentElement;
  if (root.nodeName === 'parsererror' || root.tagName.toLowerCase() !== 'svg') {
    throw new Error('Invalid SVG code: must be a single <svg> element.');
  }
  // querySelectorAll statis: aman hapus elemen saat iterasi.
  for (const element of root.querySelectorAll('*')) {
    if (!ALLOWED_ELEMENTS.has(element.tagName.toLowerCase())) {
      element.remove();
    } else {
      stripDangerousAttributes(element);
    }
  }
  stripDangerousAttributes(root);
  return new XMLSerializer().serializeToString(doc);
}
