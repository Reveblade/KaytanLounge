"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { TourDto, TourTemplateDto } from "@/lib/contract/api";
import { fromLocalInput, toLocalInput } from "@/lib/format";
import { useAdmin } from "@/lib/session/context";
import { Field, PageHeader, Section, Skeleton } from "@/components/ui/primitives";
import { TourCoreFields, useCoreOptions, type TourCoreDraft } from "./tour-core-fields";

const BLANK: TourCoreDraft = {
  languages: ["tr", "en"],
  pricing: { currency: "EUR", premiumSeatSurcharge: 0, tiers: [{ key: "ADULT", label: { en: "Adult", tr: "Yetişkin" }, amount: 0 }] },
  blockedSeats: [],
  contactPhone: "",
};

/**
 * A new departure starts either from nothing or from a saved template. Starting from a
 * template is the normal path — the whole point of saving one was not to fill this in
 * again — so the picker is the first thing on the page.
 */
export function NewTourView() {
  const { can } = useAdmin();
  const router = useRouter();
  const client = useQueryClient();
  const options = useCoreOptions();
  const [templateId, setTemplateId] = useState("");
  const [draft, setDraft] = useState<TourCoreDraft>(BLANK);
  const [startsAt, setStartsAt] = useState(defaultStart());
  const [publish, setPublish] = useState(false);

  const { data: templates } = useQuery({ queryKey: ["templates"], queryFn: () => api<TourTemplateDto[]>("admin/tour-templates") });

  /**
   * Choosing a template replaces the draft wholesale — it is a starting point, not a
   * merge — so the swap happens in the change handler rather than in an effect that
   * would have to undo whatever had already been typed.
   */
  function chooseTemplate(id: string) {
    setTemplateId(id);
    const template = templates?.find((t) => t.id === id);
    if (!template) return setDraft(BLANK);
    const { id: _id, name: _name, defaultStartTime, createdAt: _c, updatedAt: _u, ...core } = template;
    setDraft(core);
    if (defaultStartTime) setStartsAt(`${startsAt.split("T")[0]}T${defaultStartTime}`);
  }

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<TourDto>("admin/tours", { method: "POST", body }),
    onSuccess: (tour) => {
      void client.invalidateQueries({ queryKey: ["tours"] });
      toast.success(tour.status === "PUBLISHED" ? "Scheduled and on sale" : "Saved as a draft");
      router.push(`/tours/${tour.id}`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not create the departure"),
  });

  if (options.loading) return <Skeleton rows={12} />;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate({ ...draft, startsAt: fromLocalInput(startsAt), templateId: templateId || undefined, status: publish ? "PUBLISHED" : "DRAFT" });
      }}
    >
      <PageHeader back={{ href: "/tours", label: "Tours" }} title="New departure" subtitle="One day out, on the calendar." />

      <div className="space-y-6">
        <Section title="Start from" description="A template carries the route, prices, meeting point and everything included.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Template">
              <select className="field" value={templateId} onChange={(e) => chooseTemplate(e.target.value)}>
                <option value="">Start from nothing</option>
                {(templates ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Departure" hint="Istanbul time.">
              <input className="field" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
            </Field>
          </div>
          {templates?.length ? null : (
            <p className="hint mt-3">
              No templates yet. Configure a departure fully, then use <span className="font-medium">Save as template</span> on it — the next one is two fields.
            </p>
          )}
        </Section>

        <TourCoreFields value={draft} onChange={setDraft} options={options} />
      </div>

      <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line bg-surface/90 p-3 backdrop-blur-xl">
        <Link href="/tours" className="btn btn-ghost">
          Cancel
        </Link>
        <div className="flex items-center gap-2">
          {can("TOURS_PUBLISH") ? (
            <label className="flex cursor-pointer items-center gap-2 pr-2 text-sm">
              <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
              Publish straight away
            </label>
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={create.isPending}>
            {create.isPending ? "Creating" : "Create the departure"}
          </button>
        </div>
      </div>
    </form>
  );
}

/** Tomorrow at 09:00 Istanbul: the most likely thing someone is scheduling. */
function defaultStart(): string {
  const tomorrow = new Date(Date.now() + 86_400_000);
  return `${toLocalInput(tomorrow.toISOString()).split("T")[0]}T09:00`;
}
