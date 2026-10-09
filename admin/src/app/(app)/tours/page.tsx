import { Suspense } from "react";
import { ToursView } from "@/components/tours/tours-view";
import { Skeleton } from "@/components/ui/primitives";

export const metadata = { title: "Tours" };

export default function ToursPage() {
  return (
    <Suspense fallback={<Skeleton rows={10} />}>
      <ToursView />
    </Suspense>
  );
}
