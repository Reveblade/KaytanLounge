"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { LoadingScreen } from "@/components/chrome/loading-screen";
import { CITY_LOOP_READY, CITY_VIDEO, CityLoopProvider } from "@/components/map/city-loop";
import { isLoungeDisplay } from "@/lib/lounge";
import { isPageCurtainUp } from "@/lib/page-ready";

function subscribe() {
  return () => undefined;
}

async function settleLayout(root: HTMLElement) {
  const fonts = document.fonts?.ready;
  if (fonts) await fonts.catch(() => undefined);
  const images = [...root.querySelectorAll("img")].filter((img) => {
    const box = img.getBoundingClientRect();
    return box.bottom > 0 && box.top < window.innerHeight + 80;
  });
  await Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalWidth) return Promise.resolve();
      return img.decode?.().catch(() => undefined) ?? Promise.resolve();
    }),
  );
  await Promise.race([
    new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    new Promise<void>((resolve) => window.setTimeout(resolve, 200)),
  ]);
}

function Curtain() {
  return (
    <div className="fixed inset-0 z-[80]">
      <LoadingScreen immediate />
    </div>
  );
}

/**
 * Holds the istanbul writing until the city is actually on screen.
 *
 * `wait="city"` (the TV reel): always. Decide video vs WebGL here, start that
 * path under the curtain, lift only when a frame has painted.
 * `wait="video"` (the homepage): only a real television waits; a laptop
 * keeps the live hero.
 */
export function TvGate({
  children,
  required = false,
  wait = "video",
}: {
  children: ReactNode;
  required?: boolean;
  wait?: "video" | "city";
}) {
  const lounge = useSyncExternalStore(subscribe, isLoungeDisplay, () => required);
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const covered = useSyncExternalStore(subscribe, isPageCurtainUp, () => false);
  const useVideo = required || lounge;
  const hold = wait === "city" || useVideo;
  const [open, setOpen] = useState(false);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!useVideo) return;
    document.documentElement.dataset.lounge = "";
    return () => {
      delete document.documentElement.dataset.lounge;
    };
  }, [useVideo]);

  useEffect(() => {
    if (!hold || open) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, [hold, open]);

  useEffect(() => {
    if (!hold || !mounted || open) return;
    const root = stage.current;
    if (!root) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      void settleLayout(root).then(() => setOpen(true));
    };
    const video = root.querySelector("video");
    if (useVideo && video && !video.paused && video.readyState >= 2) finish();
    window.addEventListener(CITY_LOOP_READY, finish, { once: true });
    window.addEventListener("biy-map-idle", finish, { once: true });
    const fallback = window.setTimeout(finish, 8_000);
    return () => {
      window.removeEventListener(CITY_LOOP_READY, finish);
      window.removeEventListener("biy-map-idle", finish);
      window.clearTimeout(fallback);
    };
  }, [hold, mounted, useVideo, open]);

  if (!hold) return children;

  if (!mounted) {
    return covered ? <div className="min-h-[100dvh] bg-bg" /> : (
      <div className="min-h-[100dvh] bg-bg">
        <LoadingScreen immediate />
      </div>
    );
  }

  const tree = useVideo ? <CityLoopProvider src={CITY_VIDEO}>{children}</CityLoopProvider> : children;

  return (
    <div className="relative min-h-[100dvh] bg-bg">
      {!open && !covered ? <Curtain /> : null}
      <div ref={stage} aria-hidden={!open}>
        {tree}
      </div>
    </div>
  );
}
