"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { cn } from "@/lib/cn";
import { pickBrand } from "@/app/actions/campaigns";
import type { BrandOption } from "@/campaign/types";
import { Avatar } from "@/components/ui/Feedback";
import { Spinner } from "@/components/ui/Spinner";
import { CheckIcon, ChevronDownIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";

/** Agencies: which client brand the dashboard shows. Remembered across visits (spec §6.3). */
export function BrandPicker({ brands, active }: { brands: BrandOption[]; active: BrandOption }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="inline-flex h-11 items-center gap-2 rounded-full bg-gray pl-1.5 pr-4 text-body font-medium transition-[background-color,transform] hover:bg-gray-strong active:scale-[0.98] data-[state=open]:bg-gray-strong">
        <Avatar name={active.name} size={32} />
        <span className="max-w-48 truncate">{active.name}</span>
        {pending ? <Spinner size={14} /> : <ChevronDownIcon size={16} className="text-muted" />}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-64 animate-pop-in rounded-tile-sm bg-white p-1.5 shadow-pop">
          <DropdownMenu.Label className="kicker px-3 pb-1 pt-2">Client brands</DropdownMenu.Label>
          {brands.map((b) => (
            <DropdownMenu.Item
              key={b.id}
              onSelect={() =>
                start(async () => {
                  try {
                    await pickBrand(b.id);
                    router.refresh();
                  } catch {
                    toast({ title: "Couldn't switch brands. Try again.", tone: "err" });
                  }
                })
              }
              className={cn("flex h-11 cursor-pointer items-center gap-3 rounded-input px-3 text-body outline-none data-[highlighted]:bg-gray")}
            >
              <Avatar name={b.name} size={26} />
              <span className="flex-1 truncate">{b.name}</span>
              {b.id === active.id && <CheckIcon size={16} />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
