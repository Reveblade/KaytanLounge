/**
 * Lounge TVs (Tizen, webOS, Android TV, Fire TV). The reel still wants the
 * pitched city; what goes black is a 4K canvas at 2×, not the tilt itself.
 * Callers keep the still underneath and paint WebGL at a 1080p budget.
 */
export function isLoungeDisplay(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Tizen|Web0S|WebOS|SmartTV|SMART-TV|Smart-TV|BRAVIA|HbbTV|VIDAA|CrKey|AFT|Silk\/|TV Safari|NetCast|Viera|Hisense|PhilipsTV|AppleTV|DTV|HbbTV|MiTV|Sony-TV/i.test(
    navigator.userAgent,
  );
}

let webgl: boolean | null = null;

/** Cached: creating a context on every snapshot would churn the GPU. */
export function canPaintWebGL(): boolean {
  if (typeof document === "undefined") return false;
  if (webgl !== null) return webgl;
  try {
    const canvas = document.createElement("canvas");
    webgl = !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    webgl = false;
  }
  return webgl;
}
