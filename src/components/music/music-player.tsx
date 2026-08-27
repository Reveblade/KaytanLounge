"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CaretDown,
  CaretUp,
  Pause,
  Play,
  Repeat,
  RepeatOnce,
  Shuffle,
  SkipBack,
  SkipForward,
  SpeakerHigh,
  SpeakerLow,
  SpeakerSimpleX,
} from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n/context";
import { TRACKS } from "@/lib/music";

type RepeatMode = "off" | "all" | "one";

interface Persisted {
  index: number;
  volume: number;
  muted: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
}

const STORE_KEY = "biy-music";
const EASE = [0.22, 1, 0.36, 1] as const;
/** Where the slider sits for a first-time visitor: background, not performance. */
const DEFAULT_VOLUME = 0.35;
/** Seconds the gain takes to reach that level when the music starts by itself. */
const FADE_IN = 2.4;

/** Read once per page load; every state initialiser below draws from the same parse. */
let restored: Partial<Persisted> | null = null;
function saved(): Partial<Persisted> {
  if (typeof window === "undefined") return {};
  if (restored) return restored;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    restored = raw ? (JSON.parse(raw) as Partial<Persisted>) : {};
  } catch {
    /* Private mode, a blocked store, or a stale shape: start fresh, never crash. */
    restored = {};
  }
  return restored;
}

/** Hydration-safe "are we on the client yet": false on the server, true after mount. */
const neverChanges = () => () => {};

/**
 * The house radio.
 *
 * Mounted once in the root layout, which is what keeps a piece playing while you
 * move from the map to a route to checkout — the element never unmounts, so the
 * sound never cuts. Nothing autoplays: the first note always follows a tap.
 *
 * Two states, one component. Docked it is a pill in the bottom corner (play and a
 * caret on a phone; artwork, title and skip on a desk). Open it is a bottom sheet
 * under 640px and a floating panel above it — same markup, different anchoring, so
 * there is no viewport probe and nothing flashes on first paint.
 *
 * Loudness runs through a Web Audio gain node rather than `audio.volume`, because
 * iOS ignores volume on a media element outright and would leave the slider dead.
 */
export function MusicPlayer() {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const reduce = useReducedMotion();

  const audioRef = useRef<HTMLAudioElement>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  /** Set once the Web Audio graph proves unavailable, so we stop retrying it. */
  const noGraphRef = useRef(false);

  /* The server renders nothing, so what the store remembers can seed state directly
     without risking a hydration mismatch. */
  const mounted = useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  );

  const [expanded, setExpanded] = useState(false);
  const [index, setIndex] = useState(() => {
    const i = saved().index;
    return typeof i === "number" && TRACKS[i] ? i : 0;
  });
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    const v = saved().volume;
    /* Low by default: this starts on its own under a page nobody came here to listen
       to. Loud enough to be a room, quiet enough to talk over. */
    return typeof v === "number" ? Math.min(1, Math.max(0, v)) : DEFAULT_VOLUME;
  });
  const [muted, setMuted] = useState(() => saved().muted === true);
  const [repeat, setRepeat] = useState<RepeatMode>(() => {
    const r = saved().repeat;
    return r === "off" || r === "all" || r === "one" ? r : "all";
  });
  const [shuffle, setShuffle] = useState(() => saved().shuffle === true);

  /** Mirrors, so the audio element's own handlers never read a stale closure. */
  const indexRef = useRef(index);
  const repeatRef = useRef(repeat);
  /** The play order: identity, or a shuffle with the current track pinned first. */
  const orderRef = useRef<number[]>(TRACKS.map((_, i) => i));
  /** Whether the track we are about to load should start on its own. */
  const wantPlayRef = useRef(false);
  /** True while a thumb is down on the seek bar, so timeupdate stops fighting it. */
  const scrubRef = useRef(false);
  /** Set once sound has started, or once the visitor has taken the controls: either
   *  way the radio never tries to start itself again. */
  const selfStartDoneRef = useRef(false);

  const track = TRACKS[index];

  /* ---------- audio graph ---------- */

  const applyVolume = useCallback((v: number, m: boolean, fade = 0) => {
    const audio = audioRef.current;
    if (!audio) return;
    const gain = gainRef.current;
    const ctx = ctxRef.current;
    if (gain && ctx) {
      /* Squared, because loudness is heard closer to the square of amplitude:
         a slider at half should sound half, not a shade under full. */
      const level = m ? 0 : v * v;
      const now = ctx.currentTime;
      /* Always cancel first: a drag of the slider mid-fade must win outright, not
         blend with a ramp that is still scheduled. */
      gain.gain.cancelScheduledValues(now);
      if (fade > 0) {
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(level, now + fade);
      } else {
        gain.gain.setValueAtTime(level, now);
      }
      return;
    }
    audio.volume = v;
    audio.muted = m;
  }, []);

  const ensureGraph = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || gainRef.current || noGraphRef.current) return;
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) {
        noGraphRef.current = true;
        return;
      }
      const ctx = new Ctx();
      const source = ctx.createMediaElementSource(audio);
      const gain = ctx.createGain();
      source.connect(gain);
      gain.connect(ctx.destination);
      ctxRef.current = ctx;
      gainRef.current = gain;
      /* The element is only a source now; the gain node owns loudness. */
      audio.volume = 1;
      audio.muted = false;
    } catch {
      noGraphRef.current = true;
    }
  }, []);

  const play = useCallback(
    async (fade = false) => {
      const audio = audioRef.current;
      if (!audio) return;
      ensureGraph();
      applyVolume(volume, muted, fade ? FADE_IN : 0);
      try {
        /* play() goes first and unawaited: Safari counts the user gesture only for calls
           made synchronously inside it, and an `await resume()` ahead of this would spend
           the gesture and get the playback refused. Resuming alongside is enough. */
        const started = audio.play();
        if (ctxRef.current?.state === "suspended") void ctxRef.current.resume();
        await started;
        setFailed(false);
      } catch {
        /* Refused (no gesture yet) or unplayable: fall back to the paused truth. */
        setPlaying(false);
      }
    },
    [applyVolume, ensureGraph, muted, volume],
  );

  const pause = useCallback(() => audioRef.current?.pause(), []);

  /**
   * Start on our own, once, and only into silence.
   *
   * Nothing here overrides the visitor: if a piece is already playing this is a no-op,
   * and the moment they touch a transport control the radio stops trying forever.
   */
  const selfStart = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || selfStartDoneRef.current || !audio.paused) return;
    void play(true);
  }, [play]);

  /* ---------- track selection ---------- */

  const goTo = useCallback((next: number, andPlay: boolean) => {
    wantPlayRef.current = andPlay;
    setFailed(false);
    setTime(0);
    setDuration(0);
    setIndex(next);
  }, []);

  const advance = useCallback(
    (delta: 1 | -1, auto: boolean) => {
      const order = orderRef.current;
      const pos = Math.max(0, order.indexOf(indexRef.current));
      let nextPos = pos + delta;
      if (nextPos < 0 || nextPos >= order.length) {
        /* Running off the end on its own stops the crate unless it is set to repeat.
           Pressing skip always wraps — a transport button should never be a dead key. */
        if (auto && repeatRef.current === "off") {
          pause();
          goTo(order[0], false);
          return;
        }
        nextPos = (nextPos + order.length) % order.length;
      }
      goTo(order[nextPos], true);
    },
    [goTo, pause],
  );

  const previous = useCallback(() => {
    const audio = audioRef.current;
    /* Past the first few seconds, "back" means the top of this piece, not the last one. */
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setTime(0);
      void play();
      return;
    }
    advance(-1, false);
  }, [advance, play]);

  const toggle = useCallback(() => {
    /* The visitor has an opinion now; the radio defers to it from here on. */
    selfStartDoneRef.current = true;
    if (playing) pause();
    else void play();
  }, [pause, play, playing]);

  /* ---------- effects ---------- */

  /* Mirrors first, so a commit that moves the track updates them before the effects
     below read them. */
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({ index, volume, muted, repeat, shuffle }));
    } catch {
      /* Nothing to do if the store refuses us. */
    }
  }, [index, volume, muted, repeat, shuffle]);

  useEffect(() => applyVolume(volume, muted), [applyVolume, volume, muted, mounted]);

  /* A new src needs an explicit load; React changing the attribute is not enough. */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    if (wantPlayRef.current) void play();
    /* `play` is deliberately not a dependency: it changes with volume, and re-running
       this on a volume change would reload the track mid-bar. `mounted` is, because
       the element only exists in the DOM from the second render on. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, mounted]);

  useEffect(() => {
    orderRef.current = buildOrder(shuffle, indexRef.current);
  }, [shuffle]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => {
      selfStartDoneRef.current = true;
      setPlaying(true);
    };
    const onPause = () => setPlaying(false);
    const onTime = () => {
      if (!scrubRef.current) setTime(audio.currentTime);
    };
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnded = () => advance(1, true);
    const onError = () => {
      setFailed(true);
      setPlaying(false);
    };
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [advance, mounted]);

  /* Lock screen, headphone buttons, the now-playing widget. */
  useEffect(() => {
    if (!mounted || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    if (typeof MediaMetadata !== "undefined") {
      session.metadata = new MediaMetadata({
        title: track.title,
        artist: track.note[locale],
        album: t.brand,
      });
    }
    session.playbackState = playing ? "playing" : "paused";
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => void play()],
      ["pause", () => pause()],
      ["previoustrack", () => previous()],
      ["nexttrack", () => advance(1, false)],
    ];
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        /* An action this browser does not know: skip it. */
      }
    }
  }, [mounted, track, locale, t.brand, playing, play, pause, previous, advance]);

  /* The cue: the first map to finish drawing. The city appears, the music is already
     there. Any later map (a route, the explore page) finds the radio playing and the
     guards below turn it into a no-op. */
  useEffect(() => {
    if (!mounted) return;
    window.addEventListener("biy-map-ready", selfStart);
    return () => window.removeEventListener("biy-map-ready", selfStart);
  }, [mounted, selfStart]);

  /*
   * The safety net. Autoplay policy refuses sound on a cold first visit — no gesture
   * has been spent on this origin yet — so the cue above is silently declined and the
   * dock would just sit there paused. Take the visitor's first touch anywhere as the
   * gesture instead, and try once more. Touches on the player itself are ignored: its
   * own buttons already say what to do, and starting underneath them would fight the
   * click that is about to land.
   */
  useEffect(() => {
    if (!mounted) return;
    const onGesture = (e: Event) => {
      if (e.target instanceof Element && e.target.closest("[data-music-player]")) return;
      if (selfStartDoneRef.current) return detach();
      selfStart();
    };
    const detach = () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    return detach;
  }, [mounted, selfStart]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  if (!mounted) return null;

  /* Checkout parks a fixed summary bar at the bottom on small screens; the dock
     steps over it rather than landing on the pay button. */
  const lifted = pathname.startsWith("/book/");
  /*
   * The explore map parks its 3D switch and its zoom stack in this same corner — a
   * 36px column at right:16px. On a desk they share the bottom edge, so the dock steps
   * in past that column rather than landing on top of it. On a phone those controls
   * ride up above the reading drawer instead (see globals.css), so the two never meet
   * and the dock keeps the corner.
   */
  const besideMapControls = pathname.startsWith("/explore");
  const rightEdge = besideMapControls ? "right-5 sm:right-8 lg:right-[4.75rem]" : "right-5 sm:right-8";
  /* The map screen parks a whole drawer there and publishes how tall it is, so the
     dock rides on top of it — but never so high that it reaches the floating chrome. */
  const onMap = pathname.startsWith("/explore");
  const seekPct = duration > 0 ? (time / duration) * 100 : 0;
  const repeatLabel = repeat === "one" ? t.music.repeatOne : repeat === "all" ? t.music.repeatAll : t.music.repeatOff;
  const VolumeIcon = muted || volume === 0 ? SpeakerSimpleX : volume < 0.45 ? SpeakerLow : SpeakerHigh;

  return (
    <>
      <audio ref={audioRef} src={track.src} preload="none" loop={repeat === "one"} />

      <AnimatePresence>
        {expanded ? (
          <motion.button
            key="scrim"
            type="button"
            aria-label={t.music.minimize}
            onClick={() => setExpanded(false)}
            className="fixed inset-0 z-[44] bg-[var(--scrim)] backdrop-blur-[2px] sm:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {expanded ? (
          <motion.aside
            key="panel"
            data-music-player
            role="dialog"
            aria-label={t.music.title}
            className={clsx(
              "glass-strong fixed inset-x-0 bottom-0 z-[45] flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[28px]",
              "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
              "sm:inset-x-auto sm:bottom-5 sm:w-[380px] sm:rounded-panel sm:pb-4",
              /* Opened, it keeps the dock's column so it grows straight up out of the pill. */
              besideMapControls ? "sm:right-8 lg:right-[4.75rem]" : "sm:right-8",
            )}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.985, transition: { duration: 0.2 } }}
            transition={{ duration: 0.42, ease: EASE }}
          >
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label={t.music.minimize}
              className="flex w-full justify-center pt-3 sm:hidden"
            >
              <span className="grab-handle" />
            </button>

            <div className="flex items-start justify-between gap-3 px-5 pt-4">
              <div className="min-w-0">
                <p className="label">{t.music.title}</p>
                <p className="mt-1 truncate text-sm text-ink-muted">{t.music.lede}</p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                aria-label={t.music.minimize}
                className="btn btn-quiet btn-icon -mr-1 shrink-0"
              >
                <CaretDown size={20} weight="bold" />
              </button>
            </div>

            <div className="flex items-center gap-4 px-5 pt-5">
              <span className="player-art grid h-16 w-16 shrink-0 place-items-center rounded-card border border-line">
                <Eq on={playing} className="h-5 w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.98rem] font-semibold tracking-[-0.01em]">{track.title}</span>
                <span className="mt-0.5 block truncate text-[0.8rem] text-ink-muted">{track.note[locale]}</span>
                {failed ? <span className="mt-1 block text-[0.75rem] text-danger">{t.music.unavailable}</span> : null}
              </span>
            </div>

            <div className="px-5 pt-4">
              <input
                type="range"
                className="range"
                min={0}
                max={duration || 1}
                step={0.05}
                value={time}
                disabled={duration === 0}
                aria-label={t.music.seek}
                style={{ "--pct": seekPct } as React.CSSProperties}
                onPointerDown={() => {
                  scrubRef.current = true;
                }}
                onPointerUp={() => {
                  scrubRef.current = false;
                }}
                onBlur={() => {
                  scrubRef.current = false;
                }}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setTime(next);
                  if (audioRef.current) audioRef.current.currentTime = next;
                }}
              />
              <div className="-mt-0.5 flex justify-between text-[0.72rem] tnum text-ink-faint">
                <span>{clock(time)}</span>
                <span>{duration > 0 ? clock(duration) : "--:--"}</span>
              </div>
            </div>

            <div className="flex items-center justify-between px-5 pt-2">
              <button
                type="button"
                onClick={() => setShuffle((v) => !v)}
                aria-pressed={shuffle}
                aria-label={shuffle ? t.music.shuffleOn : t.music.shuffleOff}
                title={t.music.shuffle}
                className={clsx("btn btn-quiet btn-icon", shuffle && "text-accent")}
              >
                <Shuffle size={19} weight={shuffle ? "bold" : "regular"} />
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={previous}
                  aria-label={t.music.previous}
                  className="btn btn-quiet btn-icon !h-12 !w-12"
                >
                  <SkipBack size={22} weight="fill" />
                </button>
                <button
                  type="button"
                  onClick={toggle}
                  aria-label={playing ? t.music.pause : t.music.play}
                  className="btn btn-primary btn-icon !h-14 !w-14"
                >
                  {playing ? <Pause size={22} weight="fill" /> : <Play size={22} weight="fill" className="ml-0.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => advance(1, false)}
                  aria-label={t.music.next}
                  className="btn btn-quiet btn-icon !h-12 !w-12"
                >
                  <SkipForward size={22} weight="fill" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"))}
                aria-label={repeatLabel}
                title={t.music.repeat}
                className={clsx("btn btn-quiet btn-icon", repeat !== "off" && "text-accent")}
              >
                {repeat === "one" ? (
                  <RepeatOnce size={19} weight="bold" />
                ) : (
                  <Repeat size={19} weight={repeat === "all" ? "bold" : "regular"} />
                )}
              </button>
            </div>

            <div className="flex items-center gap-3 px-5 pt-3">
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? t.music.unmute : t.music.mute}
                className="btn btn-quiet btn-icon !h-9 !w-9 !min-h-0 shrink-0"
              >
                <VolumeIcon size={18} weight="regular" />
              </button>
              <input
                type="range"
                className="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                aria-label={t.music.volume}
                style={{ "--pct": (muted ? 0 : volume) * 100 } as React.CSSProperties}
                onChange={(e) => {
                  setVolume(Number(e.target.value));
                  setMuted(false);
                }}
              />
              <span className="w-9 shrink-0 text-right text-[0.72rem] tnum text-ink-faint">
                {Math.round((muted ? 0 : volume) * 100)}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-line px-5 pb-1 pt-3">
              <p className="label">{t.music.playlist}</p>
              <p className="text-[0.72rem] text-ink-faint">{t.music.trackCount}</p>
            </div>
            <div className="no-scrollbar flex-1 overflow-y-auto px-2 pb-2 sm:max-h-[228px]">
              {TRACKS.map((item, i) => {
                const active = i === index;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => (active ? toggle() : goTo(i, true))}
                    aria-current={active ? "true" : undefined}
                    className={clsx(
                      "flex w-full items-center gap-3 rounded-card px-3 py-2.5 text-left transition-colors duration-200",
                      active ? "bg-ink/8" : "hover:bg-ink/6",
                    )}
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center text-[0.75rem] tnum text-ink-faint">
                      {active ? <Eq on={playing} className="h-3.5 w-2.5" /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={clsx("block truncate text-[0.86rem] font-medium", active && "text-accent")}>
                        {item.title}
                      </span>
                      <span className="block truncate text-[0.73rem] text-ink-faint">{item.note[locale]}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.aside>
        ) : (
          <motion.div
            key="dock"
            data-music-player
            className={clsx(
              "glass fixed z-40 flex items-center gap-1 rounded-pill p-1.5 transition-[bottom] duration-300",
              rightEdge,
              onMap
                ? "bottom-[min(calc(var(--sheet-rest,52dvh)+0.75rem),calc(100dvh-8.5rem))] lg:bottom-5"
                : lifted
                  ? "bottom-[calc(5.25rem+env(safe-area-inset-bottom))] lg:bottom-5"
                  : "bottom-[calc(0.75rem+env(safe-area-inset-bottom))] sm:bottom-5",
            )}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96, transition: { duration: 0.18 } }}
            transition={{ duration: 0.42, ease: EASE }}
          >
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? t.music.pause : t.music.play}
              className="btn btn-primary btn-icon relative !h-10 !w-10 !min-h-0 shrink-0"
            >
              {/* Playing is already said by the pause glyph; this ring only gives the dock
                  a pulse of life at a glance, and never moves anything around it. */}
              {playing ? (
                <span
                  className="pointer-events-none absolute -inset-px rounded-pill border-2 border-[color-mix(in_srgb,var(--accent)_55%,transparent)] motion-safe:animate-pulse"
                  aria-hidden
                />
              ) : null}
              {/* Optical centring, not geometric: a triangle's mass sits left of its
                  bounding box, so a mathematically centred play glyph reads as too far
                  left. The pause bars are symmetrical and need no such nudge. */}
              {playing ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" className="translate-x-[1px]" />}
            </button>

            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="hidden min-w-0 flex-col justify-center rounded-pill px-2.5 py-1 text-left transition-colors duration-200 hover:bg-ink/6 sm:flex"
            >
              {/*
                The two lines are their own column and start at the same left edge. The
                equaliser used to sit inside this button ahead of the text, which pushed
                both lines right and — because it is only as tall as one line — left them
                looking centred against nothing. It lives with the artwork now.
              */}
              <span className="block max-w-[150px] truncate text-[0.8rem] font-medium leading-tight">{track.title}</span>
              <span className="block max-w-[150px] truncate text-[0.68rem] leading-tight text-ink-faint">
                {playing ? t.music.nowPlaying : track.note[locale]}
              </span>
            </button>

            <button
              type="button"
              onClick={() => advance(1, false)}
              aria-label={t.music.next}
              className="btn btn-quiet btn-icon !hidden !h-9 !w-9 !min-h-0 sm:!flex"
            >
              <SkipForward size={17} weight="fill" />
            </button>

            <button
              type="button"
              onClick={() => setExpanded(true)}
              aria-label={t.music.open}
              className="btn btn-quiet btn-icon !h-9 !w-9 !min-h-0"
            >
              <CaretUp size={16} weight="bold" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Eq({ on, className }: { on: boolean; className?: string }) {
  return (
    <span className={clsx("eq", className)} data-on={on ? "true" : "false"} aria-hidden>
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

/** A shuffle that always starts from where you already are. */
function buildOrder(shuffle: boolean, current: number): number[] {
  const all = TRACKS.map((_, i) => i);
  if (!shuffle) return all;
  const rest = all.filter((i) => i !== current);
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [current, ...rest];
}

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
