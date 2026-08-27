"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { AdminDto, Permission } from "../contract/api";

interface AdminSessionValue {
  admin: AdminDto;
  permissions: Permission[];
  can: (...required: Permission[]) => boolean;
}

const Ctx = createContext<AdminSessionValue | null>(null);

export function AdminSessionProvider({ admin, permissions, children }: { admin: AdminDto; permissions: Permission[]; children: ReactNode }) {
  const value = useMemo<AdminSessionValue>(
    () => ({
      admin,
      permissions,
      can: (...required) => admin.isOwner || required.every((p) => permissions.includes(p)),
    }),
    [admin, permissions],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin(): AdminSessionValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("useAdmin must be used inside AdminSessionProvider");
  return value;
}
