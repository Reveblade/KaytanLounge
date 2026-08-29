/**
 * Lounge TVs (Tizen, webOS, Android TV, Fire TV) ship old Chromium and a
 * fragile WebGL stack. MapLibre and Ken Burns both take the tab down or
 * shimmer the picture; the reel has to keep running without them.
 */
export function isLoungeDisplay(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Tizen|Web0S|WebOS|SmartTV|SMART-TV|Smart-TV|BRAVIA|HbbTV|VIDAA|CrKey|AFT|Silk\/|TV Safari|NetCast|Viera|Hisense|PhilipsTV|AppleTV|DTV|HbbTV|MiTV|Sony-TV/i.test(
    navigator.userAgent,
  );
}

export function canUseWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }) ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");
    return Boolean(gl);
  } catch {
    return false;
  }
}
