# Partner venue photography

Drop the venue's **own** photographs here and they replace the stand-in imagery that
ships in `businesses.json`.

```
seed-content/venues/
  kaytan-lounge/
    01-terrace.jpg
    02-bosphorus-tables.jpg
    03-late-night.jpg
    photos.json        (optional)
  green-corner/
    ...
```

- Any `.jpg`, `.jpeg`, `.png`, `.webp` or `.avif` file is picked up.
- **Filename order is display order**, so number them: the first file becomes the map
  marker thumbnail and the gallery's opening frame.
- Three to six photographs per venue works best. The gallery shows a thumbnail strip
  from the second photograph onwards.

Then re-host them into the database:

```bash
SEED_MEDIA=import npm run seed
```

Each file is re-encoded to WebP, capped at 2400px, given a 640px thumbnail, and served
from the API — nothing is hotlinked.

## Credits and alt text (optional)

`photos.json` sits beside the images and is keyed by filename:

```json
{
  "01-terrace.jpg": {
    "credit": "Kaytan Lounge",
    "alt": {
      "en": "The open-air terrace at dusk, tables set along the Bosphorus rail",
      "tr": "Alacakaranlıkta açık hava terası, Boğaz korkuluğu boyunca kurulmuş masalar"
    }
  }
}
```

`credit` prints under the gallery. `alt` is what a screen reader announces and what
search engines read, so describe what is actually in the frame, in both languages.

## Permission

These are the venues' photographs, not ours. Get written permission from the venue
before adding them, and record who granted it. Do not take images from a venue's
Instagram or website without asking — the copyright belongs to them or to the
photographer they hired.

## The other way in

The admin panel does the same job without a re-seed: **Businesses → open the venue →
Photos**. Uploads made there survive a later `npm run seed`; the seed only fills a
venue's photographs when it has none, or when files are present in this folder.
