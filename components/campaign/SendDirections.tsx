"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { DIRECTIONS_PER_DELIVERY } from "@/lib/limits";
import { simFormaBrands, simFormaCampaigns, simFormaDirections, simSendDirections } from "@/app/actions/review";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { CheckIcon } from "@/components/ui/icons";
import { svgDataUri } from "@/components/player/svg";

type Brand = { id: string; name: string };
type Campaign = { id: string; name: string; directionCount: number; archived: boolean };
type Direction = { id: string; title: string; idea: string; format: string; scenes: number; keyframeSvg: string | null };

const select =
  "h-9 w-full rounded-input bg-white/10 px-3 text-small text-white outline-none focus-visible:shadow-ring disabled:opacity-50 [&>option]:text-navy";

/**
 * Test mode: the studio picks a Forma brand → campaign → three directions and
 * sends them. The server rebuilds the snapshot from Forma; nothing from here is trusted.
 */
export function SendDirections({ campaignId, version }: { campaignId: string; version: number }) {
  const router = useRouter();
  const toast = useToast();
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [brandId, setBrandId] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [formaId, setFormaId] = useState("");
  const [directions, setDirections] = useState<Direction[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [loading, setLoading] = useState<string | null>("brands");
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    void simFormaBrands().then((r) => {
      if (!live) return;
      setLoading(null);
      if (r.ok) setBrands(r.data);
      else toast({ title: r.error, tone: "err" });
    });
    return () => {
      live = false;
    };
  }, [toast]);

  async function pickBrand(id: string) {
    setBrandId(id);
    setFormaId("");
    setCampaigns(null);
    setDirections(null);
    setPicked([]);
    if (!id) return;
    setLoading("campaigns");
    const r = await simFormaCampaigns(id);
    setLoading(null);
    if (r.ok) setCampaigns(r.data);
    else toast({ title: r.error, tone: "err" });
  }

  async function pickCampaign(id: string) {
    setFormaId(id);
    setDirections(null);
    setPicked([]);
    if (!id) return;
    setLoading("directions");
    const r = await simFormaDirections(brandId, id);
    setLoading(null);
    if (!r.ok) return toast({ title: r.error, tone: "err" });
    setDirections(r.data);
    setPicked(r.data.slice(0, DIRECTIONS_PER_DELIVERY).map((d) => d.id));
  }

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < DIRECTIONS_PER_DELIVERY ? [...p, id] : p));
  }

  function send() {
    start(async () => {
      const r = await simSendDirections({ campaignId, version, formaBrandId: brandId, formaCampaignId: formaId, ids: picked, notes: {} });
      if (!r.ok) return toast({ title: r.error, tone: "err" });
      toast({ title: "Directions sent", tone: "ok" });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-tile-sm bg-white/5 p-3">
      <p className="text-caption font-semibold uppercase tracking-[0.06em] text-white/70">Send directions</p>
      <select aria-label="Forma brand" className={select} value={brandId} disabled={!brands} onChange={(e) => void pickBrand(e.target.value)}>
        <option value="">{loading === "brands" ? "Loading brands…" : "Forma brand…"}</option>
        {brands?.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      {brandId && (
        <select aria-label="Forma campaign" className={select} value={formaId} disabled={!campaigns} onChange={(e) => void pickCampaign(e.target.value)}>
          <option value="">{loading === "campaigns" ? "Loading campaigns…" : campaigns?.length === 0 ? "No campaigns with directions" : "Campaign…"}</option>
          {campaigns?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.directionCount}
              {c.archived ? " · archived" : ""}
            </option>
          ))}
        </select>
      )}
      {loading === "directions" && <p className="text-caption text-white/60">Loading directions…</p>}
      {directions && (
        <>
          <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto" aria-label={`Pick ${DIRECTIONS_PER_DELIVERY}`}>
            {directions.map((d) => {
              const on = picked.includes(d.id);
              const src = svgDataUri(d.keyframeSvg);
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(d.id)}
                    className={cn("flex w-full items-center gap-2.5 rounded-input p-1.5 text-left transition-colors", on ? "bg-white/15" : "hover:bg-white/5")}
                  >
                    <span className="relative size-9 shrink-0 overflow-hidden rounded-[10px] bg-white/10">
                      {src && (
                        // eslint-disable-next-line @next/next/no-img-element -- keyframe SVG as an inert image
                        <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-small font-medium">{d.title}</span>
                      <span className="truncate text-caption text-white/60">
                        {d.format}
                        {d.scenes > 1 ? ` · ${d.scenes} scenes` : ""}
                      </span>
                    </span>
                    <span className={cn("grid size-5 place-items-center rounded-full", on ? "bg-sky text-navy" : "bg-white/10")} aria-hidden="true">
                      {on && <CheckIcon size={12} strokeWidth={2.6} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {directions.length < DIRECTIONS_PER_DELIVERY && <p className="text-caption text-white/60">This campaign has fewer than {DIRECTIONS_PER_DELIVERY} directions with previews.</p>}
          <Button size="sm" variant="inverse" disabled={picked.length !== DIRECTIONS_PER_DELIVERY || pending} state={pending ? "loading" : "idle"} onClick={send}>
            Send {picked.length}/{DIRECTIONS_PER_DELIVERY} directions
          </Button>
        </>
      )}
    </div>
  );
}
