"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api/client";
import type { TicketDto } from "@/lib/contract/api";
import { useI18n } from "@/lib/i18n/context";
import { useSession } from "@/lib/session/context";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketCard } from "./ticket-card";

/** The customer's own booking: polls while the payment is being confirmed. */
export function BookingView({ bookingId }: { bookingId: string }) {
  const { t } = useI18n();
  const { customer, loading } = useSession();
  const router = useRouter();
  const [ticket, setTicket] = useState<TicketDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTicket(await api<TicketDto>(`bookings/${bookingId}/ticket`));
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.replace(`/login?returnTo=${encodeURIComponent(`/bookings/${bookingId}`)}`);
      else setError(err instanceof ApiError && err.status === 404 ? t.ticket.notFound : t.common.unknownError);
    }
  }, [bookingId, router, t]);

  useEffect(() => {
    if (loading) return;
    if (!customer) {
      router.replace(`/login?returnTo=${encodeURIComponent(`/bookings/${bookingId}`)}`);
      return;
    }
    // `load` only sets state after its await, so nothing here runs synchronously; the
    // rule cannot see through the async boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [customer, loading, load, router, bookingId]);

  useEffect(() => {
    if (!ticket || ticket.booking.status !== "AWAITING_APPROVAL") return;
    const id = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(id);
  }, [ticket, load]);

  async function cancel() {
    if (!ticket) return;
    try {
      await api(`bookings/${ticket.booking.id}/cancel`, { method: "POST", body: {} });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.common.unknownError);
    }
  }

  if (error) {
    return (
      <div>
        <p className="display-md">{error}</p>
        <Link href="/account" className="btn btn-glass mt-8">{t.nav.account}</Link>
      </div>
    );
  }
  if (!ticket) {
    return (
      <div className="grid gap-8 lg:grid-cols-12" aria-busy="true">
        <div className="space-y-4 lg:col-span-7">
          <Skeleton className="h-6 w-28 rounded-pill" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-4 w-1/3 rounded-pill" />
          <Skeleton className="mt-6 h-[260px] rounded-panel" />
        </div>
        <Skeleton className="h-[460px] rounded-panel lg:col-span-5" />
      </div>
    );
  }
  return <TicketCard ticket={ticket} onCancel={["AWAITING_APPROVAL", "PENDING_PAYMENT"].includes(ticket.booking.status) ? cancel : undefined} />;
}
