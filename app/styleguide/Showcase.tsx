"use client";

import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  ArrowRightIcon,
  Avatar,
  Banner,
  Button,
  Chip,
  ChipGroup,
  CloseIcon,
  CountUp,
  Dialog,
  DownloadIcon,
  EmptyState,
  Field,
  IconButton,
  InboxIcon,
  Input,
  Kbd,
  OptionCard,
  OptionCardGroup,
  PlusIcon,
  ProgressBar,
  SearchIcon,
  SearchPick,
  SegmentedControl,
  Sheet,
  Skeleton,
  Spinner,
  StatusPill,
  Tabs,
  Tag,
  Textarea,
  Tooltip,
  useToast,
  type ButtonVariant,
  type ForcedState,
} from "@/components/ui";
import { SaveIndicator, type SaveState } from "@/components/shell/SaveIndicator";
import { campaignLabel, questionnaireLabel } from "@/lib/client-status";
import { fadeUp, stagger } from "@/lib/motion";

/* ------------------------------------------------------------------ */

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 border-t border-line py-10">
      <div className="mb-6 flex flex-col gap-1">
        <h2 id={`${id}-h`} className="text-title-sm font-semibold">
          {title}
        </h2>
        {note && <p className="max-w-2xl text-small text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-3 py-3 sm:grid-cols-[140px_1fr] sm:items-center">
      <span className="kicker">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

const STATES: { label: string; force?: ForcedState; disabled?: boolean; state?: "loading" | "success" }[] = [
  { label: "Default" },
  { label: "Hover", force: "hover" },
  { label: "Pressed", force: "active" },
  { label: "Focus", force: "focus" },
  { label: "Disabled", disabled: true },
  { label: "Loading", state: "loading" },
  { label: "Success", state: "success" },
];

const COLORS: [string, string, string][] = [
  ["navy", "#0C2B3F", "Ink · 25–30%"],
  ["deep", "#081F2E", "Deep navy"],
  ["sky", "#B4E4FA", "Highlight · 10–15%"],
  ["orange", "#FF4F17", "Needs you · 1–3%"],
  ["gray", "#F1F1F1", "Surface"],
  ["muted", "#5A6B78", "Secondary text"],
  ["mist", "#BFD3E0", "Borders, hover"],
  ["line", "#DDE3E8", "Dividers"],
  ["hover", "#1D4A66", "Hover on navy"],
  ["focus", "#2C7BE5", "Focus ring"],
  ["ok", "#1F7A4D", "Success"],
  ["err", "#C8331A", "Error"],
];

const TYPE: [string, string, string][] = [
  ["text-hero", "Scale your content", "56 / 56 · −0.035em · 600"],
  ["text-display", "Three directions to choose from", "40 / 44 · −0.03em · 600"],
  ["text-title", "Morning Light", "28 / 32 · −0.02em · 600"],
  ["text-title-sm", "What we'll make", "20 / 26 · −0.01em · 600"],
  ["text-lead", "We'll take it from here.", "17 / 26 · 400"],
  ["text-body", "Mostly tap, little typing. Your answers save as you go.", "15 / 22 · 400"],
  ["text-small", "Updated 2 hours ago", "13 / 18 · 400–500"],
  ["text-caption", "18 files · 214 MB", "12 / 16 · tabular"],
];

const LANGS = [
  { value: "worldwide", label: "Worldwide", pinned: true, exclusive: true },
  { value: "en", label: "English" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "sr-Latn", label: "Serbian (Latin)" },
  { value: "ru", label: "Russian" },
  { value: "tr", label: "Turkish" },
  { value: "ja", label: "Japanese" },
];

/* ------------------------------------------------------------------ */

export function Showcase() {
  const toast = useToast();
  const [chips, setChips] = useState<string[]>(["Performance ads"]);
  const [kind, setKind] = useState("multi");
  const [langs, setLangs] = useState<string[]>(["en", "de"]);
  const [seg, setSeg] = useState<"wall" | "focus">("wall");
  const [tab, setTab] = useState<"open" | "done">("open");
  const [progress, setProgress] = useState(0.35);
  const [count, setCount] = useState(214);
  const [save, setSave] = useState<SaveState>("saved");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [approving, setApproving] = useState<"idle" | "loading" | "success">("idle");
  const [sheet, setSheet] = useState<"right" | "bottom" | null>(null);
  const [name, setName] = useState("");

  function cycleSave() {
    setSave("saving");
    setTimeout(() => setSave("saved"), 900);
  }

  function approve() {
    setApproving("loading");
    setTimeout(() => {
      setApproving("success");
      setTimeout(() => {
        setConfirmOpen(false);
        setApproving("idle");
        toast({ title: "Direction approved", description: "We'll build the final in every format.", tone: "ok" });
      }, 700);
    }, 1100);
  }

  return (
    <div>
      <nav aria-label="Sections" className="sticky top-16 z-30 -mx-4 mb-2 flex gap-1 overflow-x-auto bg-white/90 px-4 py-3 backdrop-blur sm:mx-0 sm:px-0">
        {["tokens", "type", "buttons", "chips", "fields", "pickers", "overlays", "feedback", "status", "motion"].map((s) => (
          <a key={s} href={`#${s}`} className="shrink-0 rounded-full px-3 py-1.5 text-small capitalize text-muted transition-colors hover:bg-gray hover:text-navy">
            {s}
          </a>
        ))}
      </nav>

      <Section id="tokens" title="Colour, radius, elevation" note="Orange is only for “needs your attention” and the current step. Never decoration.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {COLORS.map(([name, hex, use]) => (
            <div key={name} className="overflow-hidden rounded-tile-sm shadow-[inset_0_0_0_1px_var(--color-line)]">
              <div className="h-20" style={{ background: hex }} />
              <div className="flex flex-col gap-0.5 p-3">
                <span className="text-small font-semibold">{name}</span>
                <span className="text-caption tabular-nums text-muted">{hex}</span>
                <span className="text-caption text-muted">{use}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="hero-gradient flex h-40 items-end rounded-card p-6 text-title-sm font-semibold text-white">Hero gradient</div>
          <div className="light-gradient flex h-40 items-end rounded-card p-6 text-title-sm font-semibold">Light gradient</div>
        </div>
        <div className="mt-6 flex flex-wrap gap-4">
          {[
            ["rounded-card", "Card 32"],
            ["rounded-tile", "Tile 24"],
            ["rounded-tile-sm", "Tile 20"],
            ["rounded-input", "Input 16"],
            ["rounded-tag", "Tag 8"],
            ["rounded-full", "Pill 999"],
          ].map(([r, l]) => (
            <div key={r} className={`grid h-20 w-28 place-items-center bg-gray text-caption text-muted ${r}`}>
              {l}
            </div>
          ))}
          <div className="grid h-20 w-28 place-items-center rounded-tile bg-white text-caption text-muted shadow-pop">Pop</div>
          <div className="grid h-20 w-28 place-items-center rounded-tile bg-white text-caption text-muted shadow-sheet">Sheet</div>
        </div>
      </Section>

      <Section id="type" title="Typography" note="Inter Tight only. Headlines tighten; body never does. Sentence case; caps only for labels and buttons.">
        <div className="flex flex-col divide-y divide-line">
          {TYPE.map(([cls, sample, spec]) => (
            <div key={cls} className="grid gap-2 py-4 sm:grid-cols-[180px_1fr] sm:items-baseline">
              <span className="text-caption text-muted">
                {cls}
                <br />
                {spec}
              </span>
              <span className={`${cls} ${cls.includes("title") || cls.includes("display") || cls.includes("hero") ? "font-semibold" : ""}`}>{sample}</span>
            </div>
          ))}
          <div className="grid gap-2 py-4 sm:grid-cols-[180px_1fr] sm:items-baseline">
            <span className="text-caption text-muted">kicker</span>
            <span className="kicker">How it works</span>
          </div>
        </div>
      </Section>

      <Section id="buttons" title="Buttons" note="One primary per screen. Press scales to 0.98. Loading keeps the width; success confirms in place.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-separate border-spacing-y-2">
            <thead>
              <tr>
                <th className="w-28" />
                {STATES.map((s) => (
                  <th key={s.label} className="kicker pb-2 text-left font-semibold">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(["primary", "secondary", "outline", "ghost", "attention", "inverse", "danger"] as ButtonVariant[]).map((v) => (
                <tr key={v} className={v === "inverse" ? "bg-navy" : undefined}>
                  <td className={`kicker rounded-l-tile-sm py-3 pl-3 ${v === "inverse" ? "text-white/70" : ""}`}>{v}</td>
                  {STATES.map((s, i) => (
                    <td key={s.label} className={i === STATES.length - 1 ? "rounded-r-tile-sm pr-3" : undefined}>
                      <Button variant={v} size="sm" force={s.force} disabled={s.disabled} state={s.state ?? "idle"}>
                        {v === "primary" ? "Send" : v === "attention" ? "Review" : "Continue"}
                      </Button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Row label="Sizes">
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary">Medium</Button>
          <Button variant="primary" size="lg" trailing={<ArrowRightIcon size={16} />}>
            Start a campaign
          </Button>
          <Button size="lg" leading={<PlusIcon size={18} />}>
            New campaign
          </Button>
        </Row>
        <Row label="Icon">
          <Tooltip content="Close">
            <IconButton label="Close"><CloseIcon /></IconButton>
          </Tooltip>
          <IconButton label="Search" variant="secondary"><SearchIcon /></IconButton>
          <IconButton label="Download" variant="primary"><DownloadIcon /></IconButton>
          <IconButton label="Hovered" variant="secondary" force="hover"><SearchIcon /></IconButton>
          <IconButton label="Focused" variant="secondary" force="focus"><SearchIcon /></IconButton>
          <IconButton label="Disabled" variant="secondary" disabled><SearchIcon /></IconButton>
        </Row>
      </Section>

      <Section id="chips" title="Chips, tags, option cards" note="Clickable is a pill; not clickable is a flat 8 px tag. Selection is never colour-only: a check slides in.">
        <ChipGroup label="What do you make" hint="Pick any">
          {["Performance ads", "Social content", "App store screenshots", "Display banners", "Localization"].map((c) => (
            <Chip key={c} selected={chips.includes(c)} onSelectedChange={(on) => setChips(on ? [...chips, c] : chips.filter((x) => x !== c))}>
              {c}
            </Chip>
          ))}
        </ChipGroup>
        <Row label="States">
          <Chip>Default</Chip>
          <Chip force="hover">Hover</Chip>
          <Chip force="active">Pressed</Chip>
          <Chip force="focus">Focus</Chip>
          <Chip selected>Selected</Chip>
          <Chip selected force="hover">Selected hover</Chip>
          <Chip disabled>Disabled</Chip>
          <Chip size="sm" selected>Small</Chip>
        </Row>
        <Row label="Tags">
          <Tag>Draft · for the lawyer</Tag>
          <Tag tone="sky">9:16</Tag>
          <Tag tone="navy">Round 2</Tag>
          <Tag tone="orange">2 questions</Tag>
        </Row>
        <OptionCardGroup label="Kind" className="mt-4 sm:grid-cols-3">
          {[
            ["poster", "Static poster", "One strong frame, every format."],
            ["single", "Single-scene video", "A seamless loop."],
            ["multi", "Multi-scene video", "A short story in scenes."],
          ].map(([v, t, d]) => (
            <OptionCard key={v} selected={kind === v} onSelect={() => setKind(v)} title={t} description={d} media={<div className="aspect-[16/9]" />} />
          ))}
        </OptionCardGroup>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <OptionCard selected={false} onSelect={() => {}} title="Hover" force="hover" />
          <OptionCard selected={false} onSelect={() => {}} title="Focus" force="focus" />
          <OptionCard selected={false} onSelect={() => {}} title="Disabled" disabled />
        </div>
      </Section>

      <Section id="fields" title="Fields" note="Labels above, hints below. Errors say how to fix it and keep what was typed.">
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Campaign name" hint="Only you and our team see this.">
            {(f) => <Input id={f.id} aria-describedby={f.describedBy} value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring launch" />}
          </Field>
          <Field label="Search">
            {(f) => <Input id={f.id} leading={<SearchIcon size={16} />} placeholder="Find a campaign" />}
          </Field>
          <Field label="Hover">{(f) => <Input id={f.id} force="hover" defaultValue="Kite" />}</Field>
          <Field label="Focus">{(f) => <Input id={f.id} force="focus" defaultValue="Kite" />}</Field>
          <Field label="Website" error="Add the full address, like https://kite.com.">
            {(f) => <Input id={f.id} aria-describedby={f.describedBy} invalid={f.invalid} defaultValue="kite" />}
          </Field>
          <Field label="Disabled" optional>{(f) => <Input id={f.id} disabled defaultValue="Locked while in review" />}</Field>
          <Field label="Read-only">{(f) => <Input id={f.id} readOnly defaultValue="Sent on 19 Nov" />}</Field>
          <Field label="Note" hint="Grows as you type." className="md:col-span-2">
            {(f) => <Textarea id={f.id} aria-describedby={f.describedBy} placeholder="Anything we should know?" />}
          </Field>
        </div>
      </Section>

      <Section id="pickers" title="Search-pick, segmented, tabs">
        <div className="grid gap-8 md:grid-cols-2">
          <Field label="Ad languages" hint="Type to search. Worldwide replaces the rest.">
            {(f) => <SearchPick id={f.id} describedBy={f.describedBy} options={LANGS} value={langs} onChange={setLangs} placeholder="Search languages" max={6} />}
          </Field>
          <Field label="Disabled">{(f) => <SearchPick id={f.id} options={LANGS} value={["en"]} onChange={() => {}} disabled />}</Field>
          <div className="flex flex-col gap-3">
            <span className="kicker">Segmented</span>
            <SegmentedControl label="View" value={seg} onChange={setSeg} options={[{ value: "wall", label: "Wall" }, { value: "focus", label: "Focus" }]} />
            <SegmentedControl label="Length" size="sm" value="10" onChange={() => {}} options={["6", "8", "10", "12", "15"].map((v) => ({ value: v, label: `${v} s` }))} />
          </div>
          <Tabs
            label="Comments"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "open", label: "To send", count: 3, content: <p className="text-body text-muted">Three comments will go with your decision.</p> },
              { value: "done", label: "Sent", count: 0, content: <p className="text-body text-muted">Nothing sent yet.</p> },
            ]}
          />
        </div>
      </Section>

      <Section id="overlays" title="Dialogs, sheets, tooltips, toasts" note="Irreversible steps state the consequence in one line. Sheets come in with a spring; the bottom sheet drags down to close.">
        <Row label="Dialog">
          <Button variant="primary" onClick={() => setConfirmOpen(true)}>
            Choose this direction
          </Button>
          <Dialog
            open={confirmOpen}
            onOpenChange={(o) => approving === "idle" && setConfirmOpen(o)}
            dismissible={approving === "idle"}
            title="Approve Morning Light?"
            description="We'll build the final in every format from this direction. Your comments go to the team with it."
            footer={
              <>
                <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={approving !== "idle"}>
                  Back
                </Button>
                <Button variant="primary" state={approving} onClick={approve}>
                  Approve · 3 comments
                </Button>
              </>
            }
          >
            <div className="aspect-[16/9] rounded-tile-sm bg-gray" />
          </Dialog>
        </Row>
        <Row label="Sheet">
          <Button onClick={() => setSheet("right")}>Side sheet</Button>
          <Button onClick={() => setSheet("bottom")}>Bottom sheet</Button>
          <Sheet
            open={sheet !== null}
            onOpenChange={(o) => !o && setSheet(null)}
            side={sheet ?? "right"}
            title="Download"
            description="Pick exactly the files you need."
            footer={<Button variant="primary" leading={<DownloadIcon size={16} />}>Download 18 files</Button>}
          >
            <div className="flex flex-col gap-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          </Sheet>
        </Row>
        <Row label="Tooltip">
          <Tooltip content="Leave a comment on the picture" shortcut="C">
            <Button variant="outline">Hover me</Button>
          </Tooltip>
          <Tooltip content="You've used both rebuilds. Choose a direction, or write to us.">
            <span tabIndex={0} className="rounded-full">
              <Button variant="outline" disabled>
                None of these — rebuild
              </Button>
            </span>
          </Tooltip>
        </Row>
        <Row label="Toast">
          <Button onClick={() => toast({ title: "Link copied" })}>Info</Button>
          <Button onClick={() => toast({ title: "Answers sent", description: "We'll get back to you within a day.", tone: "ok" })}>Success</Button>
          <Button
            onClick={() =>
              toast({
                title: "Couldn't save your comment",
                description: "Your text is kept. Check your connection and try again.",
                tone: "err",
                action: { label: "Retry", onClick: () => toast({ title: "Saved", tone: "ok" }) },
              })
            }
          >
            Error with retry
          </Button>
        </Row>
      </Section>

      <Section id="feedback" title="Progress, skeletons, empty states, banners">
        <Row label="Progress">
          <div className="flex w-full max-w-md flex-col gap-3">
            <ProgressBar value={progress} label="Upload progress" />
            <ProgressBar value={1} tone="ok" label="Done" />
            <ProgressBar label="Preparing" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setProgress((p) => Math.max(0, p - 0.2))}>−20%</Button>
              <Button size="sm" onClick={() => setProgress((p) => Math.min(1, p + 0.2))}>+20%</Button>
            </div>
          </div>
        </Row>
        <Row label="Count up">
          <span className="text-title font-semibold">
            <CountUp value={count} /> MB
          </span>
          <Button size="sm" onClick={() => setCount((c) => c + Math.round(Math.random() * 400))}>Add files</Button>
        </Row>
        <Row label="Save status">
          <SaveIndicator state={save} />
          <SaveIndicator state="error" />
          <SaveIndicator state="offline" />
          <Button size="sm" onClick={cycleSave}>Type something</Button>
        </Row>
        <Row label="Spinner · keys">
          <Spinner label="Loading" />
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
          <Kbd>Space</Kbd>
          <Kbd>?</Kbd>
        </Row>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-card bg-gray p-5" aria-label="Loading campaign card">
            <Skeleton className="aspect-[16/10] w-full rounded-tile" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <EmptyState
            icon={<InboxIcon size={20} />}
            title="No campaigns yet"
            action={<Button variant="primary">New campaign</Button>}
          >
            Tell us what to promote. We&apos;ll send you three directions to choose from.
          </EmptyState>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <Banner tone="attention" title="2 questions for you" action={<Button variant="primary" size="sm">Answer</Button>}>
            We need a little more on your audience and offer.
          </Banner>
          <Banner tone="info" title="In review">Sent on 19 Nov at 17:20. We&apos;ll be in touch within a day.</Banner>
          <Banner tone="ok" title="Approved">Your dashboard is open. Start your first campaign.</Banner>
          <Banner tone="err" title="This preview is unavailable" action={<Button size="sm">Retry</Button>}>
            We&apos;ve been told. Try again in a moment.
          </Banner>
        </div>
      </Section>

      <Section id="status" title="Status pills and avatars" note="The only statuses a client ever sees.">
        <Row label="Questionnaire">
          {Object.values(questionnaireLabel).map((s) => (
            <StatusPill key={s.label} {...s} />
          ))}
        </Row>
        <Row label="Campaign">
          {Object.entries(campaignLabel).map(([k, s]) => (
            <StatusPill key={k} {...s} />
          ))}
        </Row>
        <Row label="Avatars">
          {["Kite", "Hearth & Co", "Morning Light", "Ana Petrović", "Dmitry"].map((n) => (
            <Avatar key={n} name={n} size={36} />
          ))}
        </Row>
      </Section>

      <Section id="motion" title="Motion" note="UI feedback 120–200 ms, surfaces 240–420 ms, easing cubic-bezier(.16,1,.3,1) or a spring (380/32). Reduced motion keeps fades only.">
        <motion.ul
          key={count}
          variants={stagger(0.05)}
          initial="hidden"
          animate="show"
          className="grid gap-3 sm:grid-cols-4"
        >
          {["Brief", "Directions", "Your review", "Final"].map((s) => (
            <motion.li key={s} variants={fadeUp} className="rounded-tile bg-gray p-5 text-body font-medium">
              {s}
            </motion.li>
          ))}
        </motion.ul>
        <p className="mt-3 text-small text-muted">“Add files” above replays the stagger.</p>
      </Section>
    </div>
  );
}
