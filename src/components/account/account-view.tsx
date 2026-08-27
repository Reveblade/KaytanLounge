"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "@phosphor-icons/react";
import { api, ApiError } from "@/lib/api/client";
import type { BookingDetailDto, CustomerDto } from "@/lib/contract/api";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useI18n } from "@/lib/i18n/context";
import { useSession } from "@/lib/session/context";
import { PlaceImage } from "@/components/media/place-image";
import { Item, Stagger } from "@/components/motion/reveal";
import { Skeleton } from "@/components/ui/skeleton";

interface SessionRow {
  id: string;
  current: boolean;
  userAgent?: string;
  ip?: string;
  lastSeenAt: string;
}

type Tab = "bookings" | "profile" | "security";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Small on purpose: tickets first, a name to edit, and the devices that hold a session. */
export function AccountView() {
  const { t, locale } = useI18n();
  const { customer, loading, setCustomer, signOut } = useSession();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<Tab>("bookings");
  const [bookings, setBookings] = useState<BookingDetailDto[] | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  /**
   * Seeded from the account and keyed on it, so a name typed here survives the
   * background refresh of the session while still following a real account change.
   */
  const [form, setForm] = useState({ firstName: customer?.firstName ?? "", lastName: customer?.lastName ?? "" });
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!customer) {
      router.replace("/login?returnTo=/account");
      return;
    }
    void api<BookingDetailDto[]>("bookings").then(setBookings).catch(() => setBookings([]));
    void api<SessionRow[]>("customers/me/sessions").then(setSessions).catch(() => setSessions([]));
  }, [customer, loading, router]);

  if (loading || !customer) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-4 w-32 rounded-pill" />
        <Skeleton className="h-12 w-64" />
        <Skeleton className="mt-8 h-10 w-72 rounded-pill" />
        <Skeleton className="h-28 rounded-card" />
        <Skeleton className="h-28 rounded-card" />
      </div>
    );
  }

  async function saveProfile() {
    setBusy(true);
    setError(null);
    try {
      const updated = await api<CustomerDto>("customers/me", { method: "PATCH", body: { firstName: form.firstName.trim() || undefined, lastName: form.lastName.trim() || undefined, displayName: `${form.firstName} ${form.lastName}`.trim() || undefined } });
      setCustomer(updated);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.common.unknownError);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    await api(`customers/me/sessions/${id}`, { method: "DELETE" }).catch(() => undefined);
    setSessions((list) => (list ?? []).filter((s) => s.id !== id));
  }

  const upcoming = (bookings ?? []).filter((b) => new Date(b.tour.startsAt) >= new Date() && b.status !== "CANCELLED" && b.status !== "EXPIRED");
  const past = (bookings ?? []).filter((b) => !upcoming.includes(b));

  return (
    <div>
      <Stagger above>
        <Item>
          <p className="label">{customer.displayName}</p>
          <h1 className="display-lg mt-2">{t.account.title}</h1>
          <p className="mt-3 text-ink-muted">{t.account.bookingIntro}</p>
        </Item>
        <Item className="mt-10">
          <div className="segmented" role="tablist">
            {(["bookings", "profile", "security"] as Tab[]).map((key) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
                {t.account[key]}
              </button>
            ))}
          </div>
        </Item>
      </Stagger>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -8, transition: { duration: 0.16 } }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mt-8"
        >
          {tab === "bookings" ? (
            bookings === null ? (
              <div className="space-y-3" aria-busy="true">{[0, 1].map((i) => <Skeleton key={i} className="h-28 rounded-card" />)}</div>
            ) : bookings.length === 0 ? (
              <div className="glass-soft rounded-panel p-12 text-center">
                <p className="display-sm">{t.account.noBookings}</p>
                <Link href="/explore" className="btn btn-primary mt-6">{t.nav.explore}</Link>
              </div>
            ) : (
              <>
                <BookingList list={upcoming} />
                {past.length ? (
                  <>
                    <p className="label mb-3 mt-10">{locale === "tr" ? "Geçmiş" : "Past"}</p>
                    <BookingList list={past} muted />
                  </>
                ) : null}
              </>
            )
          ) : null}

          {tab === "profile" ? (
            <form
              className="glass-soft max-w-[560px] space-y-5 rounded-panel p-6"
              onSubmit={(e) => {
                e.preventDefault();
                void saveProfile();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="field-label">{t.account.firstName}</span>
                  <input className="field" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </label>
                <label className="block">
                  <span className="field-label">{t.account.lastName}</span>
                  <input className="field" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </label>
              </div>
              <dl className="grid gap-2 text-sm">
                <div className="flex items-center justify-between border-b border-line py-2.5">
                  <dt className="text-ink-muted">{t.booking.phone}</dt>
                  <dd>{customer.phone ?? "—"} <span className={clsx("ml-2 text-xs", customer.phoneVerified ? "text-success" : "text-ink-faint")}>{customer.phone ? (customer.phoneVerified ? t.account.verified : t.account.unverified) : ""}</span></dd>
                </div>
                <div className="flex items-center justify-between border-b border-line py-2.5">
                  <dt className="text-ink-muted">{t.booking.email}</dt>
                  <dd>{customer.email ?? "—"} <span className={clsx("ml-2 text-xs", customer.emailVerified ? "text-success" : "text-ink-faint")}>{customer.email ? (customer.emailVerified ? t.account.verified : t.account.unverified) : ""}</span></dd>
                </div>
              </dl>
              <p className="text-xs leading-relaxed text-ink-faint">{t.account.passwordNote}</p>
              {error ? <p className="rounded-[12px] bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
              <button type="submit" className="btn btn-primary" disabled={busy}>{saved ? t.account.saved : t.account.save}</button>
            </form>
          ) : null}

          {tab === "security" ? (
            <div className="max-w-[640px]">
              {sessions === null ? (
                <Skeleton className="h-24 rounded-card" />
              ) : (
                <ul className="glass-soft divide-y divide-line rounded-panel px-5">
                  {sessions.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-4 py-4 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{s.current ? t.account.thisDevice : (s.userAgent ?? s.ip ?? s.id)}</p>
                        <p className="text-xs text-ink-faint tnum">{t.account.lastSeen}: {formatDateTime(s.lastSeenAt, locale)}{s.ip ? ` · ${s.ip}` : ""}</p>
                      </div>
                      {!s.current ? <button type="button" onClick={() => void revoke(s.id)} className="btn btn-quiet btn-sm">{t.account.remove}</button> : null}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-8 flex flex-wrap gap-3">
                <button type="button" className="btn btn-glass" onClick={() => void signOut().then(() => router.replace("/"))}>{t.nav.signOut}</button>
                <button type="button" className="btn btn-quiet text-danger" onClick={() => void signOut(true).then(() => router.replace("/"))}>{t.account.signOutEverywhere}</button>
              </div>
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function BookingList({ list, muted }: { list: BookingDetailDto[]; muted?: boolean }) {
  const { t, locale, pick } = useI18n();
  if (!list.length) return null;
  return (
    <Stagger as="ul" className="space-y-3" gap={0.06}>
      {list.map((b) => (
        <Item key={b.id} as="li">
          <Link href={`/bookings/${b.id}`} className={clsx("glass-card group flex items-center gap-4 rounded-card p-3", muted && "opacity-70")}>
            <PlaceImage media={b.tour.route.cover} alt="" className="h-20 w-28 shrink-0 rounded-[14px]" sizes="112px" thumb />
            <div className="min-w-0 flex-1">
              <p className="title truncate text-[1.05rem]">{pick(b.tour.route.name)}</p>
              <p className="mt-0.5 text-sm text-ink-muted tnum">{formatDateTime(b.tour.startsAt, locale)} · {b.passengers.length} {t.common.seats.toLowerCase()}</p>
              <p className={clsx("mt-1 inline-flex items-center gap-1.5 text-xs font-medium", b.status === "CONFIRMED" ? "text-success" : b.status === "AWAITING_APPROVAL" ? "text-warning" : "text-ink-faint")}>
                <span className="h-1.5 w-1.5 rounded-pill bg-current" aria-hidden />
                {t.status[b.status]}
              </p>
            </div>
            <span className="text-[1.05rem] font-semibold tracking-[-0.02em] tnum">{formatMoney(b.total, b.currency, locale)}</span>
            <ArrowRight size={18} weight="bold" className="mr-1 shrink-0 text-ink-faint transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-ink" />
          </Link>
        </Item>
      ))}
    </Stagger>
  );
}
