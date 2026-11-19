import { Slot } from "radix-ui";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";
import { CheckIcon } from "./icons";

/**
 * Pill button. Press scales to 0.98 in CSS, so it works in server components too.
 *
 * variants
 *  primary    navy CTA: uppercase 700 13 px .04em (spec §2.3). One per screen.
 *  secondary  gray pill, sentence case: the everyday action.
 *  outline    transparent with a line: secondary next to a primary.
 *  ghost      text-weight action inside panels.
 *  attention  orange: only for "needs your attention" (brand book: one accent per screen).
 *  inverse    white on navy / gradient surfaces.
 *  danger     destructive, rare.
 *
 * `state` keeps the label's width while loading (no layout shift) and confirms success.
 * `force` paints a state statically: for /styleguide only.
 */

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "attention" | "inverse" | "danger";
export type ButtonSize = "sm" | "md" | "lg";
export type ForcedState = "hover" | "active" | "focus";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  state?: "idle" | "loading" | "success";
  leading?: ReactNode;
  trailing?: ReactNode;
  asChild?: boolean;
  force?: ForcedState;
  fullWidth?: boolean;
}

const base =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium " +
  "transition-[background-color,color,box-shadow,transform,opacity] duration-150 ease-out " +
  "active:scale-[0.98] data-[force=active]:scale-[0.98] " +
  "data-[force=focus]:outline-2 data-[force=focus]:outline-offset-2 data-[force=focus]:outline-focus " +
  "disabled:active:scale-100";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-navy text-white uppercase font-bold tracking-[0.04em] hover:bg-hover data-[force=hover]:bg-hover " +
    "disabled:bg-mist disabled:text-white",
  secondary:
    "bg-gray text-navy hover:bg-gray-strong data-[force=hover]:bg-gray-strong disabled:text-muted disabled:hover:bg-gray",
  outline:
    "bg-transparent text-navy shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-mist)] hover:bg-gray/60 " +
    "data-[force=hover]:shadow-[inset_0_0_0_1px_var(--color-mist)] data-[force=hover]:bg-gray/60 disabled:text-muted disabled:hover:bg-transparent",
  ghost:
    "bg-transparent text-navy hover:bg-gray data-[force=hover]:bg-gray disabled:text-muted disabled:hover:bg-transparent",
  attention:
    "bg-orange text-white font-bold uppercase tracking-[0.04em] hover:brightness-95 data-[force=hover]:brightness-95 disabled:opacity-50",
  inverse:
    "bg-white text-navy hover:bg-ice data-[force=hover]:bg-ice disabled:opacity-60",
  danger:
    "bg-err text-white hover:brightness-95 data-[force=hover]:brightness-95 disabled:opacity-50",
};

const sizes: Record<ButtonSize, { normal: string; caps: string }> = {
  sm: { normal: "h-9 px-4 text-small", caps: "h-9 px-4 text-caption" },
  md: { normal: "h-11 px-5 text-body", caps: "h-11 px-6 text-small" },
  lg: { normal: "h-[52px] px-6 text-lead", caps: "h-[52px] px-7 text-small" },
};

export function buttonClass({
  variant = "secondary",
  size = "md",
  fullWidth,
  className,
}: Pick<ButtonProps, "variant" | "size" | "fullWidth" | "className">) {
  const caps = variant === "primary" || variant === "attention";
  return cn(base, variants[variant], caps ? sizes[size].caps : sizes[size].normal, fullWidth && "w-full", className);
}

export function Button({
  variant = "secondary",
  size = "md",
  state = "idle",
  leading,
  trailing,
  asChild,
  force,
  fullWidth,
  className,
  children,
  disabled,
  type,
  ...rest
}: ButtonProps) {
  const busy = state === "loading";
  const done = state === "success";
  const Comp = asChild ? Slot.Root : "button";

  if (asChild) {
    return (
      <Comp className={buttonClass({ variant, size, fullWidth, className })} data-force={force} {...rest}>
        {children}
      </Comp>
    );
  }

  return (
    <Comp
      type={type ?? "button"}
      className={buttonClass({ variant, size, fullWidth, className })}
      data-force={force}
      data-state={state}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {/* The label keeps its box while busy so the button never changes width. */}
      <span className={cn("inline-flex items-center gap-2 transition-opacity duration-150", (busy || done) && "opacity-0")}>
        {leading}
        {children}
        {trailing}
      </span>
      {busy && (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner size={16} />
        </span>
      )}
      {done && (
        <span className="absolute inset-0 grid animate-pop-in place-items-center" aria-live="polite">
          <CheckIcon size={18} aria-hidden="true" />
          <span className="sr-only">Done</span>
        </span>
      )}
    </Comp>
  );
}

/** Round icon-only button. Always needs an accessible label. */
export function IconButton({
  label,
  variant = "ghost",
  size = "md",
  className,
  children,
  force,
  ...rest
}: Omit<ButtonProps, "leading" | "trailing" | "asChild" | "state"> & { label: string }) {
  const dim = { sm: "size-8", md: "size-10", lg: "size-12" }[size];
  return (
    <button
      type="button"
      aria-label={label}
      data-force={force}
      className={cn(base, variants[variant], dim, "p-0", className)}
      {...rest}
    >
      {children}
    </button>
  );
}
