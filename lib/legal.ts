import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseLegalDoc, type LegalDocKey, type RenderedDoc } from "./legal-parse";

/**
 * NDA and terms, versioned in code (legal/nda.v1.md, legal/terms.v1.md).
 * The signed version and a hash of the exact text the signer saw are stored
 * with each signature, so a later edit never changes what was agreed.
 */

export const CURRENT: Record<LegalDocKey, string> = { nda: "nda.v1", terms: "terms.v1" };

const cache = new Map<string, string>();

async function source(version: string): Promise<string> {
  if (!/^(nda|terms)\.v\d+$/.test(version)) throw new Error("Unknown document version");
  if (!cache.has(version)) cache.set(version, await readFile(path.join(process.cwd(), "legal", `${version}.md`), "utf8"));
  return cache.get(version)!;
}

export async function loadLegalDoc(doc: LegalDocKey, agency: boolean): Promise<RenderedDoc> {
  const version = CURRENT[doc];
  const parsed = parseLegalDoc(await source(version), agency);
  const hash = createHash("sha256")
    .update([version, agency ? "agency" : "brand", parsed.title, ...parsed.blocks.map((b) => `${b.kind}:${b.text}`)].join("\n"))
    .digest("hex");
  return { doc, version, ...parsed, hash };
}

export async function loadLegalDocs(agency: boolean): Promise<Record<LegalDocKey, RenderedDoc>> {
  const [nda, terms] = await Promise.all([loadLegalDoc("nda", agency), loadLegalDoc("terms", agency)]);
  return { nda, terms };
}
