import { clientTitle, type GalleryDirection } from "@/lib/forma-map";
import type { DirectionSnapshot } from "./types";

/**
 * Directions review: pure pieces shared by the server and the UI (spec §5.2, §6.6).
 */

export interface CommentView {
  id: string;
  deliveryId: string;
  itemId: string;
  scene: string | null;
  format: string | null;
  lang: string | null;
  /** 0–1 on the artboard; null for a general comment on the direction. */
  x: number | null;
  y: number | null;
  number: number;
  body: string;
  state: "draft" | "sent" | "resolved";
  createdAt: string;
}

export const MAX_COMMENT = 4000;

export const REBUILD_REASONS = ["Too safe", "Too far from our brand", "Wrong mood", "Not clear what we sell", "Other"];

/**
 * Builds the immutable directions snapshot from Forma's directions: exactly the
 * three the studio picked, in their order, client-worded (no "Native:" prefixes,
 * no pipeline notes).
 */
export function buildDirectionsSnapshot(
  available: GalleryDirection[],
  pickedIds: string[],
  notes: Record<string, string> = {},
): { directions: DirectionSnapshot[] } {
  const ids = [...new Set(pickedIds)];
  if (ids.length !== 3) throw new Error("Pick exactly three directions.");
  const directions = ids.map((id) => {
    const d = available.find((x) => x.id === id);
    if (!d) throw new Error("A picked direction has no preview.");
    if (!/^\/p\/[0-9a-f-]{36}\/[^?#]+$/i.test(d.path)) throw new Error("A picked direction has no valid preview path.");
    const snap: DirectionSnapshot = {
      id: d.id,
      title: clientTitle(d.title) || "Direction",
      idea: clientTitle(d.idea),
      path: d.path,
      format: d.format,
      lang: d.lang,
      scenes: d.scenes,
      keyframeSvg: d.keyframeSvg,
    };
    const note = notes[id]?.trim();
    if (note) snap.studioNote = note.slice(0, 600);
    return snap;
  });
  return { directions };
}

/** Comments of one direction, pins first in their order, then general ones. Display numbers are 1…n, no gaps. */
export function commentsFor(all: CommentView[], itemId: string): { pins: (CommentView & { n: number })[]; general: CommentView[] } {
  const mine = all.filter((c) => c.itemId === itemId).sort((a, b) => a.number - b.number || a.createdAt.localeCompare(b.createdAt));
  const pins = mine.filter((c) => c.x !== null && c.y !== null).map((c, i) => ({ ...c, n: i + 1 }));
  return { pins, general: mine.filter((c) => c.x === null || c.y === null) };
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function countLabel(n: number): string {
  return n === 0 ? "No comments" : `${n} comment${n === 1 ? "" : "s"}`;
}
