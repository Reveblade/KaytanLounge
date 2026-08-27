import { notFound } from "next/navigation";
import { RouteBuilder } from "@/components/routes/route-builder";

export const metadata = { title: "Route builder" };

export default async function RoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "new") return <RouteBuilder />;
  if (!/^[a-f0-9]{24}$/i.test(id)) notFound();
  return <RouteBuilder id={id} />;
}
