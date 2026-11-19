/**
 * One queue for every creative iframe on the page (spec §8: load at most what is
 * visible, never all at once). Starting a creative is the expensive part — the
 * runtime, fonts, textures, the first frames — and creatives share the page's
 * process, so a few starting together freeze everything. A frame asks for a slot,
 * shows its poster or skeleton while it waits, and gives the slot back as soon as
 * it reports its first frame (or after a timeout, so one broken file never blocks
 * the rest).
 *
 * Lower priority numbers go first: 0 = what the user is looking at, 1 = warm
 * spares (other languages, other formats), 2 = thumbnails.
 */

export const MAX_CONCURRENT = 2;
export const SLOT_TIMEOUT_MS = 10_000;

interface Ticket {
  id: number;
  priority: number;
  grant: () => void;
}

export interface LoadQueue {
  /** Ask for a slot; `grant` runs when it's this frame's turn. Returns a release/cancel function (idempotent). */
  request(priority: number, grant: () => void): () => void;
  readonly running: number;
  readonly waiting: number;
}

export function createLoadQueue(max = MAX_CONCURRENT, timeoutMs = SLOT_TIMEOUT_MS, schedule: (fn: () => void) => void = queueMicrotask): LoadQueue {
  let seq = 0;
  let running = 0;
  const waiting: Ticket[] = [];
  let scheduled = false;

  function pump() {
    scheduled = false;
    while (running < max && waiting.length) {
      // Stable: by priority, then arrival.
      let best = 0;
      for (let i = 1; i < waiting.length; i++) {
        const a = waiting[i];
        const b = waiting[best];
        if (a.priority < b.priority || (a.priority === b.priority && a.id < b.id)) best = i;
      }
      const [t] = waiting.splice(best, 1);
      running++;
      active.set(t.id, setTimeout(() => release(t.id), timeoutMs));
      t.grant();
    }
  }

  // Batch requests made in the same tick so priorities are honoured.
  function later() {
    if (scheduled) return;
    scheduled = true;
    schedule(pump);
  }

  const active = new Map<number, ReturnType<typeof setTimeout>>();

  function release(id: number) {
    const timer = active.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      active.delete(id);
      running--;
      later();
      return;
    }
    const i = waiting.findIndex((t) => t.id === id);
    if (i >= 0) waiting.splice(i, 1);
  }

  return {
    request(priority, grant) {
      const id = ++seq;
      waiting.push({ id, priority, grant });
      later();
      let done = false;
      return () => {
        if (done) return;
        done = true;
        release(id);
      };
    },
    get running() {
      return running;
    },
    get waiting() {
      return waiting.length;
    },
  };
}

/** The page-wide queue used by CreativeFrame. */
export const frameQueue: LoadQueue = createLoadQueue();
