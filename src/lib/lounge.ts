/**
 * Lounge TVs (Tizen, webOS, Android TV, Fire TV). Their browsers often
 * report WebGL and then paint a black canvas — the pitched city never
 * appears. A pre-rendered loop of that same camera is what they play.
 */
const LOUNGE_UA =
  /Tizen|Web0S|WebOS|SmartTV|SMART-TV|Smart-TV|BRAVIA|HbbTV|VIDAA|CrKey|AFT|Silk\/|TV Safari|NetCast|Viera|Hisense|PhilipsTV|AppleTV|DTV|MiTV|Sony-TV/i;

export function isLoungeUA(ua: string): boolean {
  return LOUNGE_UA.test(ua);
}

export function isLoungeDisplay(): boolean {
  if (typeof navigator === "undefined") return false;
  return isLoungeUA(navigator.userAgent);
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

/** The baked loop is only for a real television, never a phone or a laptop. */
export function shouldLoopCity(loop: boolean, lounge: boolean): boolean {
  return loop || lounge;
}
