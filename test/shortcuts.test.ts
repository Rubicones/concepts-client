import { describe, expect, it } from "vitest";
import { playerKeyAction, type KeyContext, type KeyInput } from "@/components/player/Transport";
import { isHelpKey } from "@/components/shell/Shortcuts";
import { FRAME_STEP } from "@/lib/player/protocol";

/**
 * Every shortcut in the `?` sheet, as the code resolves it. Letters are matched by
 * physical key, so a Russian layout (K types "л", C types "с") works the same.
 */

const key = (code: string, k = "", extra: Partial<KeyInput> = {}): KeyInput => ({ code, key: k, shiftKey: false, ...extra });

const viewer: KeyContext = { typing: false, pressable: false, ownsArrows: false, has: { next: false, prev: false, seekTo: true, fullscreen: true, jump: false } };
const review: KeyContext = { typing: false, pressable: false, ownsArrows: false, has: { next: true, prev: true, seekTo: false, fullscreen: false, jump: true } };
const act = (e: KeyInput, ctx: KeyContext) => playerKeyAction(e, ctx)?.action ?? null;

describe("final viewer shortcuts", () => {
  it("Space and K play/pause", () => {
    expect(act(key("Space", " "), viewer)).toEqual({ type: "toggle" });
    expect(act(key("KeyK", "k"), viewer)).toEqual({ type: "toggle" });
    expect(act(key("KeyK", "л"), viewer)).toEqual({ type: "toggle" }); // Russian layout
  });

  it("Space presses a focused button instead; K still toggles there", () => {
    expect(act(key("Space", " "), { ...viewer, pressable: true })).toBeNull();
    expect(act(key("KeyK", "k"), { ...viewer, pressable: true })).toEqual({ type: "toggle" });
  });

  it("Space plays from the scrubber (a range input has no use for it)", () => {
    expect(act(key("Space", " "), { ...viewer, ownsArrows: true })).toEqual({ type: "toggle" });
  });

  it("←/→ step one frame, Shift one second", () => {
    expect(act(key("ArrowRight"), viewer)).toEqual({ type: "seekBy", delta: FRAME_STEP });
    expect(act(key("ArrowLeft"), viewer)).toEqual({ type: "seekBy", delta: -FRAME_STEP });
    expect(act(key("ArrowRight", "", { shiftKey: true }), viewer)).toEqual({ type: "seekBy", delta: 1 });
    expect(act(key("ArrowLeft", "", { shiftKey: true }), viewer)).toEqual({ type: "seekBy", delta: -1 });
  });

  it("arrows work on a plain button, and are left to sliders, radios and tabs", () => {
    expect(act(key("ArrowRight"), { ...viewer, pressable: true })).toEqual({ type: "seekBy", delta: FRAME_STEP });
    expect(act(key("ArrowRight"), { ...viewer, ownsArrows: true })).toBeNull();
  });

  it("J/L one second, Home to the start, F fullscreen (once per press)", () => {
    expect(act(key("KeyJ", "о"), viewer)).toEqual({ type: "seekBy", delta: -1 });
    expect(act(key("KeyL", "д"), viewer)).toEqual({ type: "seekBy", delta: 1 });
    expect(act(key("Home"), viewer)).toEqual({ type: "seekTo", t: 0 });
    expect(act(key("KeyF", "а"), viewer)).toEqual({ type: "fullscreen" });
    expect(act(key("KeyF", "f", { repeat: true }), viewer)).toBeNull();
    expect(act(key("KeyF", "f"), { ...viewer, has: { ...viewer.has, fullscreen: false } })).toBeNull(); // wall, or no fullscreen (iPhone)
  });

  it("never acts while typing or with a modifier (browser shortcuts stay theirs)", () => {
    expect(act(key("Space", " "), { ...viewer, typing: true })).toBeNull();
    expect(act(key("KeyK", "k", { metaKey: true }), viewer)).toBeNull();
    expect(act(key("KeyF", "f", { ctrlKey: true }), viewer)).toBeNull();
    expect(act(key("ArrowLeft", "", { altKey: true }), viewer)).toBeNull();
  });
});

describe("directions review shortcuts", () => {
  it("←/→ move between directions; 1–3 jump", () => {
    expect(act(key("ArrowRight"), review)).toEqual({ type: "next" });
    expect(act(key("ArrowLeft"), review)).toEqual({ type: "prev" });
    expect(act(key("Digit2", "2"), review)).toEqual({ type: "jump", index: 1 });
    expect(act(key("Digit1", "&"), review)).toEqual({ type: "jump", index: 0 }); // AZERTY: digits are shifted
  });

  it("arrows on a focused pin are left to the pin (it nudges)", () => {
    // Pins are buttons that handle arrows themselves and preventDefault; the window
    // handler skips prevented events, so the review never switches direction then.
    expect(act(key("ArrowRight"), { ...review, ownsArrows: true })).toBeNull();
  });
});

describe("global shortcuts", () => {
  it("? opens the sheet on any layout", () => {
    expect(isHelpKey({ key: "?", code: "Slash", shiftKey: true })).toBe(true);
    expect(isHelpKey({ key: "?", code: "Digit7", shiftKey: true })).toBe(true); // Russian layout: Shift+7
    expect(isHelpKey({ key: ",", code: "Slash", shiftKey: true })).toBe(true); // physical "/" key, other layout
    expect(isHelpKey({ key: "/", code: "Slash", shiftKey: false })).toBe(false);
    expect(isHelpKey({ key: "?", code: "Slash", shiftKey: true, metaKey: true })).toBe(false);
  });
});
