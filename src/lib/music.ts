/**
 * The house record crate.
 *
 * Six pieces of Ottoman/Turkish classical music that play under the site — the same
 * music a guide would have on in the vehicle between two stops. Titles are the real
 * Turkish ones and are never translated; the second line is a plain-language note
 * about the piece, and that one is localized.
 *
 * Files live in /public/music with slugged names, so the URLs stay ASCII.
 */
export interface Track {
  id: string;
  /** The Turkish title, as written. Same in every locale — a name, not a string. */
  title: string;
  /** Composer, form, or era. Localized because it is a sentence, not a name. */
  note: { en: string; tr: string };
  src: string;
}

/**
 * The house radio lives in the root layout; the lounge reel only needs to ask it
 * to pause or continue. A window event is the same shape as `biy-map-ready`, and
 * a tiny store is enough for the TV chrome to know which glyph to show.
 */
export const MUSIC_TOGGLE_EVENT = "biy-music-toggle";

type PlayingListener = () => void;
const playingListeners = new Set<PlayingListener>();
let playingNow = false;

export function subscribeMusicPlaying(onStoreChange: () => void): () => void {
  playingListeners.add(onStoreChange);
  return () => {
    playingListeners.delete(onStoreChange);
  };
}

export function getMusicPlaying(): boolean {
  return playingNow;
}

export function publishMusicPlaying(next: boolean): void {
  if (playingNow === next) return;
  playingNow = next;
  playingListeners.forEach((fn) => fn());
}

export function toggleHouseMusic(): void {
  window.dispatchEvent(new Event(MUSIC_TOGGLE_EVENT));
}

export const TRACKS: Track[] = [
  {
    id: "uskudara-gider-iken",
    title: "Üsküdar'a Gider İken",
    note: { en: "Istanbul folk song · 19th century", tr: "İstanbul türküsü · 19. yüzyıl" },
    src: "/music/uskudara-gider-iken.mp3",
  },
  {
    id: "ada-sahillerinde-bekliyorum",
    title: "Ada Sahillerinde Bekliyorum",
    note: { en: "Rumelian folk song · the Princes' Islands", tr: "Rumeli türküsü · Adalar" },
    src: "/music/ada-sahillerinde-bekliyorum.mp3",
  },
  {
    id: "nihavend-longa",
    title: "Nihavend Longa",
    note: { en: "Kevser Hanım · longa in makam Nihavend", tr: "Kevser Hanım · Nihavend makamında longa" },
    src: "/music/nihavend-longa.mp3",
  },
  {
    id: "sehnaz-longa",
    title: "Şehnaz Longa",
    note: { en: "Kevser Hanım · longa in makam Şehnaz", tr: "Kevser Hanım · Şehnaz makamında longa" },
    src: "/music/sehnaz-longa.mp3",
  },
  {
    id: "sultaniyegah-sirto",
    title: "Sultanîyegâh Sirto",
    note: { en: "Tanburi Cemil Bey · sirto in makam Sultanîyegâh", tr: "Tanburi Cemil Bey · Sultanîyegâh makamında sirto" },
    src: "/music/sultaniyegah-sirto.mp3",
  },
  {
    id: "fetih-marsi",
    title: "Fetih Marşı",
    note: { en: "Ottoman military march · mehter tradition", tr: "Osmanlı marşı · mehter geleneği" },
    src: "/music/fetih-marsi.mp3",
  },
];
