"use client";

import type { ComponentType } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, CreditCard, Info, PhoneCall, WhatsappLogo } from "@phosphor-icons/react";
import type { PaymentOptionDto, PaymentProvider, SettingsDto } from "@/lib/contract/api";
import { useI18n } from "@/lib/i18n/context";

/**
 * Three ways to pay, and only three: a card through iyzico, a card through Stripe,
 * or a phone call where we take it by transfer. Anything else the API happens to
 * report — paying at the venue, a booking an admin arranged by hand — is an internal
 * arrangement rather than something to put in front of a customer, so it is filtered
 * out here rather than hidden by a setting somebody can flip back on.
 */
export const OFFERED_PROVIDERS = ["IYZICO", "STRIPE", "BANK_TRANSFER"] as const;
export type OfferedProvider = (typeof OFFERED_PROVIDERS)[number];

const ICONS: Record<OfferedProvider, ComponentType<{ size?: number; weight?: "regular" | "bold" | "fill" }>> = {
  IYZICO: CreditCard,
  STRIPE: CreditCard,
  BANK_TRANSFER: PhoneCall,
};

/** The enabled options we offer, in our order rather than the API's. */
export function offeredOptions(options: PaymentOptionDto[]): PaymentOptionDto[] {
  return OFFERED_PROVIDERS.map((provider) => options.find((o) => o.provider === provider && o.enabled)).filter(
    (o): o is PaymentOptionDto => Boolean(o),
  );
}

export function isOffered(provider: PaymentProvider | null): provider is OfferedProvider {
  return OFFERED_PROVIDERS.includes(provider as OfferedProvider);
}

interface Props {
  options: PaymentOptionDto[];
  value: PaymentProvider | null;
  onChange: (provider: PaymentProvider) => void;
  settings: SettingsDto;
  /** The departure's own line, which is always set, unlike the brand-wide one. */
  contactPhone: string;
  whatsapp?: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function PaymentMethods({ options, value, onChange, settings, contactPhone, whatsapp }: Props) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const list = offeredOptions(options);
  const selected = list.find((o) => o.provider === value);
  const phone = settings.contact.phone || contactPhone;

  if (!list.length) return <p className="text-ink-muted">{t.booking.errors.PAYMENT_PROVIDER_DISABLED}</p>;

  return (
    <div>
      <div className="space-y-2.5">
        {list.map((option) => {
          const provider = option.provider as OfferedProvider;
          const copy = t.booking.pay[provider];
          const Icon = ICONS[provider];
          const active = value === option.provider;
          return (
            <button key={option.provider} type="button" onClick={() => onChange(option.provider)} aria-pressed={active} className="pay-option">
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-[13px] transition-colors duration-200 ${
                  active ? "bg-accent text-on-accent" : "bg-surface-2 text-ink-muted"
                }`}
                aria-hidden
              >
                <Icon size={20} weight="regular" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium">{copy.title}</span>
                  <span className="rounded-pill border border-line px-2 py-0.5 text-[0.7rem] font-medium text-ink-muted">{copy.tag}</span>
                </span>
                <span className="mt-1 block text-sm leading-snug text-ink-muted">{copy.note}</span>
              </span>
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-pill border transition-colors duration-200 ${
                  active ? "border-accent bg-accent text-on-accent" : "border-line-strong"
                }`}
                aria-hidden
              >
                {active ? <Check size={13} weight="bold" /> : null}
              </span>
            </button>
          );
        })}
      </div>

      {/* Only worth a strip when there is something to say: bank details, or the
          standing note that a card still goes through a person for now. */}
      <AnimatePresence mode="wait" initial={false}>
        {selected && (selected.provider === "BANK_TRANSFER" || selected.mode === "manual") ? (
          <motion.div
            key={selected.provider}
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.3, ease: EASE }}
            className="glass-soft mt-4 rounded-card p-4"
          >
            {selected.provider === "BANK_TRANSFER" ? (
              <div>
                <dl className="space-y-1.5 text-sm">
                  <Line label={t.booking.reachUsOn} value={phone} />
                  {settings.payments.bankTransfer?.holder ? <Line label={t.booking.bankHolder} value={settings.payments.bankTransfer.holder} /> : null}
                  {settings.payments.bankTransfer?.bank ? <Line label={t.booking.bankBank} value={settings.payments.bankTransfer.bank} /> : null}
                  {settings.payments.bankTransfer?.iban ? <Line label={t.booking.bankIban} value={settings.payments.bankTransfer.iban} /> : null}
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={`tel:${phone.replace(/\s/g, "")}`} className="btn btn-glass btn-sm">
                    <PhoneCall size={15} weight="bold" /> {t.tour.call}
                  </a>
                  {whatsapp ? (
                    <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="btn btn-glass btn-sm">
                      <WhatsappLogo size={15} weight="bold" /> {t.tour.whatsapp}
                    </a>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="flex gap-2.5 text-sm leading-relaxed text-ink-muted">
                <Info size={16} weight="regular" className="mt-0.5 shrink-0 text-accent" />
                {t.booking.cardManualNote}
              </p>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="font-medium tnum">{value}</dd>
    </div>
  );
}
