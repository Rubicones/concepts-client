// Copies the creative runtime libraries into public/lib so the player host can serve
// them at the absolute paths creatives use (forma/server.mjs `libs`):
//   /lib/gsap.js  /lib/lottie.js  /lib/three/build/…  /lib/three/examples/jsm/…
// Versions are pinned in package.json to Forma's; scripts/check is in lib/player/player.test.ts.
import { cp, mkdir, rm, copyFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "public", "lib");
const nm = path.join(root, "node_modules");
const require = createRequire(import.meta.url);

await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, "three"), { recursive: true });
await copyFile(path.join(nm, "gsap/dist/gsap.min.js"), path.join(out, "gsap.js"));
await copyFile(path.join(nm, "lottie-web/build/player/lottie.min.js"), path.join(out, "lottie.js"));
await cp(path.join(nm, "three/build"), path.join(out, "three/build"), { recursive: true });
await cp(path.join(nm, "three/examples/jsm"), path.join(out, "three/examples/jsm"), { recursive: true });

const versions = Object.fromEntries(
  ["three", "gsap", "lottie-web"].map((p) => [p, require(path.join(nm, p, "package.json")).version]),
);
await writeFile(path.join(out, "VERSIONS.json"), JSON.stringify(versions, null, 2) + "\n");
console.log("[player libs]", Object.entries(versions).map(([k, v]) => `${k}@${v}`).join(" "));
