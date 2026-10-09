import "server-only";
import type { AttractionDto, BusinessDto, PublicBootstrapDto, RouteCardDto, RouteDetailDto } from "./contract/api";
import { apiGet, apiGetOrNull } from "./api/server";

const EMPTY_BOOTSTRAP: PublicBootstrapDto = {
  settings: {
    brand: { name: "Başka İstanbul Yok", tagline: {} },
    contact: {},
    defaultCurrency: "EUR",
    payments: { providers: [] },
    booking: { holdMinutes: 30, approvalHours: 24 },
    featuredRouteSlugs: [],
  },
  sponsors: [],
  featuredRoutes: [],
  paymentOptions: [],
  highlights: [],
};

/** Everything the landing and the chrome need. Falls back to an empty shell if the API is down so the page still renders. */
export async function loadBootstrap(): Promise<PublicBootstrapDto> {
  try {
    return await apiGet<PublicBootstrapDto>("public/bootstrap", { revalidate: 60, tags: ["public"] });
  } catch {
    return EMPTY_BOOTSTRAP;
  }
}

export async function loadRouteCards(): Promise<RouteCardDto[]> {
  try {
    return await apiGet<RouteCardDto[]>("public/routes", { revalidate: 60, tags: ["public"] });
  } catch {
    return [];
  }
}

export async function loadRoute(slug: string): Promise<RouteDetailDto | null> {
  try {
    return await apiGetOrNull<RouteDetailDto>(`public/routes/${encodeURIComponent(slug)}`, { revalidate: 30, tags: ["public"] });
  } catch {
    return null;
  }
}

export interface PlacesIndex {
  attractions: AttractionDto[];
  businesses: BusinessDto[];
}

/** Every published place, for the map overview and the places index. */
export async function loadPlaces(): Promise<PlacesIndex> {
  try {
    return await apiGet<PlacesIndex>("public/places", { revalidate: 60, tags: ["public"] });
  } catch {
    return { attractions: [], businesses: [] };
  }
}
