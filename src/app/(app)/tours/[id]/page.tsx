import { notFound } from "next/navigation";
import { TourDetailView } from "@/components/tours/tour-detail";
import { NewTourView } from "@/components/tours/new-tour";

export const metadata = { title: "Departure" };

/** `/tours/new` shares this segment so the calendar links stay flat. */
export default async function TourPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "new") return <NewTourView />;
  if (!/^[a-f0-9]{24}$/i.test(id)) notFound();
  return <TourDetailView id={id} />;
}
