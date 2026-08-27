"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { clsx } from "clsx";
import { api, ApiError } from "@/lib/api";
import type { CurrencyCode, LocalizedText, Paginated, PaymentOptionDto, RouteDto, SettingsDto } from "@/lib/contract/api";
import { text } from "@/lib/format";
import { useAdmin } from "@/lib/session/context";
import { EmptyState, Field, LocalizedInput, PageHeader, Section, Skeleton, Toggle } from "@/components/ui/primitives";

const CURRENCIES: CurrencyCode[] = ["EUR", "TRY", "USD", "GBP"];

/** The things that are true across the whole product: who we are, how we take money, what leads the site. */
export function SettingsView() {
  const { data, isLoading, error } = useQuery({ queryKey: ["settings"], queryFn: () => api<SettingsDto>("admin/settings") });
  const routes = useQuery({ queryKey: ["routes", "options"], queryFn: () => api<Paginated<RouteDto>>("admin/routes?pageSize=200") });

  if (isLoading) return <Skeleton rows={10} />;
  if (error || !data) return <EmptyState title="Settings unavailable" body="The API did not answer." />;
  // The form owns its draft from the moment it mounts, so there is nothing to sync afterwards.
  return <SettingsForm settings={data} routes={routes.data?.items ?? []} />;
}

function SettingsForm({ settings, routes }: { settings: SettingsDto; routes: RouteDto[] }) {
  const { can } = useAdmin();
  const client = useQueryClient();
  const [form, setForm] = useState<SettingsDto>(settings);

  const save = useMutation({
    mutationFn: (settings: SettingsDto) =>
      api<SettingsDto>("admin/settings", {
        method: "PATCH",
        body: {
          brandName: settings.brand.name,
          tagline: settings.brand.tagline,
          ...settings.contact,
          defaultCurrency: settings.defaultCurrency,
          paymentProviders: settings.payments.providers.map((p) => ({ provider: p.provider, enabled: p.enabled, label: p.label, instructions: p.instructions })),
          bankIban: settings.payments.bankTransfer?.iban,
          bankHolder: settings.payments.bankTransfer?.holder,
          bankName: settings.payments.bankTransfer?.bank,
          holdMinutes: settings.booking.holdMinutes,
          approvalHours: settings.booking.approvalHours,
          featuredRouteSlugs: settings.featuredRouteSlugs,
        },
      }),
    onSuccess: (next) => {
      setForm(next);
      void client.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not save"),
  });

  const editable = can("SETTINGS_WRITE");
  const setContact = (key: keyof SettingsDto["contact"], value: string) => setForm({ ...form, contact: { ...form.contact, [key]: value } });
  const setProvider = (provider: string, patch: Partial<PaymentOptionDto>) =>
    setForm({ ...form, payments: { ...form.payments, providers: form.payments.providers.map((p) => (p.provider === provider ? { ...p, ...patch } : p)) } });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(form);
      }}
    >
      <PageHeader title="Settings" subtitle="Brand, contact, payments and what leads the website." />

      <fieldset disabled={!editable} className="space-y-6">
        <Section title="Brand">
          <div className="grid gap-4">
            <Field label="Name">
              <input className="field" value={form.brand.name} onChange={(e) => setForm({ ...form, brand: { ...form.brand, name: e.target.value } })} maxLength={80} />
            </Field>
            <LocalizedInput label="Tagline" value={form.brand.tagline} onChange={(tagline: LocalizedText) => setForm({ ...form, brand: { ...form.brand, tagline } })} />
          </div>
        </Section>

        <Section title="Contact" description="Shown in the footer and printed on tickets.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Phone">
              <input className="field" value={form.contact.phone ?? ""} onChange={(e) => setContact("phone", e.target.value)} />
            </Field>
            <Field label="WhatsApp">
              <input className="field" value={form.contact.whatsapp ?? ""} onChange={(e) => setContact("whatsapp", e.target.value)} />
            </Field>
            <Field label="Email">
              <input className="field" type="email" value={form.contact.email ?? ""} onChange={(e) => setContact("email", e.target.value)} />
            </Field>
            <Field label="Address">
              <input className="field" value={form.contact.address ?? ""} onChange={(e) => setContact("address", e.target.value)} />
            </Field>
            <Field label="Instagram">
              <input className="field" value={form.contact.instagram ?? ""} onChange={(e) => setContact("instagram", e.target.value)} />
            </Field>
            <Field label="Facebook">
              <input className="field" value={form.contact.facebook ?? ""} onChange={(e) => setContact("facebook", e.target.value)} />
            </Field>
            <Field label="YouTube">
              <input className="field" value={form.contact.youtube ?? ""} onChange={(e) => setContact("youtube", e.target.value)} />
            </Field>
            <Field label="TikTok">
              <input className="field" value={form.contact.tiktok ?? ""} onChange={(e) => setContact("tiktok", e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section title="Money" description="Card checkout is not live yet: enabled providers still land in the approval queue.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Default currency">
              <select className="field" value={form.defaultCurrency} onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value as CurrencyCode })}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Seat hold" hint="Minutes a seat is held before payment.">
              <input className="field tnum" type="number" min={5} max={1440} value={form.booking.holdMinutes} onChange={(e) => setForm({ ...form, booking: { ...form.booking, holdMinutes: Number(e.target.value) } })} />
            </Field>
            <Field label="Approval window" hint="Hours to approve a payment before it lapses.">
              <input className="field tnum" type="number" min={1} max={240} value={form.booking.approvalHours} onChange={(e) => setForm({ ...form, booking: { ...form.booking, approvalHours: Number(e.target.value) } })} />
            </Field>
          </div>

          <div className="mt-5 space-y-3">
            {form.payments.providers.map((provider) => (
              <div key={provider.provider} className={clsx("rounded-control border p-3", provider.enabled ? "border-line-strong" : "border-line opacity-70")}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{provider.provider.replace(/_/g, " ").toLowerCase()}</p>
                    <p className="text-xs text-ink-faint">{provider.mode === "manual" ? "Approved by an admin" : "Charged by the gateway"}</p>
                  </div>
                  <Toggle label="" checked={provider.enabled} onChange={(enabled) => setProvider(provider.provider, { enabled })} />
                </div>
                {provider.enabled ? (
                  <div className="mt-3 grid gap-3">
                    <LocalizedInput label="What the guest sees" value={provider.label} onChange={(label) => setProvider(provider.provider, { label })} />
                    <LocalizedInput label="Instructions" multiline rows={2} value={provider.instructions} onChange={(instructions) => setProvider(provider.provider, { instructions })} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <Field label="IBAN">
              <input className="field mono" value={form.payments.bankTransfer?.iban ?? ""} onChange={(e) => setForm({ ...form, payments: { ...form.payments, bankTransfer: { ...form.payments.bankTransfer, iban: e.target.value } } })} maxLength={40} />
            </Field>
            <Field label="Account holder">
              <input className="field" value={form.payments.bankTransfer?.holder ?? ""} onChange={(e) => setForm({ ...form, payments: { ...form.payments, bankTransfer: { ...form.payments.bankTransfer, holder: e.target.value } } })} maxLength={120} />
            </Field>
            <Field label="Bank">
              <input className="field" value={form.payments.bankTransfer?.bank ?? ""} onChange={(e) => setForm({ ...form, payments: { ...form.payments, bankTransfer: { ...form.payments.bankTransfer, bank: e.target.value } } })} maxLength={120} />
            </Field>
          </div>
        </Section>

        <Section title="Featured routes" description="What leads the landing page, in this order.">
          <div className="flex flex-wrap gap-1.5">
            {routes.filter((r) => r.status === "PUBLISHED").map((route) => {
              const index = form.featuredRouteSlugs.indexOf(route.slug);
              const on = index >= 0;
              return (
                <button
                  key={route.id}
                  type="button"
                  className={clsx("btn btn-sm", on ? "btn-primary" : "btn-secondary")}
                  onClick={() => setForm({ ...form, featuredRouteSlugs: on ? form.featuredRouteSlugs.filter((s) => s !== route.slug) : [...form.featuredRouteSlugs, route.slug] })}
                >
                  {on ? <span className="tnum">{index + 1}.</span> : null} {text(route.name)}
                </button>
              );
            })}
          </div>
          <p className="hint mt-2">Click to add or remove. The number is the order they appear in.</p>
        </Section>
      </fieldset>

      {editable ? (
        <div className="sticky bottom-4 mt-6 flex items-center justify-end rounded-panel border border-line bg-surface/90 p-3 backdrop-blur-xl">
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? "Saving" : "Save settings"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
