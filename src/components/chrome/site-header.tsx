"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { List, X } from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n/context";
import { useSession } from "@/lib/session/context";
import { Wordmark } from "./wordmark";
import { PrefsToggles } from "./prefs-toggles";

/**
 * A floating glass island, 56px, that never touches the edges. Over the hero it is
 * barely there; once the page scrolls (or on solid pages) it frosts. The primary
 * action is always the map, except on the map itself.
 */
export function SiteHeader({ variant = "overlay" }: { variant?: "overlay" | "solid" }) {
  const { t } = useI18n();
  const { customer } = useSession();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  /**
   * The mobile drawer is remembered against the page it was opened on, so navigating
   * anywhere closes it without an effect that resets state after the fact.
   */
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (next: boolean) => setOpenOn(next ? pathname : null);

  useEffect(() => {
    if (variant !== "overlay") return;
    const sentinel = document.getElementById("header-sentinel");
    if (!sentinel) return;
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), { rootMargin: "-1px 0px 0px 0px" });
    io.observe(sentinel);
    return () => io.disconnect();
  }, [variant]);


  const links = [
    { href: "/explore", label: t.nav.routes },
    { href: "/places", label: t.nav.places },
  ];

  const frosted = variant === "solid" || scrolled || open;
  const onMap = pathname.startsWith("/explore");

  return (
    <>
      <header className="drop-in fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
        <div
          className={clsx(
            "mx-auto flex h-14 max-w-[1240px] items-center justify-between rounded-pill pl-5 pr-2 transition-[background-color,border-color,box-shadow] duration-300",
            frosted ? "glass" : "border border-transparent bg-transparent",
          )}
        >
          <Wordmark />

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {links.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link key={link.href} href={link.href} className={clsx("btn btn-quiet btn-sm relative", active && "text-ink")}>
                  {link.label}
                  {active ? <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-pill bg-accent" aria-hidden /> : null}
                </Link>
              );
            })}
            <span className="mx-2 h-5 w-px bg-line" aria-hidden />
            <PrefsToggles />
            <Link href={customer ? "/account" : "/login"} className="btn btn-quiet btn-sm ml-1">
              {customer ? customer.displayName.split(" ")[0] || t.nav.account : t.nav.signIn}
            </Link>
            {!onMap ? (
              <Link href="/explore" className="btn btn-primary btn-sm ml-1">
                {t.nav.explore}
              </Link>
            ) : null}
          </nav>

          <button type="button" className="btn btn-quiet btn-icon md:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={t.common.menu}>
            {open ? <X size={22} weight="regular" /> : <List size={22} weight="regular" />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="menu"
            initial={reduce ? false : { opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-3 top-[76px] z-30 md:hidden"
          >
            <div className="glass-strong rounded-panel p-3">
              <div className="flex flex-col">
                {links.map((link) => (
                  <Link key={link.href} href={link.href} className="display-sm rounded-card px-4 py-3.5 text-ink hover:bg-ink/5">
                    {link.label}
                  </Link>
                ))}
                <Link href={customer ? "/account" : "/login"} className="display-sm rounded-card px-4 py-3.5 text-ink hover:bg-ink/5">
                  {customer ? t.nav.account : t.nav.signIn}
                </Link>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-line px-2 pt-4">
                <PrefsToggles />
                <Link href="/explore" className="btn btn-primary btn-sm">
                  {t.nav.explore}
                </Link>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
