import type { GenerateSeatMapOptions } from '../../modules/fleet/seat-map';
import type { LocalizedText, VehicleType } from '../../contract/api';

export interface SeedVehicle {
  key: string;
  name: string;
  type: VehicleType;
  make: string;
  model: string;
  year: number;
  plate: string;
  seatMap: GenerateSeatMapOptions;
  amenities: string[];
  description: LocalizedText;
}

export const SEED_VEHICLES: SeedVehicle[] = [
  {
    key: 'sprinter',
    name: 'Sprinter VIP · 34 BIY 01',
    type: 'MINIBUS',
    make: 'Mercedes-Benz',
    model: 'Sprinter 519 VIP',
    year: 2023,
    plate: '34 BIY 01',
    seatMap: { rows: 5, layout: [1, 2], fullBackRow: true, premiumRows: 1, withDriverRow: true },
    amenities: ['Wi-Fi', 'USB-C', 'Cold water', 'Reclining leather seats', 'Panoramic windows', 'Climate control'],
    description: {
      tr: 'On altı deri koltuk, geniş camlar ve her koltukta şarj. Şehir içi rotaların standardı.',
      en: 'Sixteen leather seats, tall windows and a charger at every seat. The standard for city routes.',
    },
  },
  {
    key: 'vito',
    name: 'Vito Tourer · 34 BIY 02',
    type: 'VAN',
    make: 'Mercedes-Benz',
    model: 'Vito Tourer Select',
    year: 2022,
    plate: '34 BIY 02',
    seatMap: { rows: 2, layout: [1, 2], fullBackRow: true, premiumRows: 0, withDriverRow: true },
    amenities: ['Wi-Fi', 'USB-C', 'Cold water', 'Climate control'],
    description: {
      tr: 'Yedi kişilik, sessiz ve çevik. Dar sokaklı semt rotaları ve küçük gruplar için.',
      en: 'Seven seats, quiet and nimble. For narrow-street neighbourhood routes and small groups.',
    },
  },
  {
    key: 'midibus',
    name: 'Novo Lux · 34 BIY 03',
    type: 'BUS',
    make: 'Isuzu',
    model: 'Novo Lux',
    year: 2021,
    plate: '34 BIY 03',
    seatMap: { rows: 7, layout: [2, 2], fullBackRow: false, premiumRows: 2, withDriverRow: true },
    amenities: ['Wi-Fi', 'USB', 'Cold water', 'Reclining seats', 'Luggage bay', 'Climate control', 'Microphone system'],
    description: {
      tr: 'Yirmi sekiz koltuklu midibüs. Adalar ve uzun Boğaz günleri için bagaj yeri ve yüksek oturma.',
      en: 'Twenty-eight seats with high seating and a luggage bay, for island days and long Bosphorus loops.',
    },
  },
  {
    key: 'yacht',
    name: 'Kaytan I · Motor yacht',
    type: 'YACHT',
    make: 'Custom',
    model: '18 m motor yacht',
    year: 2020,
    plate: 'IST-KY1',
    seatMap: { rows: 5, layout: [2, 2], fullBackRow: false, premiumRows: 2, withDriverRow: false },
    amenities: ['Sun deck', 'Bar', 'Restroom', 'Blankets', 'Bluetooth audio'],
    description: {
      tr: 'Kaytan Lounge iskelesinden kalkan on sekiz metrelik yat. Boğaz rotasında araç yerine tekne.',
      en: 'An eighteen-metre yacht that departs from the Kaytan Lounge pier. On the Bosphorus route the boat is the vehicle.',
    },
  },
];

export interface SeedGuide {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthYear: number;
  languages: string[];
  yearsExperience: number;
  specialties: string[];
  licenseNo: string;
  bio: LocalizedText;
}

export const SEED_GUIDES: SeedGuide[] = [
  {
    firstName: 'Elif',
    lastName: 'Kaya',
    email: 'elif.kaya@baskaistanbulyok.com',
    phone: '+90 532 000 00 01',
    birthYear: 1988,
    languages: ['tr', 'en', 'de'],
    yearsExperience: 11,
    specialties: ['Byzantine history', 'Ottoman architecture', 'Sultanahmet'],
    licenseNo: 'TUREB-34-1188',
    bio: {
      tr: 'Bizans sanat tarihi okudu, on bir yıldır Tarihi Yarımada\'da rehberlik yapıyor. Ayasofya\'nın mozaiklerini kuyruğa girmeden anlatmanın yolunu bilir.',
      en: 'Studied Byzantine art history and has guided the historic peninsula for eleven years. Knows how to show Hagia Sophia\'s mosaics without the queue.',
    },
  },
  {
    firstName: 'Mert',
    lastName: 'Aydın',
    email: 'mert.aydin@baskaistanbulyok.com',
    phone: '+90 532 000 00 02',
    birthYear: 1993,
    languages: ['tr', 'en', 'es'],
    yearsExperience: 7,
    specialties: ['Bosphorus', 'Food and drink', 'Yalı architecture'],
    licenseNo: 'TUREB-34-2093',
    bio: {
      tr: 'Boğaz\'da büyüdü; hangi iskelede hangi balıkçının iyi olduğunu ezbere bilir. Yat rotasının kaptanla birlikte planlayan rehberi.',
      en: 'Grew up on the Bosphorus and knows which pier has the good fish. Plans the yacht route with the captain.',
    },
  },
  {
    firstName: 'Zeynep',
    lastName: 'Arslan',
    email: 'zeynep.arslan@baskaistanbulyok.com',
    phone: '+90 532 000 00 03',
    birthYear: 1982,
    languages: ['tr', 'en', 'fr', 'ar'],
    yearsExperience: 15,
    specialties: ['Museums', 'Ottoman palaces', 'Islamic art'],
    licenseNo: 'TUREB-34-0882',
    bio: {
      tr: 'On beş yıldır müze ve saray turları yönetiyor. Topkapı\'nın hangi odasına hangi saatte girilmesi gerektiğini bilen az kişiden biri.',
      en: 'Fifteen years of museum and palace tours. One of the few who knows which Topkapı room to enter at which hour.',
    },
  },
  {
    firstName: 'Can',
    lastName: 'Yıldırım',
    email: 'can.yildirim@baskaistanbulyok.com',
    phone: '+90 532 000 00 04',
    birthYear: 1990,
    languages: ['tr', 'en', 'ru'],
    yearsExperience: 9,
    specialties: ['Photography', 'Balat and Fener', 'Asian side'],
    licenseNo: 'TUREB-34-1990',
    bio: {
      tr: 'Fotoğrafçı ve rehber. Balat\'ın renkli sokaklarında ışığın en iyi olduğu saati, Kadıköy\'de en iyi kahveyi bilir.',
      en: 'Photographer and guide. Knows the hour when the light is right in Balat and where the best coffee is in Kadıköy.',
    },
  },
];

/** Dev password for every seeded admin account except the owner (which comes from env). */
export const SEED_ADMIN_PASSWORD = 'BiyDemo-2026!';

export const SEED_ADMINS = [
  { email: 'manager@baskaistanbulyok.com', name: 'Deniz Şahin', roleKey: 'full_access' },
  { email: 'ops@baskaistanbulyok.com', name: 'Selin Öztürk', roleKey: 'operations_manager' },
  { email: 'content@baskaistanbulyok.com', name: 'Emre Demir', roleKey: 'content_editor' },
  { email: 'finance@baskaistanbulyok.com', name: 'Aylin Koç', roleKey: 'finance' },
  { email: 'support@baskaistanbulyok.com', name: 'Burak Çelik', roleKey: 'support' },
];
