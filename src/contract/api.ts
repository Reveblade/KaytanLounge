/**
 * The wire contract between the Başka İstanbul Yok API and its two Next.js clients.
 *
 * Deliberately import-free: `npm run contract:sync` copies this file verbatim into
 * `website/src/lib/contract/api.ts` and `admin/src/lib/contract/api.ts`. Enum-valued
 * fields are string unions so the copy stays self-contained. The wire is JSON.
 */

// ---------------------------------------------------------------------------
// Locale and shared value shapes
// ---------------------------------------------------------------------------

export const LOCALES = ['tr', 'en', 'de', 'ru', 'ar'] as const
export type Locale = (typeof LOCALES)[number]

/** A piece of copy in one or more languages. `en` and `tr` are the guaranteed pair. */
export type LocalizedText = Partial<Record<Locale, string>>
export type LocalizedList = Partial<Record<Locale, string[]>>

export interface GeoPoint {
  lat: number
  lng: number
}

export type MediaKind = 'IMAGE' | 'VIDEO'
export type MediaProvider = 'EXTERNAL' | 'CLOUDINARY' | 'LOCAL'

export interface MediaItem {
  id: string
  kind: MediaKind
  url: string
  /** Poster frame for videos, downsized copy for images. */
  thumbnailUrl?: string
  provider: MediaProvider
  publicId?: string
  width?: number
  height?: number
  alt?: LocalizedText
  credit?: string
  license?: string
  sourceUrl?: string
}

export type CurrencyCode = 'TRY' | 'EUR' | 'USD' | 'GBP'

/** Money in minor units (kuruş, cents). */
export interface Money {
  amount: number
  currency: CurrencyCode
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ApiErrorBody {
  statusCode: number
  code: string
  message: string
  details?: Record<string, unknown>
  timestamp: string
  path: string
}

// ---------------------------------------------------------------------------
// Catalog: attractions and businesses (route nodes)
// ---------------------------------------------------------------------------

export const ATTRACTION_TYPES = [
  'HISTORICAL',
  'MUSEUM',
  'MOSQUE',
  'PALACE',
  'VIEWPOINT',
  'NATURE',
  'MARKET',
  'NEIGHBORHOOD',
  'WATERFRONT',
  'LANDMARK',
] as const
export type AttractionType = (typeof ATTRACTION_TYPES)[number]

export const BUSINESS_CATEGORIES = ['RESTAURANT', 'LOUNGE', 'CAFE', 'SHOP', 'HOTEL', 'OTHER'] as const
export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number]

export const SPONSOR_TIERS = ['TITLE', 'PARTNER', 'STANDARD'] as const
export type SponsorTier = (typeof SPONSOR_TIERS)[number]

export type PublishStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export interface AttractionDto {
  id: string
  slug: string
  type: AttractionType
  name: LocalizedText
  summary: LocalizedText
  description: LocalizedText
  tips?: LocalizedText
  district: string
  address?: string
  location: GeoPoint
  openingHours?: string
  ticket?: LocalizedText
  visitMinutes: number
  tags: string[]
  media: MediaItem[]
  featured: boolean
  status: PublishStatus
  createdAt: string
  updatedAt: string
}

export interface BusinessContact {
  phone?: string
  whatsapp?: string
  instagram?: string
  website?: string
  email?: string
}

export interface BusinessDto {
  id: string
  slug: string
  category: BusinessCategory
  sponsorTier: SponsorTier
  name: LocalizedText
  summary: LocalizedText
  description: LocalizedText
  district: string
  address?: string
  location: GeoPoint
  contact: BusinessContact
  openingHours?: string
  cuisine: string[]
  features: LocalizedList
  /** What a ticket holder gets at the venue, shown on the node sheet. */
  offer?: LocalizedText
  visitMinutes: number
  media: MediaItem[]
  logo?: MediaItem
  featured: boolean
  status: PublishStatus
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export type RouteNodeKind = 'ATTRACTION' | 'BUSINESS'

export interface RouteNodeDto {
  kind: RouteNodeKind
  refId: string
  order: number
  stayMinutes: number
  /** Travel from the previous node, filled by the routing provider. */
  travelMinutes: number
  travelKm: number
  note?: LocalizedText
}

/** A route node with its place resolved, as the website needs it. */
export interface RouteNodeResolvedDto extends RouteNodeDto {
  place: AttractionDto | BusinessDto
  /** Minutes from the tour start until arrival at this node. */
  arrivalOffsetMinutes: number
}

export type RoutePace = 'RELAXED' | 'BALANCED' | 'FULL'
export const ROUTE_THEMES = [
  'CLASSICS',
  'BOSPHORUS',
  'GOLDEN_HORN',
  'TWO_CONTINENTS',
  'HIDDEN',
  'GASTRONOMY',
  'ISLANDS',
] as const
export type RouteTheme = (typeof ROUTE_THEMES)[number]

export interface GeoJsonLineString {
  type: 'LineString'
  coordinates: [number, number][]
}

export interface RouteDto {
  id: string
  slug: string
  name: LocalizedText
  tagline: LocalizedText
  description: LocalizedText
  highlights: LocalizedList
  theme: RouteTheme
  pace: RoutePace
  nodes: RouteNodeDto[]
  path?: GeoJsonLineString
  distanceKm: number
  durationMinutes: number
  cover?: MediaItem
  featured: boolean
  status: PublishStatus
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Fleet and guides
// ---------------------------------------------------------------------------

export type SeatCellKind = 'SEAT' | 'DRIVER' | 'GUIDE' | 'AISLE' | 'EMPTY' | 'DOOR' | 'TABLE'

export interface SeatCell {
  row: number
  col: number
  kind: SeatCellKind
  /** Present on SEAT cells: the label passengers see, e.g. "3A". */
  label?: string
  /** Window / front rows can carry a surcharge. */
  premium?: boolean
}

export interface SeatMap {
  rows: number
  cols: number
  cells: SeatCell[]
}

export type VehicleType = 'MINIBUS' | 'BUS' | 'VAN' | 'BOAT' | 'YACHT' | 'CAR'
export type VehicleStatus = 'ACTIVE' | 'MAINTENANCE' | 'RETIRED'

export interface VehicleDto {
  id: string
  name: string
  type: VehicleType
  make?: string
  model?: string
  year?: number
  plate?: string
  seatMap: SeatMap
  seatCount: number
  amenities: string[]
  description: LocalizedText
  media: MediaItem[]
  status: VehicleStatus
  createdAt: string
  updatedAt: string
}

export interface GuideDto {
  id: string
  firstName: string
  lastName: string
  displayName: string
  photo?: MediaItem
  bio: LocalizedText
  birthYear?: number
  /** ISO 639-1 codes the guide can lead a tour in. */
  languages: string[]
  phone?: string
  email?: string
  yearsExperience?: number
  specialties: string[]
  licenseNo?: string
  status: 'ACTIVE' | 'INACTIVE'
  /** Admin account this guide signs in with, when they have one. */
  adminId?: string
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Tours and templates
// ---------------------------------------------------------------------------

export const PRICE_TIER_KEYS = ['ADULT', 'CHILD', 'INFANT', 'STUDENT', 'SENIOR'] as const
export type PriceTierKey = (typeof PRICE_TIER_KEYS)[number]

export interface PriceTier {
  key: PriceTierKey
  label: LocalizedText
  amount: number
  minAge?: number
  maxAge?: number
}

export interface TourPricing {
  currency: CurrencyCode
  tiers: PriceTier[]
  /** Added to any seat flagged premium on the seat map. */
  premiumSeatSurcharge: number
}

export interface MeetingPoint {
  name: LocalizedText
  address?: string
  location: GeoPoint
  instructions?: LocalizedText
}

export type TourStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED'

/** Everything a tour and a template share. */
export interface TourCore {
  routeId: string
  vehicleId: string
  guideId: string
  meetingPoint: MeetingPoint
  languages: string[]
  pricing: TourPricing
  inclusions: LocalizedList
  exclusions: LocalizedList
  contactPhone: string
  whatsapp?: string
  cancellationPolicy: LocalizedText
  blockedSeats: string[]
  minPassengers?: number
  /** Overrides the route duration for this particular departure. */
  durationMinutes?: number
  internalNotes?: string
}

export interface TourTemplateDto extends TourCore {
  id: string
  name: string
  /** "09:00" in Europe/Istanbul */
  defaultStartTime: string
  createdAt: string
  updatedAt: string
}

export interface TourDto extends TourCore {
  id: string
  startsAt: string
  endsAt: string
  status: TourStatus
  templateId?: string
  seatCount: number
  bookedSeats: number
  publishedAt?: string
  cancelledAt?: string
  cancellationReason?: string
  createdAt: string
  updatedAt: string
}

/** A tour row as the admin lists it, with its relations named. */
export interface TourListItemDto extends TourDto {
  routeName: LocalizedText
  routeSlug: string
  guideName: string
  vehicleName: string
  pendingApprovals: number
}

/** Lightweight card data for the website's route panel. */
export interface TourSummaryDto {
  id: string
  startsAt: string
  endsAt: string
  status: TourStatus
  languages: string[]
  pricing: TourPricing
  seatCount: number
  seatsLeft: number
  guide: Pick<GuideDto, 'id' | 'displayName' | 'photo' | 'languages' | 'yearsExperience'>
  vehicle: Pick<VehicleDto, 'id' | 'name' | 'type' | 'seatCount' | 'media' | 'amenities'>
}

/**
 * The result of rolling a template out over a list of dates. A date the guide or the
 * vehicle could not take is reported rather than failing the whole batch.
 */
export interface TourBatchResultDto {
  created: TourDto[]
  skipped: { date: string; reason: string }[]
}

export interface TourDetailDto extends TourDto {
  route: RouteDto
  guide: GuideDto
  vehicle: VehicleDto
  seatsLeft: number
  /** Seat labels no longer purchasable (booked, held, or blocked). */
  unavailableSeats: string[]
}

// ---------------------------------------------------------------------------
// Bookings, payments, tickets
// ---------------------------------------------------------------------------

export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'AWAITING_APPROVAL'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'EXPIRED'

export const PAYMENT_PROVIDERS = ['IYZICO', 'STRIPE', 'BANK_TRANSFER', 'AT_VENUE', 'MANUAL'] as const
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number]
export type PaymentStatus = 'UNPAID' | 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED'

export interface BookingPassenger {
  seatLabel: string
  fullName: string
  tierKey: PriceTierKey
  amount: number
  checkedInAt?: string
}

export interface BookingPayment {
  provider: PaymentProvider
  status: PaymentStatus
  /** Gateway id or bank reference, whichever exists. */
  reference?: string
  approvedByAdminId?: string
  approvedAt?: string
  refundedAt?: string
  refundAmount?: number
  note?: string
}

export interface BookingDto {
  id: string
  ticketCode: string
  /** Absent on walk-in bookings an admin recorded without a customer account. */
  customerId?: string
  tourId: string
  status: BookingStatus
  passengers: BookingPassenger[]
  contact: { fullName: string; phone: string; email?: string }
  subtotal: number
  discount: number
  total: number
  currency: CurrencyCode
  payment: BookingPayment
  locale: Locale
  notes?: string
  holdExpiresAt?: string
  confirmedAt?: string
  cancelledAt?: string
  cancellationReason?: string
  createdAt: string
  updatedAt: string
}

/** The booking with the departure it belongs to. */
export interface BookingDetailDto extends BookingDto {
  customer?: Pick<CustomerDto, 'id' | 'displayName' | 'phone' | 'email'>
  tour: {
    id: string
    startsAt: string
    endsAt: string
    status: TourStatus
    meetingPoint: MeetingPoint
    contactPhone: string
    whatsapp?: string
    route: Pick<RouteDto, 'id' | 'slug' | 'name' | 'tagline' | 'cover' | 'durationMinutes'>
    guide: Pick<GuideDto, 'id' | 'displayName' | 'photo' | 'languages' | 'phone'>
    vehicle: Pick<VehicleDto, 'id' | 'name' | 'type' | 'plate'>
  }
}

export interface TicketDto {
  booking: BookingDetailDto
  /** PNG data URL of the QR the guide scans at the meeting point. */
  qrDataUrl: string
}

export interface PaymentOptionDto {
  provider: PaymentProvider
  enabled: boolean
  /** `manual` waits for an admin; `live` redirects to the gateway. */
  mode: 'manual' | 'live'
  label: LocalizedText
  instructions?: LocalizedText
}

// ---------------------------------------------------------------------------
// Customers (mirror of the Kuwho consumer account)
// ---------------------------------------------------------------------------

export interface CustomerDto {
  id: string
  kuwhoCustomerId: string
  displayName: string
  firstName?: string
  lastName?: string
  phone?: string
  phoneVerified: boolean
  email?: string
  emailVerified: boolean
  avatarUrl?: string
  preferredLocale: Locale
  bookingsCount?: number
  lastSeenAt?: string
  createdAt: string
}

/**
 * The customer as the admin panel sees them: the mirrored profile plus the internal note
 * support keeps. `adminNotes` is returned only by the admin endpoints — never by
 * `/customers/me`, and never by the customer list.
 */
export interface AdminCustomerDto extends CustomerDto {
  adminNotes?: string
}

export interface CustomerSessionDto {
  accessToken: string
  refreshToken: string
  customer: CustomerDto
  newAccount?: boolean
}

/** Returned instead of a session when Kuwho needs a second proof (social link). */
export interface CustomerChallengeDto {
  challengeRequired: true
  challengeId: string
  email?: string
  phone?: string
  expiresInSeconds: number
}

export type CustomerLoginResult = CustomerSessionDto | CustomerChallengeDto

// ---------------------------------------------------------------------------
// Admin realm
// ---------------------------------------------------------------------------

export const PERMISSIONS = [
  'CATALOG_READ',
  'CATALOG_WRITE',
  'ROUTES_READ',
  'ROUTES_WRITE',
  'FLEET_READ',
  'FLEET_WRITE',
  'GUIDES_READ',
  'GUIDES_WRITE',
  'TOURS_READ',
  'TOURS_WRITE',
  'TOURS_PUBLISH',
  'BOOKINGS_READ',
  'BOOKINGS_WRITE',
  'BOOKINGS_CHECKIN',
  'PAYMENTS_READ',
  'PAYMENTS_APPROVE',
  'PAYMENTS_REFUND',
  'CUSTOMERS_READ',
  'CUSTOMERS_WRITE',
  'ADMINS_READ',
  'ADMINS_WRITE',
  'ROLES_READ',
  'ROLES_WRITE',
  'SETTINGS_READ',
  'SETTINGS_WRITE',
  'MEDIA_WRITE',
  'REPORTS_READ',
  'AUDIT_READ',
] as const
export type Permission = (typeof PERMISSIONS)[number]

export interface PermissionGroupDto {
  key: string
  label: string
  permissions: { key: Permission; label: string; description: string }[]
}

/** OWNER is held by exactly one account. FULL holds every permission. STANDARD is custom. */
export type RoleTier = 'OWNER' | 'FULL' | 'STANDARD'

export interface AdminRoleDto {
  id: string
  key: string
  name: string
  description?: string
  tier: RoleTier
  permissions: Permission[]
  isSystem: boolean
  adminCount?: number
  createdAt: string
  updatedAt: string
}

export type AdminStatus = 'ACTIVE' | 'SUSPENDED'

export interface AdminDto {
  id: string
  email: string
  name: string
  phone?: string
  role: Pick<AdminRoleDto, 'id' | 'key' | 'name' | 'tier'>
  isOwner: boolean
  status: AdminStatus
  guideId?: string
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

export interface AdminSessionDto {
  accessToken: string
  refreshToken: string
  admin: AdminDto
  permissions: Permission[]
}

export interface AuditLogDto {
  id: string
  actorId?: string
  actorName?: string
  action: string
  resourceType: string
  resourceId?: string
  summary?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface SettingsDto {
  brand: { name: string; tagline: LocalizedText }
  contact: {
    phone?: string
    whatsapp?: string
    email?: string
    address?: string
    instagram?: string
    facebook?: string
    youtube?: string
    tiktok?: string
  }
  defaultCurrency: CurrencyCode
  payments: {
    providers: PaymentOptionDto[]
    bankTransfer?: { iban?: string; holder?: string; bank?: string }
  }
  booking: { holdMinutes: number; approvalHours: number }
  /** Slugs pinned to the landing page, in order. */
  featuredRouteSlugs: string[]
  updatedAt?: string
}

// ---------------------------------------------------------------------------
// Public (website) composites
// ---------------------------------------------------------------------------

export interface RouteCardDto {
  id: string
  slug: string
  name: LocalizedText
  tagline: LocalizedText
  theme: RouteTheme
  pace: RoutePace
  cover?: MediaItem
  nodeCount: number
  distanceKm: number
  durationMinutes: number
  nextTourAt?: string
  upcomingTours: number
  priceFrom?: Money
  /** First few node thumbnails for the card strip. */
  nodePreviews: { name: LocalizedText; media?: MediaItem; kind: RouteNodeKind; slug: string }[]
}

export interface RouteDetailDto extends Omit<RouteDto, 'nodes'> {
  nodes: RouteNodeResolvedDto[]
  tours: TourSummaryDto[]
}

export type PublicPlaceDto =
  | { kind: 'ATTRACTION'; place: AttractionDto; routes: RouteCardDto[] }
  | { kind: 'BUSINESS'; place: BusinessDto; routes: RouteCardDto[] }

export interface PublicBootstrapDto {
  settings: SettingsDto
  sponsors: BusinessDto[]
  featuredRoutes: RouteCardDto[]
  paymentOptions: PaymentOptionDto[]
  /** Published attractions with media, for the landing page mosaic. */
  highlights: AttractionDto[]
}

export interface DashboardDto {
  today: { tours: number; passengers: number; checkedIn: number }
  pending: { approvals: number; awaitingAmount: Money }
  next7Days: { tours: number; seatsSold: number; seatsTotal: number }
  revenue30d: Money
  recentBookings: BookingDetailDto[]
  upcomingTours: TourListItemDto[]
}
