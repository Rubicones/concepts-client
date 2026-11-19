"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Popover } from "radix-ui";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";
import { feedback } from "@/lib/motion";
import { CheckIcon, CloseIcon, SearchIcon } from "./icons";

/**
 * Multi-select with search (languages, markets). Chosen items show as removable
 * chips inside the field; typing filters; ↑/↓ move, Enter toggles, Backspace on an
 * empty query removes the last chip, Esc closes. Pinned options (e.g. "Worldwide")
 * stay at the top and can be exclusive.
 */
export interface PickOption {
  value: string;
  label: string;
  hint?: string;
  /** Selecting it clears everything else, and selecting anything else clears it. */
  exclusive?: boolean;
  pinned?: boolean;
}

export interface SearchPickProps {
  options: PickOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  max?: number;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  emptyText?: string;
  label?: string;
}

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function SearchPick({
  options,
  value,
  onChange,
  placeholder = "Search…",
  max,
  id,
  invalid,
  describedBy,
  disabled,
  emptyText = "Nothing matches. Try another spelling.",
  label,
}: SearchPickProps) {
  const autoId = useId();
  const inputId = id ?? `${autoId}-input`;
  const listId = `${autoId}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);

  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
  const filtered = useMemo(() => {
    const q = norm(query.trim());
    const list = q ? options.filter((o) => norm(o.label).includes(q) || norm(o.value).includes(q)) : options;
    return [...list.filter((o) => o.pinned), ...list.filter((o) => !o.pinned)];
  }, [options, query]);
  const full = max !== undefined && value.length >= max;

  function toggle(opt: PickOption) {
    const has = value.includes(opt.value);
    if (has) {
      onChange(value.filter((v) => v !== opt.value));
    } else if (opt.exclusive) {
      onChange([opt.value]);
    } else {
      const rest = value.filter((v) => !byValue.get(v)?.exclusive);
      if (max !== undefined && rest.length >= max) return;
      onChange([...rest, opt.value]);
    }
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (!filtered.length) return;
      setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      // IME composition confirms with Enter; never toggle mid-composition.
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      if (open && filtered[active]) toggle(filtered[active]);
      else setOpen(true);
    } else if (e.key === "Backspace" && !query && value.length) {
      onChange(value.slice(0, -1));
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  }

  const activeId = open && filtered[active] ? `${listId}-${filtered[active].value}` : undefined;

  return (
    <Popover.Root open={open && !disabled} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div
          ref={fieldRef}
          onClick={() => {
            if (disabled) return;
            inputRef.current?.focus();
            setOpen(true);
          }}
          aria-invalid={invalid || undefined}
          className={cn(
            "flex min-h-12 w-full cursor-text flex-wrap items-center gap-1.5 rounded-input bg-white py-1.5 pl-3 pr-2",
            "shadow-[inset_0_0_0_1px_var(--color-line)] transition-[box-shadow] duration-150 ease-out hover:shadow-[inset_0_0_0_1px_var(--color-mist)]",
            "focus-within:shadow-[inset_0_0_0_1.5px_var(--color-navy),var(--shadow-ring)]",
            "aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_var(--color-err)]",
            disabled && "cursor-not-allowed bg-gray shadow-none",
          )}
        >
          <SearchIcon size={16} className="ml-1 shrink-0 text-muted" />
          <AnimatePresence initial={false}>
            {value.map((v) => (
              <motion.span
                key={v}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={feedback}
                className="inline-flex h-8 items-center gap-1 rounded-full bg-navy pl-3 pr-1 text-small font-medium text-white"
              >
                {byValue.get(v)?.label ?? v}
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`Remove ${byValue.get(v)?.label ?? v}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(value.filter((x) => x !== v));
                  }}
                  className="grid size-6 place-items-center rounded-full transition-colors hover:bg-hover"
                >
                  <CloseIcon size={12} strokeWidth={2.4} />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
          <input
            ref={inputRef}
            id={inputId}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            aria-describedby={describedBy}
            aria-label={label}
            disabled={disabled}
            value={query}
            placeholder={value.length ? (full ? "" : "Add more…") : placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className="h-8 min-w-[8ch] flex-1 bg-transparent px-1 text-body outline-none placeholder:text-muted"
          />
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            // Clicks inside the field are handled by the field itself.
            if (fieldRef.current?.contains(e.target as Node)) e.preventDefault();
          }}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-64 animate-pop-in rounded-tile-sm bg-white p-1.5 shadow-pop"
        >
          <ul id={listId} role="listbox" aria-multiselectable="true" className="max-h-72 overflow-auto">
            {filtered.length === 0 && <li className="px-3 py-3 text-small text-muted">{emptyText}</li>}
            {filtered.map((opt, i) => {
              const selected = value.includes(opt.value);
              const blocked = !selected && full && !opt.exclusive;
              return (
                <li
                  key={opt.value}
                  id={`${listId}-${opt.value}`}
                  role="option"
                  aria-selected={selected}
                  aria-disabled={blocked || undefined}
                  onMouseMove={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => !blocked && toggle(opt)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-input px-3 py-2.5 text-body transition-colors duration-150",
                    i === active && "bg-gray",
                    blocked && "cursor-not-allowed opacity-40",
                    opt.pinned && i === filtered.filter((o) => o.pinned).length - 1 && "mb-1",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full transition-colors duration-150",
                      selected ? "bg-navy text-white" : "shadow-[inset_0_0_0_1.5px_var(--color-mist)]",
                    )}
                  >
                    {selected && <CheckIcon size={12} strokeWidth={2.6} />}
                  </span>
                  <span className="flex-1">{opt.label}</span>
                  {opt.hint && <span className="text-caption text-muted">{opt.hint}</span>}
                </li>
              );
            })}
          </ul>
          {max !== undefined && (
            <p className="border-t border-line px-3 pb-1 pt-2 text-caption text-muted tabular-nums">
              {value.length} of {max} chosen
            </p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
