"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { AdminDto } from "@/lib/contract/api";
import { dateTime } from "@/lib/format";
import { useAdmin } from "@/lib/session/context";
import { Field, PageHeader, Section } from "@/components/ui/primitives";

/** Your own account: the two things you can change, and what your role actually lets you do. */
export function AccountView() {
  const { admin, permissions } = useAdmin();
  const router = useRouter();
  const [name, setName] = useState(admin.name);
  const [phone, setPhone] = useState(admin.phone ?? "");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const saveProfile = useMutation({
    mutationFn: () => api<AdminDto>("admin/auth/me", { method: "PATCH", body: { name, phone: phone || undefined } }),
    onSuccess: () => {
      toast.success("Profile saved");
      router.refresh();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not save"),
  });

  const changePassword = useMutation({
    mutationFn: () => api<void>("admin/auth/me/password", { method: "POST", body: { currentPassword: current, newPassword: next } }),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password changed");
    },
    onError: (err) => toast.error(err instanceof ApiError ? (err.code === "INVALID_CREDENTIALS" ? "That is not your current password." : err.message) : "Could not change the password"),
  });

  const mismatch = Boolean(next && confirm && next !== confirm);

  return (
    <>
      <PageHeader title="Your account" subtitle={`${admin.email} · ${admin.role.name}`} />

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Profile">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveProfile.mutate();
            }}
          >
            <Field label="Name">
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
            </Field>
            <Field label="Phone">
              <input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={32} />
            </Field>
            <Field label="Email" hint="Changed by an administrator, not here.">
              <input className="field" value={admin.email} disabled />
            </Field>
            <button type="submit" className="btn btn-primary" disabled={saveProfile.isPending}>
              {saveProfile.isPending ? "Saving" : "Save profile"}
            </button>
          </form>
        </Section>

        <Section title="Password" description="Changing it signs your other sessions out.">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!mismatch) changePassword.mutate();
            }}
          >
            <Field label="Current password">
              <input className="field" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
            </Field>
            <Field label="New password" hint="At least 10 characters.">
              <input className="field" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} minLength={10} required />
            </Field>
            <Field label="Repeat it" error={mismatch ? "The two do not match." : undefined}>
              <input className="field" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </Field>
            <button type="submit" className="btn btn-primary" disabled={changePassword.isPending || mismatch}>
              {changePassword.isPending ? "Changing" : "Change password"}
            </button>
          </form>
        </Section>

        <Section title="What you can do" description={admin.isOwner ? "You are the owner: every permission, always." : `Granted by the ${admin.role.name} role.`} className="xl:col-span-2">
          {admin.isOwner ? (
            <p className="text-sm text-ink-muted">Owner accounts hold every permission and cannot be edited or removed by anyone, including other full-access admins.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {permissions.map((permission) => (
                <span key={permission} className="badge badge-neutral mono">
                  {permission.replace(/_/g, " ").toLowerCase()}
                </span>
              ))}
            </div>
          )}
          <p className="hint mt-4">Signed in since {dateTime(admin.lastLoginAt ?? admin.updatedAt)}.</p>
        </Section>
      </div>
    </>
  );
}
