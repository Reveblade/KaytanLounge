/**
 * What the visitor sees between pages, at full screen and with nothing to read: the
 * city's name, written in a thin monoline signature across the middle of the dark
 * field. A hairline of progress grows along the top edge. The brand's accent fills
 * the word from left to right as if a pen were travelling it, and the logotype
 * settles in underneath in the same script the brand signs with. Everything is
 * CSS/SMIL, so it costs nothing and can never be left stuck hidden by a script
 * that failed to run.
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
 * Path the accent dot rides while the signature fills in. Authored against the same
 * 1200x400 field the word sits on (Sacramento at 423, origin 66,338), so the pen
 * climbs the t, b and l loops instead of skating the baseline. Do not "correct"
 * it onto a straight line — that is when it stops reading as writing.
 */
const WRITE = [
  "M 78 318",
  "C 105 290, 120 225, 128 205",
  "C 122 250, 124 295, 138 325",
  "C 165 295, 185 225, 225 228",
  "C 265 232, 272 280, 248 318",
  "C 268 300, 285 180, 300 95",
  "C 312 55, 338 70, 328 130",
  "C 318 200, 312 280, 322 328",
  "C 360 315, 400 240, 450 238",
  "C 500 236, 525 280, 505 325",
  "C 535 310, 555 235, 590 232",
  "C 625 230, 640 280, 632 328",
  "C 655 280, 690 228, 725 238",
  "C 745 250, 740 310, 748 328",
  "C 760 240, 762 100, 768 48",
  "C 778 18, 805 35, 798 90",
  "C 788 170, 778 270, 780 328",
  "C 800 310, 845 245, 875 250",
  "C 905 260, 920 235, 948 238",
  "C 975 242, 980 290, 968 328",
  "C 990 295, 1020 238, 1045 242",
  "C 1055 180, 1058 80, 1068 42",
  "C 1080 12, 1110 28, 1102 90",
  "C 1092 170, 1085 270, 1088 328",
  "C 1115 320, 1155 275, 1175 248",
].join(" ");

/**
 * One write, one hold, one fade. Must match --loading-cycle in globals.css; the
 * animateMotion below cannot read a custom property, so it carries the number too.
 *
 * The map curtain uses this to lift on a cycle boundary rather than mid-word — the
 * screen is never cut off half-written, it is left when it has just finished.
 */
export const LOADING_CYCLE_MS = 2600;
/** Matches `--loading-delay`. A navigation that settles inside this window never plays. */
export const LOADING_DELAY_MS = 240;

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
          <svg className="absolute inset-0 h-full w-full overflow-visible font-hand" viewBox="0 0 1200 400" aria-hidden>
            <defs>
              <clipPath id="biy-loading-write">
                <rect x="0" y="0" width="0" height="400">
                  <animate attributeName="width" values="0;1200;1200;1200" keyTimes="0;0.58;0.86;1" dur="2.6s" repeatCount="indefinite" />
                </rect>
              </clipPath>
            </defs>
            {/* The word sits there as a faint casing the whole time, so even the shortest
                appearance shows a name rather than a fragment. */}
            <text x="66" y="338" fontSize="423" className="loading-word-casing">
              istanbul
            </text>
            <text x="66" y="338" fontSize="423" className="loading-word" clipPath="url(#biy-loading-write)">
              istanbul
            </text>

            {/* The pen: the brand dot riding the stroke as it is written. */}
            <g className="loading-rider">
              <circle r="22" className="loading-rider-halo" />
              <circle r="7" className="loading-rider-dot" />
              <animateMotion dur="2.6s" repeatCount="indefinite" calcMode="linear" keyPoints="0;1;1" keyTimes="0;0.58;1" path={WRITE} />
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
