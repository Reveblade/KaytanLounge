import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainException } from '../../../common/exceptions/domain.exception';
import type { KuwhoConfig } from '../../../config/configuration';

/** What Kuwho returns from every successful sign-in, verification and refresh. */
export interface KuwhoSession {
  accessToken: string;
  refreshToken: string;
  newAccount?: boolean;
  customer: {
    id: string;
    displayName: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    phoneVerified: boolean;
    emailVerified: boolean;
  };
}

export interface KuwhoChallenge {
  challengeRequired: true;
  challengeId: string;
  email?: string;
  phone?: string;
  expiresInSeconds: number;
}

export type KuwhoLoginResult = KuwhoSession | KuwhoChallenge;

export interface KuwhoProfile {
  id: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  phoneVerified: boolean;
  email?: string;
  emailVerified: boolean;
  avatar?: { url: string; publicId?: string };
  preferredLocale: string;
  identities: { provider: string; email?: string; username?: string; linkedAt: string }[];
}

export function isKuwhoChallenge(result: KuwhoLoginResult): result is KuwhoChallenge {
  return 'challengeRequired' in result && result.challengeRequired === true;
}

/**
 * Thin HTTP client for api.kuwho.com. Kuwho's error bodies already carry stable codes
 * (OTP_INVALID, TOO_MANY_CODE_REQUESTS, ...) which are re-thrown untouched so the
 * website can translate them the same way kuwho.com does.
 */
@Injectable()
export class KuwhoClient {
  private readonly logger = new Logger(KuwhoClient.name);
  private readonly config: KuwhoConfig;

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<KuwhoConfig>('kuwho');
  }

  post<T>(path: string, body: unknown, options?: { bearer?: string; forwardedIp?: string }): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  get<T>(path: string, options?: { bearer?: string }): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  patch<T>(path: string, body: unknown, options?: { bearer?: string }): Promise<T> {
    return this.request<T>('PATCH', path, body, options);
  }

  private async request<T>(
    method: string,
    path: string,
    body: unknown,
    options?: { bearer?: string; forwardedIp?: string },
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const headers: Record<string, string> = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (options?.bearer) headers.authorization = `Bearer ${options.bearer}`;
    if (options?.forwardedIp) headers['x-forwarded-for'] = options.forwardedIp;

    let response: Response;
    try {
      response = await fetch(`${this.config.apiUrl}/${path.replace(/^\//, '')}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      this.logger.warn(`Kuwho ${method} ${path} unreachable: ${String(error)}`);
      throw new DomainException(
        'IDENTITY_PROVIDER_UNAVAILABLE',
        'The sign-in service is not reachable right now',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    const json = text ? (safeJson(text) as Record<string, unknown> | undefined) : undefined;
    if (!response.ok) {
      const code = typeof json?.code === 'string' ? json.code : 'IDENTITY_PROVIDER_ERROR';
      const message = typeof json?.message === 'string' ? json.message : `Kuwho responded ${response.status}`;
      throw new DomainException(code, message, response.status, {
        upstream: 'kuwho',
        ...(json?.details ? { details: json.details } : {}),
      });
    }
    return (json ?? {}) as T;
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
