"use client";

import Link from "next/link";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError, qs } from "@/lib/api";
import type { AdminCustomerDto, BookingDetailDto, CustomerDto, Paginated } from "@/lib/contract/api";
import { dateTime, money, text } from "@/lib/format";
import { useAdmin } from "@/lib/session/context";
import { EmptyState, Field, Pager, PageHeader, SearchBox, Sheet, Skeleton, StatusBadge } from "@/components/ui/primitives";

const PAGE_SIZE = 25;

/**
 * Customer accounts mirrored from Kuwho. They are read-only here apart from the note an
 * operator keeps against a person; identity lives in Kuwho and is edited there.
 */
export function CustomersView() {
  const { can } = useAdmin();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<CustomerDto | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["customers", q, page],
    queryFn: () => api<Paginated<CustomerDto>>(`admin/customers${qs({ q: q || undefined, page, pageSize: PAGE_SIZE })}`),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Customers" subtitle="Everyone with an account, and what they have booked." actions={<SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Name, phone, email" />} />

      {isLoading && !data ? (
        <Skeleton rows={10} />
      ) : error || !data ? (
        <EmptyState title="Customers unavailable" body="The API did not answer." />
      ) : data.items.length === 0 ? (
        <EmptyState title="Nobody yet" body={q ? `Nothing matches “${q}”.` : "Accounts appear here as people sign up."} />
      ) : (
        <div className="panel overflow-x-auto p-1.5">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <button type="button" className="hover:underline" onClick={() => setOpen(customer)}>
                      {customer.displayName}
                    </button>
                  </td>
                  <td className="tnum text-ink-muted">
                    {customer.phone ?? "—"}
                    {customer.phone && customer.phoneVerified ? <span className="badge badge-success ml-1.5">verified</span> : null}
                  </td>
                  <td className="text-ink-muted">
                    {customer.email ?? "—"}
                    {customer.email && customer.emailVerified ? <span className="badge badge-success ml-1.5">verified</span> : null}
                  </td>
                  <td className="tnum text-ink-muted">{dateTime(customer.createdAt)}</td>
                  <td className="text-right">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(customer)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data ? <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} /> : null}

      <Sheet open={Boolean(open)} onClose={() => setOpen(null)} title={open?.displayName ?? ""} wide>
        {open ? <CustomerSheet customer={open} editable={can("CUSTOMERS_WRITE")} /> : null}
      </Sheet>
    </>
  );
}

function CustomerSheet({ customer, editable }: { customer: CustomerDto; editable: boolean }) {
  const client = useQueryClient();
  const [notes, setNotes] = useState<string | null>(null);

  // The list deliberately omits the internal note, so the full record is fetched on open.
  const detail = useQuery({ queryKey: ["customer", customer.id], queryFn: () => api<AdminCustomerDto>(`admin/customers/${customer.id}`) });
  const stored = detail.data?.adminNotes ?? "";

  const bookings = useQuery({
    queryKey: ["customer-bookings", customer.id],
    queryFn: () => api<Paginated<BookingDetailDto>>(`admin/bookings${qs({ customerId: customer.id, pageSize: 50 })}`),
  });

  const saveNotes = useMutation({
    mutationFn: () => api<AdminCustomerDto>(`admin/customers/${customer.id}/notes`, { method: "PATCH", body: { adminNotes: notes ?? "" } }),
    onSuccess: (next) => {
      client.setQueryData(["customer", customer.id], next);
      setNotes(null);
      toast.success("Note saved");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not save the note"),
  });

  const items = bookings.data?.items ?? [];
  const spent = items.filter((b) => b.status === "CONFIRMED").reduce((sum, b) => sum + b.total, 0);

  return (
    <div className="space-y-6">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Detail label="Phone" value={customer.phone ?? "—"} />
        <Detail label="Email" value={customer.email ?? "—"} />
        <Detail label="Joined" value={dateTime(customer.createdAt)} />
        <Detail label="Kuwho id" value={<span className="mono text-xs">{customer.kuwhoCustomerId}</span>} />
      </dl>

      <div>
        <h3 className="mb-2 text-[1.05rem] font-semibold tracking-[-0.014em]">
          Bookings
          {items.length ? <span className="ml-2 text-sm font-normal text-ink-muted">{items.length} · {money(spent, items[0].currency)} confirmed</span> : null}
        </h3>
        {bookings.isLoading ? (
          <Skeleton rows={3} />
        ) : items.length === 0 ? (
          <p className="text-sm text-ink-muted">No bookings yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Route</th>
                <th>Departure</th>
                <th className="text-right">Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((booking) => (
                <tr key={booking.id}>
                  <td>
                    <Link href={`/bookings/${booking.id}`} className="mono hover:underline">
                      {booking.ticketCode}
                    </Link>
                  </td>
                  <td className="max-w-[180px] truncate">{text(booking.tour.route.name)}</td>
                  <td className="tnum whitespace-nowrap">{dateTime(booking.tour.startsAt)}</td>
                  <td className="tnum text-right">{money(booking.total, booking.currency)}</td>
                  <td>
                    <StatusBadge value={booking.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <Field label="Internal note" hint="Never shown to the customer.">
          <textarea className="field" rows={3} value={notes ?? stored} onChange={(e) => setNotes(e.target.value)} disabled={!editable || detail.isLoading} maxLength={2000} />
        </Field>
        {editable ? (
          <button type="button" className="btn btn-secondary btn-sm mt-2" disabled={saveNotes.isPending || notes === null || notes === stored} onClick={() => saveNotes.mutate()}>
            {saveNotes.isPending ? "Saving" : "Save the note"}
          </button>
        ) : null}
      </div>
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
