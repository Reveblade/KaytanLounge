"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CaretDown, SignIn, SignOut, Ticket, User } from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n/context";
import { useSession } from "@/lib/session/context";
import { PrefsToggles } from "@/components/chrome/prefs-toggles";
import { Wordmark } from "@/components/chrome/wordmark";

/**
 * The map screen has no site header: the city is the page. What replaces it is two
 * glass clusters — the brand with a main-menu dropdown on the left, preferences and
 * a profile dropdown on the right — so nothing is more than one tap away and no bar
 * runs across the view.
 */
/**
 * What floats over the map: preferences and the profile dropdown on the right, and —
 * on a phone, where the drawer has no room for a header row — the brand on the left.
 */
export function MapChrome() {
  const { t } = useI18n();
  const { customer, signOut } = useSession();
  const router = useRouter();
  const initial = customer?.displayName?.trim().charAt(0).toLocaleUpperCase("tr-TR") || null;

  return (
    <div className="drop-in pointer-events-none absolute inset-x-3 top-3 z-30 flex items-start justify-end gap-3 sm:inset-x-5 sm:top-4">
      {/* The brand, where the phone has nowhere else to put it */}
      <div className="glass pointer-events-auto mr-auto flex h-12 items-center rounded-pill px-4 lg:hidden">
        <Wordmark size="sm" />
      </div>

      {/* Preferences + profile */}
      <div className="glass pointer-events-auto flex h-12 items-center gap-1 rounded-pill pl-2 pr-1.5">
        <div className="hidden sm:block">
          <PrefsToggles />
        </div>
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden />
        <Dropdown
          align="right"
          label={t.nav.profile}
          trigger={
            <>
              <span className={clsx("grid h-7 w-7 place-items-center rounded-pill text-[0.8rem] font-semibold", customer ? "bg-accent text-on-accent" : "bg-ink/10 text-ink")}>
                {initial ?? <User size={15} weight="bold" />}
              </span>
              <span className="hidden max-w-[10ch] truncate sm:inline">{customer ? customer.displayName.split(" ")[0] : t.nav.signIn}</span>
              <CaretDown size={14} weight="bold" />
            </>
          }
        >
          {customer ? (
            <>
              <div className="px-3 pb-2 pt-1.5">
                <p className="truncate text-sm font-semibold">{customer.displayName}</p>
                <p className="truncate text-xs text-ink-faint">{customer.email ?? customer.phone ?? ""}</p>
              </div>
              <span className="menu-sep" aria-hidden />
              <MenuLink href="/account" icon={<Ticket size={18} weight="regular" />}>{t.nav.account}</MenuLink>
              <MenuLink href="/account" icon={<User size={18} weight="regular" />}>{t.nav.profile}</MenuLink>
              <span className="menu-sep" aria-hidden />
              <div className="px-2 pb-1 sm:hidden">
                <PrefsToggles />
              </div>
              <button type="button" className="menu-item text-danger" onClick={() => void signOut().then(() => router.refresh())}>
                <SignOut size={18} weight="regular" className="menu-icon !text-danger" />
                {t.nav.signOut}
              </button>
            </>
          ) : (
            <>
              <MenuLink href="/login?returnTo=/explore" icon={<SignIn size={18} weight="regular" />}>{t.nav.signIn}</MenuLink>
              <MenuLink href="/login?returnTo=/account" icon={<Ticket size={18} weight="regular" />}>{t.nav.account}</MenuLink>
              <span className="menu-sep sm:hidden" aria-hidden />
              <div className="px-2 pb-1 sm:hidden">
                <PrefsToggles />
              </div>
            </>
          )}
        </Dropdown>
      </div>
    </div>
  );
}

function MenuLink({ href, icon, children, active }: { href: string; icon: ReactNode; children: ReactNode; active?: boolean }) {
  return (
    <Link href={href} className="menu-item" data-active={active ? "true" : undefined}>
      <span className="menu-icon">{icon}</span>
      {children}
    </Link>
  );
}

/** A glass dropdown anchored to a pill button. Closes on outside click, Escape, and navigation. */
function Dropdown({ trigger, children, align, label }: { trigger: ReactNode; children: ReactNode; align: "left" | "right"; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className={clsx("btn btn-quiet btn-sm !h-9 !min-h-0 gap-1.5 !px-2", open && "bg-ink/8 text-ink")}
      >
        {trigger}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            initial={reduce ? false : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.14 } }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setOpen(false);
            }}
            className={clsx("glass-strong menu absolute top-[calc(100%+10px)] z-50 origin-top", align === "left" ? "left-0" : "right-0")}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
