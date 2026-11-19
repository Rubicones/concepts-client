"use client";

import { useState, type ReactNode } from "react";
import { Dialog as RDialog } from "radix-ui";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { cn } from "@/lib/cn";
import { SPRING, surface } from "@/lib/motion";
import { CloseIcon } from "./icons";

/**
 * Dialog and Sheet on Radix Dialog (focus trap, Esc, scroll lock, labelling),
 * animated with springs. Controlled (`open` + `onOpenChange`) or uncontrolled
 * with a `trigger`.
 */

function useOpenState(open?: boolean, onOpenChange?: (o: boolean) => void) {
  const [inner, setInner] = useState(false);
  const isControlled = open !== undefined;
  return [isControlled ? open : inner, (o: boolean) => (isControlled ? onOpenChange?.(o) : setInner(o))] as const;
}

interface SurfaceProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: string;
  /** One line under the title; for confirmations, the consequence. */
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Hide the title visually (still read by screen readers). */
  hideTitle?: boolean;
  /** Block closing by outside click (irreversible steps in flight). */
  dismissible?: boolean;
  className?: string;
}

const overlayMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: surface,
};

function Header({ title, description, hideTitle }: Pick<SurfaceProps, "title" | "description" | "hideTitle">) {
  return (
    <div className={cn("flex flex-col gap-1.5 pr-10", hideTitle && "sr-only")}>
      <RDialog.Title className="text-title-sm font-semibold">{title}</RDialog.Title>
      {description ? (
        <RDialog.Description className="text-body text-muted">{description}</RDialog.Description>
      ) : (
        <RDialog.Description className="sr-only">{title}</RDialog.Description>
      )}
    </div>
  );
}

function Close() {
  return (
    <RDialog.Close
      aria-label="Close"
      className="absolute right-4 top-4 grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-gray hover:text-navy"
    >
      <CloseIcon size={18} />
    </RDialog.Close>
  );
}

export function Dialog({
  open: openProp,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  hideTitle,
  dismissible = true,
  className,
  size = "md",
}: SurfaceProps & { size?: "sm" | "md" | "lg" | "xl" }) {
  const [open, setOpen] = useOpenState(openProp, onOpenChange);
  const width = { sm: "max-w-[440px]", md: "max-w-[560px]", lg: "max-w-[760px]", xl: "max-w-[1040px]" }[size];
  return (
    <RDialog.Root open={open} onOpenChange={setOpen}>
      {trigger && <RDialog.Trigger asChild>{trigger}</RDialog.Trigger>}
      <AnimatePresence>
        {open && (
          <RDialog.Portal forceMount>
            <RDialog.Overlay asChild forceMount>
              <motion.div {...overlayMotion} className="fixed inset-0 z-50 bg-deep/40 backdrop-blur-[2px]" />
            </RDialog.Overlay>
            <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
              <RDialog.Content
                asChild
                forceMount
                onPointerDownOutside={(e) => !dismissible && e.preventDefault()}
                onEscapeKeyDown={(e) => !dismissible && e.preventDefault()}
              >
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.16 } }}
                  transition={SPRING}
                  className={cn(
                    "pointer-events-auto relative flex max-h-[min(860px,calc(100dvh-32px))] w-full flex-col gap-5 overflow-auto rounded-card bg-white p-6 shadow-sheet sm:p-8",
                    width,
                    className,
                  )}
                >
                  <Header title={title} description={description} hideTitle={hideTitle} />
                  {children}
                  {footer && <div className="mt-1 flex flex-wrap items-center justify-end gap-3">{footer}</div>}
                  {dismissible && <Close />}
                </motion.div>
              </RDialog.Content>
            </div>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  );
}

/**
 * Side sheet (desktop panels: downloads, comments) or bottom sheet (phones).
 * Bottom sheets can be dragged down to dismiss.
 */
export function Sheet({
  open: openProp,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  hideTitle,
  dismissible = true,
  className,
  side = "right",
}: SurfaceProps & { side?: "right" | "bottom" }) {
  const [open, setOpen] = useOpenState(openProp, onOpenChange);
  const bottom = side === "bottom";

  function onDragEnd(_: unknown, info: PanInfo) {
    if (dismissible && (info.offset.y > 120 || info.velocity.y > 600)) setOpen(false);
  }

  return (
    <RDialog.Root open={open} onOpenChange={setOpen}>
      {trigger && <RDialog.Trigger asChild>{trigger}</RDialog.Trigger>}
      <AnimatePresence>
        {open && (
          <RDialog.Portal forceMount>
            <RDialog.Overlay asChild forceMount>
              <motion.div {...overlayMotion} className="fixed inset-0 z-50 bg-deep/30" />
            </RDialog.Overlay>
            <RDialog.Content
              asChild
              forceMount
              onPointerDownOutside={(e) => !dismissible && e.preventDefault()}
              onEscapeKeyDown={(e) => !dismissible && e.preventDefault()}
            >
              <motion.div
                initial={bottom ? { y: "100%" } : { x: "100%" }}
                animate={bottom ? { y: 0 } : { x: 0 }}
                exit={bottom ? { y: "100%" } : { x: "100%" }}
                transition={SPRING}
                drag={bottom ? "y" : false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.6 }}
                onDragEnd={onDragEnd}
                className={cn(
                  "fixed z-50 flex flex-col gap-5 bg-white shadow-sheet",
                  bottom
                    ? "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-card px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3"
                    : "inset-y-2 right-2 w-[min(480px,calc(100vw-16px))] rounded-card p-6 sm:p-8",
                  className,
                )}
              >
                {bottom && <div aria-hidden="true" className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-line" />}
                <Header title={title} description={description} hideTitle={hideTitle} />
                <div className="-mx-1 min-h-0 flex-1 overflow-auto px-1">{children}</div>
                {footer && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">{footer}</div>}
                {dismissible && !bottom && <Close />}
              </motion.div>
            </RDialog.Content>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  );
}

export const DialogClose = RDialog.Close;
