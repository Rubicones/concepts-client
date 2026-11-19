/** Joins class names, skipping falsy values. Put overrides last. */
export function cn(...classes: (string | false | null | undefined | 0)[]): string {
  return classes.filter(Boolean).join(" ");
}
