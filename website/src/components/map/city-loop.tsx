"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/components/chrome/prefs-toggles";
import { noteLoopReady } from "@/lib/page-ready";

export const CITY_VIDEO = "/tv/city-dark.mp4";
export const CITY_STILL = "/tv/city-dark.jpg";
export const CITY_LOOP_READY = "biy-city-loop-ready";

const FILES = {
  dark: { video: "/tv/city-dark.mp4", still: "/tv/city-dark.jpg" },
  light: { video: "/tv/city-light.mp4", still: "/tv/city-light.jpg" },
} as const;

function announceReady() {
  noteLoopReady();
  window.dispatchEvent(new Event(CITY_LOOP_READY));
}

/**
 * A muted looping MP4 of the hero camera at its real orbit. Light and dark
 * are separate files. Televisions get this in the first HTML — no WebGL,
 * no blob URL, no opacity hide.
 */
export function CityLoop({
  className,
  theme: locked,
}: {
  className?: string;
  theme?: "light" | "dark";
}) {
  const prefs = useTheme();
  const mode = locked ?? prefs;
  const files = FILES[mode];
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;
    el.setAttribute("webkit-playsinline", "true");
    const play = () => void el.play()?.catch(() => undefined);
    play();
    const kick = window.setInterval(() => {
      if (el.paused) play();
    }, 2000);
    return () => window.clearInterval(kick);
  }, [files.video]);

  return (
    <div className={className ?? "tv-city-wrap"} data-city="loop" aria-hidden>
      <video
        ref={video}
        key={files.video}
        className="tv-city"
        src={files.video}
        poster={files.still}
        width={1920}
        height={1080}
        muted
        loop
        autoPlay
        playsInline
        preload="auto"
        controls={false}
        onPlaying={announceReady}
        onError={announceReady}
      />
    </div>
  );
}
