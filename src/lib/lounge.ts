/**
 * Lounge TVs (Tizen, webOS, Android TV, Fire TV). The reel still draws the
 * city, but the camera stays flat and the framebuffer stays 1× — a pitched
 * 4K WebGL canvas is what goes black on these sets.
 */
export function isLoungeDisplay(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Tizen|Web0S|WebOS|SmartTV|SMART-TV|Smart-TV|BRAVIA|HbbTV|VIDAA|CrKey|AFT|Silk\/|TV Safari|NetCast|Viera|Hisense|PhilipsTV|AppleTV|DTV|HbbTV|MiTV|Sony-TV/i.test(
    navigator.userAgent,
  );
}
