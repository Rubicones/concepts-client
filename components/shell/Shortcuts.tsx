"use client";

import { Fragment, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Dialog } from "@/components/ui/Dialog";
import { Kbd } from "@/components/ui/Tooltip";

/** "?" on any layout: the character, or Shift + the physical "/" key. */
export const isHelpKey = (e: { key: string; code: string; shiftKey: boolean; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean }) =>
  (e.key === "?" || (e.shiftKey && e.code === "Slash")) && !e.metaKey && !e.ctrlKey && !e.altKey;

/** Fired by the account menu (and anything else) to open the sheet. */
export const SHORTCUTS_EVENT = "tc:shortcuts";
export const openShortcuts = () => window.dispatchEvent(new Event(SHORTCUTS_EVENT));

type Row = { keys: string[][]; what: string };
type Group = { id: string; title: string; where: (path: string) => boolean; rows: Row[] };

const isCampaign = (p: string) => p.startsWith("/campaigns/") && p !== "/campaigns/new";

const GROUPS: Group[] = [
  {
    id: "everywhere",
    title: "Everywhere",
    where: () => true,
    rows: [
      { keys: [["?"]], what: "Show these shortcuts" },
      { keys: [["Tab"], ["Shift", "Tab"]], what: "Move between controls" },
      { keys: [["Esc"]], what: "Close a dialog, sheet or menu" },
    ],
  },
  {
    id: "review",
    title: "Reviewing directions",
    where: isCampaign,
    rows: [
      { keys: [["←"], ["→"]], what: "Previous / next direction" },
      { keys: [["1"], ["2"], ["3"]], what: "Jump to a direction" },
      { keys: [["C"]], what: "Comment mode: click the picture to pin a comment" },
      { keys: [["Enter"]], what: "Save a comment" },
      { keys: [["Shift", "Enter"]], what: "New line in a comment" },
      { keys: [["Esc"]], what: "Step back: the comment box, comment mode, then the view" },
      { keys: [["←", "↑", "→", "↓"]], what: "Nudge a focused pin (Shift: bigger steps)" },
    ],
  },
  {
    id: "viewer",
    title: "Watching the final",
    where: isCampaign,
    rows: [
      { keys: [["Space"], ["K"]], what: "Play / pause" },
      { keys: [["←"], ["→"]], what: "One frame back / forward" },
      { keys: [["Shift", "←"], ["Shift", "→"]], what: "One second back / forward" },
      { keys: [["J"], ["L"]], what: "One second back / forward" },
      { keys: [["Home"]], what: "Back to the start" },
      { keys: [["F"]], what: "Fullscreen (one format)" },
    ],
  },
  {
    id: "forms",
    title: "Questionnaire and brief",
    where: (p) => p.startsWith("/questionnaire") || p === "/campaigns/new",
    rows: [
      { keys: [["Enter"]], what: "In a search list: pick the first match" },
      { keys: [["Space"]], what: "Toggle a chip or option" },
    ],
  },
];

/**
 * The keyboard cheat sheet (spec §12, polish). `?` opens it anywhere except while
 * typing. Sections for the current page come first; the rest follow, quieter.
 */
export function Shortcuts({ testMode }: { testMode: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!isHelpKey(e) || e.defaultPrevented || e.repeat) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable=true]")) return;
      e.preventDefault();
      setOpen((o) => !o);
    }
    const onEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(SHORTCUTS_EVENT, onEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(SHORTCUTS_EVENT, onEvent);
    };
  }, []);

  const groups = GROUPS.map((g) =>
    g.id === "everywhere" && testMode ? { ...g, rows: [...g.rows, { keys: [["⌘", "K"]], what: "Switch brand (test mode)" }] } : g,
  );
  const here = groups.filter((g) => g.id !== "everywhere" && g.where(pathname));
  const ordered = [...here, groups[0], ...groups.filter((g) => g.id !== "everywhere" && !here.includes(g))];

  return (
    <Dialog open={open} onOpenChange={setOpen} title="Keyboard shortcuts" description="Ignored while you're typing." size="lg">
      <div className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
        {ordered.map((g) => {
          const current = here.includes(g) || g.id === "everywhere";
          return (
            <section key={g.id} aria-labelledby={`sc-${g.id}`} className={cn("flex flex-col gap-3", !current && "opacity-70")}>
              <h3 id={`sc-${g.id}`} className="kicker">
                {g.title}
                {here.includes(g) && <span className="ml-2 font-medium normal-case tracking-normal text-muted">· this page</span>}
              </h3>
              <dl className="flex flex-col gap-2.5">
                {g.rows.map((r) => (
                  <div key={r.what} className="flex items-start justify-between gap-4">
                    <dt className="text-small">{r.what}</dt>
                    <dd className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                      {r.keys.map((combo, i) => (
                        <Fragment key={i}>
                          {i > 0 && <span className="px-0.5 text-caption text-muted">or</span>}
                          {combo.map((k) => (
                            <Kbd key={k}>{k}</Kbd>
                          ))}
                        </Fragment>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
      </div>
    </Dialog>
  );
}
