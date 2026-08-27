import { clsx } from "clsx";

/** A shimmering placeholder block. Sized by the caller, shaped like what will replace it. */
export function Skeleton({ className }: { className?: string }) {
  return <span className={clsx("skeleton block", className)} aria-hidden />;
}

/** A group of text lines. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span className={clsx("block space-y-2.5", className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skeleton block h-3.5 rounded-pill" style={{ width: `${100 - (i % 3) * 18}%` }} />
      ))}
    </span>
  );
}
