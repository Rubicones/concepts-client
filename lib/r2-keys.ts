/**
 * R2 key layout (contract §4.2). Pure, so it is shared by server code and tests.
 *   clients/<accountId>/files/<fileId>/<safe-name>   client uploads
 *   deliveries/<deliveryId>/exports/<file>           final exports (written by Forma)
 *   projects/<project>/<file>                        Forma creatives (read via the player origin)
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** A file name that is safe as one key segment: no separators, no dot-files, ≤ 120 chars, extension kept. */
export function safeName(name: string): string {
  const base = String(name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[\\/]/)
    .pop()!
    .trim();
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) : "";
  const cleanStem =
    stem
      .replace(/[^A-Za-z0-9._ -]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, 100) || "file";
  return ext ? `${cleanStem}.${ext}` : cleanStem;
}

function assertUuid(label: string, v: string) {
  if (!isUuid(v)) throw new Error(`Invalid ${label}`);
}

export function clientFileKey(accountId: string, fileId: string, name: string): string {
  assertUuid("account id", accountId);
  assertUuid("file id", fileId);
  return `clients/${accountId}/files/${fileId}/${safeName(name)}`;
}

export function deliveryExportKey(deliveryId: string, file: string): string {
  assertUuid("delivery id", deliveryId);
  return `deliveries/${deliveryId}/exports/${safeName(file)}`;
}

/** `projects/<project>/<rel>` for a player path segment list; rejects traversal and dot-files. */
export function projectObjectKey(project: string, rel: string[]): string | null {
  if (!isUuid(project) || !rel.length) return null;
  for (const seg of rel) {
    if (!seg || seg === "." || seg === ".." || seg.startsWith(".") || /[\\\0]/.test(seg)) return null;
  }
  return `projects/${project}/${rel.join("/")}`;
}
