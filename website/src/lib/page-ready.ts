const MAP_IDLE = "biy-map-idle";
const LOOP_READY = "biy-city-loop-ready";

let mapIdle = false;
let loopReady = false;

export function noteMapIdle() {
  mapIdle = true;
}

export function noteLoopReady() {
  loopReady = true;
}

export function resetPageSignals() {
  mapIdle = false;
  loopReady = false;
}

export function isPageCurtainUp() {
  return typeof document !== "undefined" && document.documentElement.dataset.pageCurtain !== undefined;
}

function frames(n: number) {
  return Promise.race([
    new Promise<void>((resolve) => {
      const step = (left: number) => {
        if (left <= 0) resolve();
        else requestAnimationFrame(() => step(left - 1));
      };
      step(n);
    }),
    new Promise<void>((resolve) => window.setTimeout(resolve, 250)),
  ]);
}

function waitEvent(name: string, already: () => boolean, ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (already()) {
      resolve();
      return;
    }
    const done = () => {
      window.removeEventListener(name, done);
      signal?.removeEventListener("abort", done);
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, ms);
    window.addEventListener(name, done, { once: true });
    signal?.addEventListener("abort", done, { once: true });
  });
}

async function decodeViewport(root: ParentNode) {
  const images = [...root.querySelectorAll("img")].filter((img) => {
    const box = img.getBoundingClientRect();
    return box.bottom > 0 && box.top < window.innerHeight + 80;
  });
  await Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalWidth) return Promise.resolve();
      return img.decode().catch(() => undefined);
    }),
  );
}

/**
 * The next screen, as it actually is: type, the pictures in view, and the city
 * if this page has one. No caller names a route.
 */
export async function waitForPageReady(signal?: AbortSignal) {
  await frames(2);
  if (signal?.aborted) return;
  await document.fonts.ready.catch(() => undefined);
  await decodeViewport(document.body);
  if (signal?.aborted) return;

  const hasLoop = !!document.querySelector("[data-city='loop'], video.tv-city");
  const hasMap = !!document.querySelector("[data-city='map'], .maplibregl-canvas");
  const wait: Promise<void>[] = [];
  if (hasLoop) wait.push(waitEvent(LOOP_READY, () => loopReady, 16_000, signal));
  if (hasMap) wait.push(waitEvent(MAP_IDLE, () => mapIdle, 16_000, signal));
  await Promise.all(wait);
  await frames(2);
}
