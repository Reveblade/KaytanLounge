"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { LoadingScreen } from "@/components/chrome/loading-screen";
import { isLoungeDisplay } from "@/lib/lounge";
import { isPageCurtainUp } from "@/lib/page-ready";

function subscribe() {
  return () => undefined;
}

function Curtain() {
  return (
    <div className="fixed inset-0 z-[80]">
      <LoadingScreen immediate />
    </div>
  );
}

/**
 * A television already has the city `<video>` in the HTML. Do not wrap it
 * in a client-only curtain — that is a black screen until React hydrates,
 * and many lounge browsers never finish that step.
 *
 * Desktop `/tv` still waits for the live map to paint.
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
  const useVideo = required || lounge;
  const holdMap = wait === "city" && !useVideo;
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const covered = useSyncExternalStore(subscribe, isPageCurtainUp, () => false);
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
    if (!holdMap || open) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, [holdMap, open]);

  useEffect(() => {
    if (!holdMap || !mounted || open) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setOpen(true);
    };
    window.addEventListener("biy-map-idle", finish, { once: true });
    const fallback = window.setTimeout(finish, 8_000);
    return () => {
      window.removeEventListener("biy-map-idle", finish);
      window.clearTimeout(fallback);
    };
  }, [holdMap, mounted, open]);

  if (!holdMap) return children;

  if (!mounted) {
    return covered ? <div className="min-h-[100dvh] bg-bg" /> : (
      <div className="min-h-[100dvh] bg-bg">
        <LoadingScreen immediate />
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] bg-bg">
      {!open && !covered ? <Curtain /> : null}
      <div ref={stage} aria-hidden={!open}>
        {children}
      </div>
    </div>
  );
}
