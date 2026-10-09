"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { clsx } from "clsx";
import { X } from "@phosphor-icons/react";
import type { Locale, LocalizedList, LocalizedText } from "@/lib/contract/api";

/* ------------------------------------------------------------------ page chrome */

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: string; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {back ? (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-ink-faint transition-colors hover:text-ink">
            ← {back.label}
          </Link>
        ) : null}
        <h1 className="display-lg">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Section({ title, description, children, className }: { title?: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("panel p-5 sm:p-6", className)}>
      {title ? (
        <div className="mb-4">
          <h2 className="text-[1.05rem] font-semibold tracking-[-0.014em]">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="panel px-6 py-14 text-center">
      <p className="display-md">{title}</p>
      {body ? <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{body}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-11" style={{ width: `${100 - (i % 4) * 6}%` }} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ badges */

const STATUS_TONE: Record<string, string> = {
  PUBLISHED: "badge-success",
  CONFIRMED: "badge-success",
  ACTIVE: "badge-success",
  PAID: "badge-success",
  DRAFT: "badge-neutral",
  ARCHIVED: "badge-neutral",
  INACTIVE: "badge-neutral",
  RETIRED: "badge-neutral",
  COMPLETED: "badge-neutral",
  EXPIRED: "badge-neutral",
  UNPAID: "badge-neutral",
  AWAITING_APPROVAL: "badge-warning",
  PENDING_PAYMENT: "badge-warning",
  PENDING: "badge-warning",
  MAINTENANCE: "badge-warning",
  SUSPENDED: "badge-danger",
  CANCELLED: "badge-danger",
  FAILED: "badge-danger",
  REFUNDED: "badge-accent",
  OWNER: "badge-accent",
  FULL: "badge-accent",
  TITLE: "badge-accent",
  PARTNER: "badge-success",
};

export function StatusBadge({ value }: { value: string }) {
  return <span className={clsx("badge", STATUS_TONE[value] ?? "badge-neutral")}>{value.replace(/_/g, " ").toLowerCase()}</span>;
}

/* ------------------------------------------------------------------ form fields */

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {error ? <p className="hint text-danger">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

const LOCALE_TABS: { key: Locale; label: string }[] = [
  { key: "tr", label: "TR" },
  { key: "en", label: "EN" },
];

/** Side-by-side Turkish and English inputs; the two languages the product ships in. */
export function LocalizedInput({ label, value, onChange, multiline, hint, rows }: { label: string; value: LocalizedText | undefined; onChange: (next: LocalizedText) => void; multiline?: boolean; hint?: string; rows?: number }) {
  const current = value ?? {};
  return (
    <div>
      <label className="label">{label}</label>
      <div className="grid gap-2 sm:grid-cols-2">
        {LOCALE_TABS.map((tab) => (
          <div key={tab.key} className="relative">
            <span className="pointer-events-none absolute right-2 top-2 text-[10px] font-medium text-ink-faint">{tab.label}</span>
            {multiline ? (
              <textarea className="field pr-8" rows={rows ?? 4} value={current[tab.key] ?? ""} onChange={(e) => onChange({ ...current, [tab.key]: e.target.value })} />
            ) : (
              <input className="field pr-8" value={current[tab.key] ?? ""} onChange={(e) => onChange({ ...current, [tab.key]: e.target.value })} />
            )}
          </div>
        ))}
      </div>
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

/** One line per item, per language. */
export function LocalizedListInput({ label, value, onChange, hint }: { label: string; value: LocalizedList | undefined; onChange: (next: LocalizedList) => void; hint?: string }) {
  const current = value ?? {};
  return (
    <div>
      <label className="label">{label}</label>
      <div className="grid gap-2 sm:grid-cols-2">
        {LOCALE_TABS.map((tab) => (
          <div key={tab.key} className="relative">
            <span className="pointer-events-none absolute right-2 top-2 text-[10px] font-medium text-ink-faint">{tab.label}</span>
            <textarea
              className="field pr-8"
              rows={4}
              value={(current[tab.key] ?? []).join("\n")}
              onChange={(e) => onChange({ ...current, [tab.key]: e.target.value.split("\n").map((s) => s.trimEnd()).filter((s, i, arr) => s || i < arr.length - 1) })}
              onBlur={(e) => onChange({ ...current, [tab.key]: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
            />
          </div>
        ))}
      </div>
      <p className="hint">{hint ?? "One item per line."}</p>
    </div>
  );
}

export function TagsInput({ label, value, onChange, placeholder }: { label: string; value: string[]; onChange: (next: string[]) => void; placeholder?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="field" value={value.join(", ")} placeholder={placeholder ?? "comma, separated"} onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
    </div>
  );
}

export function Toggle({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: (next: boolean) => void; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <span className={clsx("relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-pill transition-colors", checked ? "bg-accent" : "bg-line-strong")}>
        <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className={clsx("absolute h-4 w-4 rounded-pill bg-white shadow-sm transition-transform duration-200", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
      </span>
      <span>
        <span className="block text-sm">{label}</span>
        {description ? <span className="block text-xs text-ink-faint">{description}</span> : null}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ dialog */

export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sheet" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className={clsx("sheet-body", wide && "!w-[min(1100px,calc(100vw-2rem))]")} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-[1.05rem] font-semibold tracking-[-0.014em]">{title}</h2>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-icon btn-sm" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </dialog>
  );
}

export function ConfirmButton({ label, confirmLabel, onConfirm, className, disabled }: { label: string; confirmLabel?: string; onConfirm: () => void | Promise<void>; className?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={className ?? "btn btn-danger btn-sm"}
      onClick={() => {
        if (window.confirm(confirmLabel ?? `${label}?`)) void onConfirm();
      }}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ table helpers */

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-ink-muted">
      <span className="tnum">
        {(page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)} of {total}
      </span>
      <div className="flex gap-1">
        <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input className="field max-w-xs" placeholder={placeholder ?? "Search"} value={value} onChange={(e) => onChange(e.target.value)} />;
}
