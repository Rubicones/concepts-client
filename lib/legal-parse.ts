/** Tiny parser for the legal markdown: front matter, "## " headings, paragraphs, [[agency]]/[[brand]] variants. */

export type LegalDocKey = "nda" | "terms";

export interface LegalBlock {
  kind: "h" | "p";
  text: string;
}

export interface RenderedDoc {
  doc: LegalDocKey;
  version: string;
  title: string;
  agree: string;
  status: string;
  blocks: LegalBlock[];
  hash: string;
}

export function parseLegalDoc(src: string, agency: boolean): Omit<RenderedDoc, "doc" | "version" | "hash"> {
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(src);
  const meta: Record<string, string> = {};
  for (const line of (fm?.[1] ?? "").split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const body = (fm ? src.slice(fm[0].length) : src).replace(/\[\[(agency|brand)\]\]([\s\S]*?)\[\[\/\1\]\]/g, (_, who: string, inner: string) =>
    (who === "agency") === agency ? inner : "",
  );
  const blocks: LegalBlock[] = body
    .split(/\n\s*\n/)
    .map((b) => b.trim().replace(/\s*\n\s*/g, " "))
    .filter(Boolean)
    .map((b) => (b.startsWith("## ") ? { kind: "h" as const, text: b.slice(3).trim() } : { kind: "p" as const, text: b }));
  return { title: meta.title ?? "", agree: meta.agree ?? "I agree", status: meta.status ?? "", blocks };
}
