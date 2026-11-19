"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatInfo, language } from "@/lib/forma-constants";
import {
  cell,
  expectedExports,
  fileKey,
  mergeExports,
  matchingPreset,
  nameSegment,
  presetSelection,
  selectFiles,
  shapeOf,
  summary,
  toggleIn,
  toggleLine,
  type ExportFile,
  type FileType,
  type Preset,
  type Selection,
} from "@/campaign/final";
import type { FinalSnapshot } from "@/campaign/types";
import { Button } from "@/components/ui/Button";
import { Chip, ChipGroup } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Dialog";
import { ProgressBar } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { CheckIcon, DownloadIcon } from "@/components/ui/icons";
import { FormatGlyph } from "@/components/player/FormatChip";
import { useMediaQuery } from "@/components/review/useComments";
import { useZipDownload } from "./useZipDownload";

const TYPE_LABEL: Record<FileType, string> = { mp4: "MP4 video", webm: "WebM video", gif: "GIF", png: "PNG still", jpg: "JPG still" };

/**
 * The download panel (spec §6.8): presets first, the formats × languages matrix
 * to fine-tune, lengths and file types (videos and stills), a live summary, then
 * one click. The whole shape comes from the final, so every filter is there
 * before Forma has rendered a single file; only ready files download.
 * Without a campaign (test-mode gallery) it is a preview: everything but the download.
 */
export function DownloadPanel({
  campaignId,
  final,
  exports,
  brandName,
  campaignName,
}: {
  /** Omit for a preview (no delivery, nothing to download yet). */
  campaignId?: string;
  final: Pick<FinalSnapshot, "kind" | "formats" | "langs" | "lengths">;
  exports: ExportFile[];
  brandName: string;
  campaignName: string;
}) {
  const wide = useMediaQuery("(min-width: 640px)");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const files = mergeExports(expectedExports(final), exports);
  const shape = shapeOf(files, { formats: final.formats, langs: final.langs });
  const ready = files.filter((f) => f.status === "ready");
  const preview = !campaignId;
  const [sel, setSel] = useState<Selection>(() => presetSelection(shape, { kind: "everything" }));
  const [chooser, setChooser] = useState<"format" | "lang" | null>(null);
  const { progress, start, cancel } = useZipDownload(campaignId ?? "");

  const chosen = selectFiles(files, sel);
  const chosenReady = chosen.filter((f) => f.status === "ready");
  const chosenWaiting = chosen.length - chosenReady.length;
  const preset = matchingPreset(shape, sel);
  const busy = progress !== null;

  function applyPreset(p: Preset) {
    setSel(presetSelection(shape, p));
  }

  async function download() {
    const zipName = `${nameSegment(brandName, "Brand")}_${nameSegment(campaignName, "Campaign")}.zip`;
    const r = await start(chosenReady.map(fileKey), zipName);
    if (!r.ok) {
      if (!r.cancelled) toast({ title: r.error, tone: "err" });
      else if (r.error === "") toast({ title: "Download cancelled", tone: "info", duration: 2500 });
      return;
    }
    if (r.failed.length) {
      toast({ title: `${r.failed.length} file${r.failed.length === 1 ? "" : "s"} couldn't be added`, description: r.failed.slice(0, 4).join(", "), tone: "err", duration: 9000 });
    } else if (chosenReady.length > 1) {
      toast({ title: "Download ready", tone: "ok" });
    }
  }

  const label = chosenReady.length === 0 ? "Download" : chosenReady.length === 1 ? "Download file" : `Download ${chosenReady.length} files (ZIP)`;
  const summaryLine = [chosenReady.length ? summary(chosenReady) : chosen.length ? `${chosen.length} file${chosen.length === 1 ? "" : "s"}` : "Nothing selected", chosenWaiting && chosenReady.length ? `${chosenWaiting} still being prepared` : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !busy && setOpen(o)}
      dismissible={!busy}
      side={wide ? "right" : "bottom"}
      trigger={
        <Button leading={<DownloadIcon size={16} />} variant="primary">
          Download
        </Button>
      }
      title="Download"
      description="Pick what you need. Files are named for upload, by format."
      className="sm:!w-[min(560px,calc(100vw-16px))]"
      footer={
        progress ? (
            <div className="flex w-full flex-col gap-2" aria-live="polite">
              <div className="flex items-center justify-between gap-3 text-small">
                <span className="truncate text-muted">
                  {progress.file ? `Adding ${progress.file}` : "Preparing…"} · {Math.min(progress.index + 1, progress.count)}/{progress.count}
                </span>
                <Button size="sm" variant="ghost" onClick={cancel}>
                  Cancel
                </Button>
              </div>
              <ProgressBar value={progress.value} label="Download progress" />
            </div>
        ) : (
          <>
            <p className="mr-auto text-small tabular-nums text-muted" aria-live="polite">
              {summaryLine}
            </p>
            <Button disabled={preview || !chosenReady.length} onClick={() => void download()} leading={<DownloadIcon size={16} />}>
              {label}
            </Button>
          </>
        )
      }
    >
      {
        <div className={cn("flex flex-col gap-6 transition-opacity", busy && "pointer-events-none opacity-60")}>
          {preview ? (
            <p className="rounded-tile-sm bg-ice p-3 text-small">
              <span className="font-semibold">Preview.</span> This is the panel the client gets. Files download here once the final is delivered and Forma has rendered them.
            </p>
          ) : !ready.length ? (
            <Preparing waiting={files.length} />
          ) : ready.length < files.length ? (
            <p className="rounded-tile-sm bg-ice p-3 text-small">
              {files.length - ready.length} of {files.length} files are still being prepared. You can download the rest now; the others appear here when ready.
            </p>
          ) : null}

          <ChipGroup label="Start from">
            <Chip noCheck selected={preset?.kind === "everything"} onClick={() => (setChooser(null), applyPreset({ kind: "everything" }))}>
              Everything
            </Chip>
            {shape.formats.length > 1 && (
              <Chip noCheck selected={preset?.kind === "format" || chooser === "format"} onClick={() => setChooser(chooser === "format" ? null : "format")}>
                One format, all languages
              </Chip>
            )}
            {shape.langs.length > 1 && (
              <Chip noCheck selected={preset?.kind === "lang" || chooser === "lang"} onClick={() => setChooser(chooser === "lang" ? null : "lang")}>
                One language, all formats
              </Chip>
            )}
          </ChipGroup>

          {chooser === "format" && (
            <div className="-mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Which format">
              {shape.formats.map((f) => (
                <Chip
                  key={f}
                  size="sm"
                  role="radio"
                  aria-pressed={undefined}
                  noCheck
                  aria-checked={preset?.kind === "format" && preset.format === f}
                  selected={preset?.kind === "format" && preset.format === f}
                  icon={<FormatGlyph format={f} size={14} />}
                  onClick={() => applyPreset({ kind: "format", format: f })}
                >
                  {formatInfo(f).label}
                </Chip>
              ))}
            </div>
          )}
          {chooser === "lang" && (
            <div className="-mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Which language">
              {shape.langs.map((l) => (
                <Chip
                  key={l}
                  size="sm"
                  role="radio"
                  aria-pressed={undefined}
                  noCheck
                  aria-checked={preset?.kind === "lang" && preset.lang === l}
                  selected={preset?.kind === "lang" && preset.lang === l}
                  onClick={() => applyPreset({ kind: "lang", lang: l })}
                  title={language(l).name}
                >
                  {l.toUpperCase()}
                </Chip>
              ))}
            </div>
          )}

          <Matrix shape={shape} sel={sel} onChange={setSel} />

          {shape.lengths.length > 1 && (
            <ChipGroup label="Lengths">
              {shape.lengths.map((n) => (
                <Chip key={n} size="sm" selected={sel.lengths.includes(n)} onSelectedChange={() => setSel((s) => ({ ...s, lengths: toggleIn(s.lengths, n) }))}>
                  {n} s
                </Chip>
              ))}
            </ChipGroup>
          )}
          {shape.types.length > 1 && (
            <ChipGroup label="File types">
              {shape.types.map((t) => (
                <Chip key={t} size="sm" selected={sel.types.includes(t)} onSelectedChange={() => setSel((s) => ({ ...s, types: toggleIn(s.types, t) }))}>
                  {TYPE_LABEL[t]}
                </Chip>
              ))}
            </ChipGroup>
          )}

          <p className="text-caption text-muted">
            Saved as <span className="font-medium text-navy">Brand/Campaign/format/</span> with each file named brand_campaign_format_language_length (stills without the length).
          </p>
        </div>
      }
    </Sheet>
  );
}

function Matrix({ shape, sel, onChange }: { shape: ReturnType<typeof shapeOf>; sel: Selection; onChange: (s: Selection) => void }) {
  const on = new Set(sel.cells);
  const available = [...shape.available];
  const allOn = available.length > 0 && available.every((c) => on.has(c));

  function toggleCell(c: string) {
    const next = new Set(on);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    onChange({ ...sel, cells: [...next] });
  }

  const lineState = (cells: string[]) => {
    const live = cells.filter((c) => shape.available.has(c));
    const count = live.filter((c) => on.has(c)).length;
    return count === 0 ? false : count === live.length ? true : ("mixed" as const);
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="kicker">Formats × languages</span>
      <div className="overflow-x-auto rounded-tile-sm bg-gray p-2">
        <table className="w-full border-separate border-spacing-1 text-small">
          <thead>
            <tr>
              <th scope="col" className="w-0 text-left">
                <MatrixBox
                  label={allOn ? "Clear all" : "Select all"}
                  checked={allOn ? true : sel.cells.length ? "mixed" : false}
                  onToggle={() => onChange({ ...sel, cells: allOn ? [] : available })}
                  wide
                >
                  All
                </MatrixBox>
              </th>
              {shape.langs.map((l) => (
                <th key={l} scope="col">
                  <MatrixBox
                    label={`All formats in ${language(l).name}`}
                    checked={lineState(shape.formats.map((f) => cell(f, l)))}
                    onToggle={() => onChange(toggleLine(shape, sel, { lang: l }))}
                  >
                    {l.toUpperCase()}
                  </MatrixBox>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shape.formats.map((f) => {
              const info = formatInfo(f);
              return (
                <tr key={f}>
                  <th scope="row" className="text-left">
                    <MatrixBox label={`${info.label} ${info.name} in every language`} checked={lineState(shape.langs.map((l) => cell(f, l)))} onToggle={() => onChange(toggleLine(shape, sel, { format: f }))} wide>
                      <FormatGlyph format={f} size={14} />
                      <span className="tabular-nums">{info.label}</span>
                      <span className="hidden truncate font-normal text-muted sm:inline">{info.name}</span>
                    </MatrixBox>
                  </th>
                  {shape.langs.map((l) => {
                    const c = cell(f, l);
                    const exists = shape.available.has(c);
                    const isReady = shape.readyCells.has(c);
                    return (
                      <td key={l} className="text-center">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={on.has(c)}
                          aria-label={`${info.label} in ${language(l).name}`}
                          disabled={!exists}
                          title={!exists ? "Not part of this delivery" : isReady ? undefined : "Being prepared"}
                          onClick={() => toggleCell(c)}
                          className={cn(
                            "mx-auto grid size-11 place-items-center rounded-[10px] sm:size-9 transition-[background-color,transform] duration-150 active:scale-[0.94]",
                            !exists ? "cursor-not-allowed bg-transparent text-mist" : on.has(c) ? (isReady ? "bg-navy text-white" : "bg-navy/45 text-white") : "bg-white text-transparent shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-mist)]",
                          )}
                        >
                          {exists ? <CheckIcon size={15} strokeWidth={2.4} /> : <span aria-hidden="true">–</span>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatrixBox({ label, checked, onToggle, children, wide }: { label: string; checked: boolean | "mixed"; onToggle: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        "inline-flex h-11 w-full items-center gap-1.5 whitespace-nowrap rounded-[10px] px-2.5 font-semibold sm:h-9 transition-colors duration-150",
        wide ? "justify-start" : "justify-center",
        checked === true ? "bg-sky/70 text-navy" : checked === "mixed" ? "bg-sky/35 text-navy" : "text-muted hover:bg-white hover:text-navy",
      )}
    >
      {children}
    </button>
  );
}

function Preparing({ waiting }: { waiting: number }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-tile bg-ice p-6" role="status">
      <span className="grid size-11 place-items-center rounded-full bg-sky text-navy" aria-hidden="true">
        <span className="size-2.5 animate-pulse rounded-full bg-navy motion-reduce:animate-none" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="text-title-sm font-semibold">Your files are being prepared</p>
        <p className="text-body text-muted">
          We render every format and language for upload{waiting ? ` (${waiting} on the way)` : ""}. You&apos;ll get an email when they&apos;re ready. Below is everything that&apos;s coming.
        </p>
      </div>
    </div>
  );
}
