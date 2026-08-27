"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { clsx } from "clsx";
import { Lock, Plus } from "@phosphor-icons/react";
import { api, ApiError } from "@/lib/api";
import type { AdminRoleDto, Permission, PermissionGroupDto } from "@/lib/contract/api";
import { useAdmin } from "@/lib/session/context";
import { ConfirmButton, EmptyState, Field, PageHeader, Section, Sheet, Skeleton, StatusBadge } from "@/components/ui/primitives";

/**
 * Roles are the point of the permission system: set a bundle once, hand it to people.
 * The editor is a grid of every permission grouped the way the product is grouped, so
 * granting "everything about sales" is one pass down a column rather than nine clicks.
 */
export function RolesView() {
  const { admin, can, permissions: mine } = useAdmin();
  const [editing, setEditing] = useState<AdminRoleDto | null>(null);

  const roles = useQuery({ queryKey: ["roles"], queryFn: () => api<AdminRoleDto[]>("admin/roles") });
  const groups = useQuery({ queryKey: ["permission-groups"], queryFn: () => api<PermissionGroupDto[]>("admin/roles/permissions") });

  const editable = can("ROLES_WRITE");

  if (roles.isLoading || groups.isLoading) return <Skeleton rows={8} />;
  if (roles.error || !roles.data || !groups.data) return <EmptyState title="Roles unavailable" body="The API did not answer." />;

  return (
    <>
      <PageHeader
        title="Roles"
        subtitle="Bundles of permissions. Assign a role instead of ticking boxes per person."
        actions={
          editable ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({ id: "", key: "", name: "", description: "", tier: "STANDARD", permissions: [], isSystem: false, createdAt: "", updatedAt: "" })}>
              <Plus size={15} weight="bold" /> New role
            </button>
          ) : null
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roles.data.map((role) => (
          <article key={role.id} className="panel panel-lift flex flex-col p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold tracking-[-0.014em]">{role.name}</p>
                <p className="mono mt-0.5 truncate text-xs text-ink-faint">{role.key}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {role.isSystem ? <Lock size={13} className="text-ink-faint" aria-label="Built in" /> : null}
                {role.tier !== "STANDARD" ? <StatusBadge value={role.tier} /> : null}
              </div>
            </div>
            {role.description ? <p className="mt-2 flex-1 text-sm text-ink-muted">{role.description}</p> : <div className="flex-1" />}
            <p className="mt-4 text-xs text-ink-faint tnum">
              {role.tier === "OWNER" || role.tier === "FULL" ? "Every permission" : `${role.permissions.length} permissions`}
              {typeof role.adminCount === "number" ? ` · ${role.adminCount} ${role.adminCount === 1 ? "admin" : "admins"}` : ""}
            </p>
            {editable ? (
              <div className="mt-3">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(role)} disabled={role.tier === "OWNER"}>
                  {role.isSystem ? "View" : "Edit"}
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <Sheet open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? editing.name : "New role"} wide>
        {editing ? <RoleEditor role={editing} groups={groups.data} grantable={admin.isOwner ? undefined : mine} onClose={() => setEditing(null)} /> : null}
      </Sheet>
    </>
  );
}

function RoleEditor({ role, groups, grantable, onClose }: { role: AdminRoleDto; groups: PermissionGroupDto[]; grantable?: Permission[]; onClose: () => void }) {
  const client = useQueryClient();
  const [name, setName] = useState(role.name);
  const [key, setKey] = useState(role.key);
  const [description, setDescription] = useState(role.description ?? "");
  const [chosen, setChosen] = useState<Permission[]>(role.permissions);
  const isNew = !role.id;
  const locked = role.isSystem;
  const held = new Set(chosen);

  const save = useMutation({
    mutationFn: () =>
      isNew
        ? api<AdminRoleDto>("admin/roles", { method: "POST", body: { key, name, description: description || undefined, permissions: chosen } })
        : api<AdminRoleDto>(`admin/roles/${role.id}`, { method: "PATCH", body: { name, description: description || undefined, permissions: chosen } }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["roles"] });
      toast.success(isNew ? "Role created" : "Role saved");
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not save the role"),
  });

  const remove = useMutation({
    mutationFn: () => api<void>(`admin/roles/${role.id}`, { method: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Role deleted");
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not delete"),
  });

  function toggle(permission: Permission) {
    setChosen((current) => (current.includes(permission) ? current.filter((p) => p !== permission) : [...current, permission]));
  }

  function toggleGroup(group: PermissionGroupDto) {
    const keys = group.permissions.map((p) => p.key).filter((p) => !grantable || grantable.includes(p));
    const allOn = keys.every((k) => held.has(k));
    setChosen((current) => (allOn ? current.filter((p) => !keys.includes(p)) : [...new Set([...current, ...keys])]));
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      {role.tier === "FULL" ? (
        <p className="rounded-control bg-accent-soft px-3 py-2 text-sm">
          Full-access admins hold every permission automatically. The list below is not consulted for them.
        </p>
      ) : null}

      <Section title="The role">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name">
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required disabled={locked} />
          </Field>
          <Field label="Key" hint={isNew ? "Lowercase, digits and underscores." : "Fixed once the role exists."}>
            <input className="field mono" value={key} onChange={(e) => setKey(e.target.value)} pattern="[a-z0-9_]{2,40}" required disabled={!isNew} />
          </Field>
          <Field label="Description">
            <input className="field" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} disabled={locked} />
          </Field>
        </div>
      </Section>

      <Section title="Permissions" description={grantable ? "You can only grant what you hold yourself." : "Every permission in the panel."}>
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <div key={group.key} className="rounded-control border border-line p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">{group.label}</p>
                {!locked ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleGroup(group)}>
                    All
                  </button>
                ) : null}
              </div>
              <ul className="space-y-1">
                {group.permissions.map((permission) => {
                  const beyond = Boolean(grantable && !grantable.includes(permission.key));
                  return (
                    <li key={permission.key}>
                      <label className={clsx("flex cursor-pointer items-start gap-2.5 rounded-control p-1.5 transition-colors", beyond ? "cursor-not-allowed opacity-45" : "hover:bg-surface-2")}>
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={held.has(permission.key)}
                          disabled={locked || beyond}
                          onChange={() => toggle(permission.key)}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm">{permission.label}</span>
                          {permission.description ? <span className="block text-xs text-ink-faint">{permission.description}</span> : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {isNew || locked ? <span /> : <ConfirmButton label="Delete role" confirmLabel="Delete this role? Admins holding it must be moved first." onConfirm={() => remove.mutate()} />}
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {locked ? "Close" : "Cancel"}
          </button>
          {!locked ? (
            <button type="submit" className="btn btn-primary" disabled={save.isPending}>
              {save.isPending ? "Saving" : isNew ? "Create the role" : "Save"}
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}
