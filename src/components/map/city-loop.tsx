"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { noteLoopReady } from "@/lib/page-ready";

const CACHE = "biy-city-loop-v4";
const CITY_VIDEO = "/tv/city-dark.mp4";
const Preloaded = createContext<string | null>(null);

export const CITY_LOOP_READY = "biy-city-loop-ready";

/** Fills the Cache API so the lounge gate does not start from zero. */
export function prefetchCityLoop() {
  void (async () => {
    try {
      const cache = await caches.open(CACHE);
      if (await cache.match(CITY_VIDEO)) return;
      const res = await fetch(CITY_VIDEO);
      if (res.ok) await cache.put(CITY_VIDEO, res.clone());
    } catch {
      /* Private mode, old TV, offline: the gate will fetch again. */
    }
  })();
}

/** Resolves only after the whole file is on the device. */
export async function loadCityLoop(signal?: AbortSignal): Promise<string> {
  let res: Response | undefined;
  try {
    const cache = await caches.open(CACHE);
    res = await cache.match(CITY_VIDEO);
    if (!res) {
      res = await fetch(CITY_VIDEO, { signal });
      if (!res.ok) throw new Error("city loop");
      void cache.put(CITY_VIDEO, res.clone()).catch(() => undefined);
    }
  } catch {
    res = await fetch(CITY_VIDEO, { signal });
  }
  if (!res?.ok) throw new Error("city loop");
  return URL.createObjectURL(await res.blob());
}

export function CityLoopProvider({ src, children }: { src: string; children: ReactNode }) {
  return <Preloaded.Provider value={src}>{children}</Preloaded.Provider>;
}

function announceReady() {
  noteLoopReady();
  window.dispatchEvent(new Event(CITY_LOOP_READY));
}

/**
 * The hero camera, already turned. A television plays this on the homepage
 * and the reel. No poster — a still behind the decoder is what flashed black
 * every time the file restarted.
 */
export function CityLoop({ className }: { className?: string }) {
  const preloaded = useContext(Preloaded);
  const src = preloaded ?? CITY_VIDEO;
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      el.pause();
      el.removeAttribute("autoplay");
      announceReady();
      return;
    }
    el.muted = true;
    el.defaultMuted = true;
    el.loop = false;
    el.removeAttribute("poster");
    el.setAttribute("webkit-playsinline", "true");

    const play = () => void el.play().catch(() => undefined);
    const restart = () => {
      if (!el.duration || el.duration < 0.2) return;
      if (el.currentTime >= el.duration - 0.08) {
        el.currentTime = 0.04;
        play();
      }
    };
    const onEnded = () => {
      el.currentTime = 0.04;
      play();
    };
    const onPainted = () => announceReady();

    el.addEventListener("timeupdate", restart);
    el.addEventListener("ended", onEnded);
    el.addEventListener("canplay", play);
    el.addEventListener("playing", onPainted, { once: true });
    if ("requestVideoFrameCallback" in el) {
      el.requestVideoFrameCallback(() => onPainted());
    }
    play();
    return () => {
      el.removeEventListener("timeupdate", restart);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("canplay", play);
      el.removeEventListener("playing", onPainted);
      el.pause();
    };
  }, [src]);

  return (
    <div className={className ?? "absolute inset-0 overflow-hidden bg-bg"} data-city="loop" aria-hidden>
      <video
        ref={video}
        key={src}
        className="tv-city"
        src={src}
        muted
        playsInline
        autoPlay
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        controls={false}
      >
        <source src={src} type="video/mp4" />
      </video>
    </div>
  );
}
