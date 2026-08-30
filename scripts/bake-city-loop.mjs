/**
 * Record the live hero camera at its real orbit — light and dark — then
 * encode TV-safe H.264 (Constrained Baseline, 30fps, no B-frames, 1080p).
 *
 *   npx playwright install chromium
 *   npm run bake:city
 *
 * Expects the website at http://localhost:3302.
 */
import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { finished } from "node:stream/promises";
import { chromium } from "playwright";

/** Keep in lockstep with `src/lib/hero-orbit.ts`. */
const HERO_ORBIT_MS = 163_636;
const ORIGIN = process.env.BAKE_ORIGIN ?? "http://localhost:3302";
const SECONDS = Number(process.env.BAKE_SECONDS ?? HERO_ORBIT_MS / 1000);
const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
const OUT_DIR = join(process.cwd(), "public", "tv");
const THEMES = ["dark", "light"];

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
    child.on("error", reject);
  });
}

async function encode(raw, theme) {
  const mp4 = join(OUT_DIR, `city-${theme}.mp4`);
  const poster = join(OUT_DIR, `city-${theme}.jpg`);
  await run("ffmpeg", [
    "-y",
    "-i",
    raw,
    "-t",
    String(SECONDS),
    "-vf",
    `fps=${FPS},scale=${WIDTH}:${HEIGHT}:flags=lanczos,format=yuv420p`,
    "-r",
    String(FPS),
    "-c:v",
    "libx264",
    "-profile:v",
    "baseline",
    "-level",
    "4.0",
    "-bf",
    "0",
    "-g",
    "30",
    "-preset",
    "slow",
    "-crf",
    "26",
    "-movflags",
    "+faststart",
    "-an",
    "-pix_fmt",
    "yuv420p",
    mp4,
  ]);
  await run("ffmpeg", ["-y", "-ss", "1", "-i", mp4, "-update", "1", "-frames:v", "1", "-q:v", "5", poster]);
  console.log(`wrote ${mp4}`);
  console.log(`wrote ${poster}`);
}

const scratch = join(tmpdir(), `biy-city-loop-${Date.now()}`);
await mkdir(scratch, { recursive: true });
await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  args: [
    "--use-gl=angle",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--disable-frame-rate-limit",
    "--disable-gpu-vsync",
  ],
});

for (const theme of THEMES) {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    colorScheme: theme,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(Math.ceil(SECONDS * 1000) + 180_000);

  const raw = join(scratch, `${theme}.webm`);
  const out = createWriteStream(raw);
  await page.exposeFunction("biyWriteChunk", (b64) => {
    out.write(Buffer.from(b64, "base64"));
  });

  await page.goto(`${ORIGIN}/tv/bake?theme=${theme}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector(".maplibregl-canvas", { timeout: 45_000 });
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const done = () => resolve(undefined);
        window.addEventListener("biy-map-idle", done, { once: true });
        setTimeout(done, 12_000);
      }),
  );
  await page.waitForTimeout(2000);
  console.log(`recording ${theme} ${SECONDS}s closed turn @ ${FPS}fps ${WIDTH}x${HEIGHT}`);

  await page.evaluate(async ({ seconds, fps }) => {
    const canvas = document.querySelector(".maplibregl-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("no map canvas");
    const stream = canvas.captureStream(fps);
    const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((type) =>
      MediaRecorder.isTypeSupported(type),
    );
    if (!mime) throw new Error("no MediaRecorder mime");
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    rec.addEventListener("dataavailable", async (event) => {
      if (!event.data.size) return;
      const bytes = new Uint8Array(await event.data.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      await window.biyWriteChunk(btoa(binary));
    });
    rec.start(1000);
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    rec.stop();
    await new Promise((resolve) => rec.addEventListener("stop", resolve, { once: true }));
  }, { seconds: SECONDS, fps: FPS });

  out.end();
  await finished(out);
  await page.close();
  await context.close();
  await encode(raw, theme);
}

await browser.close();
await rm(scratch, { recursive: true, force: true });
await rm(join(OUT_DIR, "city.mp4"), { force: true });
await rm(join(OUT_DIR, "city.jpg"), { force: true });
console.log("done");
