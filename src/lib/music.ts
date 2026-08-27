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
