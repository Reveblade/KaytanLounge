/**
 * Record the live hero camera at 60fps — dark only, TV-sized.
 *
 *   npx playwright install chromium
 *   npm run bake:city
 *
 * Expects the website at http://localhost:3302.
 */
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const ORIGIN = process.env.BAKE_ORIGIN ?? "http://localhost:3302";
/** One closed turn. Matches `orbitMs` on the bake map. */
const SECONDS = Number(process.env.BAKE_SECONDS ?? 20);
const WARMUP_MS = 600;
const FPS = 60;
const WIDTH = 1920;
const HEIGHT = 1080;
const OUT_DIR = join(process.cwd(), "public", "tv");

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
    child.on("error", reject);
  });
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

const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
  colorScheme: "dark",
});
const page = await context.newPage();
page.setDefaultTimeout(60_000);

await page.goto(`${ORIGIN}/tv/bake?theme=dark`, { waitUntil: "domcontentloaded", timeout: 60_000 });
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
console.log(`recording dark ${SECONDS}s closed turn @ ${FPS}fps ${WIDTH}x${HEIGHT}`);

const b64 = await page.evaluate(async ({ seconds, fps, warmupMs }) => {
  const canvas = document.querySelector(".maplibregl-canvas");
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error("no map canvas");
  const stream = canvas.captureStream(fps);
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type));
  if (!mime) throw new Error("no MediaRecorder mime");
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks = [];
  rec.addEventListener("dataavailable", (event) => {
    if (event.data.size) chunks.push(event.data);
  });
  rec.start(40);
  await new Promise((resolve) => setTimeout(resolve, warmupMs + seconds * 1000));
  rec.stop();
  await new Promise((resolve) => rec.addEventListener("stop", resolve, { once: true }));
  const bytes = new Uint8Array(await new Blob(chunks, { type: mime }).arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}, { seconds: SECONDS, fps: FPS, warmupMs: WARMUP_MS });

const raw = join(scratch, "dark.webm");
await writeFile(raw, Buffer.from(b64, "base64"));

const mp4 = join(OUT_DIR, "city-dark.mp4");
const poster = join(OUT_DIR, "city-dark.jpg");
await run("ffmpeg", [
  "-y",
  "-ss",
  (WARMUP_MS / 1000).toFixed(2),
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
  "main",
  "-level",
  "4.0",
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

await page.close();
await context.close();
await browser.close();
await rm(scratch, { recursive: true, force: true });
await rm(join(OUT_DIR, "city.mp4"), { force: true });
await rm(join(OUT_DIR, "city.jpg"), { force: true });
await rm(join(OUT_DIR, "city-light.mp4"), { force: true });
await rm(join(OUT_DIR, "city-light.jpg"), { force: true });
console.log("done");
