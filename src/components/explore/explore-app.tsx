"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { clsx } from "clsx";
import { ArrowRight, SidebarSimple } from "@phosphor-icons/react";
import type { AttractionDto, BusinessDto, RouteCardDto, RouteDetailDto, RouteNodeKind } from "@/lib/contract/api";
import { fareFrom, formatMoney } from "@/lib/format";
import { useI18n } from "@/lib/i18n/context";
import { markerThumb } from "@/lib/place";
import { RouteMap, type MapNode } from "@/components/map/lazy-route-map";
import { AllPlacesPanel, type OverviewPlace } from "./all-places-panel";
import { DeparturesSheet } from "./departures-sheet";
import { MapChrome } from "./map-chrome";
import { NodeSheet } from "./node-sheet";
import { ReadingSheet, type Snap } from "./reading-sheet";
import { DecideBar, RoutePanel } from "./route-panel";
import { RouteSwitcher } from "./route-switcher";
import { LOADING_CYCLE_MS, LoadingScreen } from "@/components/chrome/loading-screen";
import { Wordmark } from "@/components/chrome/wordmark";

interface Props {
  cards: RouteCardDto[];
  initialRoute: RouteDetailDto | null;
  initialStop: string | null;
  places: { attractions: AttractionDto[]; businesses: BusinessDto[] };
  startInOverview: boolean;
}

const EASE = [0.22, 1, 0.36, 1] as const;

/** Resolve `?stop=slug` to a node id: a stop on the initial route first, then any published place. */
function deepLinkId(slug: string | null, route: RouteDetailDto | null, places: Props["places"]): string | null {
  if (!slug) return null;
  const stop = route?.nodes.find((n) => n.place.slug === slug);
  if (stop) return `${stop.kind}:${stop.refId}`;
  const business = places.businesses.find((p) => p.slug === slug);
  if (business) return `BUSINESS:${business.id}`;
  const attraction = places.attractions.find((p) => p.slug === slug);
  return attraction ? `ATTRACTION:${attraction.id}` : null;
}

/** Wordmark and the collapse toggle: the same row in the column header and in the collapsed pill. */
function BrandRow({ onToggle, label, hint }: { onToggle: () => void; label: string; hint?: string }) {
  return (
    <>
      <Wordmark size="sm" />
      {hint ? <span className="ml-1 hidden max-w-[18ch] truncate text-sm text-ink-muted xl:inline">{hint}</span> : null}
      <span className="flex-1" />
      <button type="button" onClick={onToggle} className="btn btn-quiet btn-icon !h-9 !min-h-0 !w-9 shrink-0" aria-label={label} title={label}>
        <SidebarSimple size={18} weight="bold" />
      </button>
    </>
  );
}

/**
 * The map is the stage, and there is no site header above it: chrome floats.
 *
 * One panel does the reading. On a wide screen it is a column on the left that
 * collapses to a pill; on a phone it is a drawer on the bottom edge, dragged between
 * three heights. Either way it holds the same three things — the route picker, the
 * chosen route or the catalogue, and the decide bar — and the map keeps its pins
 * clear of whichever shape is in front of it. The page never navigates: only the
 * data changes.
 */
export function ExploreApp({ cards, initialRoute, initialStop, places, startInOverview }: Props) {
  const { t, locale, pick } = useI18n();
  const reduce = useReducedMotion();
  const [route, setRoute] = useState<RouteDetailDto | null>(initialRoute);
  const [overview, setOverview] = useState(startInOverview || !initialRoute);
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  // A deep link to a stop (?stop=slug) opens its sheet on arrival, whichever state we start in.
  const [activeNode, setActiveNode] = useState<string | null>(() => deepLinkId(initialStop, initialRoute, places));
  const [sheetNode, setSheetNode] = useState<string | null>(activeNode);
  const [departuresOpen, setDeparturesOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [snap, setSnap] = useState<Snap>("half");
  // What the drawer settled at: how much of the map it covers, and its own height,
  // which the map's controls ride above.
  const [sheet, setSheet] = useState({ height: 0, mapInset: 0 });
  const [isWide, setIsWide] = useState(true);
  // "up" until the map has drawn a city AND the word has finished writing itself.
  const [curtain, setCurtain] = useState<"up" | "lifting" | "gone">("up");
  const [cityDrawn, setCityDrawn] = useState(false);
  const curtainSince = useRef(0);
  const cache = useRef(new Map<string, RouteDetailDto>(initialRoute ? [[initialRoute.slug, initialRoute]] : []));

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /**
   * The Suspense fallback ends when the route data lands, which on this screen is far
   * too early: MapLibre has yet to boot, fetch a style and paint anything at all, so
   * the page arrives as an empty stage. The curtain covers that gap with the same
   * loading screen, and comes down on the same signal the house radio waits for.
   *
   * The map fires `biy-map-ready` from its own `load`, always later than this effect,
   * so there is no event to miss. If it never fires, `.map-curtain` fades itself out
   * anyway — see globals.css.
   */
  useEffect(() => {
    curtainSince.current = performance.now();
    const drawn = () => setCityDrawn(true);
    window.addEventListener("biy-map-ready", drawn);
    return () => window.removeEventListener("biy-map-ready", drawn);
  }, []);

  /**
   * Two things have to be true before the curtain goes: the city is drawn, and the
   * word has finished writing itself. Cutting away mid-word is what made this look
   * broken, so a ready map waits for the end of the cycle it is in — the curtain
   * starts its fade at 86%, exactly as the word starts its own, and both are gone
   * together on the boundary.
   */
  useEffect(() => {
    if (!cityDrawn || curtain !== "up") return;
    const EXIT_AT = 0.86;
    const elapsed = (performance.now() - curtainSince.current) % LOADING_CYCLE_MS;
    const wait = (LOADING_CYCLE_MS * EXIT_AT - elapsed + LOADING_CYCLE_MS) % LOADING_CYCLE_MS;
    const id = window.setTimeout(() => setCurtain("lifting"), wait);
    return () => window.clearTimeout(id);
  }, [cityDrawn, curtain]);

  /** Unmount once the fade is over, rather than leaving a full-screen layer running. */
  useEffect(() => {
    if (curtain !== "lifting") return;
    const id = window.setTimeout(() => setCurtain("gone"), 420);
    return () => window.clearTimeout(id);
  }, [curtain]);

  /**
   * Where the drawer came to rest, published to the page: everything that floats over
   * the bottom of the map — the map's own controls, the music dock — rides above it.
   */
  useEffect(() => {
    if (!sheet.height) return;
    const root = document.documentElement;
    root.style.setProperty("--sheet-rest", `${sheet.height}px`);
    return () => {
      root.style.removeProperty("--sheet-rest");
    };
  }, [sheet.height]);

  /** Every published place, keyed the way route stops are, so one sheet serves both. */
  const allPlaces = useMemo<OverviewPlace[]>(
    () => [
      ...places.businesses.map((place) => ({ id: `BUSINESS:${place.id}`, kind: "BUSINESS" as RouteNodeKind, place })),
      ...places.attractions.map((place) => ({ id: `ATTRACTION:${place.id}`, kind: "ATTRACTION" as RouteNodeKind, place })),
    ],
    [places],
  );

  const nodes = useMemo<MapNode[]>(() => {
    if (overview) {
      return allPlaces.map((item, i) => ({
        id: item.id,
        order: i,
        kind: item.kind,
        location: item.place.location,
        label: item.place.name.en ?? item.place.name.tr ?? "",
        variant: "pin" as const,
        ...markerThumb(item.place),
      }));
    }
    return (route?.nodes ?? []).map((n) => ({
      id: `${n.kind}:${n.refId}`,
      order: n.order,
      kind: n.kind,
      location: n.place.location,
      label: n.place.name.en ?? n.place.name.tr ?? "",
      variant: "numbered" as const,
      ...markerThumb(n.place),
    }));
  }, [overview, allPlaces, route]);

  const showOverview = useCallback(() => {
    setOverview(true);
    setActiveNode(null);
    setSheetNode(null);
    setDeparturesOpen(false);
    setCollapsed(false);
    setSnap("half");
    window.history.replaceState(null, "", "/explore?view=all");
  }, []);

  const selectRoute = useCallback(async (slug: string) => {
    setActiveNode(null);
    setSheetNode(null);
    setDeparturesOpen(false);
    setOverview(false);
    setCollapsed(false);
    setSnap("half");
    const cached = cache.current.get(slug);
    if (cached) {
      setRoute(cached);
      window.history.replaceState(null, "", `/explore?route=${slug}`);
      return;
    }
    setLoadingSlug(slug);
    try {
      const res = await fetch(`/api/v1/public/routes/${encodeURIComponent(slug)}`, { cache: "no-store" });
      if (!res.ok) return;
      const detail = (await res.json()) as RouteDetailDto;
      cache.current.set(slug, detail);
      setRoute(detail);
      window.history.replaceState(null, "", `/explore?route=${slug}`);
    } finally {
      setLoadingSlug(null);
    }
  }, []);

  const openNode = useCallback((id: string) => {
    setActiveNode(id);
    setSheetNode(id);
  }, []);
  const closeNode = useCallback(() => setSheetNode(null), []);
  const closeDepartures = useCallback(() => setDeparturesOpen(false), []);
  const openDepartures = useCallback(() => setDeparturesOpen(true), []);
  /** Some things need the whole drawer: the picker's list, and searching the catalogue. */
  const openFully = useCallback(() => setSnap("full"), []);
  const onPickerOpen = useCallback((open: boolean) => {
    if (open) setSnap("full");
  }, []);

  const padding = useMemo(
    () =>
      isWide
        ? { top: 90, right: 60, bottom: 60, left: collapsed ? 120 : 500 }
        : { top: 104, right: 28, bottom: Math.max(sheet.mapInset, 44), left: 28 },
    [isWide, collapsed, sheet.mapInset],
  );

  const sheetTarget = useMemo(() => {
    if (!sheetNode) return null;
    const stop = route?.nodes.find((n) => `${n.kind}:${n.refId}` === sheetNode);
    if (stop) return { kind: stop.kind, place: stop.place };
    const item = allPlaces.find((p) => p.id === sheetNode);
    return item ? { kind: item.kind, place: item.place } : null;
  }, [sheetNode, route, allPlaces]);

  const collapseLabel = collapsed || snap === "peek" ? t.explore.expandPanel : t.explore.collapsePanel;
  const currentName = overview ? t.explore.allPlacesChip : route ? pick(route.name) : t.explore.chooseRoute;
  const fares = !overview && route ? route.tours.map((tour) => fareFrom(tour.pricing)).filter((fare): fare is number => fare !== null) : [];
  const collapsedFare = fares.length && route ? formatMoney(Math.min(...fares), route.tours[0].pricing.currency, locale) : null;
  const showCollapsedCta = isWide && collapsed && !overview && Boolean(route?.tours.length);

  return (
    <div className="page-in relative h-[100dvh] overflow-hidden overscroll-none">
      {/* Stage */}
      <div className="absolute inset-0 z-0">
        <RouteMap
          mode="explore"
          path={overview ? undefined : route?.path}
          drawPath={!overview}
          nodes={nodes}
          activeNodeId={activeNode}
          onNodeClick={openNode}
          padding={padding}
          fitKey={overview ? "overview" : (route?.slug ?? "none")}
          className="h-full w-full"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[100px] bg-gradient-to-b from-bg/80 to-transparent" aria-hidden />
        <MapChrome />
      </div>

      {/* Brand row on its own: what the column collapses into */}
      <AnimatePresence initial={false} mode="wait">
        {isWide && collapsed ? (
          <motion.div
            key="pill"
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.14 } }}
            transition={{ duration: 0.3, ease: EASE }}
            className="glass absolute left-5 top-4 z-10 flex h-12 items-center gap-1 rounded-pill pl-4 pr-1.5"
          >
            <BrandRow onToggle={() => setCollapsed(false)} label={collapseLabel} hint={currentName} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Collapsed, with a route on the map: the one decision stays within reach, bottom-left */}
      <AnimatePresence>
        {showCollapsedCta ? (
          <motion.button
            key="collapsed-cta"
            type="button"
            onClick={openDepartures}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10, transition: { duration: 0.14 } }}
            transition={{ duration: 0.3, ease: EASE }}
            className="glass absolute bottom-5 left-5 z-10 flex h-16 items-center gap-4 rounded-pill pl-5 pr-2 text-left"
          >
            <span className="min-w-0">
              <span className="block text-[0.7rem] text-ink-faint">{t.explore.likeIt}</span>
              <span className="block truncate text-sm font-medium tnum">
                {collapsedFare ? (
                  <>
                    {t.explore.from} <span className="font-semibold">{collapsedFare}</span>
                    <span className="text-ink-muted"> · {route?.tours.length} {t.explore.upcoming}</span>
                  </>
                ) : (
                  `${route?.tours.length} ${t.explore.upcoming}`
                )}
              </span>
            </span>
            <span className="btn btn-accent shrink-0">
              {t.explore.seeDepartures} <ArrowRight size={16} weight="bold" />
            </span>
          </motion.button>
        ) : null}
      </AnimatePresence>

      {/* The reading: a column on the left, a drawer on the bottom edge */}
      <ReadingSheet
        wide={isWide}
        collapsed={collapsed}
        snap={snap}
        onSnapChange={setSnap}
        onSettle={setSheet}
        handleLabel={collapseLabel}
        brand={<BrandRow onToggle={() => setCollapsed((v) => !v)} label={collapseLabel} />}
        switcher={
          <RouteSwitcher
            cards={cards}
            activeSlug={route?.slug ?? null}
            overview={overview}
            loadingSlug={loadingSlug}
            onSelectRoute={selectRoute}
            onSelectOverview={showOverview}
            onOpenChange={onPickerOpen}
          />
        }
        footer={!overview && route ? <DecideBar route={route} onOpenDepartures={openDepartures} /> : null}
      >
        {overview ? (
          <AllPlacesPanel places={allPlaces} activeId={activeNode} onSelect={openNode} onSearchFocus={openFully} />
        ) : (
          <RoutePanel route={route} loading={Boolean(loadingSlug)} activeNode={activeNode} onSelectNode={openNode} emptyLabel={t.explore.chooseRoute} />
        )}
      </ReadingSheet>

      <DeparturesSheet route={route} open={departuresOpen} wide={isWide} onClose={closeDepartures} />

      <AnimatePresence>
        {sheetTarget ? <NodeSheet key={sheetNode} kind={sheetTarget.kind} place={sheetTarget.place} wide={isWide} onClose={closeNode} /> : null}
      </AnimatePresence>

      {curtain === "gone" ? null : (
        <div
          className={clsx("map-curtain absolute inset-0 z-[60]", curtain === "lifting" && "map-curtain-out")}
          aria-hidden={curtain === "lifting"}
        >
          <LoadingScreen label={t.common.loading} immediate />
        </div>
      )}
    </div>
  );
}
