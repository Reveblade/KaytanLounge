"use client";

import { useEffect, useRef } from "react";
import { noteLoopReady } from "@/lib/page-ready";

export const CITY_VIDEO = "/tv/city-dark.mp4";
export const CITY_STILL = "/tv/city-dark.jpg";
export const CITY_LOOP_READY = "biy-city-loop-ready";

function announceReady() {
  noteLoopReady();
  window.dispatchEvent(new Event(CITY_LOOP_READY));
}

/**
 * A muted looping MP4. Televisions get this in the first HTML — no WebGL,
 * no blob URL, no opacity hide. CSS that creates a compositor layer
 * (opacity / isolate / transform) on this node punches a black hole on
 * Tizen and webOS because the hardware video plane cannot draw into it.
 */
export function CityLoop({ className }: { className?: string }) {
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
  }, []);

  return (
    <div className={className ?? "tv-city-wrap"} data-city="loop" aria-hidden>
      <video
        ref={video}
        className="tv-city"
        src={CITY_VIDEO}
        poster={CITY_STILL}
        width={1280}
        height={720}
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
