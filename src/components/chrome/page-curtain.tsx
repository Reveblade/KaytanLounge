"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LOADING_CYCLE_MS, LOADING_DELAY_MS, LoadingScreen } from "@/components/chrome/loading-screen";
import { resetPageSignals, waitForPageReady } from "@/lib/page-ready";

function mark(on: boolean) {
  if (on) document.documentElement.dataset.pageCurtain = "";
  else delete document.documentElement.dataset.pageCurtain;
}

function untilCycle(since: number) {
  const EXIT_AT = 0.86;
  const elapsed = (performance.now() - since) % LOADING_CYCLE_MS;
  const wait = (LOADING_CYCLE_MS * EXIT_AT - elapsed + LOADING_CYCLE_MS) % LOADING_CYCLE_MS;
  return new Promise<void>((resolve) => window.setTimeout(resolve, wait));
}

function samePlace(href: string) {
  try {
    const url = new URL(href, window.location.href);
    return url.origin === window.location.origin && url.pathname === window.location.pathname && url.search === window.location.search;
  } catch {
    return true;
  }
}

/**
 * One curtain for every navigation. The Suspense fallback dies when the
 * payload arrives, which is too early — the city, the pictures, the type
 * may still be arriving. This stays up until the next screen is actually
 * there. A hop that settles inside --loading-delay never plays at all.
 */
function PageCurtainInner() {
  const pathname = usePathname();
  const search = useSearchParams();
  const key = `${pathname}?${search.toString()}`;
  const [up, setUp] = useState(false);
  const first = useRef(true);
  const pending = useRef(false);
  const since = useRef(0);

  useEffect(() => {
    const begin = () => {
      pending.current = true;
      since.current = performance.now();
      resetPageSignals();
      mark(true);
      setUp(true);
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!link || link.getAttribute("target") === "_blank" || link.hasAttribute("download")) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || samePlace(href)) return;
      begin();
    };
    const onPop = () => begin();
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!pending.current) {
      pending.current = true;
      since.current = performance.now();
      resetPageSignals();
      mark(true);
      setUp(true);
    }
    const ac = new AbortController();
    void (async () => {
      await waitForPageReady(ac.signal);
      if (ac.signal.aborted) return;
      if (performance.now() - since.current < LOADING_DELAY_MS) {
        setUp(false);
        pending.current = false;
        mark(false);
        return;
      }
      await untilCycle(since.current);
      if (ac.signal.aborted) return;
      setUp(false);
      pending.current = false;
      mark(false);
    })();
    return () => ac.abort();
  }, [key]);

  if (!up) return null;
  return (
    <div className="fixed inset-0 z-[80]">
      <LoadingScreen />
    </div>
  );
}

export function PageCurtain() {
  return (
    <Suspense fallback={null}>
      <PageCurtainInner />
    </Suspense>
  );
}
