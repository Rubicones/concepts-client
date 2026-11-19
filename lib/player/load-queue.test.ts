import { describe, expect, it, vi } from "vitest";
import { createLoadQueue } from "./load-queue";

const sync = (fn: () => void) => fn();

describe("creative load queue", () => {
  it("runs at most N at once, by priority then arrival", () => {
    let flush: () => void = () => {};
    const q = createLoadQueue(2, 10_000, (fn) => (flush = fn));
    const order: string[] = [];
    const rel: Record<string, () => void> = {};
    for (const [name, p] of [["thumb", 2], ["a", 0], ["spare", 1], ["b", 0]] as const) rel[name] = q.request(p, () => order.push(name));
    flush();
    expect(order).toEqual(["a", "b"]);
    expect(q.running).toBe(2);
    rel.a();
    flush();
    expect(order).toEqual(["a", "b", "spare"]);
    rel.b();
    rel.spare();
    flush();
    expect(order).toEqual(["a", "b", "spare", "thumb"]);
  });

  it("cancelling a waiting request removes it; release is idempotent", () => {
    const q = createLoadQueue(1, 10_000, sync);
    const got: string[] = [];
    const a = q.request(0, () => got.push("a"));
    const b = q.request(0, () => got.push("b"));
    b();
    expect(q.waiting).toBe(0);
    a();
    a();
    expect(q.running).toBe(0);
    q.request(0, () => got.push("c"));
    expect(got).toEqual(["a", "c"]);
  });

  it("frees a slot after the timeout so a broken file never blocks the rest", () => {
    vi.useFakeTimers();
    const q = createLoadQueue(1, 1000, sync);
    const got: string[] = [];
    q.request(0, () => got.push("stuck"));
    q.request(0, () => got.push("next"));
    expect(got).toEqual(["stuck"]);
    vi.advanceTimersByTime(1000);
    expect(got).toEqual(["stuck", "next"]);
    vi.useRealTimers();
  });
});
