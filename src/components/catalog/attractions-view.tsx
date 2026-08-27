"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { ATTRACTION_TYPES } from "@/lib/contract/api";
import type { AttractionDto, AttractionType, PublishStatus } from "@/lib/contract/api";
import { ConfirmButton, Field, LocalizedInput, Section, TagsInput } from "@/components/ui/primitives";
import { MapPicker } from "@/components/ui/map-picker";
import { MediaManager } from "@/components/ui/media-manager";
import { CatalogView } from "./catalog-view";

/** A new attraction lands in Sultanahmet, which is where most of them are. */
function blank(): AttractionDto {
  const now = new Date().toISOString();
  return {
    id: "",
    slug: "",
    type: "HISTORICAL",
    name: {},
    summary: {},
    description: {},
    district: "",
    location: { lat: 41.0086, lng: 28.978 },
    visitMinutes: 45,
    tags: [],
    media: [],
    featured: false,
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
  };
}

export function AttractionsView() {
  return (
    <CatalogView<AttractionDto>
      title="Attractions"
      subtitle="Everything a route can stop at."
      endpoint="admin/attractions"
      queryKey="attractions"
      facet={{ param: "type", label: "Any type", options: ATTRACTION_TYPES }}
      blank={blank}
      cardMeta={(a) => `${a.type.replace(/_/g, " ").toLowerCase()} · ${a.visitMinutes} min · ${a.media.length} photo${a.media.length === 1 ? "" : "s"}`}
      editor={({ value, onClose }) => <AttractionEditor value={value!} onClose={onClose} />}
    />
  );
}

function AttractionEditor({ value, onClose }: { value: AttractionDto; onClose: () => void }) {
  const client = useQueryClient();
  const [form, setForm] = useState(value);
  const isNew = !value.id;
  const set = <K extends keyof AttractionDto>(key: K, next: AttractionDto[K]) => setForm((f) => ({ ...f, [key]: next }));

  const save = useMutation({
    mutationFn: () => {
      const { id, createdAt: _c, updatedAt: _u, ...body } = form;
      const payload = { ...body, slug: body.slug || undefined };
      return isNew ? api<AttractionDto>("admin/attractions", { method: "POST", body: payload }) : api<AttractionDto>(`admin/attractions/${id}`, { method: "PATCH", body: payload });
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["attractions"] });
      toast.success(isNew ? "Attraction added" : "Attraction saved");
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not save"),
  });

  const remove = useMutation({
    mutationFn: () => api<void>(`admin/attractions/${value.id}`, { method: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["attractions"] });
      toast.success("Attraction deleted");
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not delete"),
  });

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <Section title="What it is">
        <div className="grid gap-4">
          <LocalizedInput label="Name" value={form.name} onChange={(name) => set("name", name)} />
          <LocalizedInput label="Summary" value={form.summary} onChange={(summary) => set("summary", summary)} hint="One sentence for the card and the map sheet." />
          <LocalizedInput label="Description" multiline rows={6} value={form.description} onChange={(description) => set("description", description)} />
          <LocalizedInput label="Tip" multiline rows={2} value={form.tips} onChange={(tips) => set("tips", tips)} hint="The thing a guide would lean over and tell you." />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Type">
            <select className="field" value={form.type} onChange={(e) => set("type", e.target.value as AttractionType)}>
              {ATTRACTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ").toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
          <Field label="District">
            <input className="field" value={form.district} onChange={(e) => set("district", e.target.value)} required />
          </Field>
          <Field label="Visit length" hint="Minutes a stop here takes.">
            <input className="field tnum" type="number" min={5} max={600} value={form.visitMinutes} onChange={(e) => set("visitMinutes", Number(e.target.value))} required />
          </Field>
          <Field label="Status">
            <select className="field" value={form.status} onChange={(e) => set("status", e.target.value as PublishStatus)}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TagsInput label="Tags" value={form.tags} onChange={(tags) => set("tags", tags)} />
          <Field label="Slug" hint="Leave empty to build one from the name.">
            <input className="field mono" value={form.slug} onChange={(e) => set("slug", e.target.value)} maxLength={80} />
          </Field>
        </div>
      </Section>

      <Section title="Where it is">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <Field label="Address">
              <input className="field" value={form.address ?? ""} maxLength={300} onChange={(e) => set("address", e.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Latitude">
                <input className="field tnum" value={form.location.lat} onChange={(e) => set("location", { ...form.location, lat: Number(e.target.value) })} />
              </Field>
              <Field label="Longitude">
                <input className="field tnum" value={form.location.lng} onChange={(e) => set("location", { ...form.location, lng: Number(e.target.value) })} />
              </Field>
            </div>
            <Field label="Opening hours" hint="Free text, shown as written.">
              <input className="field" value={form.openingHours ?? ""} onChange={(e) => set("openingHours", e.target.value)} />
            </Field>
            <LocalizedInput label="Ticket" value={form.ticket} onChange={(ticket) => set("ticket", ticket)} hint="What entry costs, or “free”." />
          </div>
          <MapPicker value={form.location} onChange={(location) => set("location", location)} height={420} />
        </div>
      </Section>

      <Section title="Photos" description="First one is the cover. Credits and licences are kept on each file.">
        <MediaManager value={form.media} onChange={(media) => set("media", media)} folder="attractions" />
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {isNew ? <span /> : <ConfirmButton label="Delete" confirmLabel="Delete this attraction? Routes that stop here will lose the stop." onConfirm={() => remove.mutate()} />}
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? "Saving" : isNew ? "Add the attraction" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
