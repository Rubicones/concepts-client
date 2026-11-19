"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { simFormaBrands, simFormaCampaigns } from "@/app/actions/review";
import { simFormaFinal, simSendFinal } from "@/app/actions/final";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { svgDataUri } from "@/components/player/svg";

type Brand = { id: string; name: string };
type Campaign = { id: string; name: string; archived: boolean };
type Final = { id: string; title: string; kind: string; formats: string[]; langs: string[]; lengths: number[]; keyframeSvg: string | null };

const select = "h-9 w-full rounded-input bg-white/10 px-3 text-small text-white outline-none focus-visible:shadow-ring disabled:opacity-50 [&>option]:text-navy";

/** Test mode: the studio picks a Forma campaign with a final and sends it. The server rebuilds the snapshot. */
export function SendFinal({ campaignId, version }: { campaignId: string; version: number }) {
  const router = useRouter();
  const toast = useToast();
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [brandId, setBrandId] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [formaId, setFormaId] = useState("");
  const [final, setFinal] = useState<Final | null>(null);
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
    setFinal(null);
    if (!id) return;
    setLoading("campaigns");
    const r = await simFormaCampaigns(id, "final");
    setLoading(null);
    if (r.ok) setCampaigns(r.data);
    else toast({ title: r.error, tone: "err" });
  }

  async function pickCampaign(id: string) {
    setFormaId(id);
    setFinal(null);
    if (!id) return;
    setLoading("final");
    const r = await simFormaFinal(brandId, id);
    setLoading(null);
    if (r.ok) setFinal(r.data);
    else toast({ title: r.error, tone: "err" });
  }

  function send() {
    start(async () => {
      const r = await simSendFinal(campaignId, version, brandId, formaId);
      if (!r.ok) return toast({ title: r.error, tone: "err" });
      toast({ title: "Final sent", tone: "ok" });
      router.refresh();
    });
  }

  const src = svgDataUri(final?.keyframeSvg);

  return (
    <div className="flex flex-col gap-2.5 rounded-tile-sm bg-white/5 p-3">
      <p className="text-caption font-semibold uppercase tracking-[0.06em] text-white/70">Send the final</p>
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
          <option value="">{loading === "campaigns" ? "Loading campaigns…" : campaigns?.length === 0 ? "No campaigns with a final" : "Campaign…"}</option>
          {campaigns?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.archived ? " · archived" : ""}
            </option>
          ))}
        </select>
      )}
      {loading === "final" && <p className="text-caption text-white/60">Loading the final…</p>}
      {final && (
        <>
          <div className="flex items-center gap-2.5 rounded-input bg-white/10 p-1.5">
            <span className="relative size-9 shrink-0 overflow-hidden rounded-[10px] bg-white/10">
              {src && (
                // eslint-disable-next-line @next/next/no-img-element -- keyframe SVG as an inert image
                <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
              )}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-small font-medium">{final.title}</span>
              <span className="truncate text-caption text-white/60">
                {final.formats.join(", ")} · {final.langs.join(", ").toUpperCase()}
                {final.lengths.length ? ` · ${final.lengths.join("/")} s` : ""}
              </span>
            </span>
          </div>
          <Button size="sm" variant="inverse" disabled={pending} state={pending ? "loading" : "idle"} onClick={send}>
            Send final
          </Button>
        </>
      )}
    </div>
  );
}
