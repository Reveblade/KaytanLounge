"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CaretLeft, CaretRight, MusicNotes, Pause, Play, X } from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n/context";
import { pickText } from "@/lib/i18n/pick";
import { getMusicPlaying, subscribeMusicPlaying, toggleHouseMusic } from "@/lib/music";
import { TvBackdrop } from "./tv-backdrop";
import { Scene, type SceneId, type TvData } from "./tv-scenes";

const IDLE_MS = 3200;

/**
 * A looping reel of the product, built for a television, a lounge wall, a booth.
 *
 * The city is the homepage map: OpenFreeMap behind the reel. A lounge set
 * gets the same pitched city at a 1080p budget; the baked still holds the
 * frame until WebGL paints.
 */
export function TvShow(data: TvData) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const indexRef = useRef(0);
  const elapsedRef = useRef(0);
  const [index, setIndex] = useState(0);
  const [beat, setBeat] = useState(0);
  const [paused, setPaused] = useState(false);
  const [awake, setAwake] = useState(true);
  const musicPlaying = useSyncExternalStore(subscribeMusicPlaying, getMusicPlaying, () => false);

  const mapNodes = useMemo(
    () =>
      (data.featured?.nodes ?? []).map((n) => ({
        id: `${n.kind}:${n.refId}`,
        order: n.order,
        kind: n.kind,
        location: n.place.location,
        label: pickText(n.place.name, locale),
      })),
    [data.featured, locale],
  );

  const scenes = useMemo(() => {
    const list: { id: SceneId; ms: number }[] = [{ id: "open", ms: 12000 }];
    if (data.routes.length) list.push({ id: "routes", ms: 16000 });
    if (data.featured?.nodes.length) list.push({ id: "day", ms: 18000 });
    list.push({ id: "map", ms: 11000 });
    if (data.highlights.length) list.push({ id: "places", ms: 13000 });
    if (data.titleSponsor) list.push({ id: "partners", ms: 20000 });
    list.push({ id: "company", ms: 14000 });
    list.push({ id: "book", ms: 12000 });
    list.push({ id: "music", ms: 8000 });
    list.push({ id: "close", ms: 11000 });
    return list;
  }, [data.routes.length, data.featured, data.highlights.length, data.titleSponsor]);

  const paint = useCallback((b: number, i: number, n: number) => {
    const el = rootRef.current;
    if (!el) return;
    el.style.setProperty("--tv-beat", b.toFixed(4));
    el.style.setProperty("--tv-loop", ((i + b) / n).toFixed(4));
  }, []);

  const go = useCallback(
    (next: number) => {
      const wrapped = (next + scenes.length) % scenes.length;
      elapsedRef.current = 0;
      indexRef.current = wrapped;
      setIndex(wrapped);
      setBeat(0);
      paint(0, wrapped, scenes.length);
    },
    [paint, scenes.length],
  );

  const toggle = useCallback(() => {
    setPaused((p) => {
      pausedRef.current = !p;
      return !p;
    });
  }, []);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.classList.add("tv-active");
    body.classList.add("tv-active");
    return () => {
      html.classList.remove("tv-active");
      body.classList.remove("tv-active");
    };
  }, []);

  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        lock = await navigator.wakeLock?.request("screen");
      } catch {
        /* Unsupported, denied, or the document is hidden. */
      }
    };
    void request();
    const onVis = () => {
      if (document.visibilityState === "visible") void request();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release();
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastPaint = 0;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (!pausedRef.current) {
        elapsedRef.current += dt;
        const current = scenes[indexRef.current];
        const ms = current?.ms ?? 8000;
        if (elapsedRef.current >= ms) {
          const next = (indexRef.current + 1) % scenes.length;
          elapsedRef.current = 0;
          indexRef.current = next;
          setIndex(next);
          setBeat(0);
          paint(0, next, scenes.length);
        } else {
          const b = elapsedRef.current / ms;
          paint(b, indexRef.current, scenes.length);
          if (now - lastPaint > 80) {
            lastPaint = now;
            setBeat(b);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paint, scenes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "k" || e.key === "Enter") {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowRight" || e.key === "l") {
        e.preventDefault();
        go(indexRef.current + 1);
      } else if (e.key === "ArrowLeft" || e.key === "j") {
        e.preventDefault();
        if (elapsedRef.current > 1400) go(indexRef.current);
        else go(indexRef.current - 1);
      } else if (e.key === "Escape") {
        router.push("/");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, toggle, router]);

  useEffect(() => {
    let hide: number | undefined;
    const poke = () => {
      setAwake(true);
      window.clearTimeout(hide);
      hide = window.setTimeout(() => {
        if (!pausedRef.current) setAwake(false);
      }, IDLE_MS);
    };
    poke();
    window.addEventListener("pointermove", poke);
    window.addEventListener("pointerdown", poke);
    return () => {
      window.clearTimeout(hide);
      window.removeEventListener("pointermove", poke);
      window.removeEventListener("pointerdown", poke);
    };
  }, [paused]);

  const scene = scenes[index] ?? scenes[0];
  const showChrome = awake || paused;

  return (
    <div
      ref={rootRef}
      data-theme="dark"
      data-paused={paused ? "true" : "false"}
      data-awake={showChrome ? "true" : "false"}
      className="tv-root relative h-[100vh] h-[100dvh] w-full overflow-hidden bg-bg text-ink"
      onPointerUp={(event) => {
        if ((event.target as HTMLElement).closest("a, button")) return;
        toggle();
      }}
    >
      <TvBackdrop path={data.featured?.path} nodes={mapNodes} />

      {scene ? (
        <div key={scene.id} className="absolute inset-0 z-10 tv-scene">
          <Scene id={scene.id} beat={beat} data={data} t={t} locale={locale} />
        </div>
      ) : null}

      <div className="tv-progress" aria-hidden>
        <i />
      </div>

      <div
        className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-4 transition-opacity duration-500 sm:px-6"
        style={{ opacity: showChrome ? 1 : 0, pointerEvents: showChrome ? "auto" : "none" }}
      >
        <Link href="/" className="text-[0.95rem] font-medium leading-none tracking-[-0.01em] text-ink/80 no-underline">
          baskaistanbulyok.com
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-music-player
            className="btn btn-quiet btn-icon !h-10 !w-10"
            onClick={toggleHouseMusic}
            aria-label={musicPlaying ? t.tv.pauseMusic : t.tv.playMusic}
            title={musicPlaying ? t.tv.pauseMusic : t.tv.playMusic}
          >
            <MusicNotes size={18} weight={musicPlaying ? "fill" : "regular"} />
          </button>
          <span className="mx-1 h-3.5 w-px bg-ink/20" aria-hidden />
          <button type="button" className="btn btn-quiet btn-icon !h-10 !w-10" onClick={() => go(index - 1)} aria-label={t.tv.previousScene}>
            <CaretLeft size={18} weight="bold" />
          </button>
          <button type="button" className="btn btn-quiet btn-icon !h-10 !w-10" onClick={toggle} aria-label={paused ? t.tv.play : t.tv.pause}>
            {paused ? <Play size={16} weight="fill" className="translate-x-[1px]" /> : <Pause size={16} weight="fill" />}
          </button>
          <button type="button" className="btn btn-quiet btn-icon !h-10 !w-10" onClick={() => go(index + 1)} aria-label={t.tv.nextScene}>
            <CaretRight size={18} weight="bold" />
          </button>
          <Link href="/" className="btn btn-quiet btn-icon !h-10 !w-10 ml-1" aria-label={t.tv.exit}>
            <X size={18} weight="regular" />
          </Link>
        </div>
      </div>
    </div>
  );
}
