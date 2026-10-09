"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X } from "@phosphor-icons/react";
import { api, ApiError } from "@/lib/api";
import type { BookingDetailDto, PaymentProvider, TicketDto } from "@/lib/contract/api";
import { PAYMENT_PROVIDERS } from "@/lib/contract/api";
import { dateTime, money, text, timeOnly } from "@/lib/format";
import { useAdmin } from "@/lib/session/context";
import { ConfirmButton, EmptyState, Field, PageHeader, Section, Sheet, Skeleton, StatusBadge } from "@/components/ui/primitives";

/**
 * One booking, everything about it, and the decisions an operator can take on it.
 * Payments are approved by hand in this phase, so the approval panel is the first
 * thing on the page whenever the booking is waiting on one.
 */
export function BookingDetailView({ id }: { id: string }) {
  const { can } = useAdmin();
  const client = useQueryClient();
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [showTicket, setShowTicket] = useState(false);

  const { data, isLoading, error } = useQuery({ queryKey: ["booking", id], queryFn: () => api<BookingDetailDto>(`admin/bookings/${id}`) });

  const act = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown }) => api<BookingDetailDto>(`admin/bookings/${id}/${path}`, { method: "POST", body: body ?? {} }),
    onSuccess: (next, variables) => {
      client.setQueryData(["booking", id], next);
      void client.invalidateQueries({ queryKey: ["bookings"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(DONE[variables.path] ?? "Saved");
      setApproving(false);
      setRejecting(false);
      setRefunding(false);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  if (isLoading) return <Skeleton rows={10} />;
  if (error || !data) return <EmptyState title="Booking not found" body="It may have been removed." action={<Link href="/bookings" className="btn btn-secondary">Back to bookings</Link>} />;

  const checkedIn = data.passengers.filter((p) => p.checkedInAt).length;
  const open = data.status !== "CANCELLED" && data.status !== "REFUNDED" && data.status !== "EXPIRED";

  return (
    <>
      <PageHeader
        back={{ href: "/bookings", label: "Bookings" }}
        title={data.ticketCode}
        subtitle={`${data.contact.fullName} · ${data.passengers.length} ${data.passengers.length === 1 ? "seat" : "seats"} · ${money(data.total, data.currency)}`}
        actions={
          <>
            <StatusBadge value={data.status} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowTicket(true)}>
              Ticket
            </button>
            {open && can("BOOKINGS_WRITE") ? (
              <ConfirmButton
                label="Cancel booking"
                confirmLabel={`Cancel ${data.ticketCode}? The seats go back on sale.`}
                onConfirm={() => act.mutate({ path: "cancel", body: { reason: "Cancelled from the admin panel" } })}
                className="btn btn-secondary btn-sm"
              />
            ) : null}
          </>
        }
      />

      <div className="space-y-6">
        {data.status === "AWAITING_APPROVAL" && can("PAYMENTS_APPROVE") ? (
          <Section
            title="This payment is waiting for you"
            description={`${money(data.total, data.currency)} · ${providerLabel(data.payment.provider)}${data.payment.reference ? ` · ${data.payment.reference}` : ""}`}
            className="!border-warning/50"
          >
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" onClick={() => setApproving(true)}>
                <Check size={16} weight="bold" /> Approve payment
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setRejecting(true)}>
                <X size={16} weight="bold" /> Reject
              </button>
            </div>
            <p className="hint mt-3">
              Approving confirms the booking, issues the ticket and locks the seats. The guest is told the seats are theirs.
            </p>
          </Section>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <Section title="Passengers" description={open ? `${checkedIn} of ${data.passengers.length} checked in` : undefined}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Seat</th>
                    <th>Name</th>
                    <th>Fare</th>
                    <th className="text-right">Amount</th>
                    <th>Checked in</th>
                  </tr>
                </thead>
                <tbody>
                  {data.passengers.map((p) => (
                    <tr key={p.seatLabel}>
                      <td className="mono">{p.seatLabel}</td>
                      <td>{p.fullName}</td>
                      <td className="text-ink-muted">{p.tierKey.toLowerCase()}</td>
                      <td className="tnum text-right">{money(p.amount, data.currency)}</td>
                      <td className="tnum text-ink-muted">{p.checkedInAt ? timeOnly(p.checkedInAt) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
                <Line label="Subtotal" value={money(data.subtotal, data.currency)} />
                {data.discount ? <Line label="Discount" value={`− ${money(data.discount, data.currency)}`} /> : null}
                <Line label="Total" value={money(data.total, data.currency)} strong />
              </div>
              {open && can("BOOKINGS_CHECKIN") && data.status === "CONFIRMED" ? (
                <div className="mt-4 flex gap-2">
                  <button type="button" className="btn btn-secondary btn-sm" disabled={act.isPending} onClick={() => act.mutate({ path: "check-in", body: {} })}>
                    Check everyone in
                  </button>
                  {checkedIn ? (
                    <button type="button" className="btn btn-ghost btn-sm" disabled={act.isPending} onClick={() => act.mutate({ path: "check-in", body: { undo: true } })}>
                      Undo check-in
                    </button>
                  ) : null}
                </div>
              ) : null}
            </Section>

            <Section title="Departure">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <Detail label="Route" value={<Link href={`/routes/${data.tour.route.id}`} className="hover:underline">{text(data.tour.route.name)}</Link>} />
                <Detail label="Leaves" value={dateTime(data.tour.startsAt)} />
                <Detail label="Returns" value={dateTime(data.tour.endsAt)} />
                <Detail label="Guide" value={data.tour.guide.displayName} />
                {/* Vehicle names often already carry the plate; appending it again reads as a stutter. */}
                <Detail label="Vehicle" value={data.tour.vehicle.plate && !data.tour.vehicle.name.includes(data.tour.vehicle.plate) ? `${data.tour.vehicle.name} · ${data.tour.vehicle.plate}` : data.tour.vehicle.name} />
                <Detail label="Meeting point" value={text(data.tour.meetingPoint.name)} />
              </dl>
              <Link href={`/tours/${data.tour.id}`} className="btn btn-secondary btn-sm mt-4">
                Open the departure
              </Link>
            </Section>
          </div>

          <div className="space-y-6">
            <Section title="Payment">
              <dl className="grid gap-3">
                <Detail label="Method" value={providerLabel(data.payment.provider)} />
                <Detail label="State" value={<StatusBadge value={data.payment.status} />} />
                {data.payment.reference ? <Detail label="Reference" value={<span className="mono">{data.payment.reference}</span>} /> : null}
                {data.payment.approvedAt ? <Detail label="Approved" value={dateTime(data.payment.approvedAt)} /> : null}
                {data.payment.refundedAt ? <Detail label="Refunded" value={`${dateTime(data.payment.refundedAt)}${data.payment.refundAmount ? ` · ${money(data.payment.refundAmount, data.currency)}` : ""}`} /> : null}
                {data.payment.note ? <Detail label="Note" value={data.payment.note} /> : null}
              </dl>
              {data.status === "CONFIRMED" && can("PAYMENTS_REFUND") ? (
                <button type="button" className="btn btn-secondary btn-sm mt-4" onClick={() => setRefunding(true)}>
                  Refund
                </button>
              ) : null}
            </Section>

            <Section title="Guest">
              <dl className="grid gap-3">
                <Detail label="Name" value={data.contact.fullName} />
                <Detail label="Phone" value={<a href={`tel:${data.contact.phone}`} className="hover:underline">{data.contact.phone}</a>} />
                {data.contact.email ? <Detail label="Email" value={<a href={`mailto:${data.contact.email}`} className="hover:underline">{data.contact.email}</a>} /> : null}
                <Detail label="Language" value={data.locale.toUpperCase()} />
                {data.customer ? (
                  <Detail label="Account" value={<Link href={`/customers/${data.customer.id}`} className="hover:underline">{data.customer.displayName}</Link>} />
                ) : (
                  <Detail label="Account" value={<span className="text-ink-faint">Booked at the counter</span>} />
                )}
              </dl>
              {data.notes ? <p className="mt-4 rounded-control bg-surface-2 p-3 text-sm text-ink-muted">{data.notes}</p> : null}
            </Section>

            <Section title="History">
              <dl className="grid gap-3">
                <Detail label="Created" value={dateTime(data.createdAt)} />
                {data.holdExpiresAt && data.status === "PENDING_PAYMENT" ? <Detail label="Hold expires" value={dateTime(data.holdExpiresAt)} /> : null}
                {data.confirmedAt ? <Detail label="Confirmed" value={dateTime(data.confirmedAt)} /> : null}
                {data.cancelledAt ? <Detail label="Cancelled" value={dateTime(data.cancelledAt)} /> : null}
                {data.cancellationReason ? <Detail label="Reason" value={data.cancellationReason} /> : null}
              </dl>
            </Section>
          </div>
        </div>
      </div>

      <ApproveSheet open={approving} onClose={() => setApproving(false)} booking={data} busy={act.isPending} onSubmit={(body) => act.mutate({ path: "approve", body })} />
      <ReasonSheet
        open={rejecting}
        onClose={() => setRejecting(false)}
        title="Reject this payment"
        description="The booking is cancelled and the seats go back on sale. The reason is recorded on the booking."
        label="Why"
        submitLabel="Reject payment"
        busy={act.isPending}
        onSubmit={(reason) => act.mutate({ path: "reject", body: { reason } })}
      />
      <RefundSheet open={refunding} onClose={() => setRefunding(false)} booking={data} busy={act.isPending} onSubmit={(body) => act.mutate({ path: "refund", body })} />
      <TicketSheet open={showTicket} onClose={() => setShowTicket(false)} id={id} code={data.ticketCode} />
    </>
  );
}

const DONE: Record<string, string> = {
  approve: "Payment approved, the ticket is live",
  reject: "Payment rejected",
  refund: "Refund recorded",
  cancel: "Booking cancelled",
  "check-in": "Check-in updated",
};

const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  IYZICO: "Iyzico",
  STRIPE: "Stripe",
  BANK_TRANSFER: "Bank transfer",
  AT_VENUE: "Paid at the venue",
  MANUAL: "Recorded by hand",
};

function providerLabel(provider: PaymentProvider): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold" : "text-ink-muted"}`}>
      <span>{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}

function ApproveSheet({ open, onClose, booking, busy, onSubmit }: { open: boolean; onClose: () => void; booking: BookingDetailDto; busy: boolean; onSubmit: (body: { provider: PaymentProvider; reference?: string; note?: string }) => void }) {
  const [provider, setProvider] = useState<PaymentProvider>(booking.payment.provider);
  const [reference, setReference] = useState(booking.payment.reference ?? "");
  const [note, setNote] = useState("");
  return (
    <Sheet open={open} onClose={onClose} title={`Approve ${money(booking.total, booking.currency)}`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ provider, reference: reference.trim() || undefined, note: note.trim() || undefined });
        }}
      >
        <Field label="How was it paid">
          <select className="field" value={provider} onChange={(e) => setProvider(e.target.value as PaymentProvider)}>
            {PAYMENT_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {providerLabel(p)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reference" hint="Bank reference or gateway id, so the payment can be traced later.">
          <input className="field" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Note" hint="Optional, kept on the booking.">
          <textarea className="field" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Not yet
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Approving" : "Approve and issue the ticket"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function RefundSheet({ open, onClose, booking, busy, onSubmit }: { open: boolean; onClose: () => void; booking: BookingDetailDto; busy: boolean; onSubmit: (body: { amount?: number; note?: string }) => void }) {
  const [full, setFull] = useState(true);
  const [amount, setAmount] = useState(String(booking.total / 100));
  const [note, setNote] = useState("");
  const minor = Math.round(Number(amount) * 100);
  const invalid = !full && (!Number.isFinite(minor) || minor < 1 || minor > booking.total);
  return (
    <Sheet open={open} onClose={onClose} title="Refund this booking">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (invalid) return;
          onSubmit({ amount: full ? undefined : minor, note: note.trim() || undefined });
        }}
      >
        <div className="flex gap-1.5">
          <button type="button" className={`btn btn-sm ${full ? "btn-primary" : "btn-secondary"}`} onClick={() => setFull(true)}>
            Full · {money(booking.total, booking.currency)}
          </button>
          <button type="button" className={`btn btn-sm ${full ? "btn-secondary" : "btn-primary"}`} onClick={() => setFull(false)}>
            Part of it
          </button>
        </div>
        {!full ? (
          <Field label={`Amount in ${booking.currency}`} error={invalid ? `Between 0.01 and ${money(booking.total, booking.currency)}.` : undefined}>
            <input className="field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
        ) : null}
        <Field label="Note">
          <textarea className="field" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
        <p className="hint">
          This records the refund against the booking. Moving the money is done in the payment provider, or by bank transfer.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-danger" disabled={busy || invalid}>
            {busy ? "Recording" : "Record the refund"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function ReasonSheet({ open, onClose, title, description, label, submitLabel, busy, onSubmit }: { open: boolean; onClose: () => void; title: string; description: string; label: string; submitLabel: string; busy: boolean; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (reason.trim()) onSubmit(reason.trim());
        }}
      >
        <p className="text-sm text-ink-muted">{description}</p>
        <Field label={label}>
          <textarea className="field" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required autoFocus />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-danger" disabled={busy || !reason.trim()}>
            {busy ? "Saving" : submitLabel}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

/** The same QR the guide scans, so the counter can show or print it. */
function TicketSheet({ open, onClose, id, code }: { open: boolean; onClose: () => void; id: string; code: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["ticket", id], queryFn: () => api<TicketDto>(`admin/bookings/${id}/ticket`), enabled: open });
  return (
    <Sheet open={open} onClose={onClose} title={`Ticket ${code}`}>
      {isLoading || !data ? (
        <Skeleton rows={4} />
      ) : (
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.qrDataUrl} alt={`QR code for ticket ${code}`} className="mx-auto h-56 w-56 rounded-control bg-white p-2" />
          <p className="mono mt-4 text-lg">{code}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {text(data.booking.tour.route.name)} · {dateTime(data.booking.tour.startsAt)}
          </p>
        </div>
      )}
    </Sheet>
  );
}
