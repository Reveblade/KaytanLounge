"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "@phosphor-icons/react";
import { api, ApiError } from "@/lib/api";
import type { GuideDto, Paginated } from "@/lib/contract/api";
import { text } from "@/lib/format";
import { useAdmin } from "@/lib/session/context";
import { ConfirmButton, EmptyState, Field, LocalizedInput, PageHeader, Section, Sheet, Skeleton, StatusBadge, TagsInput, Toggle } from "@/components/ui/primitives";
import { MediaManager } from "@/components/ui/media-manager";

const LANGUAGES = ["tr", "en", "de", "fr", "es", "it", "ru", "ar", "zh", "ja"];

function blank(): GuideDto {
  const now = new Date().toISOString();
  return { id: "", firstName: "", lastName: "", displayName: "", bio: {}, languages: ["tr", "en"], specialties: [], status: "ACTIVE", createdAt: now, updatedAt: now };
}

/** People, not resources: a photo, the languages they lead in, and their login. */
export function GuidesView() {
  const { can } = useAdmin();
  const [editing, setEditing] = useState<GuideDto | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ["guides"], queryFn: () => api<Paginated<GuideDto>>("admin/guides?pageSize=200") });
  const editable = can("GUIDES_WRITE");

  return (
    <>
      <PageHeader
        title="Guides"
        subtitle="Who leads the day, and what they can lead it in."
        actions={editable ? <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(blank())}><Plus size={15} weight="bold" /> New guide</button> : null}
      />

      {isLoading ? (
        <Skeleton rows={6} />
      ) : error || !data ? (
        <EmptyState title="Guides unavailable" body="The API did not answer." />
      ) : data.items.length === 0 ? (
        <EmptyState title="No guides" body="Add the first one." action={editable ? <button type="button" className="btn btn-primary" onClick={() => setEditing(blank())}>Add a guide</button> : undefined} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((guide) => (
            <article key={guide.id} className="panel panel-lift p-5">
              <div className="flex items-start gap-3.5">
                {guide.photo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={guide.photo.thumbnailUrl ?? guide.photo.url} alt="" className="h-14 w-14 shrink-0 rounded-pill object-cover" />
                ) : (
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-pill bg-surface-2 text-base font-semibold text-ink-muted" aria-hidden>
                    {initials(guide.displayName)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-semibold tracking-[-0.014em]">{guide.displayName}</p>
                    <StatusBadge value={guide.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {guide.languages.join(", ").toUpperCase()}
                    {guide.yearsExperience ? ` · ${guide.yearsExperience} years` : ""}
                    {guide.adminId ? " · has a login" : ""}
                  </p>
                </div>
              </div>
              <p className="mt-3 line-clamp-3 text-sm text-ink-muted">{text(guide.bio)}</p>
              {editable ? (
                <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={() => setEditing(guide)}>
                  Edit
                </button>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <Sheet open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? editing.displayName : "New guide"} wide>
        {editing ? <GuideEditor value={editing} onClose={() => setEditing(null)} /> : null}
      </Sheet>
    </>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr-TR") ?? "")
    .join("");
}

function GuideEditor({ value, onClose }: { value: GuideDto; onClose: () => void }) {
  const client = useQueryClient();
  const [form, setForm] = useState(value);
  const [withLogin, setWithLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState(value.email ?? "");
  const [loginPassword, setLoginPassword] = useState("");
  const isNew = !value.id;
  const set = <K extends keyof GuideDto>(key: K, next: GuideDto[K]) => setForm((f) => ({ ...f, [key]: next }));

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        firstName: form.firstName,
        lastName: form.lastName,
        photo: form.photo ?? null,
        bio: form.bio,
        birthYear: form.birthYear || undefined,
        languages: form.languages,
        phone: form.phone || undefined,
        email: form.email || undefined,
        yearsExperience: form.yearsExperience ?? undefined,
        specialties: form.specialties,
        licenseNo: form.licenseNo || undefined,
        status: form.status,
      };
      if (withLogin && loginEmail && loginPassword) body.adminAccount = { email: loginEmail, password: loginPassword };
      return isNew ? api<GuideDto>("admin/guides", { method: "POST", body }) : api<GuideDto>(`admin/guides/${form.id}`, { method: "PATCH", body });
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["guides"] });
      toast.success(isNew ? "Guide added" : "Guide saved");
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not save"),
  });

  const remove = useMutation({
    mutationFn: () => api<void>(`admin/guides/${value.id}`, { method: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["guides"] });
      toast.success("Guide deleted");
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
      <Section title="The person">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="First name">
            <input className="field" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} maxLength={60} required />
          </Field>
          <Field label="Last name">
            <input className="field" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} maxLength={60} required />
          </Field>
          <Field label="Born" hint="Year only.">
            <input className="field tnum" type="number" min={1930} max={2015} value={form.birthYear ?? ""} onChange={(e) => set("birthYear", e.target.value ? Number(e.target.value) : undefined)} />
          </Field>
          <Field label="Years guiding">
            <input className="field tnum" type="number" min={0} max={70} value={form.yearsExperience ?? ""} onChange={(e) => set("yearsExperience", e.target.value ? Number(e.target.value) : undefined)} />
          </Field>
        </div>
        <div className="mt-4">
          <LocalizedInput label="Bio" multiline rows={4} value={form.bio} onChange={(bio) => set("bio", bio)} hint="Two sentences. It is quoted on the landing page." />
        </div>
      </Section>

      <Section title="What they lead">
        <Field label="Languages">
          <div className="flex flex-wrap gap-1.5">
            {LANGUAGES.map((code) => {
              const on = form.languages.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  className={`btn btn-sm ${on ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => set("languages", on ? form.languages.filter((l) => l !== code) : [...form.languages, code])}
                >
                  {code.toUpperCase()}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TagsInput label="Specialties" value={form.specialties} onChange={(specialties) => set("specialties", specialties)} placeholder="byzantine, food" />
          <Field label="Licence number">
            <input className="field mono" value={form.licenseNo ?? ""} onChange={(e) => set("licenseNo", e.target.value)} maxLength={40} />
          </Field>
          <Field label="Phone">
            <input className="field" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} maxLength={32} />
          </Field>
          <Field label="Status">
            <select className="field" value={form.status} onChange={(e) => set("status", e.target.value as GuideDto["status"])}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Photo">
        <MediaManager value={form.photo ? [form.photo] : []} onChange={(media) => set("photo", media[0])} folder="guides" single label="" />
      </Section>

      <Section title="Panel access" description={form.adminId ? "This guide already signs in and sees only their own departures." : "Guides with a login see their own calendar and can check passengers in."}>
        <Field label="Contact email" hint="Used for the login when you open one.">
          <input className="field" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
        </Field>
        {!form.adminId ? (
          <div className="mt-4 space-y-4">
            <Toggle label="Open a login for this guide" description="Creates a Tour Guide account." checked={withLogin} onChange={setWithLogin} />
            {withLogin ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Sign-in email">
                  <input className="field" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                </Field>
                <Field label="Temporary password" hint="At least 10 characters. Tell them to change it.">
                  <input className="field" type="text" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} minLength={10} required />
                </Field>
              </div>
            ) : null}
          </div>
        ) : null}
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {isNew ? <span /> : <ConfirmButton label="Delete" confirmLabel="Delete this guide? Departures they lead keep the record." onConfirm={() => remove.mutate()} />}
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? "Saving" : isNew ? "Add the guide" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
