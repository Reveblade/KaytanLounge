import { Suspense } from "react";
import { BookingsView } from "@/components/bookings/bookings-view";
import { Skeleton } from "@/components/ui/primitives";

export const metadata = { title: "Bookings" };

export default function BookingsPage() {
  return (
    <Suspense fallback={<Skeleton rows={10} />}>
      <BookingsView />
    </Suspense>
  );
}
