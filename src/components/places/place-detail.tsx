"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Clock, InstagramLogo, MapPin, Phone, Ticket, WhatsappLogo, Globe, Sparkle, Lightbulb } from "@phosphor-icons/react";
import type { AttractionDto, BusinessDto, MediaItem, RouteNodeKind } from "@/lib/contract/api";
import { useI18n } from "@/lib/i18n/context";
import { PlaceImage } from "@/components/media/place-image";
import { Item, Stagger } from "@/components/motion/reveal";

interface Props {
  kind: RouteNodeKind;
  place: AttractionDto | BusinessDto;
  inSheet?: boolean;
}

/** Shared body for the node sheet and the place page: gallery first, then the writing. */
export function PlaceDetail({ kind, place, inSheet }: Props) {
  const { t, locale, pick, pickList } = useI18n();
  const business = kind === "BUSINESS" ? (place as BusinessDto) : null;
  const attraction = kind === "ATTRACTION" ? (place as AttractionDto) : null;
  const typeLabel = t.explore.types[business ? business.category : attraction!.type];

  return (
    <article>
      <div className={clsx(!inSheet && "mx-auto max-w-[1100px] px-5 sm:px-8")}>
        <Gallery media={place.media} alt={pick(place.name)} tall={!inSheet} rounded={!inSheet} />
      </div>
      <Stagger className={clsx("px-6 pb-14", inSheet ? "pt-6" : "mx-auto max-w-[820px] pt-10")} gap={0.06}>
        <Item>
          <div className="flex flex-wrap gap-1.5">
            <span className="stat">{typeLabel}</span>
            <span className="stat">{place.district}</span>
            {/* The title partner wears the accent; other partners still say they are one. */}
            {business && business.sponsorTier !== "STANDARD" ? (
              <span className={clsx("stat", business.sponsorTier === "TITLE" && "!border-accent/40 !text-accent")}>{t.explore.partnerVenue}</span>
            ) : null}
          </div>
          <h1 className={clsx("mt-4 text-balance", inSheet ? "display-md" : "display-lg")}>{pick(place.name)}</h1>
          <p className="mt-4 text-[1.1rem] leading-relaxed text-ink-muted">{pick(place.summary)}</p>
        </Item>

        {business?.offer && pick(business.offer) ? (
          <Item className="mt-6">
            <div className="flex gap-3 rounded-card border border-accent/30 bg-accent-soft p-4">
              <Sparkle size={18} weight="fill" className="mt-0.5 shrink-0 text-accent" />
              <div>
                <p className="label mb-1 !text-accent">{t.explore.offer}</p>
                <p className="text-ink">{pick(business.offer)}</p>
              </div>
            </div>
          </Item>
        ) : null}

        <Item className="mt-8 space-y-4 whitespace-pre-line text-[1.02rem] leading-[1.7] text-ink">
          {pick(place.description)
            .split(/\n\s*\n/)
            .map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
        </Item>

        {attraction?.tips && pick(attraction.tips) ? (
          <Item className="mt-8">
            <div className="glass-soft flex gap-3 rounded-card p-4">
              <Lightbulb size={18} weight="regular" className="mt-0.5 shrink-0 text-ink-muted" />
              <div>
                <p className="label mb-1">{t.explore.tips}</p>
                <p className="text-ink-muted">{pick(attraction.tips)}</p>
              </div>
            </div>
          </Item>
        ) : null}

        {business ? (
          <Item>
            {pickList(business.features).length ? (
              <ul className="mt-8 flex flex-wrap gap-2">
                {pickList(business.features).map((f) => (
                  <li key={f} className="chip cursor-default">{f}</li>
                ))}
              </ul>
            ) : null}
            {business.cuisine.length ? <p className="mt-4 text-sm text-ink-muted">{business.cuisine.join(" · ")}</p> : null}
          </Item>
        ) : null}

        <Item className="mt-10">
          <dl className="grid gap-3 sm:grid-cols-2">
            {place.openingHours ? <Fact icon={<Clock size={16} weight="regular" />} label={t.explore.hoursLabel} value={place.openingHours} /> : null}
            {attraction?.ticket && pick(attraction.ticket) ? <Fact icon={<Ticket size={16} weight="regular" />} label={t.explore.ticket} value={pick(attraction.ticket)} /> : null}
            {place.address ? <Fact icon={<MapPin size={16} weight="regular" />} label={t.explore.address} value={place.address} /> : null}
            {business?.contact.phone ? (
              <Fact icon={<Phone size={16} weight="regular" />} label={t.booking.phone} value={<a href={`tel:${business.contact.phone}`} className="hover:underline">{business.contact.phone}</a>} />
            ) : null}
            {business?.contact.whatsapp ? (
              <Fact icon={<WhatsappLogo size={16} weight="regular" />} label="WhatsApp" value={<a href={`https://wa.me/${business.contact.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="hover:underline">{business.contact.whatsapp}</a>} />
            ) : null}
            {business?.contact.instagram ? (
              <Fact icon={<InstagramLogo size={16} weight="regular" />} label="Instagram" value={<a href={`https://instagram.com/${business.contact.instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="hover:underline">@{business.contact.instagram.replace(/^@/, "")}</a>} />
            ) : null}
            {business?.contact.website ? (
              <Fact icon={<Globe size={16} weight="regular" />} label="Web" value={<a href={business.contact.website} target="_blank" rel="noreferrer" className="hover:underline">{business.contact.website.replace(/^https?:\/\//, "")}</a>} />
            ) : null}
          </dl>
        </Item>

        <Item className="mt-8">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${place.location.lat},${place.location.lng}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-glass"
          >
            <MapPin size={18} weight="regular" /> {locale === "tr" ? "Yol tarifi" : "Directions"}
          </a>
        </Item>
      </Stagger>
    </article>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="glass-soft flex gap-3 rounded-card p-4">
      <span className="mt-0.5 text-ink-faint">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-ink-faint">{label}</dt>
        <dd className="mt-0.5 text-sm text-ink">{value}</dd>
      </div>
    </div>
  );
}

function Gallery({ media, alt, tall, rounded }: { media: MediaItem[]; alt: string; tall?: boolean; rounded?: boolean }) {
  const [index, setIndex] = useState(0);
  const { t } = useI18n();
  const reduce = useReducedMotion();
  if (!media.length) return <div className={clsx("bg-surface-2", tall ? "aspect-[21/9]" : "aspect-[4/3]", rounded && "rounded-panel")} />;
  const current = media[index] ?? media[0];
  return (
    <div>
      <div className={clsx("relative w-full overflow-hidden bg-surface-2", tall ? "aspect-[16/9] max-h-[70vh]" : "aspect-[4/3]", rounded && "rounded-panel")}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.id}
            className="absolute inset-0"
            initial={reduce ? false : { opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {current.kind === "VIDEO" ? (
              <video src={current.url} poster={current.thumbnailUrl} controls playsInline className="h-full w-full object-cover" />
            ) : (
              <PlaceImage media={current} alt={alt} mode="inset" sizes="(min-width: 640px) 1100px, 100vw" priority />
            )}
          </motion.div>
        </AnimatePresence>
        {media.length > 1 ? (
          <div className="no-scrollbar absolute inset-x-3 bottom-3 flex gap-1.5 overflow-x-auto rounded-[16px] border border-white/15 bg-[rgba(14,16,22,0.5)] p-1.5 backdrop-blur-xl" aria-label={t.common.photos}>
            {media.map((m, i) => (
              <button key={m.id} type="button" onClick={() => setIndex(i)} className={clsx("h-12 w-16 shrink-0 overflow-hidden rounded-[10px] transition-all duration-200", i === index ? "ring-2 ring-white opacity-100" : "opacity-55 hover:opacity-90")} aria-label={`${i + 1}/${media.length}`} aria-pressed={i === index}>
                <PlaceImage media={m} alt="" className="h-full w-full" sizes="64px" thumb />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {current.credit ? <p className={clsx("pt-2 text-[11px] text-ink-faint", !rounded && "px-6")}>{current.credit}{current.license ? ` · ${current.license}` : ""}</p> : null}
    </div>
  );
}
