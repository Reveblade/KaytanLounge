/**
 * Lounge TVs (Tizen, webOS, Android TV, Fire TV). Their browsers often
 * report WebGL and then paint a black canvas — the pitched city never
 * appears. A pre-rendered loop of that same camera is what they play.
 */
const LOUNGE_UA =
  /Tizen|Web0S|WebOS|SmartTV|SMART-TV|Smart-TV|BRAVIA|HbbTV|VIDAA|CrKey|AFT|TV Safari|NetCast|Viera|Hisense|PhilipsTV|AppleTV|DTV|MiTV|Sony-TV|BeyondTV|Android TV|GoogleTV|MIBOX|MiBOX|SHIELD Android|NETTV|Opera TV|TV Store|SmartHub|Orsay|Maple|WebBrowserForAndroid|SamsungBrowser\/.*TV|AOSP on.*TV|sdk_google_atv|Chromecast|Vewd|WhaleTV|Xumo|PlayStation|Xbox/i;

export function isLoungeUA(ua: string): boolean {
  return LOUNGE_UA.test(ua);
}

export function isLoungeDisplay(): boolean {
  if (typeof navigator === "undefined") return false;
  if (isLoungeUA(navigator.userAgent)) return true;
  try {
    if (window.matchMedia("tv").matches) return true;
  } catch {
    /* Old engines throw on an unknown media type. */
  }
  return false;
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
