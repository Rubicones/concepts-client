/**
 * Keyframe SVGs are rendered only as images (data: URIs), never inlined as HTML:
 * an <img> SVG cannot run scripts or load anything, so no sanitizer is needed.
 */
export function svgDataUri(svg: string | null | undefined): string | null {
  if (!svg || !/^\s*<svg[\s>]/i.test(svg)) return null;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
