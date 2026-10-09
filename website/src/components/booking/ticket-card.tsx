"use client";

import Image from "next/image";
import Link from "next/link";
import { clsx } from "clsx";
import { CheckCircle, Phone, WhatsappLogo } from "@phosphor-icons/react";
import type { BookingDetailDto, TicketDto } from "@/lib/contract/api";
import { formatDate, formatDateTime, formatMoney, formatTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/context";
import { Avatar } from "@/components/media/avatar";
import { PlaceImage } from "@/components/media/place-image";
import { Item, Reveal, Stagger } from "@/components/motion/reveal";

const TONE: Record<BookingDetailDto["status"], string> = {
  CONFIRMED: "bg-success/12 text-success",
  AWAITING_APPROVAL: "bg-warning/12 text-warning",
  PENDING_PAYMENT: "bg-warning/12 text-warning",
  CANCELLED: "bg-danger/12 text-danger",
  REFUNDED: "bg-ink/8 text-ink-muted",
  EXPIRED: "bg-ink/8 text-ink-muted",
};

/** The ticket as a keepsake: route photo, the code big, the QR when it is valid. */
export function TicketCard({ ticket, onCancel, compact }: { ticket: TicketDto; onCancel?: () => void; compact?: boolean }) {
  const { t, locale, pick } = useI18n();
  const b = ticket.booking;
  const confirmed = b.status === "CONFIRMED";
  const waiting = b.status === "AWAITING_APPROVAL" || b.status === "PENDING_PAYMENT";
  const instructions = (b as BookingDetailDto & { instructions?: Record<string, string> }).instructions;

  return (
    <div className={clsx("grid gap-8", !compact && "lg:grid-cols-12")}>
      <Stagger above className={clsx(!compact && "lg:col-span-7")}>
        <Item>
          <span className={clsx("inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-medium", TONE[b.status])}>
            <span className="h-1.5 w-1.5 rounded-pill bg-current" aria-hidden />
            {t.status[b.status]}
          </span>
          <h1 className={clsx("mt-3", compact ? "display-sm" : "display-lg")}>{pick(b.tour.route.name)}</h1>
          <p className="mt-2 text-ink-muted tnum">{formatDateTime(b.tour.startsAt, locale)}</p>
        </Item>

        {waiting ? (
          <Item className="mt-6">
            <p className="rounded-card border border-warning/30 bg-warning/8 p-4 text-sm text-ink">{t.ticket.awaiting}</p>
          </Item>
        ) : null}
        {b.status === "CANCELLED" || b.status === "EXPIRED" ? <Item className="mt-6 text-ink-muted">{t.ticket.cancelled}</Item> : null}

        {instructions && waiting ? (
          <Item className="mt-6">
            <p className="label mb-2">{t.ticket.instructions}</p>
            <p className="whitespace-pre-line text-sm text-ink-muted">{instructions[locale] ?? instructions.en}</p>
          </Item>
        ) : null}

        <Item className="mt-8">
          <div className="glass-soft overflow-hidden rounded-panel">
            <div className="flex items-center justify-between border-b border-line p-4">
              <span className="text-ink-muted">{t.ticket.code}</span>
              <span className="text-[1.4rem] font-semibold tracking-[0.08em] tnum">{b.ticketCode}</span>
            </div>
            <ul className="divide-y divide-line">
              {b.passengers.map((p) => (
                <li key={p.seatLabel} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <span className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-accent-soft text-xs font-semibold text-accent tnum">{p.seatLabel}</span>
                    <span>
                      <span className="block font-medium">{p.fullName}</span>
                      <span className="block text-xs text-ink-faint">{t.booking.tiers[p.tierKey]}</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-3 tnum">
                    {p.checkedInAt ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle size={16} weight="fill" />{t.ticket.checkedIn}</span> : null}
                    {formatMoney(p.amount, b.currency, locale)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-line p-4">
              <span className="text-ink-muted">{t.booking.total}</span>
              <span className="text-[1.4rem] font-semibold tracking-[-0.02em] tnum">{formatMoney(b.total, b.currency, locale)}</span>
            </div>
          </div>
        </Item>

        <Item className="mt-6">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="glass-soft rounded-card p-4">
              <dt className="label mb-1.5">{t.ticket.meeting}</dt>
              <dd className="text-ink">{pick(b.tour.meetingPoint.name)}</dd>
              {b.tour.meetingPoint.address ? <dd className="text-sm text-ink-muted">{b.tour.meetingPoint.address}</dd> : null}
              {b.tour.meetingPoint.instructions ? <dd className="mt-1 text-sm text-ink-muted">{pick(b.tour.meetingPoint.instructions)}</dd> : null}
              <dd className="mt-1.5 text-sm text-ink-muted tnum">{formatDate(b.tour.startsAt, locale, { weekday: "long" })}, {formatTime(b.tour.startsAt, locale)}</dd>
            </div>
            <div className="glass-soft rounded-card p-4">
              <dt className="label mb-1.5">{t.ticket.guideContact}</dt>
              <dd className="flex items-center gap-3">
                <Avatar media={b.tour.guide.photo} name={b.tour.guide.displayName} className="h-10 w-10 shrink-0 text-sm" sizes="40px" />
                <span>{b.tour.guide.displayName}</span>
              </dd>
              <dd className="mt-3 flex flex-wrap gap-2">
                {b.tour.contactPhone ? <a href={`tel:${b.tour.contactPhone}`} className="chip"><Phone size={14} weight="regular" />{b.tour.contactPhone}</a> : null}
                {b.tour.whatsapp ? <a href={`https://wa.me/${b.tour.whatsapp.replace(/\D/g, "")}`} className="chip" target="_blank" rel="noreferrer"><WhatsappLogo size={14} weight="regular" />WhatsApp</a> : null}
              </dd>
            </div>
          </dl>
        </Item>

        <Item className="mt-8 flex flex-wrap gap-3">
          <Link href={`/explore?route=${b.tour.route.slug}`} className="btn btn-glass">{t.landing.viewRoute}</Link>
          {onCancel ? (
            <button type="button" onClick={onCancel} className="btn btn-quiet text-danger">{t.account.cancel}</button>
          ) : null}
        </Item>
      </Stagger>

      <Reveal above className={clsx(!compact && "lg:col-span-5")}>
        <div className="glass overflow-hidden rounded-panel p-2">
          <PlaceImage media={b.tour.route.cover} alt="" className="aspect-[16/9] w-full rounded-[20px]" sizes="480px" thumb />
          <div className="p-4 pt-5">
            {confirmed ? (
              <>
                <div className="mx-auto w-full max-w-[280px] rounded-[20px] bg-white p-3 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.5)]">
                  <Image src={ticket.qrDataUrl} alt={b.ticketCode} width={640} height={640} className="h-auto w-full" unoptimized />
                </div>
                <p className="mt-4 text-center text-sm text-ink-muted">{t.ticket.showAtBoarding}</p>
              </>
            ) : (
              <div className="mx-auto grid aspect-square w-full max-w-[280px] place-items-center rounded-[20px] border border-dashed border-line-strong p-6 text-center text-sm text-ink-faint">
                {t.status[b.status]}
              </div>
            )}
          </div>
        </div>
      </Reveal>
    </div>
  );
}
