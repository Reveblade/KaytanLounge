"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

/**
 * The brand is the name and nothing else: written by hand, in the one place the
 * interface allows a hand. Yellowtail already leans, so nothing here skews it —
 * a synthesised slant on top of a brush script only smears the strokes.
 *
 * The script runs optically larger than Geist, so these steps are set against the
 * interface type the logotype sits beside, not against the old sans sizes.
 */
export function Wordmark({ className, size = "md", href = "/" }: { className?: string; size?: "sm" | "md" | "xl"; href?: string }) {
  const text = { sm: "text-[1.35rem]", md: "text-[1.5rem]", xl: "text-[clamp(3.5rem,10vw,9rem)]" };
  const pathname = usePathname();
  /**
   * Already on the page the logotype points at, so there is nowhere to navigate —
   * it becomes back-to-top instead of a no-op reload. Modified clicks are left
   * alone so "open in a new tab" still behaves.
   */
  const atDestination = pathname === href;

  const backToTop = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!atDestination || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <Link
      href={href}
      onClick={backToTop}
      className={clsx(
        // The descenders of the ş and the Y need the room `leading-none` takes away.
        "inline-block pb-[0.12em] font-script leading-none text-ink no-underline",
        text[size],
        className,
      )}
    >
      Başka İstanbul Yok
    </Link>
  );
}
