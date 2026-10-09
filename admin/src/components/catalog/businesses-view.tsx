"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { BUSINESS_CATEGORIES, SPONSOR_TIERS } from "@/lib/contract/api";
import type { BusinessCategory, BusinessDto, PublishStatus, SponsorTier } from "@/lib/contract/api";
import { ConfirmButton, Field, LocalizedInput, LocalizedListInput, Section, TagsInput } from "@/components/ui/primitives";
import { MapPicker } from "@/components/ui/map-picker";
import { MediaManager } from "@/components/ui/media-manager";
import { CatalogView } from "./catalog-view";

function blank(): BusinessDto {
  const now = new Date().toISOString();
  return {
    id: "",
    slug: "",
    category: "RESTAURANT",
    sponsorTier: "STANDARD",
    name: {},
    summary: {},
    description: {},
    district: "",
    location: { lat: 41.0086, lng: 28.978 },
    contact: {},
    cuisine: [],
    features: {},
    visitMinutes: 60,
    media: [],
    featured: false,
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
  };
}

export function BusinessesView() {
  return (
    <CatalogView<BusinessDto>
      title="Businesses"
      subtitle="Partner venues a route can start, break or end at."
      endpoint="admin/businesses"
      queryKey="businesses"
      facet={{ param: "category", label: "Any category", options: BUSINESS_CATEGORIES }}
      blank={blank}
      cardMeta={(b) => `${b.category.toLowerCase()} · ${b.sponsorTier.toLowerCase()} partner · ${b.visitMinutes} min`}
      editor={({ value, onClose }) => <BusinessEditor value={value!} onClose={onClose} />}
    />
  );
}

function BusinessEditor({ value, onClose }: { value: BusinessDto; onClose: () => void }) {
  const client = useQueryClient();
  const [form, setForm] = useState(value);
  const isNew = !value.id;
  const set = <K extends keyof BusinessDto>(key: K, next: BusinessDto[K]) => setForm((f) => ({ ...f, [key]: next }));

  const save = useMutation({
    mutationFn: () => {
      const { id, createdAt: _c, updatedAt: _u, ...body } = form;
      const payload = { ...body, slug: body.slug || undefined };
      return isNew ? api<BusinessDto>("admin/businesses", { method: "POST", body: payload }) : api<BusinessDto>(`admin/businesses/${id}`, { method: "PATCH", body: payload });
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["businesses"] });
      toast.success(isNew ? "Business added" : "Business saved");
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not save"),
  });

  const remove = useMutation({
    mutationFn: () => api<void>(`admin/businesses/${value.id}`, { method: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["businesses"] });
      toast.success("Business deleted");
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
      <Section title="The venue">
        <div className="grid gap-4">
          <LocalizedInput label="Name" value={form.name} onChange={(name) => set("name", name)} />
          <LocalizedInput label="Summary" value={form.summary} onChange={(summary) => set("summary", summary)} />
          <LocalizedInput label="Description" multiline rows={5} value={form.description} onChange={(description) => set("description", description)} />
          <LocalizedInput
            label="What a ticket holder gets"
            multiline
            rows={2}
            value={form.offer}
            onChange={(offer) => set("offer", offer)}
            hint="The line on the stop sheet: a welcome tea, a reserved table, ten per cent off."
          />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Category">
            <select className="field" value={form.category} onChange={(e) => set("category", e.target.value as BusinessCategory)}>
              {BUSINESS_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sponsor tier" hint="Title partners lead the landing page.">
            <select className="field" value={form.sponsorTier} onChange={(e) => set("sponsorTier", e.target.value as SponsorTier)}>
              {SPONSOR_TIERS.map((t) => (
                <option key={t} value={t}>
                  {t.toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
          <Field label="District">
            <input className="field" value={form.district} onChange={(e) => set("district", e.target.value)} required />
          </Field>
          <Field label="Status">
            <select className="field" value={form.status} onChange={(e) => set("status", e.target.value as PublishStatus)}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <TagsInput label="Cuisine" value={form.cuisine} onChange={(cuisine) => set("cuisine", cuisine)} placeholder="turkish, seafood" />
          <Field label="Stop length" hint="Minutes.">
            <input className="field tnum" type="number" min={5} max={600} value={form.visitMinutes} onChange={(e) => set("visitMinutes", Number(e.target.value))} />
          </Field>
          <Field label="Slug" hint="Leave empty to build one from the name.">
            <input className="field mono" value={form.slug} onChange={(e) => set("slug", e.target.value)} maxLength={80} />
          </Field>
        </div>
        <div className="mt-4">
          <LocalizedListInput label="Features" value={form.features} onChange={(features) => set("features", features)} hint="Terrace, live music, sea view. One per line." />
        </div>
      </Section>

      <Section title="How to reach them">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Phone">
            <input className="field" value={form.contact.phone ?? ""} onChange={(e) => set("contact", { ...form.contact, phone: e.target.value })} />
          </Field>
          <Field label="WhatsApp">
            <input className="field" value={form.contact.whatsapp ?? ""} onChange={(e) => set("contact", { ...form.contact, whatsapp: e.target.value })} />
          </Field>
          <Field label="Email">
            <input className="field" type="email" value={form.contact.email ?? ""} onChange={(e) => set("contact", { ...form.contact, email: e.target.value })} />
          </Field>
          <Field label="Website">
            <input className="field" value={form.contact.website ?? ""} onChange={(e) => set("contact", { ...form.contact, website: e.target.value })} placeholder="https://" />
          </Field>
          <Field label="Instagram">
            <input className="field" value={form.contact.instagram ?? ""} onChange={(e) => set("contact", { ...form.contact, instagram: e.target.value })} placeholder="@handle" />
          </Field>
          <Field label="Opening hours">
            <input className="field" value={form.openingHours ?? ""} onChange={(e) => set("openingHours", e.target.value)} />
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
          </div>
          <MapPicker value={form.location} onChange={(location) => set("location", location)} height={360} />
        </div>
      </Section>

      <Section title="Brand">
        <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
          <div>
            <p className="label">Logo</p>
            <MediaManager value={form.logo ? [form.logo] : []} onChange={(media) => set("logo", media[0])} folder="partners" single label="" />
          </div>
          <div>
            <p className="label">Photos</p>
            <MediaManager value={form.media} onChange={(media) => set("media", media)} folder="partners" label="" />
          </div>
        </div>
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {isNew ? <span /> : <ConfirmButton label="Delete" confirmLabel="Delete this business? Routes that stop here will lose the stop." onConfirm={() => remove.mutate()} />}
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? "Saving" : isNew ? "Add the business" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
