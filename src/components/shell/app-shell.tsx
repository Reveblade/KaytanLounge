"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { clsx } from "clsx";
import {
  Bus,
  CalendarBlank,
  ChartLineUp,
  ClockCounterClockwise,
  Gear,
  IdentificationBadge,
  List,
  MapTrifold,
  Moon,
  Path,
  QrCode,
  Receipt,
  ShieldCheck,
  SignOut,
  Storefront,
  SunDim,
  Ticket,
  Users,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { api } from "@/lib/api";
import type { Permission } from "@/lib/contract/api";
import { useAdmin } from "@/lib/session/context";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  needs?: Permission[];
}

const NAV: { title: string; items: NavItem[] }[] = [
  {
    title: "Today",
    items: [
      { href: "/", label: "Dashboard", icon: ChartLineUp, needs: ["REPORTS_READ"] },
      { href: "/check-in", label: "Check-in", icon: QrCode, needs: ["BOOKINGS_CHECKIN"] },
    ],
  },
  {
    title: "Sales",
    items: [
      { href: "/tours", label: "Tours", icon: CalendarBlank, needs: ["TOURS_READ"] },
      { href: "/bookings", label: "Bookings", icon: Ticket, needs: ["BOOKINGS_READ"] },
      { href: "/customers", label: "Customers", icon: Users, needs: ["CUSTOMERS_READ"] },
    ],
  },
  {
    title: "Product",
    items: [
      { href: "/routes", label: "Routes", icon: Path, needs: ["ROUTES_READ"] },
      { href: "/attractions", label: "Attractions", icon: MapTrifold, needs: ["CATALOG_READ"] },
      { href: "/businesses", label: "Businesses", icon: Storefront, needs: ["CATALOG_READ"] },
      { href: "/templates", label: "Tour templates", icon: Receipt, needs: ["TOURS_READ"] },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/vehicles", label: "Vehicles", icon: Bus, needs: ["FLEET_READ"] },
      { href: "/guides", label: "Guides", icon: IdentificationBadge, needs: ["GUIDES_READ"] },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/admins", label: "Admins", icon: UsersThree, needs: ["ADMINS_READ"] },
      { href: "/roles", label: "Roles", icon: ShieldCheck, needs: ["ROLES_READ"] },
      { href: "/settings", label: "Settings", icon: Gear, needs: ["SETTINGS_READ"] },
      { href: "/audit", label: "Audit log", icon: ClockCounterClockwise, needs: ["AUDIT_READ"] },
    ],
  },
];

/**
 * The brand, shared with the website: the name written by hand and nothing else.
 * Yellowtail already leans, so nothing here skews it.
 */
function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className={clsx("inline-block pb-[0.12em] font-script leading-none text-ink", compact ? "text-[1.35rem]" : "text-[1.45rem]")}
    >
      Başka İstanbul Yok
    </Link>
  );
}

/** A floating glass rail on the left, content on an ambient field. The rail lists only what the admin may open. */
export function AppShell({ children, initialTheme }: { children: React.ReactNode; initialTheme: "light" | "dark" }) {
  const { admin, can } = useAdmin();
  const pathname = usePathname();
  const router = useRouter();
  /**
   * The drawer is remembered against the page it was opened on, so navigating anywhere
   * closes it without an effect that resets state after the fact.
   */
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (next: boolean) => setOpenOn(next ? pathname : null);
  // The server already read the theme cookie, so there is nothing to discover on mount.
  const [theme, setTheme] = useState<"light" | "dark">(initialTheme);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.cookie = `biy_admin_theme=${next}; path=/; max-age=31536000; samesite=lax`;
    setTheme(next);
    window.dispatchEvent(new CustomEvent("biy-theme", { detail: next }));
  }

  async function signOut() {
    await api("admin/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.needs || can(...i.needs)) })).filter((g) => g.items.length);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-5">
        <Wordmark />
        <p className="eyebrow mt-1.5 pl-[22px]">Operations</p>
      </div>
      <nav className="flex-1 overflow-y-auto px-3">
        {groups.map((group) => (
          <div key={group.title} className="mb-4">
            <p className="eyebrow px-3 pb-1.5">{group.title}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href} className="nav-item" data-active={active}>
                    <item.icon size={18} weight={active ? "fill" : "regular"} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 px-1">
          <div className="grid h-9 w-9 place-items-center rounded-pill bg-accent text-sm font-semibold text-on-accent">{admin.name.slice(0, 1)}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{admin.name}</p>
            <p className="truncate text-xs text-ink-faint">{admin.role.name}</p>
          </div>
        </div>
        <div className="mt-3 flex gap-1">
          <Link href="/me" className="btn btn-ghost btn-sm flex-1">Account</Link>
          <button type="button" onClick={toggleTheme} className="btn btn-ghost btn-sm btn-icon" aria-label="Theme">
            {theme === "dark" ? <SunDim size={16} weight="regular" /> : <Moon size={16} weight="regular" />}
          </button>
          <button type="button" onClick={() => void signOut()} className="btn btn-ghost btn-sm btn-icon" aria-label="Sign out">
            <SignOut size={16} weight="regular" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="ambient flex min-h-[100dvh]">
      <aside className="sticky top-0 hidden h-[100dvh] w-[272px] shrink-0 p-4 pr-0 lg:block">
        <div className="glass h-full overflow-hidden rounded-panel">{sidebar}</div>
      </aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[2px]" aria-label="Close" onClick={() => setOpen(false)} />
          <aside className="glass-strong absolute inset-y-3 left-3 w-[280px] overflow-hidden rounded-panel rise">{sidebar}</aside>
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 px-3 pt-3 lg:hidden">
          <div className="glass flex h-12 items-center gap-2 rounded-pill pl-1.5 pr-4">
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => setOpen(!open)} aria-label="Menu">
              {open ? <X size={20} weight="bold" /> : <List size={20} weight="bold" />}
            </button>
            <Wordmark compact />
          </div>
        </header>
        <main className={clsx("mx-auto w-full max-w-[1400px] px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pt-8 rise")}>{children}</main>
      </div>
    </div>
  );
}
