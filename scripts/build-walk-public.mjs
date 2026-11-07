// Build a single interactive SVG for public review hosts that serve SVG rather
// than executable HTML. Same clock, original PNGs, no videos/external scripts.
import { build } from "vite";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { CATALOG } from "../src/rifleman/catalog.js";
import { WALK_REVIEW } from "../src/rifleman/review.js";
const result = await build({
  configFile: false,
  publicDir: false,
  logLevel: "warn",
  build: {
    write: false,
    minify: true,
    lib: {
      entry: "src/rifleman/walk-public.js",
      name: "WalkPreview",
      formats: ["iife"],
    },
  },
});
const code = (Array.isArray(result) ? result[0] : result).output.find(
  (f) => f.type === "chunk",
).code;
const assets = { new: CATALOG.banks.eWalk2, old: WALK_REVIEW.asset };
const design = Object.fromEntries(
  Object.entries(assets).map(([k, a]) => [
    k,
    JSON.parse(readFileSync("public/" + a.metadata)),
  ]),
);
const definitions = Object.entries(assets)
  .map(
    ([k, a]) =>
      `<image id="atlas-${k}" width="${a.grid[0] * a.frameSize[0]}" height="${a.grid[1] * a.frameSize[1]}" href="data:image/png;base64,${readFileSync("public/" + a.image).toString("base64")}" />`,
  )
  .join("\n");
const images = Object.entries(assets)
  .flatMap(([k, a]) =>
    ["actual", "large"].map(
      (size) =>
        `<svg id="${k}-image-${size}" overflow="hidden"><use href="#atlas-${k}" /></svg>`,
    ),
  )
  .join("\n");
mkdirSync("previews", { recursive: true });
writeFileSync(
  "previews/v035-e-walk.svg",
  `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100%" height="780" viewBox="0 0 390 780" role="application" aria-label="E 보행 신규 및 이전 프레임 대조">
<title>Autonomous Warfare v0.3.5 · Interactive E Walk Laboratory</title>
<desc>Original four-frame rejected walk and eight-frame prototype, 39px/4x, with play, pause, slow motion, speed and frame stepping. Neither gait is complete.</desc>
<style>svg{background:#15242e;color:#dce4e6;font-family:system-ui,sans-serif;font-size:13px}text{fill:#dce4e6;pointer-events:none}image{image-rendering:pixelated}.control{cursor:pointer;touch-action:manipulation}.control rect{fill:#243c49;stroke:#607d88}.control[aria-pressed="true"] rect{fill:#355d58;stroke:#a5d1bf}.control:focus rect{stroke:#edcea0;stroke-width:2}</style>
<rect width="100%" height="100%" fill="#15242e"/>
<defs>${definitions}</defs>
${images}
<text id="loading" x="12" y="32">PNG 로딩 중… / 잠시 기다려 주세요</text>
<script type="application/ecmascript"><![CDATA[
document.getElementById('loading').remove();
globalThis.WALK_DESIGN=${JSON.stringify(design)};
${code.replaceAll("]]>", "]] >")}
]]></script></svg>\n`,
);
console.log(
  "Wrote previews/v035-e-walk.svg (same shared clock, original PNGs; no gameplay)",
);
