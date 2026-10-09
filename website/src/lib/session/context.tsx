"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CustomerDto } from "../contract/api";
import { api } from "../api/client";

interface SessionValue {
  customer: CustomerDto | null;
  /** True until the first /api/session round-trip settles. */
  loading: boolean;
  refresh: () => Promise<CustomerDto | null>;
  signOut: (everywhere?: boolean) => Promise<void>;
  /** Called by login flows once the BFF has stored the cookies. */
  setCustomer: (customer: CustomerDto | null) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ initial, children }: { initial: CustomerDto | null; children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerDto | null>(initial);
  const [loading, setLoading] = useState(initial === null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/session", { cache: "no-store", credentials: "same-origin" });
      const json = (await res.json()) as { customer: CustomerDto | null };
      setCustomer(json.customer);
      return json.customer;
    } catch {
      return customer;
    } finally {
      setLoading(false);
    }
  }, [customer]);

  useEffect(() => {
    // Only on mount: the server already told us who is signed in when `initial` is set.
    // `refresh` is async, so its setState lands after the await, not during this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initial === null) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = useCallback(async (everywhere = false) => {
    try {
      await api<void>(everywhere ? "auth/customer/logout/all" : "auth/customer/logout", { method: "POST" });
    } catch {
      // The BFF clears cookies on the way out regardless.
    }
    setCustomer(null);
  }, []);

  const value = useMemo<SessionValue>(() => ({ customer, loading, refresh, signOut, setCustomer }), [customer, loading, refresh, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
