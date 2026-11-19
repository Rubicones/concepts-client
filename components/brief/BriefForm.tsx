"use client";

import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";
import { EASE } from "@/lib/motion";
import { formatIds, formatInfo, LANGUAGES } from "@/lib/forma-constants";
import { briefProblems, KIND_OPTIONS, LENGTHS, OFFERS, STEP_FIELDS, UP_TO_YOU, type BriefAnswers, type CampaignSetup } from "@/lib/brief";
import type { BrandOption } from "@/campaign/types";
import type { ClientFile } from "@/questionnaire/types";
import type { BriefPrefill } from "@/questionnaire/prefill";
import { sendBrief } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { OptionCard, OptionCardGroup } from "@/components/ui/OptionCard";
import { SearchPick } from "@/components/ui/SearchPick";
import { useToast } from "@/components/ui/Toast";
import { CheckIcon, CloseIcon, PlusIcon } from "@/components/ui/icons";
import { FormatChip } from "@/components/player/FormatChip";
import { KindIllustration } from "@/components/campaign/KindIllustration";
import { BriefSummary } from "@/components/campaign/BriefSummary";
import { useUploads, formatBytes } from "@/components/questionnaire/Files";

/**
 * New campaign brief (spec §6.5): three short steps with a summary pinned on
 * the right (desktop). Everything possible is prefilled from the questionnaire.
 * Setup rules are Forma's (lib/brief.ts validateSetup).
 */

type Step = 1 | 2 | 3;
const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "What we're promoting" },
  { n: 2, label: "What we'll make" },
  { n: 3, label: "Check & send" },
];

const LANG_OPTIONS = LANGUAGES.map((l) => ({ value: l.code, label: l.name, hint: l.code.toUpperCase() }));

export function BriefForm({
  brands,
  initialBrandId,
  questionnaireId,
  prefill,
  defaultName,
}: {
  brands: BrandOption[];
  initialBrandId: string;
  questionnaireId: string;
  prefill: BriefPrefill;
  defaultName: string;
}) {
  const toast = useToast();
  const [step, setStep] = useState<Step>(1);
  const [dir, setDir] = useState(1);
  const [tried, setTried] = useState<Record<number, boolean>>({});
  const [name, setName] = useState(defaultName);
  const [brandId, setBrandId] = useState(initialBrandId);
  const [setup, setSetup] = useState<CampaignSetup>(prefill.setup);
  const [brief, setBrief] = useState<Omit<BriefAnswers, "requestId">>(prefill.brief);
  const [requestId] = useState(() => crypto.randomUUID());
  const [refFiles, setRefFiles] = useState<ClientFile[]>([]);
  const [dirty, setDirty] = useState(false);
  const [sending, startSend] = useTransition();
  const uploads = useUploads(questionnaireId, setRefFiles, (t, tone) => toast({ title: t, tone }));
  const fileInput = useRef<HTMLInputElement>(null);
  const formId = useId();

  const problems = briefProblems({ name, setup, brief: { ...brief, requestId } });
  const stepProblems = (s: 1 | 2) => STEP_FIELDS[s].filter((f) => problems[f]);
  const err = (field: string, s: 1 | 2) => (tried[s] ? problems[field] : undefined);

  const upd = <K extends keyof typeof brief>(k: K, v: (typeof brief)[K]) => {
    setBrief((b) => ({ ...b, [k]: v }));
    setDirty(true);
  };
  const updSetup = (patch: Partial<CampaignSetup>) => {
    setSetup((s) => ({ ...s, ...patch }));
    setDirty(true);
  };

  // A half-written brief is worth a "leave anyway?".
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!sending) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, sending]);

  function goTo(n: Step) {
    if (n > step) {
      for (const s of [1, 2] as const) {
        if (s < n && stepProblems(s).length) {
          setTried((t) => ({ ...t, [s]: true }));
          setDir(s > step ? 1 : -1);
          setStep(s);
          document.getElementById(`${formId}-${stepProblems(s)[0]}`)?.focus();
          return;
        }
      }
    }
    setDir(n > step ? 1 : -1);
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function send() {
    if (Object.keys(problems).length) {
      setTried({ 1: true, 2: true });
      goTo(stepProblems(1).length ? 1 : 2);
      return;
    }
    startSend(async () => {
      const res = await sendBrief({ name, brandId, setup, brief: { ...brief, requestId, fileIds: refFiles.map((f) => f.id) } });
      // Success navigates to the campaign; we only get here when something went wrong.
      if (res && !res.ok) toast({ title: "Couldn't send the brief", description: res.error, tone: "err" });
    });
  }

  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const isOtherOffer = brief.offer !== "" && !OFFERS.includes(brief.offer) && brief.offer !== UP_TO_YOU;
  const ctaIsOther = brief.cta !== "" && brief.cta !== UP_TO_YOU && !prefill.ctas.includes(brief.cta);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:gap-10">
      <div className="min-w-0">
        {/* Step indicator */}
        <ol className="mb-8 flex items-center gap-2" aria-label="Brief steps">
          {STEPS.map((s, i) => {
            const done = s.n < step;
            const cur = s.n === step;
            return (
              <li key={s.n} className="flex flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => goTo(s.n)}
                  aria-current={cur ? "step" : undefined}
                  className="flex items-center gap-2 rounded-full pr-2 text-left transition-colors hover:text-navy"
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full text-small font-semibold tabular-nums transition-colors duration-300",
                      cur ? "bg-orange text-white" : done ? "bg-navy text-white" : "bg-gray text-muted",
                    )}
                  >
                    {done ? <CheckIcon size={14} strokeWidth={2.6} /> : s.n}
                  </span>
                  <span className={cn("hidden text-small font-medium sm:inline", cur || done ? "text-navy" : "text-muted")}>{s.label}</span>
                </button>
                {i < STEPS.length - 1 && <span aria-hidden="true" className={cn("h-0.5 flex-1 rounded-full transition-colors duration-300", done ? "bg-navy" : "bg-line")} />}
              </li>
            );
          })}
        </ol>

        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -24 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="flex flex-col gap-8"
          >
            {step === 1 && (
              <>
                <Field label="Campaign name" hint="Only you and our team see this." error={err("name", 1)}>
                  {(f) => (
                    <Input id={`${formId}-name`} aria-describedby={f.describedBy} invalid={f.invalid} value={name} onChange={(e) => (setName(e.target.value), setDirty(true))} placeholder="e.g. Spring sale" maxLength={120} />
                  )}
                </Field>

                {brands.length > 1 && (
                  <Group label="For which client?">
                    {brands.map((b) => (
                      <Chip key={b.id} noCheck selected={brandId === b.id} onSelectedChange={() => setBrandId(b.id)}>
                        {b.name}
                      </Chip>
                    ))}
                  </Group>
                )}

                <Group label="The product or offer" hint={prefill.products.length ? "From your questionnaire. Pick one, or type it." : "Type it in a few words."}>
                  {prefill.products.map((p) => (
                    <Chip key={p} noCheck selected={brief.product === p} onSelectedChange={(on) => upd("product", on ? p : "")}>
                      {p}
                    </Chip>
                  ))}
                  <Input
                    aria-label="The product or offer"
                    value={prefill.products.includes(brief.product) ? "" : brief.product}
                    onChange={(e) => upd("product", e.target.value)}
                    placeholder={prefill.products.length ? "Something else" : "e.g. The family plan"}
                    className="min-w-[220px] flex-1"
                  />
                </Group>

                <Field label="What do you want to promote?" hint="A sentence or two: what, for whom, and why now." error={err("promote", 1)}>
                  {(f) => (
                    <Textarea id={`${formId}-promote`} aria-describedby={f.describedBy} invalid={f.invalid} value={brief.promote} onChange={(e) => upd("promote", e.target.value)} placeholder="e.g. Our spring sale: 30% off the yearly plan until April 15" minLines={2} />
                  )}
                </Field>

                <Group label="The goal" error={err("goal", 1)} id={`${formId}-goal`}>
                  {prefill.goals.map((g) => (
                    <Chip key={g} noCheck selected={brief.goal === g} onSelectedChange={() => upd("goal", g)}>
                      {g}
                    </Chip>
                  ))}
                </Group>

                <Group label="Any offer to show?">
                  {[...OFFERS, UP_TO_YOU, "Other"].map((o) => (
                    <Chip
                      key={o}
                      noCheck
                      decide={o === UP_TO_YOU}
                      selected={o === "Other" ? isOtherOffer : brief.offer === o}
                      onSelectedChange={() => upd("offer", o === "Other" ? "Other" : o)}
                    >
                      {o}
                    </Chip>
                  ))}
                </Group>
                {brief.offer && brief.offer !== "No offer" && brief.offer !== UP_TO_YOU && (
                  <Field label="The exact wording" hint="As it should appear in the ad. We never change offer wording." error={err("offerText", 1)}>
                    {(f) => (
                      <Input id={`${formId}-offerText`} aria-describedby={f.describedBy} invalid={f.invalid} value={brief.offerText} onChange={(e) => upd("offerText", e.target.value)} placeholder="e.g. 30% off your first year" />
                    )}
                  </Field>
                )}

                <Group label="Button text" hint="The call to action at the end of the ad." error={err("cta", 1)} id={`${formId}-cta`}>
                  {[...prefill.ctas, UP_TO_YOU].map((c) => (
                    <Chip key={c} noCheck decide={c === UP_TO_YOU} selected={brief.cta === c} onSelectedChange={() => upd("cta", c)}>
                      {c}
                    </Chip>
                  ))}
                  <Input aria-label="Other button text" value={ctaIsOther ? brief.cta : ""} onChange={(e) => upd("cta", e.target.value)} placeholder="Other" className="w-40" maxLength={60} />
                </Group>

                <div className="flex flex-col gap-3">
                  <p className="text-small font-medium">
                    References <span className="font-normal text-muted">Optional</span>
                  </p>
                  {brief.links.map((l, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <Input aria-label={`Reference link ${i + 1}`} value={l.a} onChange={(e) => upd("links", brief.links.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} placeholder="https://" />
                      <Input aria-label={`What about it ${i + 1}`} value={l.b ?? ""} onChange={(e) => upd("links", brief.links.map((x, j) => (j === i ? { ...x, b: e.target.value } : x)))} placeholder="What about it? (optional)" className="order-3 col-span-full sm:order-none sm:col-span-1" />
                      <button type="button" aria-label="Remove link" onClick={() => upd("links", brief.links.filter((_, j) => j !== i))} className="grid size-12 place-items-center rounded-full text-muted hover:bg-gray">
                        <CloseIcon size={14} />
                      </button>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" leading={<PlusIcon size={14} />} onClick={() => upd("links", [...brief.links, { a: "" }])}>
                      Add a link
                    </Button>
                    <Button size="sm" leading={<PlusIcon size={14} />} onClick={() => fileInput.current?.click()}>
                      Add files
                    </Button>
                    <input
                      ref={fileInput}
                      type="file"
                      multiple
                      hidden
                      onChange={(e) => {
                        if (e.target.files?.length) uploads.add(e.target.files, "refs");
                        e.target.value = "";
                      }}
                    />
                  </div>
                  {(refFiles.length > 0 || uploads.items.length > 0) && (
                    <ul className="flex flex-col gap-1.5">
                      {refFiles.map((f) => (
                        <li key={f.id} className="flex items-center justify-between gap-3 rounded-tile-sm bg-gray px-4 py-2.5 text-small">
                          <span className="truncate">{f.name}</span>
                          <span className="flex items-center gap-2 text-muted">
                            {formatBytes(f.size)}
                            <button type="button" aria-label={`Remove ${f.name}`} onClick={() => uploads.remove(f.id)} className="grid size-7 place-items-center rounded-full hover:bg-gray-strong">
                              <CloseIcon size={12} />
                            </button>
                          </span>
                        </li>
                      ))}
                      {uploads.items.map((u) => (
                        <li key={u.key} className="flex items-center justify-between gap-3 rounded-tile-sm bg-gray px-4 py-2.5 text-small">
                          <span className="truncate">{u.name}</span>
                          <span className={cn("tabular-nums", u.status === "failed" ? "text-err" : "text-muted")}>
                            {u.status === "failed" ? (
                              <button type="button" className="font-medium underline" onClick={() => uploads.retry(u.key)}>
                                Retry
                              </button>
                            ) : (
                              `${Math.round(u.progress * 100)}%`
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Field label="A note for the team" optional>
                    {(f) => <Textarea id={f.id} value={brief.note} onChange={(e) => upd("note", e.target.value)} placeholder="Anything else we should know?" minLines={2} />}
                  </Field>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="flex flex-col gap-3">
                  <p className="text-small font-medium">What should we make?</p>
                  <OptionCardGroup label="Kind" className="sm:grid-cols-3">
                    {KIND_OPTIONS.map((k) => (
                      <OptionCard
                        key={k.value}
                        selected={setup.kind === k.value}
                        onSelect={() => updSetup({ kind: k.value, lengths: k.value === "poster" ? [] : setup.lengths.length ? setup.lengths : [10] })}
                        title={k.title}
                        description={k.description}
                        media={
                          <div className="aspect-[16/9] p-2">
                            <KindIllustration kind={k.value} active={setup.kind === k.value} />
                          </div>
                        }
                      />
                    ))}
                  </OptionCardGroup>
                </div>

                <Group label="Formats" hint="Drawn to scale. Pick every one you'll run." error={err("formats", 2)} id={`${formId}-formats`} role="none">
                  <div role="group" aria-label="Formats" className="flex flex-wrap gap-2">
                    {formatIds.map((f) => (
                      <FormatChip key={f} multiple format={f} showName selected={setup.formats.includes(f)} onSelect={() => updSetup({ formats: toggleIn(setup.formats, f) })} />
                    ))}
                  </div>
                </Group>

                {setup.kind !== "poster" && (
                  <Group
                    label="Lengths"
                    hint={setup.kind === "multi" ? "Shorter videos have fewer scenes." : "A loop of any of these lengths."}
                    error={err("lengths", 2)}
                    id={`${formId}-lengths`}
                  >
                    {LENGTHS.map((n) => (
                      <Chip key={n} selected={setup.lengths.includes(n)} onSelectedChange={() => updSetup({ lengths: toggleIn(setup.lengths, n).sort((a, b) => a - b) })}>
                        <span className="tabular-nums">{n} s</span>
                      </Chip>
                    ))}
                  </Group>
                )}

                <Field label="Languages" hint="Your ad languages from the questionnaire are already in." error={err("languages", 2)}>
                  {(f) => (
                    <SearchPick
                      id={`${formId}-languages`}
                      describedBy={f.describedBy}
                      invalid={f.invalid}
                      options={LANG_OPTIONS}
                      value={setup.languages}
                      onChange={(languages) => updSetup({ languages })}
                      placeholder="Search languages"
                    />
                  )}
                </Field>
              </>
            )}

            {step === 3 && (
              <>
                <div className="rounded-card bg-gray p-6 sm:p-8">
                  <div className="mb-5 flex items-baseline justify-between gap-3">
                    <h2 className="text-title-sm font-semibold">{name || "Untitled campaign"}</h2>
                    <button type="button" onClick={() => goTo(1)} className="text-small font-medium text-navy underline underline-offset-4">
                      Edit
                    </button>
                  </div>
                  <BriefSummary setup={setup} brief={brief} refs={refFiles} />
                </div>
                <div className="rounded-card bg-ice p-6 shadow-[inset_0_0_0_1px_var(--color-sky)] sm:p-8">
                  <p className="kicker">What happens next</p>
                  <p className="mt-2 text-lead">We&apos;ll send you three directions to choose from. You comment, pick one, and we build the final in every format.</p>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-10 flex items-center justify-between gap-3 border-t border-line pt-6">
          {step > 1 ? (
            <Button variant="outline" onClick={() => goTo((step - 1) as Step)}>
              ← Back
            </Button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <Button variant="primary" onClick={() => goTo((step + 1) as Step)}>
              Next
            </Button>
          ) : (
            <Button variant="primary" size="lg" state={sending ? "loading" : "idle"} onClick={send}>
              Send request
            </Button>
          )}
        </div>
      </div>

      {/* Sticky summary (desktop) */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 flex flex-col gap-4 rounded-card bg-gray p-6">
          <p className="kicker">Your brief</p>
          <p className="text-title-sm font-semibold">{name || "Untitled campaign"}</p>
          <BriefSummary setup={setup} brief={brief} compact />
          {Object.keys(problems).length > 0 && (
            <p className="text-small text-muted">
              {Object.keys(problems).length} thing{Object.keys(problems).length === 1 ? "" : "s"} left before you can send.
            </p>
          )}
          <p className="border-t border-line pt-4 text-small text-muted">
            {setup.formats.length} format{setup.formats.length === 1 ? "" : "s"} × {setup.languages.length} language{setup.languages.length === 1 ? "" : "s"}
            {setup.kind !== "poster" && setup.lengths.length ? ` × ${setup.lengths.length} length${setup.lengths.length === 1 ? "" : "s"}` : ""} — every version included.
          </p>
          <p className="text-caption text-muted">{setup.formats.map((f) => formatInfo(f).label).join(" · ")}</p>
        </div>
      </aside>
    </div>
  );
}

function Group({ label, hint, error, children, id, role = "group" }: { label: string; hint?: string; error?: string; children: ReactNode; id?: string; role?: "group" | "none" }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <p className="text-small font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-small text-muted">{hint}</p>}
      </div>
      <div id={id} tabIndex={id ? -1 : undefined} role={role} aria-label={role === "group" ? label : undefined} className="flex flex-wrap items-center gap-2 outline-none">
        {children}
      </div>
      {error && <p className="animate-fade-in text-small text-err">{error}</p>}
    </div>
  );
}
