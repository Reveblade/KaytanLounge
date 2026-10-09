"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, LockSimple } from "@phosphor-icons/react";
import { api, ApiError } from "@/lib/api/client";
import type { AttractionDto, BookingDetailDto, BusinessDto, PaymentOptionDto, PaymentProvider, PriceTierKey, SettingsDto, TourDetailDto } from "@/lib/contract/api";
import { fareFrom, formatDate, formatDuration, formatMoney, formatTime, languageName } from "@/lib/format";
import { useI18n } from "@/lib/i18n/context";
import { useSession } from "@/lib/session/context";
import { PlaceImage } from "@/components/media/place-image";
import { Reveal } from "@/components/motion/reveal";
import { PaymentMethods, offeredOptions } from "./payment-methods";
import { SeatMapView } from "./seat-map";
import { TourTabs } from "./tour-tabs";

interface Passenger {
  seatLabel: string;
  fullName: string;
  tierKey: PriceTierKey;
}

interface Contact {
  fullName: string;
  phone: string;
  email: string;
}

/**
 * The departure page reads before it sells. It opens on the tour itself — the day,
 * the vehicle, the guide, each in its own tab — and only turns into a checkout when
 * the customer asks for one, at which point it walks the three questions that
 * actually need answering, in the order they depend on each other: which seats, who
 * is sitting in them, and how the day gets paid for.
 *
 * Nothing is held until the customer confirms, and confirming needs a signed-in
 * account so the ticket has somewhere to live.
 */

type Stage = "details" | "seats" | "passengers" | "payment";
const STEPS = ["seats", "passengers", "payment"] as const;

const EASE = [0.22, 1, 0.36, 1] as const;
const MAX_SEATS = 12;

interface Props {
  tour: TourDetailDto;
  /** The stop the meeting point stands at, when it is one; only its picture is used. */
  meetingPlace?: AttractionDto | BusinessDto | null;
  routeName: string;
  paymentOptions: PaymentOptionDto[];
  settings: SettingsDto;
}

export function BookingFlow({ tour, meetingPlace, routeName, paymentOptions, settings }: Props) {
  const { t, locale } = useI18n();
  const { customer, loading } = useSession();
  const router = useRouter();
  const reduce = useReducedMotion();

  const [stage, setStage] = useState<Stage>("details");
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  /**
   * Prefilled from the account until the first edit, after which the form owns every
   * field outright — clearing one has to leave it cleared, not resurrect the account
   * value. The session can arrive after mount, so this is derived rather than seeded.
   */
  const [edited, setEdited] = useState<Contact | null>(null);
  const contact: Contact = edited ?? {
    fullName: customer?.displayName ?? "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
  };
  const setContact = setEdited;
  const [notes, setNotes] = useState("");
  const enabled = useMemo(() => offeredOptions(paymentOptions), [paymentOptions]);
  const [provider, setProvider] = useState<PaymentProvider | null>(enabled[0]?.provider ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string[]>(tour.unavailableSeats);

  const premium = useMemo(
    () => new Set(tour.vehicle.seatMap.cells.filter((c) => c.kind === "SEAT" && c.premium).map((c) => c.label!)),
    [tour],
  );
  const tierAmount = useMemo(() => new Map(tour.pricing.tiers.map((tier) => [tier.key, tier.amount])), [tour]);
  const priced = passengers.map((p) => ({
    ...p,
    amount: (tierAmount.get(p.tierKey) ?? 0) + (premium.has(p.seatLabel) ? tour.pricing.premiumSeatSurcharge : 0),
  }));
  const total = priced.reduce((sum, p) => sum + p.amount, 0);
  const cheapest = fareFrom(tour.pricing);
  const soldOut = tour.seatsLeft <= 0;

  const namesComplete = passengers.length > 0 && passengers.every((p) => p.fullName.trim().length >= 2);
  const contactComplete = contact.fullName.trim().length >= 2 && contact.phone.replace(/\D/g, "").length >= 10;
  const ready = namesComplete && contactComplete && Boolean(provider) && !busy && !loading;

  /** Each stage is a fresh screen, so it starts where a screen starts. */
  const column = useRef<HTMLDivElement>(null);
  const landed = useRef(false);
  useEffect(() => {
    if (!landed.current) {
      landed.current = true;
      return;
    }
    const top = (column.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 110;
    window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
  }, [stage, reduce]);

  function toggleSeat(label: string) {
    setError(null);
    setPassengers((list) => {
      if (list.some((p) => p.seatLabel === label)) return list.filter((p) => p.seatLabel !== label);
      if (list.length >= MAX_SEATS) return list;
      const fullName = list.length === 0 ? contact.fullName || customer?.displayName || "" : "";
      return [...list, { seatLabel: label, fullName, tierKey: "ADULT" }];
    });
  }

  async function confirm() {
    if (!provider) return;
    setBusy(true);
    setError(null);
    try {
      const booking = await api<BookingDetailDto>("bookings", {
        method: "POST",
        body: {
          tourId: tour.id,
          passengers: passengers.map((p) => ({ seatLabel: p.seatLabel, fullName: p.fullName.trim(), tierKey: p.tierKey })),
          contact: { fullName: contact.fullName.trim(), phone: contact.phone.trim(), email: contact.email.trim() || undefined },
          paymentProvider: provider,
          notes: notes.trim() || undefined,
          locale,
        },
      });
      router.push(`/bookings/${booking.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        const table = t.booking.errors as Record<string, string>;
        setError(table[err.code] ?? err.message);
        if (err.code === "SEATS_UNAVAILABLE") {
          const seats = (err.details?.seats as string[] | undefined) ?? [];
          setUnavailable((u) => [...new Set([...u, ...seats])]);
          setPassengers((list) => list.filter((p) => !seats.includes(p.seatLabel)));
          /** Those seats are gone; sending them back to the plan is the only useful move. */
          setStage("seats");
        }
      } else {
        setError(t.common.unknownError);
      }
    } finally {
      setBusy(false);
    }
  }

  const loginHref = `/login?returnTo=${encodeURIComponent(`/book/${tour.id}`)}`;
  const needsSignIn = stage === "payment" && !loading && !customer;

  const action =
    stage === "details"
      ? { label: t.booking.chooseSeatsCta, disabled: soldOut, run: () => setStage("seats") }
      : stage === "seats"
        ? { label: t.booking.namesCta, disabled: passengers.length === 0, run: () => setStage("passengers") }
        : stage === "passengers"
          ? { label: t.booking.reviewCta, disabled: !namesComplete || !contactComplete, run: () => setStage("payment") }
          : { label: t.booking.confirm, disabled: !ready, run: () => void confirm() };

  const primaryButton = (className: string) =>
    needsSignIn ? (
      <Link href={loginHref} className={clsx("btn btn-primary btn-lg", className)}>
        {t.booking.signInToBook}
      </Link>
    ) : (
      <button type="button" className={clsx("btn btn-accent btn-lg", className)} disabled={action.disabled} onClick={action.run}>
        {stage === "payment" ? <LockSimple size={18} weight="bold" /> : null}
        {action.label}
        {stage !== "payment" ? <ArrowRight size={17} weight="bold" /> : null}
      </button>
    );

  return (
    <div className="pb-24 lg:pb-0">
      <Reveal above>
        <Link href={`/explore?route=${tour.route.slug}`} className="btn btn-quiet btn-sm -ml-3">
          <ArrowLeft size={15} weight="bold" /> {t.tour.allDepartures}
        </Link>
        <p className="label mt-5">{t.tour.departure}</p>
        <h1 className="display-lg mt-2 text-balance">{routeName}</h1>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <span className="stat">
            {formatDate(tour.startsAt, locale, { weekday: "long" })} · {formatTime(tour.startsAt, locale)}
          </span>
          <span className="stat">{formatDuration(tour.durationMinutes ?? tour.route.durationMinutes, locale)}</span>
          <span className="stat">{tour.guide.displayName}</span>
          <span className="stat">{tour.vehicle.name}</span>
          <span
            className={clsx(
              "stat",
              soldOut ? "!border-danger/30 !text-danger" : tour.seatsLeft <= 4 ? "!border-warning/30 !text-warning" : "!border-success/30 !text-success",
            )}
          >
            {soldOut ? t.tour.soldOut : `${tour.seatsLeft} ${t.tour.seatsLeft}`}
          </span>
        </div>
      </Reveal>

      <div className="mt-9 grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div ref={column} className="lg:col-span-7">
          {stage === "details" ? (
            <TourTabs tour={tour} meetingPlace={meetingPlace} />
          ) : (
            <Checkout
              stage={stage}
              onBack={setStage}
              tour={tour}
              unavailable={unavailable}
              passengers={passengers}
              setPassengers={setPassengers}
              onToggleSeat={toggleSeat}
              contact={contact}
              setContact={setContact}
              notes={notes}
              setNotes={setNotes}
              provider={provider}
              setProvider={setProvider}
              paymentOptions={paymentOptions}
              settings={settings}
              needsSignIn={needsSignIn}
              loginHref={loginHref}
            />
          )}
        </div>

        <aside className="lg:col-span-5">
          <div className="glass reveal-now sticky top-24 rounded-panel p-2" style={{ animationDelay: "0.2s" }}>
            <PlaceImage media={tour.route.cover} alt={routeName} className="aspect-[16/9] w-full rounded-[20px]" sizes="480px" thumb />
            <div className="px-4 pb-4 pt-5">
              <p className="display-sm">{routeName}</p>
              <p className="mt-1 text-sm text-ink-muted tnum">
                {formatDate(tour.startsAt, locale, { weekday: "long" })} · {formatTime(tour.startsAt, locale)}
              </p>
              <p className="mt-0.5 text-sm text-ink-muted">
                {tour.guide.displayName} · {tour.languages.map((l) => languageName(l, locale)).join(", ")}
              </p>

              {priced.length ? <p className="label mb-2 mt-6">{t.booking.summary}</p> : null}
              <AnimatePresence initial={false} mode="popLayout">
                {priced.length ? (
                  <motion.ul key="rows" className="divide-y divide-line text-sm" layout>
                    <AnimatePresence initial={false}>
                      {priced.map((p) => (
                        <motion.li
                          key={p.seatLabel}
                          layout
                          initial={reduce ? false : { opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8, transition: { duration: 0.15 } }}
                          className="flex items-center justify-between py-2.5"
                        >
                          <span className="flex items-center gap-2">
                            <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-accent-soft text-xs font-semibold text-accent tnum">{p.seatLabel}</span>
                            <span className="text-ink-muted">
                              {t.booking.tiers[p.tierKey]}
                              {premium.has(p.seatLabel) ? ` · ${t.booking.premiumSurcharge}` : ""}
                            </span>
                          </span>
                          <span className="font-medium tnum">{formatMoney(p.amount, tour.pricing.currency, locale)}</span>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </motion.ul>
                ) : (
                  <motion.div key="none" className="mt-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {cheapest !== null ? (
                      <p className="flex items-baseline gap-2">
                        <span className="text-sm text-ink-muted">{t.tour.from}</span>
                        <span className="text-[1.6rem] font-semibold tracking-[-0.03em] tnum">{formatMoney(cheapest, tour.pricing.currency, locale)}</span>
                        <span className="text-sm text-ink-faint">{t.tour.perPerson}</span>
                      </p>
                    ) : null}
                    {/* Only an instruction once there is a plan to tap. */}
                    {stage === "details" ? null : <p className="mt-2 text-sm text-ink-muted">{t.booking.noneSelected}</p>}
                  </motion.div>
                )}
              </AnimatePresence>

              {priced.length ? (
                <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
                  <span className="text-ink-muted">{t.booking.total}</span>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={total}
                      initial={reduce ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
                      transition={{ duration: 0.3, ease: EASE }}
                      className="text-[1.9rem] font-semibold tracking-[-0.03em] tnum"
                    >
                      {formatMoney(total, tour.pricing.currency, locale)}
                    </motion.span>
                  </AnimatePresence>
                </div>
              ) : null}

              <AnimatePresence>
                {error ? (
                  <motion.p
                    key="err"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 rounded-[12px] bg-danger/10 px-3 py-2 text-sm text-danger"
                    role="alert"
                  >
                    {error}
                  </motion.p>
                ) : null}
              </AnimatePresence>

              <div className="mt-6 hidden lg:block">
                {primaryButton("w-full")}
                {needsSignIn ? <p className="mt-3 text-xs leading-relaxed text-ink-faint">{t.booking.signInHint}</p> : null}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* The same action, kept under the thumb where the aside has scrolled away. */}
      <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
        <div className="glass-strong flex items-center gap-4 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-faint">{priced.length ? t.booking.total : t.tour.from}</p>
            <p className="truncate text-[1.15rem] font-semibold tracking-[-0.02em] tnum">
              {priced.length
                ? formatMoney(total, tour.pricing.currency, locale)
                : cheapest !== null
                  ? formatMoney(cheapest, tour.pricing.currency, locale)
                  : "—"}
            </p>
          </div>
          {primaryButton("shrink-0")}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- checkout */

interface CheckoutProps {
  stage: Exclude<Stage, "details">;
  onBack: (stage: Stage) => void;
  tour: TourDetailDto;
  unavailable: string[];
  passengers: Passenger[];
  setPassengers: Dispatch<SetStateAction<Passenger[]>>;
  onToggleSeat: (label: string) => void;
  contact: Contact;
  setContact: (contact: Contact) => void;
  notes: string;
  setNotes: (notes: string) => void;
  provider: PaymentProvider | null;
  setProvider: (provider: PaymentProvider) => void;
  paymentOptions: PaymentOptionDto[];
  settings: SettingsDto;
  needsSignIn: boolean;
  loginHref: string;
}

function Checkout(props: CheckoutProps) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const { stage, onBack } = props;
  const index = STEPS.indexOf(stage);
  const backTo: Stage = index === 0 ? "details" : STEPS[index - 1];
  const backLabel = index === 0 ? t.booking.backToDetails : t.booking.steps[STEPS[index - 1]];

  return (
    <div>
      <button type="button" onClick={() => onBack(backTo)} className="btn btn-quiet btn-sm -ml-3">
        <ArrowLeft size={15} weight="bold" /> {backLabel}
      </button>

      <ol className="mt-5 flex items-center gap-2.5">
        {STEPS.map((step, i) => {
          const done = i < index;
          const current = i === index;
          return (
            <li key={step} className={clsx("flex min-w-0 items-center gap-2.5", i < STEPS.length - 1 && "flex-1")}>
              <button
                type="button"
                disabled={!done}
                onClick={() => onBack(step)}
                aria-current={current ? "step" : undefined}
                className={clsx("flex min-w-0 items-center gap-2", done && "cursor-pointer")}
              >
                <span
                  className={clsx(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-pill border text-xs font-semibold tnum transition-colors duration-300",
                    done ? "border-accent bg-accent text-on-accent" : current ? "border-ink bg-ink text-bg" : "border-line-strong text-ink-faint",
                  )}
                >
                  {done ? <Check size={13} weight="bold" /> : i + 1}
                </span>
                <span className={clsx("truncate text-sm", current ? "font-medium text-ink" : "text-ink-muted", !current && "hidden sm:inline")}>
                  {t.booking.steps[step]}
                </span>
              </button>
              {i < STEPS.length - 1 ? <span className="h-px flex-1 bg-line" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>

      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={stage}
          initial={reduce ? false : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? undefined : { opacity: 0, x: -12, transition: { duration: 0.16 } }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mt-8"
        >
          {stage === "seats" ? <SeatsStep {...props} /> : stage === "passengers" ? <NamesStep {...props} /> : <PaymentStep {...props} />}
        </motion.section>
      </AnimatePresence>
    </div>
  );
}

function StepHead({ title, hint }: { title: string; hint: string }) {
  return (
    <header className="mb-5">
      <h2 className="display-sm">{title}</h2>
      <p className="mt-1.5 text-ink-muted">{hint}</p>
    </header>
  );
}

/* ------------------------------------------------------------------------- seats */

function SeatsStep({ tour, unavailable, passengers, onToggleSeat }: CheckoutProps) {
  const { t, locale } = useI18n();
  return (
    <div>
      <StepHead title={t.booking.seatsStepTitle} hint={t.booking.seatsStepHint} />
      <div className="glass-soft overflow-x-auto rounded-panel p-6">
        <SeatMapView
          seatMap={tour.vehicle.seatMap}
          unavailable={unavailable}
          selected={passengers.map((p) => p.seatLabel)}
          onToggle={onToggleSeat}
          labels={{ driver: t.booking.driver, guide: t.booking.guideSeat }}
        />
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-muted">
        <li className="flex items-center gap-2">
          <span className="h-4 w-4 rounded-[5px] border border-line-strong bg-glass-soft" />
          {t.booking.seatLegendFree}
        </li>
        <li className="flex items-center gap-2">
          <span className="h-4 w-4 rounded-[5px] border border-accent/60 bg-accent-soft" />
          {t.booking.seatLegendPremium}
          {tour.pricing.premiumSeatSurcharge ? ` (+${formatMoney(tour.pricing.premiumSeatSurcharge, tour.pricing.currency, locale)})` : ""}
        </li>
        <li className="flex items-center gap-2">
          <span className="h-4 w-4 rounded-[5px] bg-surface-2" />
          {t.booking.seatLegendTaken}
        </li>
        <li className="flex items-center gap-2">
          <span className="h-4 w-4 rounded-[5px] bg-accent" />
          {t.booking.seatLegendSelected}
        </li>
      </ul>
      {passengers.length ? (
        <p className="mt-5 flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
          <span>{t.booking.selectedSeats}:</span>
          {passengers.map((p) => (
            <span key={p.seatLabel} className="grid h-7 min-w-7 place-items-center rounded-[8px] bg-accent px-1.5 text-xs font-semibold text-on-accent tnum">
              {p.seatLabel}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------- passengers */

function NamesStep({ tour, passengers, setPassengers, contact, setContact, notes, setNotes }: CheckoutProps) {
  const { t, locale, pick } = useI18n();
  const reduce = useReducedMotion();

  return (
    <div>
      <StepHead title={t.booking.passengersStepTitle} hint={t.booking.passengersStepHint} />
      <motion.ul className="space-y-3" layout>
        <AnimatePresence initial={false}>
          {passengers.map((p, i) => (
            <motion.li
              key={p.seatLabel}
              layout
              initial={reduce ? false : { opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
              transition={{ duration: 0.4, ease: EASE }}
              className="glass-soft grid gap-3 rounded-card p-4 sm:grid-cols-[72px_1fr_200px] sm:items-end"
            >
              <div>
                <span className="label">{t.common.seats}</span>
                <p className="mt-1 grid h-10 w-10 place-items-center rounded-[11px] bg-accent text-sm font-semibold text-on-accent tnum">{p.seatLabel}</p>
              </div>
              <label className="block">
                <span className="field-label">{t.booking.passengerName}</span>
                <input
                  className="field"
                  value={p.fullName}
                  onChange={(e) => setPassengers((list) => list.map((x, j) => (j === i ? { ...x, fullName: e.target.value } : x)))}
                  autoComplete="off"
                />
              </label>
              <label className="block">
                <span className="field-label">{t.booking.fare}</span>
                <select
                  className="field"
                  value={p.tierKey}
                  onChange={(e) => setPassengers((list) => list.map((x, j) => (j === i ? { ...x, tierKey: e.target.value as PriceTierKey } : x)))}
                >
                  {tour.pricing.tiers.map((tier) => (
                    <option key={tier.key} value={tier.key}>
                      {pick(tier.label) || t.booking.tiers[tier.key]} · {formatMoney(tier.amount, tour.pricing.currency, locale)}
                    </option>
                  ))}
                </select>
              </label>
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>

      <h3 className="label mb-3 mt-9">{t.booking.contactTitle}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="field-label">{t.booking.contactName}</span>
          <input className="field" value={contact.fullName} onChange={(e) => setContact({ ...contact, fullName: e.target.value })} autoComplete="name" />
        </label>
        <label className="block">
          <span className="field-label">{t.booking.phone}</span>
          <input className="field" type="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} autoComplete="tel" />
        </label>
        <label className="block">
          <span className="field-label">{t.booking.email}</span>
          <input className="field" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} autoComplete="email" />
        </label>
        <label className="block sm:col-span-2">
          <span className="field-label">{t.booking.notes}</span>
          <textarea className="field min-h-[96px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- payment */

function PaymentStep({ tour, provider, setProvider, paymentOptions, settings, needsSignIn, loginHref }: CheckoutProps) {
  const { t } = useI18n();
  return (
    <div>
      <StepHead title={t.booking.payStepTitle} hint={t.booking.payStepHint} />
      <PaymentMethods
        options={paymentOptions}
        value={provider}
        onChange={setProvider}
        settings={settings}
        contactPhone={tour.contactPhone}
        whatsapp={tour.whatsapp}
      />
      {needsSignIn ? (
        <div className="glass-soft mt-6 rounded-card p-4">
          <p className="font-medium">{t.booking.signInToBook}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">{t.booking.signInHint}</p>
          <Link href={loginHref} className="btn btn-primary btn-sm mt-4">
            {t.nav.signIn}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
