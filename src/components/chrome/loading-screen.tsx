/**
 * What the visitor sees between pages, at full screen and with nothing to read: the
 * route does not wander, it writes the city's name. One continuous stroke spells
 * "İstanbul" in a monoline hand across the middle of the dark field, the brand's
 * accent dot travels along it as the pen, and the logotype settles in underneath in
 * the same script the brand signs with. A hairline of progress grows along the top
 * edge. Everything is CSS/SMIL, so it costs nothing and can never be left stuck
 * hidden by a script that failed to run.
 *
 * It is a normal viewport-high block rather than `position: fixed`, so it cannot be
 * trapped by a transformed ancestor.
 *
 * As a Suspense fallback it does not appear straight away: it lives exactly as long as
 * the data takes, and a navigation that resolves in under --loading-delay would only
 * flash. `.loading-screen` holds it invisible for that window (see globals.css), so a
 * quick page never shows it and a slow one gets all of it.
 *
 * `immediate` drops that hold, for the one caller that is not waiting on data but
 * covering for something already on screen — the map screen, whose curtain takes over
 * the moment the page mounts and stays up until the city has actually drawn itself.
 */

/**
 * "İstanbul" written the way a hand would: one stroke, entered at the baseline on the
 * left and left again on the right, with only the two marks a hand goes back for —
 * the dot over the İ and the bar across the t — lifted out below.
 *
 * Authored by hand against a 1200x400 field: baseline 292, x-height 218, ascenders
 * 128. A later rewrite put every letter on strictly shared metrics with a measured
 * shear and ligatures between them; it was more even and it read worse, so this is
 * the hand that stays. Do not "correct" it back.
 *
 * Kept as one path so `pathLength` can write the whole word with a single dash, and
 * so the rider has an unbroken line to travel.
 */
const WORD = [
  "M 112 272",
  // İ — a tall capital loop, entered low from the left
  "C 146 254, 186 202, 210 134 C 220 106, 252 110, 248 142 C 244 172, 206 198, 200 236 C 195 268, 210 292, 232 294 C 248 296, 260 288, 270 276",
  // s
  "C 276 256, 284 230, 292 216 C 298 204, 316 206, 314 222 C 312 238, 294 240, 292 258 C 290 278, 316 296, 338 286 C 348 281, 355 273, 362 266",
  // t — the stem only; its bar is a second stroke
  "C 370 250, 386 186, 398 134 C 402 118, 416 120, 413 140 C 408 178, 400 242, 402 276 C 406 298, 428 304, 446 290",
  // a — bowl closed against its stem
  "C 462 284, 486 264, 502 230 C 490 206, 452 214, 450 254 C 448 290, 480 308, 502 290 C 512 278, 514 252, 506 232 C 508 254, 508 278, 512 290 C 518 304, 540 306, 556 292",
  // n — two shoulders
  "C 568 284, 576 246, 582 224 C 588 206, 612 208, 616 240 C 619 264, 616 280, 618 292 C 622 260, 632 226, 646 214 C 662 202, 684 212, 686 246 C 687 268, 684 282, 686 294 C 692 306, 712 306, 724 292",
  // b — ascender loop, then the bowl, exiting at x-height
  "C 738 276, 754 200, 764 136 C 768 116, 790 118, 784 146 C 778 176, 756 240, 754 282 C 752 302, 774 312, 798 306 C 822 300, 834 274, 818 256 C 802 238, 774 248, 768 266 C 786 254, 814 250, 836 258",
  // u
  "C 846 266, 850 282, 854 292 C 862 308, 886 302, 890 268 C 893 244, 894 228, 896 218 C 892 246, 888 274, 892 292 C 900 308, 924 304, 928 268 C 931 244, 932 230, 934 218",
  // l — ascender loop and the exit swash
  "C 940 194, 958 148, 974 128 C 984 114, 1002 118, 996 148 C 988 184, 972 244, 972 278 C 974 300, 996 308, 1024 300 C 1056 290, 1084 274, 1104 256",
].join(" ");

/** The bar of the t and the dot of the İ: the two marks the hand comes back for. */
const T_BAR = "M 372 196 C 396 186, 424 190, 448 182";
const I_DOT = { cx: 250, cy: 76, r: 8 };

/**
 * One write, one hold, one fade. Must match --loading-cycle in globals.css; the
 * animateMotion below cannot read a custom property, so it carries the number too.
 *
 * The map curtain uses this to lift on a cycle boundary rather than mid-word — the
 * screen is never cut off half-written, it is left when it has just finished.
 */
export const LOADING_CYCLE_MS = 2600;

export function LoadingScreen({ label = "Loading", immediate = false }: { label?: string; immediate?: boolean }) {
  return (
    <div
      className={`loading-screen ambient relative min-h-[100dvh] overflow-hidden bg-bg${immediate ? " loading-screen-now" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="loading-bar absolute inset-x-0 top-0 h-[2px] bg-accent" aria-hidden />

      <div className="absolute inset-0 grid place-items-center">
        <div className="relative w-[min(112vw,1240px)]" style={{ aspectRatio: "1200 / 400" }}>
          <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 1200 400" fill="none" aria-hidden>
            {/* The word sits there as a faint casing the whole time, so even the shortest
                appearance shows a name rather than a fragment. */}
            <path d={WORD} className="loading-route-casing" />
            <path d={T_BAR} className="loading-route-casing" />
            <circle {...I_DOT} className="loading-mark-casing" />

            {/* The accent writes over the casing, letter by letter. */}
            <path d={WORD} className="loading-route" pathLength={1} />
            {/* Each mark lights as the pen leaves its letter — the İ ends 14% of the way
                along the stroke, the t 32%, and the delays in globals.css are those two
                numbers mapped onto the write. */}
            <path d={T_BAR} className="loading-route loading-mark-bar" pathLength={1} />
            <circle {...I_DOT} className="loading-mark-dot" />

            {/* The pen: the brand dot riding the stroke as it is written. */}
            <g className="loading-rider">
              <circle r="22" className="loading-rider-halo" />
              <circle r="7" className="loading-rider-dot" />
              <animateMotion dur="2.6s" repeatCount="indefinite" calcMode="linear" keyPoints="0;1;1" keyTimes="0;0.58;1" path={WORD} />
            </g>
          </svg>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-[15vh] flex justify-center">
        {/* The logotype, in the one hand the brand allows. Yellowtail already leans, so
            nothing here skews it, and the descenders need the room `leading-none` takes. */}
        <p
          className="stagger-now flex items-baseline gap-[0.24em] pb-[0.12em] font-script text-[clamp(2rem,5vw,3.4rem)] leading-none text-ink"
          style={{ "--stagger": "0.12s", "--stagger-base": "var(--loading-delay)" } as React.CSSProperties}
        >
          <span>Başka</span>
          <span>İstanbul</span>
          <span>Yok</span>
        </p>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
