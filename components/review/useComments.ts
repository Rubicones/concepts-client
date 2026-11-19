"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { addComment, deleteComment, editComment } from "@/app/actions/review";
import type { CommentView } from "@/campaign/review";
import { useToast } from "@/components/ui/Toast";

export interface NewComment {
  itemId: string;
  scene: string | null;
  format: string | null;
  lang: string | null;
  x: number | null;
  y: number | null;
  body: string;
}

export const isTemp = (id: string) => id.startsWith("tmp-");

/**
 * Draft comments for the open round, saved the moment they are written.
 * Every change shows at once and rolls back with a toast if the server refuses.
 */
export function useComments(initial: CommentView[], deliveryId: string | null) {
  const [items, setItems] = useState(initial);
  const seq = useRef(0);
  const toast = useToast();
  const router = useRouter();

  function fail(error: string, code?: string) {
    if (code === "conflict") {
      toast({ title: error, tone: "err", action: { label: "Refresh", onClick: () => router.refresh() } });
    } else toast({ title: error, tone: "err" });
  }

  async function add(c: NewComment): Promise<boolean> {
    if (!deliveryId) return false;
    const id = `tmp-${++seq.current}`;
    const number = Math.max(0, ...items.filter((x) => x.itemId === c.itemId).map((x) => x.number)) + 1;
    const temp: CommentView = { ...c, id, deliveryId, number, state: "draft", createdAt: new Date().toISOString() };
    setItems((s) => [...s, temp]);
    const r = await addComment({ ...c, deliveryId });
    if (r.ok) {
      setItems((s) => s.map((x) => (x.id === id ? r.data : x)));
      return true;
    }
    setItems((s) => s.filter((x) => x.id !== id));
    fail(r.error, r.code);
    return false;
  }

  async function edit(id: string, patch: { body?: string; x?: number; y?: number }): Promise<boolean> {
    if (isTemp(id)) return false;
    const before = items.find((x) => x.id === id);
    if (!before) return false;
    setItems((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const r = await editComment(id, patch);
    if (r.ok) {
      setItems((s) => s.map((x) => (x.id === id ? r.data : x)));
      return true;
    }
    setItems((s) => s.map((x) => (x.id === id ? before : x)));
    fail(r.error, r.code);
    return false;
  }

  async function remove(id: string): Promise<void> {
    if (isTemp(id)) return;
    const index = items.findIndex((x) => x.id === id);
    if (index < 0) return;
    const before = items[index];
    setItems((s) => s.filter((x) => x.id !== id));
    const r = await deleteComment(id);
    if (!r.ok) {
      setItems((s) => {
        const next = [...s];
        next.splice(Math.min(index, next.length), 0, before);
        return next;
      });
      fail(r.error, r.code);
    }
  }

  return { items, add, edit, remove };
}

/** Matches a media query on the client; false while rendering on the server. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", onChange);
      return () => m.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
