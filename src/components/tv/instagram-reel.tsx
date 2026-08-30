"use client";

import { useEffect, useRef } from "react";
import { BookmarkSimple, ChatCircle, DotsThree, Heart, InstagramLogo, PaperPlaneTilt } from "@phosphor-icons/react";

const HANDLE = "@kaytanlounge";
const PROFILE = "https://www.instagram.com/kaytanlounge/";
const POST = "https://www.instagram.com/p/Dbz2NJQsCCd/";
const REEL = "/tv/kaytan-reel.mp4";
const STILL = "/tv/kaytan-reel.jpg";

/**
 * A vertical Instagram post, built for a lounge wall: the reel plays muted so
 * the house radio keeps the room, and the handle is always Kaytan's.
 */
export function InstagramReel() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const root = video?.closest(".tv-root");
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("webkit-playsinline", "true");

    const play = () => {
      void video.play()?.catch(() => undefined);
    };
    const painted = () => {
      if (video.videoWidth > 0) video.dataset.playing = "true";
    };
    const sync = () => {
      const leaving = video.closest(".tv-scene-out");
      if (leaving || root?.getAttribute("data-paused") === "true") video.pause();
      else play();
    };

    const obs = root ? new MutationObserver(sync) : null;
    if (root && obs) obs.observe(root, { attributes: true, attributeFilter: ["data-paused"] });
    video.addEventListener("canplay", sync);
    video.addEventListener("playing", painted);
    sync();
    return () => {
      obs?.disconnect();
      video.removeEventListener("canplay", sync);
      video.removeEventListener("playing", painted);
      video.pause();
    };
  }, []);

  return (
    <figure className="tv-ig tv-rise tv-d2" aria-label={`${HANDLE} Instagram`}>
      <div className="tv-ig-bezel">
        <div className="tv-ig-sheet">
          <header className="tv-ig-bar">
            <span className="tv-ig-who">
              <span className="tv-ig-ring" aria-hidden>
                <span className="tv-ig-avatar">
                  <img src="/tv/kaytan-avatar.jpg" alt="" width={36} height={36} />
                </span>
              </span>
              <span>
                <span className="tv-ig-handle">{HANDLE}</span>
                <span className="tv-ig-meta">Ortaköy</span>
              </span>
            </span>
            <span className="tv-ig-brand" aria-hidden>
              <InstagramLogo size={18} weight="fill" />
              <DotsThree size={22} weight="bold" />
            </span>
          </header>

          <div className="tv-ig-stage">
            <video
              ref={videoRef}
              className="tv-ig-video"
              src={REEL}
              poster={STILL}
              muted
              loop
              playsInline
              autoPlay
              preload="auto"
              controls={false}
            />
          </div>

          <footer className="tv-ig-bar tv-ig-foot">
            <span className="tv-ig-actions" aria-hidden>
              <Heart size={22} weight="regular" />
              <ChatCircle size={22} weight="regular" />
              <PaperPlaneTilt size={22} weight="regular" />
              <span className="tv-ig-spacer" aria-hidden />
              <BookmarkSimple size={22} weight="regular" />
            </span>
            <p className="tv-ig-caption">
              <span>{HANDLE}</span>
              <span>Boğaz’ın tam kıyısında başlayan bir sabah.</span>
            </p>
          </footer>
        </div>
      </div>
      <figcaption className="sr-only">
        {HANDLE} · {PROFILE} · {POST}
      </figcaption>
    </figure>
  );
}
