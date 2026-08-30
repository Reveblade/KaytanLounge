"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { isLoungeDisplay } from "@/lib/lounge";
import { noteLoopReady } from "@/lib/page-ready";

export const CITY_VIDEO = "/tv/city-dark.mp4";
export const CITY_STILL = "/tv/city-dark.jpg";
const Preloaded = createContext<string | null>(null);

export const CITY_LOOP_READY = "biy-city-loop-ready";

export function CityLoopProvider({ src, children }: { src: string; children: ReactNode }) {
  return <Preloaded.Provider value={src}>{children}</Preloaded.Provider>;
}

function announceReady() {
  noteLoopReady();
  window.dispatchEvent(new Event(CITY_LOOP_READY));
}

/**
 * The hero camera, already turned. A television plays this on the homepage
 * and the reel. The JPEG sits underneath so a decoder that never starts
 * still shows the city, not a black field.
 */
export function CityLoop({ className }: { className?: string }) {
  const preloaded = useContext(Preloaded);
  const src = preloaded ?? CITY_VIDEO;
  const video = useRef<HTMLVideoElement>(null);
  const still = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = still.current;
    if (img?.complete && img.naturalWidth) announceReady();
    else img?.addEventListener("load", announceReady, { once: true });
  }, []);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const lounge = isLoungeDisplay();
    const reduce = !lounge && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      el.pause();
      el.removeAttribute("autoplay");
      announceReady();
      return;
    }

    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;
    el.loop = true;
    el.setAttribute("webkit-playsinline", "true");
    el.removeAttribute("poster");

    const hasFrame = () => el.videoWidth > 0 && el.readyState >= 2;
    const painted = () => {
      if (!hasFrame()) return;
      el.dataset.playing = "true";
      announceReady();
    };
    const play = () => {
      void el.play()?.catch(() => undefined);
    };

    el.addEventListener("playing", painted);
    el.addEventListener("canplay", play);
    el.addEventListener("loadeddata", play);
    el.addEventListener("error", announceReady);
    if ("requestVideoFrameCallback" in el) {
      el.requestVideoFrameCallback(() => painted());
    }
    play();
    const kick = window.setInterval(() => {
      if (el.paused) play();
      else painted();
    }, 1500);

    return () => {
      window.clearInterval(kick);
      el.removeEventListener("playing", painted);
      el.removeEventListener("canplay", play);
      el.removeEventListener("loadeddata", play);
      el.removeEventListener("error", announceReady);
      el.pause();
    };
  }, [src]);

  return (
    <div className={className ?? "absolute inset-0 overflow-hidden bg-bg"} data-city="loop" aria-hidden>
      <img ref={still} className="tv-city tv-city-still" src={CITY_STILL} alt="" />
      <video
        ref={video}
        key={src}
        className="tv-city"
        src={src}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        controls={false}
      />
    </div>
  );
}
