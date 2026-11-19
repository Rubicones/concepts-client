/**
 * Render hints for creatives on the player origin (dashboard-side; Forma's protocol
 * is unchanged). A creative is laid out at its native size (1080×1920…) and scaled
 * down to fit, so left alone it renders every frame at full size — and WebGL scenes
 * at full size × the screen's pixel ratio. Four formats at once on a retina screen
 * is ~30 million pixels a frame for tiles that show a fraction of that.
 *
 * `rs` (render scale) tells the creative how many device pixels one of its CSS
 * pixels really covers on screen; the player origin injects a tiny script that
 * reports it as `devicePixelRatio`, which three.js, canvas and Lottie use to size
 * their buffers. DOM content is rasterised by the browser at the on-screen scale
 * anyway. `fps` caps requestAnimationFrame (120 Hz screens would otherwise double
 * the work for no visible gain).
 */

export const RENDER_SCALES = [0.25, 0.375, 0.5, 0.75, 1, 1.5, 2] as const;
export const DEFAULT_FPS = 60;

/** The smallest render scale that still covers the on-screen size, capped at 2. */
export function renderScaleFor(displayScale: number, devicePixelRatio: number): number {
  const need = Math.max(0, displayScale) * Math.max(1, devicePixelRatio || 1);
  return RENDER_SCALES.find((s) => s >= need - 1e-6) ?? RENDER_SCALES[RENDER_SCALES.length - 1];
}

/** Re-render at a new scale only when it matters: always up; down only when the buffer is 2× too big. */
export function shouldRerender(current: number | null, next: number): boolean {
  if (current === null) return true;
  return next > current || next <= current / 2;
}

export function parseHints(params: URLSearchParams): { rs: number | null; fps: number | null } {
  const rs = Number(params.get("rs"));
  const fps = Number(params.get("fps"));
  return {
    rs: (RENDER_SCALES as readonly number[]).includes(rs) ? rs : null,
    fps: Number.isInteger(fps) && fps >= 24 && fps <= 120 ? fps : null,
  };
}

/** The script injected first into the creative's <head>. Numbers only; nothing from the request is echoed. */
export function hintScript({ rs, fps }: { rs: number | null; fps: number | null }): string {
  const parts: string[] = [];
  if (rs !== null) {
    parts.push(`try{Object.defineProperty(window,"devicePixelRatio",{get:function(){return ${rs}},configurable:true})}catch(e){}`);
  }
  if (fps !== null) {
    // One real frame loop; callbacks run at most `fps` times a second. cancelAnimationFrame keeps working.
    parts.push(
      `(function(){var raw=window.requestAnimationFrame.bind(window),q=new Map(),id=0,pending=false,last=-1e9,min=${(1000 / fps - 2).toFixed(2)};` +
        `function pump(ts){if(ts-last<min){raw(pump);return}last=ts;pending=false;var cbs=Array.from(q.values());q.clear();` +
        `for(var i=0;i<cbs.length;i++){try{cbs[i](ts)}catch(e){setTimeout(function(){throw e})}}}` +
        `window.requestAnimationFrame=function(cb){var n=++id;q.set(n,cb);if(!pending){pending=true;raw(pump)}return n};` +
        `window.cancelAnimationFrame=function(n){q.delete(n)}})();`,
    );
  }
  return parts.length ? `<script>${parts.join("")}</script>` : "";
}

/** Puts the script before anything else runs: right after <head>, else after <html>, else first. */
export function injectIntoHtml(html: string, script: string): string {
  if (!script) return html;
  const head = /<head(\s[^>]*)?>/i.exec(html);
  if (head) return html.slice(0, head.index + head[0].length) + script + html.slice(head.index + head[0].length);
  const root = /<html(\s[^>]*)?>/i.exec(html);
  if (root) return html.slice(0, root.index + root[0].length) + script + html.slice(root.index + root[0].length);
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
  if (doctype) return doctype[0] + script + html.slice(doctype[0].length);
  return script + html;
}
