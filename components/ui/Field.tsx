import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { AlertIcon } from "./icons";
import type { ForcedState } from "./Button";

/**
 * Label + control + hint/error. The error keeps its line reserved only when
 * `reserveError` is set, so forms that validate on blur do not jump.
 */
export function Field({
  label,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
  /** Receives the ids to wire aria-describedby and the label. */
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className="flex items-baseline gap-2 text-small font-medium text-navy">
          {label}
          {optional && <span className="text-caption font-normal text-muted">Optional</span>}
        </label>
      )}
      {children({ id, describedBy: [errId, hintId].filter(Boolean).join(" ") || undefined, invalid: Boolean(error) })}
      {error ? (
        <p id={errId} className="flex animate-fade-in items-center gap-1.5 text-small text-err">
          <AlertIcon size={14} />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-small text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const control =
  "w-full rounded-input bg-white px-4 text-body text-navy placeholder:text-muted " +
  "shadow-[inset_0_0_0_1px_var(--color-line)] transition-[box-shadow,background-color] duration-150 ease-out " +
  "hover:shadow-[inset_0_0_0_1px_var(--color-mist)] " +
  "focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_1.5px_var(--color-navy),var(--shadow-ring)] " +
  "data-[force=hover]:shadow-[inset_0_0_0_1px_var(--color-mist)] " +
  "data-[force=focus]:shadow-[inset_0_0_0_1.5px_var(--color-navy),var(--shadow-ring)] " +
  "aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_var(--color-err)] " +
  "disabled:cursor-not-allowed disabled:bg-gray disabled:text-muted disabled:shadow-none " +
  "read-only:bg-gray/50";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  force?: ForcedState;
  leading?: ReactNode;
}

export function Input({ invalid, force, leading, className, ...rest }: InputProps) {
  if (leading) {
    return (
      <div className={cn("relative", className)}>
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">{leading}</span>
        <input aria-invalid={invalid || undefined} data-force={force} className={cn(control, "h-12 pl-11")} {...rest} />
      </div>
    );
  }
  return <input aria-invalid={invalid || undefined} data-force={force} className={cn(control, "h-12", className)} {...rest} />;
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  force?: ForcedState;
  /** Visible lines while empty, and the most it grows to before scrolling. */
  minLines?: number;
  maxLines?: number;
}

/** Grows with its content (field-sizing; falls back to a fixed height where unsupported). */
export function Textarea({ invalid, force, minLines = 3, maxLines = 12, className, style, ...rest }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      data-force={force}
      className={cn(control, "resize-none py-3 leading-[22px] [field-sizing:content]", className)}
      style={{ minHeight: `calc(${minLines} * 22px + 24px)`, maxHeight: `calc(${maxLines} * 22px + 24px)`, ...style }}
      {...rest}
    />
  );
}
