"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Crown, Key, Plus } from "@phosphor-icons/react";
import { api, ApiError } from "@/lib/api";
import type { AdminDto, AdminRoleDto, GuideDto, Paginated } from "@/lib/contract/api";
import { dateTime } from "@/lib/format";
import { useAdmin } from "@/lib/session/context";
import { ConfirmButton, EmptyState, Field, PageHeader, Sheet, Skeleton, StatusBadge } from "@/components/ui/primitives";

/**
 * The people who can sign in. The owner is a single account that no one can edit or
 * delete, and only the owner can touch a full-access admin — the API enforces both;
 * this screen simply refuses to offer the buttons so nobody is invited to try.
 */
export function AdminsView() {
  const { admin: me, can } = useAdmin();
  const [editing, setEditing] = useState<AdminDto | null>(null);
  const [resetting, setResetting] = useState<AdminDto | null>(null);

  const admins = useQuery({ queryKey: ["admins"], queryFn: () => api<Paginated<AdminDto>>("admin/admins?pageSize=200") });
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => api<AdminRoleDto[]>("admin/roles") });
  const guides = useQuery({ queryKey: ["guides", "options"], queryFn: () => api<Paginated<GuideDto>>("admin/guides?pageSize=200") });

  const editable = can("ADMINS_WRITE");

  /**
   * The two rules this screen can check for itself, mirroring `assertCanManage` on the
   * API: the owner is untouchable by anyone, and only the owner may manage a full-access
   * admin. The third rule — a standard admin cannot reach someone holding permissions they
   * lack — needs the target's full permission set, which this list does not carry, so it
   * is left to the API to refuse.
   */
  function mayManage(target: AdminDto): boolean {
    if (target.isOwner) return false;
    if (me.isOwner) return true;
    return target.role.tier !== "FULL";
  }

  if (admins.isLoading || roles.isLoading) return <Skeleton rows={8} />;
  if (admins.error || !admins.data || !roles.data) return <EmptyState title="Admins unavailable" body="The API did not answer." />;

  return (
    <>
      <PageHeader
        title="Admins"
        subtitle="Who can sign in, and as what."
        actions={editable ? <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({ id: "", email: "", name: "", role: roles.data!.find((r) => r.tier === "STANDARD") ?? roles.data![0], isOwner: false, status: "ACTIVE", createdAt: "", updatedAt: "" })}><Plus size={15} weight="bold" /> New admin</button> : null}
      />

      <div className="panel overflow-x-auto p-1.5">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Last signed in</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {admins.data.items.map((admin) => (
              <tr key={admin.id}>
                <td>
                  <span className="flex items-center gap-1.5">
                    {admin.isOwner ? <Crown size={14} weight="fill" className="text-accent" aria-label="Owner" /> : null}
                    {admin.name}
                    {admin.id === me.id ? <span className="text-xs text-ink-faint">(you)</span> : null}
                  </span>
                  {admin.guideId ? <span className="block text-xs text-ink-faint">tour guide</span> : null}
                </td>
                <td className="text-ink-muted">{admin.email}</td>
                <td>
                  {admin.role.name}
                  {admin.role.tier !== "STANDARD" ? <span className="ml-1.5"><StatusBadge value={admin.role.tier} /></span> : null}
                </td>
                <td className="tnum text-ink-muted">{admin.lastLoginAt ? dateTime(admin.lastLoginAt) : "never"}</td>
                <td>
                  <StatusBadge value={admin.status} />
                </td>
                <td className="text-right">
                  {editable && mayManage(admin) ? (
                    <span className="flex justify-end gap-1">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setResetting(admin)}>
                        <Key size={14} /> Password
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(admin)}>
                        Edit
                      </button>
                    </span>
                  ) : (
                    <span className="text-xs text-ink-faint">{admin.isOwner ? "owner" : "protected"}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? editing.name : "New admin"}>
        {editing ? <AdminEditor value={editing} roles={roles.data} guides={guides.data?.items ?? []} ownerViewing={me.isOwner} onClose={() => setEditing(null)} /> : null}
      </Sheet>

      <Sheet open={Boolean(resetting)} onClose={() => setResetting(null)} title={`New password for ${resetting?.name ?? ""}`}>
        {resetting ? <PasswordReset admin={resetting} onClose={() => setResetting(null)} /> : null}
      </Sheet>
    </>
  );
}

function AdminEditor({ value, roles, guides, ownerViewing, onClose }: { value: AdminDto; roles: AdminRoleDto[]; guides: GuideDto[]; ownerViewing: boolean; onClose: () => void }) {
  const client = useQueryClient();
  const [name, setName] = useState(value.name);
  const [email, setEmail] = useState(value.email);
  const [phone, setPhone] = useState(value.phone ?? "");
  const [roleId, setRoleId] = useState(value.role.id);
  const [guideId, setGuideId] = useState(value.guideId ?? "");
  const [status, setStatus] = useState(value.status);
  const [password, setPassword] = useState("");
  const isNew = !value.id;

  // Only the owner can hand out full access, and nobody can create another owner.
  const assignable = roles.filter((role) => role.tier !== "OWNER" && (ownerViewing || role.tier !== "FULL"));

  const save = useMutation({
    mutationFn: () =>
      isNew
        ? api<AdminDto>("admin/admins", { method: "POST", body: { email, name, phone: phone || undefined, password, roleId, guideId: guideId || undefined } })
        : api<AdminDto>(`admin/admins/${value.id}`, { method: "PATCH", body: { email, name, phone: phone || undefined, roleId, guideId: guideId || null, status } }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["admins"] });
      toast.success(isNew ? "Admin created" : "Admin saved");
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not save"),
  });

  const remove = useMutation({
    mutationFn: () => api<void>(`admin/admins/${value.id}`, { method: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["admins"] });
      toast.success("Admin removed");
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not remove"),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
        </Field>
        <Field label="Email">
          <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Phone">
          <input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={32} />
        </Field>
        <Field label="Role">
          <select className="field" value={roleId} onChange={(e) => setRoleId(e.target.value)} required>
            {assignable.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
                {role.tier === "FULL" ? " · full access" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Linked guide" hint="Tour guide accounts see only their own departures.">
          <select className="field" value={guideId} onChange={(e) => setGuideId(e.target.value)}>
            <option value="">Not a guide</option>
            {guides.map((guide) => (
              <option key={guide.id} value={guide.id}>
                {guide.displayName}
              </option>
            ))}
          </select>
        </Field>
        {isNew ? (
          <Field label="Temporary password" hint="At least 10 characters.">
            <input className="field" type="text" value={password} onChange={(e) => setPassword(e.target.value)} minLength={10} required />
          </Field>
        ) : (
          <Field label="Status">
            <select className="field" value={status} onChange={(e) => setStatus(e.target.value as AdminDto["status"])}>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </Field>
        )}
      </div>

      {!ownerViewing ? <p className="hint">Full-access roles can only be granted by the owner.</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {isNew ? <span /> : <ConfirmButton label="Remove admin" confirmLabel={`Remove ${value.name}? They lose access immediately.`} onConfirm={() => remove.mutate()} />}
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? "Saving" : isNew ? "Create the admin" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}

function PasswordReset({ admin, onClose }: { admin: AdminDto; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const reset = useMutation({
    mutationFn: () => api<void>(`admin/admins/${admin.id}/password`, { method: "POST", body: { newPassword: password } }),
    onSuccess: () => {
      toast.success("Password changed. Their other sessions are signed out.");
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not change the password"),
  });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        reset.mutate();
      }}
    >
      <p className="text-sm text-ink-muted">Set a new password for {admin.email}. Hand it over in person and ask them to change it.</p>
      <Field label="New password" hint="At least 10 characters.">
        <input className="field" type="text" value={password} onChange={(e) => setPassword(e.target.value)} minLength={10} required autoFocus />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={reset.isPending}>
          {reset.isPending ? "Saving" : "Set the password"}
        </button>
      </div>
    </form>
  );
}
