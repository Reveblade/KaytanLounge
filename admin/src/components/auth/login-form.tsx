"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const returnTo = search.get("returnTo")?.startsWith("/") ? search.get("returnTo")! : "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("admin/auth/login", { method: "POST", body: { email, password } });
      router.replace(returnTo);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.code === "INVALID_CREDENTIALS" ? "Email or password is wrong." : err.code === "ACCOUNT_SUSPENDED" ? "This account is suspended." : err.status === 0 ? "The API is not reachable." : err.message);
      } else setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
      </div>
      {error ? <p className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}
      <button type="submit" className="btn btn-primary w-full !min-h-[2.9rem]" disabled={busy}>
        {busy ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
