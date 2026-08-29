"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import Image from "next/image";
import { BookmarkSimple, ChatCircle, DotsThree, Heart, InstagramLogo, PaperPlaneTilt } from "@phosphor-icons/react";
import { isLoungeDisplay } from "@/lib/lounge";

const HANDLE = "@kaytanlounge";
const PROFILE = "https://www.instagram.com/kaytanlounge/";
const POST = "https://www.instagram.com/p/Dbz2NJQsCCd/";

/**
 * A vertical Instagram post, built for a lounge wall: the reel plays muted so
 * the house radio keeps the room, and the handle is always Kaytan's.
 */
export function InstagramReel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lounge = useSyncExternalStore(() => () => undefined, isLoungeDisplay, () => false);

  useEffect(() => {
    const video = videoRef.current;
    const root = video?.closest(".tv-root");
    if (!video) return;
    video.muted = true;

    const sync = () => {
      if (root?.getAttribute("data-paused") === "true") video.pause();
      else void video.play().catch(() => undefined);
    };

    const obs = root ? new MutationObserver(sync) : null;
    if (root && obs) obs.observe(root, { attributes: true, attributeFilter: ["data-paused"] });
    video.addEventListener("canplay", sync);
    sync();
    return () => {
      obs?.disconnect();
      video.removeEventListener("canplay", sync);
      video.pause();
    };
  }, [lounge]);

  return (
    <figure className="tv-ig tv-rise tv-d2" aria-label={`${HANDLE} Instagram`}>
      <div className="tv-ig-bezel">
        <div className="tv-ig-sheet">
          <header className="tv-ig-bar">
            <span className="tv-ig-who">
              <span className="tv-ig-ring" aria-hidden>
                <span className="tv-ig-avatar">
                  <Image src="/tv/kaytan-avatar.jpg" alt="" width={36} height={36} />
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
            {lounge ? (
              <Image src="/tv/kaytan-reel.jpg" alt="" fill sizes="360px" className="tv-ig-video object-cover" />
            ) : (
              <video
                ref={videoRef}
                className="tv-ig-video"
                src="/tv/kaytan-reel.mp4"
                poster="/tv/kaytan-reel.jpg"
                muted
                loop
                playsInline
                autoPlay
                preload="metadata"
                disablePictureInPicture
                disableRemotePlayback
                controls={false}
              />
            )}
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
