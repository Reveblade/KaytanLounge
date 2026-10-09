import Link from "next/link";
import type { ReactNode } from "react";

/** Desktop keeps the live map on /tv — no city-loop download on hover. */
export function TvLink({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Link href="/tv" className={className}>
      {children}
    </Link>
  );
}
