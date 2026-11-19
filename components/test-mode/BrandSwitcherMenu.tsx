"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { Dialog as RDialog } from "radix-ui";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";
import { SPRING, surface } from "@/lib/motion";
import { questionnaireLabel } from "@/lib/client-status";
import type { SwitcherData } from "@/lib/switcher";
import { pickViewer } from "@/app/actions/test-mode";
import { createTestBrand } from "@/app/actions/questionnaire";
import { Avatar, StatusPill } from "@/components/ui/Feedback";
import { Kbd } from "@/components/ui/Tooltip";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { ChevronDownIcon, InfoIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";

/**
 * Test-mode brand switcher (spec §6.1): every client account (agency brands nested)
 * with its questionnaire status, then every Forma brand no account links to.
 * Searchable; ⌘K opens it from anywhere; ↑/↓ + Enter picks.
 */

interface Item {
  value: string;
  label: string;
  section: "Accounts" | "Forma brands";
  sub?: string;
  status?: SwitcherData["accounts"][number]["status"];
}

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function BrandSwitcherMenu({ data, current }: { data: SwitcherData; current: { value: string | null; label: string | null } }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();
  const [picking, setPicking] = useState<string | null>(null);
  const toast = useToast();
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  const items = useMemo<Item[]>(
    () => [
      ...data.accounts.map((a) => ({
        value: a.id,
        label: a.name,
        section: "Accounts" as const,
        sub: a.kind === "agency" ? (a.brands.length ? `Agency · ${a.brands.map((b) => b.name).join(", ")}` : "Agency") : undefined,
        status: a.status,
      })),
      ...data.formaBrands.map((b) => ({ value: `forma:${b.id}`, label: b.name, section: "Forma brands" as const, sub: "Results gallery" })),
    ],
    [data],
  );

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    return q ? items.filter((i) => norm(i.label).includes(q) || (i.sub && norm(i.sub).includes(q))) : items;
  }, [items, query]);

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.code === "KeyK" || e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function pick(item: Item) {
    if (item.value === current.value) {
      setOpen(false);
      return;
    }
    setPicking(item.value);
    startTransition(async () => {
      try {
        await pickViewer(item.value);
      } catch (err) {
        // redirect() resolves the transition by navigating; only real failures land here.
        if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
        toast({ title: "Couldn't switch brands", description: "Try again in a moment.", tone: "err" });
        setPicking(null);
      }
    });
  }

  function newBrand() {
    setPicking("new");
    startTransition(async () => {
      try {
        await createTestBrand();
      } catch (err) {
        if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
        toast({ title: "Couldn't create a test brand", description: "Is the migration applied? See the notice above.", tone: "err" });
        setPicking(null);
      }
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!filtered.length) return;
      setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      const item = filtered[active];
      if (item) pick(item);
    }
  }

  return (
    <RDialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setQuery("");
          setActive(0);
        }
      }}
    >
      <RDialog.Trigger
        className="group inline-flex h-10 min-w-0 max-w-[min(360px,50vw)] items-center gap-2 rounded-full pl-1.5 pr-3 transition-[background-color,transform] duration-150 hover:bg-gray active:scale-[0.98] data-[state=open]:bg-gray"
        aria-label={`Switch brand${current.label ? `, now viewing ${current.label}` : ""}`}
      >
        {current.label ? <Avatar name={current.label} size={28} /> : <span className="grid size-7 place-items-center rounded-full bg-gray text-muted"><SearchIcon size={14} /></span>}
        <span className="truncate text-body font-medium">{current.label ?? "Pick a brand"}</span>
        <ChevronDownIcon size={16} className="shrink-0 text-muted transition-transform duration-150 group-data-[state=open]:rotate-180" />
        <span className="ml-1 hidden items-center gap-0.5 lg:flex">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </RDialog.Trigger>
      <AnimatePresence>
        {open && (
          <RDialog.Portal forceMount>
            <RDialog.Overlay asChild forceMount>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={surface} className="fixed inset-0 z-50 bg-deep/30 backdrop-blur-[2px]" />
            </RDialog.Overlay>
            <RDialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.14 } }}
                transition={SPRING}
                className="fixed left-1/2 top-[12vh] z-50 flex max-h-[70vh] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 flex-col overflow-hidden rounded-card bg-white shadow-sheet"
              >
                <RDialog.Title className="sr-only">Switch brand</RDialog.Title>
                <div className="flex items-center gap-3 border-b border-line px-5">
                  <SearchIcon size={18} className="text-muted" />
                  <input
                    autoFocus
                    role="combobox"
                    aria-expanded="true"
                    aria-controls={listId}
                    aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
                    aria-label="Search brands"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActive(0);
                    }}
                    onKeyDown={onKeyDown}
                    placeholder="Search accounts and Forma brands"
                    className="h-14 flex-1 bg-transparent text-lead outline-none placeholder:text-muted/70"
                  />
                  <Kbd>Esc</Kbd>
                </div>
                {data.notices.length > 0 && (
                  <div className="flex flex-col gap-1 border-b border-line bg-ice px-5 py-3">
                    {data.notices.map((n) => (
                      <p key={n} className="flex items-start gap-2 text-small text-muted">
                        <InfoIcon size={14} className="mt-0.5 shrink-0" />
                        {n}
                      </p>
                    ))}
                  </div>
                )}
                <ul ref={listRef} id={listId} role="listbox" aria-label="Brands" className="min-h-0 flex-1 overflow-auto p-2">
                  {filtered.length === 0 && (
                    <li className="px-4 py-10 text-center text-body text-muted">
                      {items.length ? "Nothing matches. Try another name." : "No brands yet. Accounts and Forma brands will show up here."}
                    </li>
                  )}
                  {filtered.map((item, i) => {
                    const header = i === 0 || filtered[i - 1].section !== item.section ? item.section : null;
                    const isCurrent = item.value === current.value;
                    return (
                      <li key={item.value} role="presentation">
                        {header && <p className="kicker px-3 pb-1.5 pt-3">{header}</p>}
                        <div
                          id={`${listId}-${i}`}
                          role="option"
                          aria-selected={i === active}
                          data-index={i}
                          onMouseMove={() => setActive(i)}
                          onClick={() => pick(item)}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-tile-sm px-3 py-2.5 transition-colors duration-150",
                            i === active && "bg-gray",
                          )}
                        >
                          <Avatar name={item.label} size={32} />
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-body font-medium">
                              {item.label}
                              {isCurrent && <span className="ml-2 text-caption font-normal text-muted">Viewing</span>}
                            </span>
                            {item.sub && <span className="truncate text-caption text-muted">{item.sub}</span>}
                          </div>
                          {pending && picking === item.value ? (
                            <Spinner size={16} />
                          ) : (
                            item.status && <StatusPill {...questionnaireLabel[item.status]} className="h-6 px-2.5 text-caption" />
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-caption text-muted">
                  <button
                    type="button"
                    onClick={newBrand}
                    disabled={pending}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-navy px-3.5 text-small font-semibold text-white transition-[background-color,transform] hover:bg-hover active:scale-[0.98] disabled:opacity-60"
                  >
                    {pending && picking === "new" ? <Spinner size={14} /> : <PlusIcon size={14} />}
                    New brand
                  </button>
                  <span className="hidden items-center gap-1.5 sm:flex">
                    <Kbd>↑</Kbd>
                    <Kbd>↓</Kbd> to move · <Kbd>↵</Kbd> to open
                  </span>
                  <span className="tabular-nums">
                    {data.accounts.length} accounts · {data.formaBrands.length} Forma brands
                  </span>
                </div>
              </motion.div>
            </RDialog.Content>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  );
}
