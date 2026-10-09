import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PaymentsConfig } from '../../config/configuration';
import type { LocalizedText, PaymentOptionDto, PaymentProvider, SettingsDto } from '../../contract/api';
import type { BookingDocument } from './booking.schema';

export interface CheckoutResult {
  /** `manual`: nothing to redirect to, an admin confirms. `redirect`: send the browser there. */
  kind: 'manual' | 'redirect';
  url?: string;
  providerRef?: string;
}

/**
 * Payment gateway seam. Phase 1 runs every provider in manual mode: the customer picks
 * how they will pay, the booking waits, an admin approves once the money is seen.
 * `createCheckout` is where the iyzico / Stripe hosted-checkout calls slot in later,
 * and `handleWebhook` is where their confirmations would land.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly config: PaymentsConfig;

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<PaymentsConfig>('payments');
  }

  get mode(): 'manual' | 'live' {
    return this.config.mode;
  }

  /** Providers the checkout screen shows, merged from env and the editable settings. */
  options(settings: SettingsDto): PaymentOptionDto[] {
    const envEnabled = new Set(this.config.providers.map((p) => p.toUpperCase()));
    return settings.payments.providers.map((p) => ({
      ...p,
      enabled: p.enabled && (envEnabled.has(p.provider) || p.provider === 'AT_VENUE' || p.provider === 'MANUAL'),
      mode: this.modeFor(p.provider),
    }));
  }

  modeFor(provider: PaymentProvider): 'manual' | 'live' {
    if (this.config.mode !== 'live') return 'manual';
    if (provider === 'STRIPE') return this.config.stripe.secretKey ? 'live' : 'manual';
    if (provider === 'IYZICO') return this.config.iyzico.apiKey && this.config.iyzico.secretKey ? 'live' : 'manual';
    return 'manual';
  }

  isEnabled(settings: SettingsDto, provider: PaymentProvider): boolean {
    return this.options(settings).some((o) => o.provider === provider && o.enabled);
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- async today for the caller's sake; the gateway adapter that lands here will await.
  async createCheckout(booking: BookingDocument, provider: PaymentProvider): Promise<CheckoutResult> {
    if (this.modeFor(provider) === 'manual') return { kind: 'manual' };
    // Gateway integration point. Kept explicit so the shape of the work is visible.
    this.logger.warn(`Live checkout requested for ${provider} on ${booking.ticketCode} but no adapter is wired; falling back to manual`);
    return { kind: 'manual' };
  }

  instructions(settings: SettingsDto, provider: PaymentProvider, booking: BookingDocument): LocalizedText {
    const option = settings.payments.providers.find((p) => p.provider === provider);
    const base = option?.instructions ?? {};
    if (provider === 'BANK_TRANSFER') {
      const bank = settings.payments.bankTransfer;
      const line = bank?.iban ? `\nIBAN: ${bank.iban}${bank.holder ? ` (${bank.holder})` : ''}` : '';
      return {
        tr: `${base.tr ?? 'Havale/EFT ile ödeme yapıp açıklamaya bilet kodunuzu yazın.'}${line}\nBilet kodu: ${booking.ticketCode}`,
        en: `${base.en ?? 'Transfer the total and quote your ticket code as the reference.'}${line}\nTicket code: ${booking.ticketCode}`,
      };
    }
    return {
      tr: base.tr ?? 'Ekibimiz ödemenizi teyit ettiğinde biletiniz onaylanır.',
      en: base.en ?? 'Your ticket is confirmed as soon as our team verifies the payment.',
    };
  }
}
