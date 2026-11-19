"use client";

import { DropdownMenu } from "radix-ui";
import { Avatar } from "@/components/ui/Feedback";
import { UserIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { Kbd } from "@/components/ui/Tooltip";
import { openShortcuts } from "./Shortcuts";

/** Account menu. Sign-out arrives with auth (spec §11); test mode shows who is being viewed. */
export function AccountMenu({ name, kindLabel }: { name: string | null; kindLabel?: string }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={name ? `Account: ${name}` : "Account"}
        className="grid size-10 place-items-center rounded-full transition-[transform,background-color] duration-150 hover:bg-gray active:scale-[0.96] data-[state=open]:bg-gray"
      >
        {name ? <Avatar name={name} size={32} /> : <UserIcon size={18} />}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-60 animate-pop-in rounded-tile-sm bg-white p-1.5 shadow-pop"
        >
          <div className="px-3 pb-2 pt-2.5">
            <p className="text-body font-semibold">{name ?? "No brand picked"}</p>
            {kindLabel && <p className="text-small text-muted">{kindLabel}</p>}
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item
            onSelect={openShortcuts}
            className="flex h-10 cursor-pointer items-center justify-between gap-3 rounded-input px-3 text-body outline-none data-[highlighted]:bg-gray"
          >
            Keyboard shortcuts <Kbd>?</Kbd>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled
            className={cn(
              "flex h-10 cursor-default items-center rounded-input px-3 text-body outline-none",
              "data-[highlighted]:bg-gray data-[disabled]:text-muted",
            )}
          >
            Sign out · coming with sign-in
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
