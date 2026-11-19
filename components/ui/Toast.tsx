"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Toast as RToast } from "radix-ui";
import { cn } from "@/lib/cn";
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from "./icons";

/**
 * Toasts: slide in bottom-right (bottom-center on phones), pause on hover,
 * swipe to dismiss, announced politely (errors assertively). F8 focuses them.
 * Errors say how to recover and can carry an action ("Retry").
 */

export type ToastTone = "info" | "ok" | "err";
export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  action?: { label: string; onClick: () => void };
  duration?: number;
}
interface ToastItem extends ToastInput {
  id: number;
  open: boolean;
}

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((t: ToastInput) => {
    const id = nextId++;
    setItems((list) => [...list.slice(-2), { ...t, id, open: true }]);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext value={value}>
      <RToast.Provider swipeDirection="right" duration={5000} label="Notification">
        {children}
        {items.map((t) => (
          <RToast.Root
            key={t.id}
            open={t.open}
            type={t.tone === "err" ? "foreground" : "background"}
            duration={t.duration ?? (t.tone === "err" ? 8000 : 4000)}
            onOpenChange={(open) => {
              if (!open) {
                setItems((list) => list.map((x) => (x.id === t.id ? { ...x, open: false } : x)));
                setTimeout(() => setItems((list) => list.filter((x) => x.id !== t.id)), 240);
              }
            }}
            className={cn(
              "group pointer-events-auto relative flex w-full items-start gap-3 rounded-tile-sm bg-deep p-4 pr-11 text-white shadow-sheet",
              "data-[state=open]:animate-toast-in data-[state=closed]:animate-toast-out",
              "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform",
              "data-[swipe=end]:animate-toast-out",
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full",
                t.tone === "ok" && "bg-ok",
                t.tone === "err" && "bg-err",
                (!t.tone || t.tone === "info") && "bg-white/15",
              )}
              aria-hidden="true"
            >
              {t.tone === "ok" ? <CheckIcon size={14} strokeWidth={2.4} /> : t.tone === "err" ? <AlertIcon size={14} /> : <InfoIcon size={14} />}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <RToast.Title className="text-body font-semibold">{t.title}</RToast.Title>
              {t.description && <RToast.Description className="text-small text-white/75">{t.description}</RToast.Description>}
              {t.action && (
                <RToast.Action altText={t.action.label} asChild>
                  <button
                    type="button"
                    onClick={t.action.onClick}
                    className="mt-2 self-start rounded-full bg-white px-3 py-1.5 text-small font-semibold text-navy transition-transform active:scale-[0.98]"
                  >
                    {t.action.label}
                  </button>
                </RToast.Action>
              )}
            </div>
            <RToast.Close aria-label="Dismiss" className="absolute right-2 top-2 grid size-8 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white">
              <CloseIcon size={14} />
            </RToast.Close>
          </RToast.Root>
        ))}
        <RToast.Viewport className="fixed bottom-0 right-0 z-[100] flex w-full max-w-[420px] flex-col gap-2 p-4 outline-none max-sm:left-1/2 max-sm:-translate-x-1/2" />
      </RToast.Provider>
    </ToastContext>
  );
}
