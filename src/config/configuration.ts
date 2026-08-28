export interface AppConfig {
  nodeEnv: string;
  port: number;
  host: string;
  apiPrefix: string;
  apiVersion: string;
  corsOrigins: string[];
  websiteOrigin: string;
  adminOrigin: string;
  /** Where browsers reach this API; used to build URLs for locally stored media. */
  publicOrigin: string;
  trustProxy: number | boolean;
}

export interface DatabaseConfig {
  uri: string;
  dbName: string;
}

export interface AuthConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtl: string;
  refreshTtl: string;
  saltRounds: number;
  owner: { email: string; password: string; name: string };
}

export interface KuwhoConfig {
  apiUrl: string;
  timeoutMs: number;
}

export interface BookingConfig {
  holdMinutes: number;
  approvalHours: number;
}

export interface PaymentsConfig {
  mode: 'manual' | 'live';
  providers: string[];
  stripe: { secretKey?: string; webhookSecret?: string };
  iyzico: { apiKey?: string; secretKey?: string; baseUrl: string };
  bankTransfer: { iban?: string; holder?: string };
}

export interface MediaConfig {
  cloudinary?: { cloudName: string; apiKey: string; apiSecret: string; folder: string };
  localDir: string;
  maxFileBytes: number;
}

export interface RoutingConfig {
  provider: 'osrm' | 'straight';
  osrmUrl: string;
  /** Stops closer than this are walked, not driven. */
  walkMaxKm: number;
  /** Douglas-Peucker tolerance applied to the stored line, in metres. */
  simplifyMeters: number;
}

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function num(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Cloud Run injects K_SERVICE. Local .env often still has HOST=127.0.0.1 / PORT=3300. */
export function resolveBindAddress(env: NodeJS.ProcessEnv): { host: string; port: number } {
  const onCloudRun = Boolean(env.K_SERVICE);
  const production = (env.NODE_ENV ?? 'development') === 'production';
  const host = onCloudRun || production ? '0.0.0.0' : (env.HOST?.trim() || '127.0.0.1');
  let port = int(env.PORT, onCloudRun ? 8080 : 3300);
  if (onCloudRun && port === 3300) port = 8080;
  return { host, port };
}

export function assertMongoUriForRuntime(uri: string, env: NodeJS.ProcessEnv): void {
  const hosted = Boolean(env.K_SERVICE) || (env.NODE_ENV ?? 'development') === 'production';
  if (!hosted) return;
  if (/[<>]/.test(uri)) {
    throw new Error(
      'MONGODB_URI still contains <placeholder> brackets. Use the Atlas username without them.',
    );
  }
  if (/127\.0\.0\.1|localhost/i.test(uri)) {
    throw new Error('MONGODB_URI points at localhost; Cloud Run needs the Atlas mongodb+srv:// URI.');
  }
}

export default () => {
  const env = process.env;
  const { host, port } = resolveBindAddress(env);
  assertMongoUriForRuntime(env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017', env);
  const trustProxyRaw = env.TRUST_PROXY ?? (env.K_SERVICE ? '1' : '0');
  const trustProxy: number | boolean =
    trustProxyRaw === 'true' ? true : trustProxyRaw === 'false' ? false : int(trustProxyRaw, 0);

  const cloudinaryReady = Boolean(
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
  );

  return {
    app: {
      nodeEnv: env.NODE_ENV ?? 'development',
      port,
      host,
      apiPrefix: env.API_PREFIX ?? 'api',
      apiVersion: env.API_VERSION ?? 'v1',
      corsOrigins: list(env.CORS_ORIGINS),
      websiteOrigin: env.WEBSITE_ORIGIN ?? 'http://localhost:3302',
      adminOrigin: env.ADMIN_ORIGIN ?? 'http://localhost:3301',
      publicOrigin: env.API_PUBLIC_ORIGIN ?? `http://localhost:${int(env.PORT, 3300)}`,
      trustProxy,
    } satisfies AppConfig,
    database: {
      uri: env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017',
      dbName: env.MONGODB_DB_NAME ?? 'baska_istanbul_yok',
    } satisfies DatabaseConfig,
    auth: {
      accessSecret: env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
      refreshSecret: env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
      accessTtl: env.JWT_ACCESS_TTL ?? '15m',
      refreshTtl: env.JWT_REFRESH_TTL ?? '30d',
      saltRounds: int(env.PASSWORD_SALT_ROUNDS, 12),
      owner: {
        email: env.OWNER_EMAIL ?? 'owner@baskaistanbulyok.com',
        password: env.OWNER_PASSWORD ?? 'ChangeMe-Owner-2026!',
        name: env.OWNER_NAME ?? 'Owner',
      },
    } satisfies AuthConfig,
    kuwho: {
      apiUrl: (env.KUWHO_API_URL ?? 'https://api.kuwho.com/api/v1').replace(/\/$/, ''),
      timeoutMs: int(env.KUWHO_TIMEOUT_MS, 20000),
    } satisfies KuwhoConfig,
    booking: {
      holdMinutes: int(env.BOOKING_HOLD_MINUTES, 30),
      approvalHours: int(env.BOOKING_APPROVAL_HOURS, 24),
    } satisfies BookingConfig,
    payments: {
      mode: env.PAYMENTS_MODE === 'live' ? 'live' : 'manual',
      providers: list(env.PAYMENT_PROVIDERS ?? 'iyzico,stripe,bank_transfer'),
      stripe: { secretKey: env.STRIPE_SECRET_KEY, webhookSecret: env.STRIPE_WEBHOOK_SECRET },
      iyzico: {
        apiKey: env.IYZICO_API_KEY,
        secretKey: env.IYZICO_SECRET_KEY,
        baseUrl: env.IYZICO_BASE_URL ?? 'https://sandbox-api.iyzipay.com',
      },
      bankTransfer: { iban: env.BANK_TRANSFER_IBAN, holder: env.BANK_TRANSFER_HOLDER },
    } satisfies PaymentsConfig,
    media: {
      cloudinary: cloudinaryReady
        ? {
            cloudName: env.CLOUDINARY_CLOUD_NAME!,
            apiKey: env.CLOUDINARY_API_KEY!,
            apiSecret: env.CLOUDINARY_API_SECRET!,
            folder: env.CLOUDINARY_FOLDER ?? 'biy',
          }
        : undefined,
      localDir: env.MEDIA_LOCAL_DIR ?? './uploads',
      maxFileBytes: int(env.MEDIA_MAX_FILE_BYTES, 15 * 1024 * 1024),
    } satisfies MediaConfig,
    routing: {
      provider: env.ROUTING_PROVIDER === 'straight' ? 'straight' : 'osrm',
      osrmUrl: (env.ROUTING_OSRM_URL ?? 'https://router.project-osrm.org').replace(/\/$/, ''),
      walkMaxKm: num(env.ROUTING_WALK_MAX_KM, 1.2),
      simplifyMeters: num(env.ROUTING_SIMPLIFY_METERS, 8),
    } satisfies RoutingConfig,
  };
};
