import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const outDir = path.join(process.cwd(), "public", "tv");
const outFile = path.join(outDir, "city.jpg");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  colorScheme: "dark",
});
page.setDefaultTimeout(90_000);
await page.goto("http://127.0.0.1:3302/tv/bake.html", { waitUntil: "load" });
await page.waitForFunction(() => document.documentElement.dataset.ready === "true");
await page.waitForTimeout(6000);
await page.screenshot({ path: outFile, type: "jpeg", quality: 86 });
await browser.close();
console.log("wrote", outFile);
