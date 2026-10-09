import type { LocalizedList, LocalizedText, RouteNodeKind, RoutePace, RouteTheme } from '../../contract/api';

export interface SeedStop {
  kind: RouteNodeKind;
  /** Slug of the attraction or business. Missing slugs are skipped with a warning. */
  slug: string;
  stayMinutes: number;
  note?: LocalizedText;
}

export interface SeedRoute {
  slug: string;
  name: LocalizedText;
  tagline: LocalizedText;
  description: LocalizedText;
  highlights: LocalizedList;
  theme: RouteTheme;
  pace: RoutePace;
  featured: boolean;
  /** Slug whose first photo becomes the route cover. Defaults to the first attraction. */
  coverFrom?: string;
  stops: SeedStop[];
}

/**
 * Seven day-routes. Each is ordered so consecutive stops are walking distance or a
 * short drive apart, and each ends where a tired traveller wants to be: at a table.
 * The Kaytan Lounge to Green Corner route is the one the sponsors asked for.
 */
export const SEED_ROUTES: SeedRoute[] = [
  {
    slug: 'kaytan-to-green-corner',
    name: { tr: 'Kaytan\'dan Green Corner\'a', en: 'Kaytan to Green Corner' },
    tagline: { tr: 'Boğaz kıyısında başlayan, tarihi yarımadadan geçen, akşam yemeğiyle biten gün.', en: 'A day that starts on the Bosphorus, crosses the old city and ends at dinner.' },
    description: {
      tr: 'Gün Kaytan Lounge\'da çayla başlar. Dolmabahçe\'nin saat kulesinden Sultanahmet\'in kubbelerine, oradan Kapalıçarşı\'nın kapılarına ve Süleymaniye\'nin avlusuna geçilir. Akşamüstü Haliç\'in kıyısına inip Green Corner\'da masaya oturursunuz.\n\nBu rota şehri iki kere geçmez: her durak sıradakine yakındır ve yürünecek yerler yürünür. Öğle arası Kapalıçarşı çevresinde verilir; rehber nerede yenmesi gerektiğini söyler.',
      en: 'The day opens with tea at Kaytan Lounge. From the clock tower at Dolmabahçe it moves to the domes of Sultanahmet, then the gates of the Grand Bazaar and the courtyard of Süleymaniye. In the late afternoon it drops to the Golden Horn and takes a table at Green Corner.\n\nThe route never crosses the city twice. Each stop sits close to the next, and what can be walked is walked. Lunch happens around the Grand Bazaar, where the guide knows the right counter.',
    },
    highlights: {
      tr: ['Kaytan Lounge\'da hoş geldin çayı', 'Dolmabahçe Sarayı', 'Ayasofya ve Sultanahmet Camii', 'Kapalıçarşı', 'Süleymaniye Camii', 'Green Corner\'da akşam yemeği'],
      en: ['Welcome tea at Kaytan Lounge', 'Dolmabahçe Palace', 'Hagia Sophia and the Blue Mosque', 'The Grand Bazaar', 'Süleymaniye Mosque', 'Dinner at Green Corner'],
    },
    theme: 'CLASSICS',
    pace: 'FULL',
    featured: true,
    coverFrom: 'hagia-sophia',
    stops: [
      { kind: 'BUSINESS', slug: 'kaytan-lounge', stayMinutes: 45, note: { tr: 'Çay ve günün programı.', en: 'Tea and the plan for the day.' } },
      { kind: 'ATTRACTION', slug: 'dolmabahce-palace', stayMinutes: 75 },
      { kind: 'ATTRACTION', slug: 'hagia-sophia', stayMinutes: 75 },
      { kind: 'ATTRACTION', slug: 'blue-mosque', stayMinutes: 45 },
      { kind: 'ATTRACTION', slug: 'hippodrome', stayMinutes: 30 },
      { kind: 'ATTRACTION', slug: 'basilica-cistern', stayMinutes: 45 },
      { kind: 'ATTRACTION', slug: 'grand-bazaar', stayMinutes: 75 },
      { kind: 'ATTRACTION', slug: 'suleymaniye-mosque', stayMinutes: 45 },
      { kind: 'ATTRACTION', slug: 'spice-bazaar', stayMinutes: 40 },
      { kind: 'BUSINESS', slug: 'green-corner', stayMinutes: 90, note: { tr: 'Günün sonu, uzun masa.', en: 'The end of the day, at a long table.' } },
    ],
  },
  {
    slug: 'imperial-peninsula',
    name: { tr: 'İmparatorluk Yarımadası', en: 'The Imperial Peninsula' },
    tagline: { tr: 'İki imparatorluğun merkezini bir günde yürümek.', en: 'The centre of two empires, on foot, in one day.' },
    description: {
      tr: 'Topkapı\'nın avlularından Ayasofya\'ya, oradan Sultanahmet Meydanı\'nın dikilitaşlarına yürünür. Öğleden sonra Türk ve İslam Eserleri Müzesi ile Arkeoloji Müzeleri; gün Gülhane Parkı\'nda biter.\n\nBütün duraklar birbirine on dakika mesafede. Araç sadece sabah alır, akşam bırakır; arada şehir yürüyerek gezilir.',
      en: 'From the courtyards of Topkapı to Hagia Sophia, then out to the obelisks on Sultanahmet Square. The afternoon belongs to the Turkish and Islamic Arts Museum and the Archaeology Museums, and the day ends under the trees of Gülhane Park.\n\nEvery stop is ten minutes from the next. The vehicle collects you in the morning and returns in the evening; in between the city is walked.',
    },
    highlights: {
      tr: ['Topkapı Sarayı ve Harem', 'Ayasofya', 'Sultanahmet Camii', 'Türk ve İslam Eserleri Müzesi', 'Arkeoloji Müzeleri', 'Gülhane Parkı'],
      en: ['Topkapı Palace and the Harem', 'Hagia Sophia', 'The Blue Mosque', 'Turkish and Islamic Arts Museum', 'The Archaeology Museums', 'Gülhane Park'],
    },
    theme: 'CLASSICS',
    pace: 'BALANCED',
    featured: true,
    coverFrom: 'topkapi-palace',
    stops: [
      { kind: 'BUSINESS', slug: 'kaytan-lounge', stayMinutes: 40 },
      { kind: 'ATTRACTION', slug: 'topkapi-palace', stayMinutes: 120 },
      { kind: 'ATTRACTION', slug: 'hagia-sophia', stayMinutes: 75 },
      { kind: 'ATTRACTION', slug: 'blue-mosque', stayMinutes: 45 },
      { kind: 'ATTRACTION', slug: 'hippodrome', stayMinutes: 30 },
      { kind: 'ATTRACTION', slug: 'turkish-islamic-arts-museum', stayMinutes: 60 },
      { kind: 'ATTRACTION', slug: 'istanbul-archaeology-museums', stayMinutes: 75 },
      { kind: 'ATTRACTION', slug: 'gulhane-park', stayMinutes: 45 },
    ],
  },
  {
    slug: 'bosphorus-by-water',
    name: { tr: 'Boğaz, sudan', en: 'The Bosphorus, by Water' },
    tagline: { tr: 'Yalıların önünden geçen, iki kıtaya da ayak basan gün.', en: 'Past the waterfront mansions, with a foot on each continent.' },
    description: {
      tr: 'Kaytan Lounge\'un iskelesinden kalkan tekne Boğaz\'ı yukarı çıkar: Ortaköy, Rumeli Hisarı, Emirgan. Anadolu Kavağı\'nda karaya çıkılır, Yoros Kalesi\'ne tırmanılır ve öğle yemeği balıkçıda yenir.\n\nDönüşte Beylerbeyi Sarayı ve Kız Kulesi görülür. Bu rotada araç yerine tekne vardır; koltuk seçimi güverte için geçerlidir.',
      en: 'The boat leaves from the Kaytan Lounge pier and works its way up the strait: Ortaköy, Rumeli Fortress, Emirgan. It ties up at Anadolu Kavağı, where the climb to Yoros Castle is followed by lunch at a fish restaurant.\n\nOn the way back it passes Beylerbeyi Palace and Maiden\'s Tower. On this route the boat is the vehicle, and your seat is on deck.',
    },
    highlights: {
      tr: ['Kaytan Lounge iskelesinden kalkış', 'Ortaköy Camii ve köprü', 'Rumeli Hisarı', 'Yoros Kalesi', 'Beylerbeyi Sarayı', 'Kız Kulesi'],
      en: ['Departure from the Kaytan Lounge pier', 'Ortaköy Mosque under the bridge', 'Rumeli Fortress', 'Yoros Castle', 'Beylerbeyi Palace', 'Maiden\'s Tower'],
    },
    theme: 'BOSPHORUS',
    pace: 'RELAXED',
    featured: true,
    coverFrom: 'ortakoy-mosque',
    stops: [
      { kind: 'BUSINESS', slug: 'kaytan-lounge', stayMinutes: 45 },
      { kind: 'ATTRACTION', slug: 'ortakoy-mosque', stayMinutes: 40 },
      { kind: 'ATTRACTION', slug: 'bebek-arnavutkoy', stayMinutes: 50 },
      { kind: 'ATTRACTION', slug: 'rumeli-fortress', stayMinutes: 60 },
      { kind: 'ATTRACTION', slug: 'emirgan-park', stayMinutes: 50 },
      { kind: 'ATTRACTION', slug: 'anadolu-kavagi-yoros', stayMinutes: 120, note: { tr: 'Kaleye çıkış ve iskelede balık.', en: 'The climb to the castle, then fish at the quay.' } },
      { kind: 'ATTRACTION', slug: 'beylerbeyi-palace', stayMinutes: 60 },
      { kind: 'ATTRACTION', slug: 'maidens-tower', stayMinutes: 45 },
    ],
  },
  {
    slug: 'golden-horn-colours',
    name: { tr: 'Haliç\'in renkleri', en: 'Colours of the Golden Horn' },
    tagline: { tr: 'Balat\'ın sokakları, Kariye\'nin mozaikleri, Pierre Loti\'de gün batımı.', en: 'The streets of Balat, the mosaics of Chora, sunset at Pierre Loti.' },
    description: {
      tr: 'Sabah Kariye\'nin mozaikleriyle başlanır, sonra Fener ve Balat\'ın renkli cepheleri arasında yürünür. Öğleden sonra Eyüp Sultan Camii, ardından teleferikle Pierre Loti Tepesi\'ne çıkılır.\n\nHaliç boyunca ilerleyen bu rota, şehrin en fotojenik saatlerini yakalamak için akşamüstüne göre kurgulandı.',
      en: 'The morning starts with the mosaics at Chora, then walks the coloured facades of Fener and Balat. The afternoon takes in Eyüp Sultan Mosque before the cable car up to Pierre Loti Hill.\n\nThe route follows the Golden Horn and is timed for the late-afternoon light the city is photographed in.',
    },
    highlights: {
      tr: ['Kariye Camii mozaikleri', 'Fener ve Balat sokakları', 'Eyüp Sultan Camii', 'Pierre Loti Tepesi', 'Haliç manzarası'],
      en: ['The Chora mosaics', 'The streets of Fener and Balat', 'Eyüp Sultan Mosque', 'Pierre Loti Hill', 'The Golden Horn from above'],
    },
    theme: 'GOLDEN_HORN',
    pace: 'BALANCED',
    featured: true,
    coverFrom: 'balat-fener',
    stops: [
      { kind: 'BUSINESS', slug: 'kaytan-lounge', stayMinutes: 40 },
      { kind: 'ATTRACTION', slug: 'chora-church', stayMinutes: 60 },
      { kind: 'ATTRACTION', slug: 'balat-fener', stayMinutes: 90 },
      { kind: 'ATTRACTION', slug: 'eyup-sultan-mosque', stayMinutes: 45 },
      { kind: 'ATTRACTION', slug: 'pierre-loti-hill', stayMinutes: 60 },
      { kind: 'ATTRACTION', slug: 'spice-bazaar', stayMinutes: 45 },
      { kind: 'BUSINESS', slug: 'green-corner', stayMinutes: 90 },
    ],
  },
  {
    slug: 'two-continents',
    name: { tr: 'İki kıta', en: 'Two Continents' },
    tagline: { tr: 'Sabah Avrupa, öğleden sonra Asya, akşam Boğaz.', en: 'Europe in the morning, Asia after lunch, the Bosphorus at dusk.' },
    description: {
      tr: 'Galata Kulesi ve İstiklal Caddesi ile başlanır, Galataport\'tan vapura binilir. Kadıköy ve Moda\'da yürünür, Çamlıca Tepesi\'nden şehrin tamamı görülür ve gün Kız Kulesi manzarasıyla kapanır.\n\nBu rota şehri bir kez enine keser; iki yaka arasındaki farkı bir günde görmek isteyenler için.',
      en: 'It begins at Galata Tower and İstiklal Avenue, then boards a ferry at Galataport. Kadıköy and Moda are walked, Çamlıca Hill gives the whole city at once, and the day closes with the view of Maiden\'s Tower.\n\nThe route crosses the water once. It is for people who want to feel the difference between the two sides in a single day.',
    },
    highlights: {
      tr: ['Galata Kulesi', 'İstiklal Caddesi', 'Vapurla karşıya geçiş', 'Kadıköy ve Moda', 'Çamlıca Tepesi', 'Kız Kulesi'],
      en: ['Galata Tower', 'İstiklal Avenue', 'The ferry crossing', 'Kadıköy and Moda', 'Çamlıca Hill', 'Maiden\'s Tower'],
    },
    theme: 'TWO_CONTINENTS',
    pace: 'FULL',
    featured: false,
    coverFrom: 'galata-tower',
    stops: [
      { kind: 'BUSINESS', slug: 'kaytan-lounge', stayMinutes: 40 },
      { kind: 'ATTRACTION', slug: 'galata-tower', stayMinutes: 60 },
      { kind: 'ATTRACTION', slug: 'istiklal-avenue', stayMinutes: 75 },
      { kind: 'ATTRACTION', slug: 'pera-museum', stayMinutes: 50 },
      { kind: 'ATTRACTION', slug: 'galataport-istanbul-modern', stayMinutes: 75 },
      { kind: 'ATTRACTION', slug: 'kadikoy-moda', stayMinutes: 90 },
      { kind: 'ATTRACTION', slug: 'camlica-hill', stayMinutes: 60 },
      { kind: 'ATTRACTION', slug: 'maidens-tower', stayMinutes: 45 },
    ],
  },
  {
    slug: 'markets-and-mezze',
    name: { tr: 'Çarşılar ve meze', en: 'Markets and Mezze' },
    tagline: { tr: 'Baharatın, balığın ve akşam sofrasının rotası.', en: 'A route made of spice, fish and a long evening table.' },
    description: {
      tr: 'Mısır Çarşısı\'ndan başlayıp Rüstem Paşa Camii\'nin çinilerine, oradan Kapalıçarşı\'nın hanlarına gidilir. Öğleden sonra Galata ve Çiçek Pasajı; akşam Green Corner\'da meze sofrası kurulur.\n\nYemek üzerine kurulu bir gün: rehber tadılacak yerleri bilir, aralar buna göre ayarlandı.',
      en: 'From the Spice Bazaar to the tiles of Rüstem Pasha Mosque, then into the hans of the Grand Bazaar. The afternoon is Galata and Çiçek Pasajı; the evening is a mezze table at Green Corner.\n\nA day built around eating. The guide knows what to taste where, and the gaps are timed for it.',
    },
    highlights: {
      tr: ['Mısır Çarşısı', 'Rüstem Paşa Camii çinileri', 'Kapalıçarşı hanları', 'Çiçek Pasajı', 'Green Corner\'da meze'],
      en: ['The Spice Bazaar', 'The tiles of Rüstem Pasha', 'The hans of the Grand Bazaar', 'Çiçek Pasajı', 'Mezze at Green Corner'],
    },
    theme: 'GASTRONOMY',
    pace: 'RELAXED',
    featured: false,
    coverFrom: 'spice-bazaar',
    stops: [
      { kind: 'BUSINESS', slug: 'kaytan-lounge', stayMinutes: 40 },
      { kind: 'ATTRACTION', slug: 'spice-bazaar', stayMinutes: 60 },
      { kind: 'ATTRACTION', slug: 'rustem-pasha-mosque', stayMinutes: 30 },
      { kind: 'ATTRACTION', slug: 'grand-bazaar', stayMinutes: 90 },
      { kind: 'ATTRACTION', slug: 'galata-tower', stayMinutes: 45 },
      { kind: 'ATTRACTION', slug: 'cicek-pasaji', stayMinutes: 60 },
      { kind: 'BUSINESS', slug: 'green-corner', stayMinutes: 120 },
    ],
  },
  {
    slug: 'princes-island-day',
    name: { tr: 'Adalar günü', en: 'An Island Day' },
    tagline: { tr: 'Büyükada\'da faytonsuz, motorsuz, telaşsız bir gün.', en: 'A day on Büyükada with no cars and nothing to rush for.' },
    description: {
      tr: 'Sabah vapurla Büyükada\'ya geçilir. Ahşap köşkler arasında yürünür, tepedeki manastıra çıkılır, öğle yemeği iskele boyunda yenir. Akşamüstü şehre dönüp Moda sahilinde gün batımı izlenir.\n\nBu rotanın temposu kasıtlı olarak düşük: adada acele etmenin bir anlamı yok.',
      en: 'The morning ferry crosses to Büyükada. The day is spent walking among the wooden mansions, climbing to the monastery on the hill and eating lunch along the quay. In the late afternoon the city returns, and the sun sets over Moda.\n\nThe pace is deliberately slow. Nothing on the island rewards hurry.',
    },
    highlights: {
      tr: ['Vapur yolculuğu', 'Büyükada\'nın ahşap köşkleri', 'Aya Yorgi tepesi', 'İskele boyunda öğle yemeği', 'Moda\'da gün batımı'],
      en: ['The ferry crossing', 'The wooden mansions of Büyükada', 'The hill of Aya Yorgi', 'Lunch along the quay', 'Sunset at Moda'],
    },
    theme: 'ISLANDS',
    pace: 'RELAXED',
    featured: false,
    coverFrom: 'buyukada',
    stops: [
      { kind: 'BUSINESS', slug: 'kaytan-lounge', stayMinutes: 40 },
      { kind: 'ATTRACTION', slug: 'buyukada', stayMinutes: 300 },
      { kind: 'ATTRACTION', slug: 'kadikoy-moda', stayMinutes: 90 },
    ],
  },
];

export interface SeedSchedule {
  vehicleKey: string;
  guideIndex: number;
  /** Short weekday names in en-US, matched against Istanbul local days. */
  weekdays: string[];
  startTime: string;
  languages: string[];
  /** Adult fare in minor units (cents of EUR). */
  adult: number;
  meetAtFirstStop?: boolean;
}

export const SEED_SCHEDULE: Record<string, SeedSchedule> = {
  'kaytan-to-green-corner': { vehicleKey: 'sprinter', guideIndex: 0, weekdays: ['Tue', 'Thu', 'Sat'], startTime: '08:30', languages: ['en', 'tr'], adult: 18900, meetAtFirstStop: true },
  'imperial-peninsula': { vehicleKey: 'midibus', guideIndex: 2, weekdays: ['Mon', 'Wed', 'Fri', 'Sun'], startTime: '09:00', languages: ['en', 'tr', 'fr'], adult: 14900 },
  'bosphorus-by-water': { vehicleKey: 'yacht', guideIndex: 1, weekdays: ['Wed', 'Sat', 'Sun'], startTime: '10:00', languages: ['en', 'tr', 'es'], adult: 24900, meetAtFirstStop: true },
  'golden-horn-colours': { vehicleKey: 'vito', guideIndex: 3, weekdays: ['Tue', 'Fri'], startTime: '09:30', languages: ['en', 'tr', 'ru'], adult: 13900 },
  'two-continents': { vehicleKey: 'sprinter', guideIndex: 1, weekdays: ['Mon', 'Fri'], startTime: '08:45', languages: ['en', 'tr'], adult: 16900 },
  'markets-and-mezze': { vehicleKey: 'vito', guideIndex: 0, weekdays: ['Thu', 'Sun'], startTime: '10:30', languages: ['en', 'tr', 'de'], adult: 15900 },
  'princes-island-day': { vehicleKey: 'midibus', guideIndex: 3, weekdays: ['Sat'], startTime: '08:00', languages: ['en', 'tr'], adult: 12900 },
};
