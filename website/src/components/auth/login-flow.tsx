"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, GoogleLogo, FacebookLogo } from "@phosphor-icons/react";
import { api, ApiError } from "@/lib/api/client";
import type { CustomerDto, CustomerLoginResult } from "@/lib/contract/api";
import { useI18n } from "@/lib/i18n/context";
import { useSession } from "@/lib/session/context";

type Method = "phone" | "email";
type Step = "form" | "code" | "challenge";

const EASE = [0.22, 1, 0.36, 1] as const;
const field = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } };

/**
 * One door, two keys: a phone number or an email, then the six digits that prove it.
 * There is no separate sign-up; the first code on a new number opens the account
 * (identity lives at Kuwho). Google and Meta render only once their client ids exist.
 */
export function LoginFlow() {
  const { t } = useI18n();
  const router = useRouter();
  const search = useSearchParams();
  const reduce = useReducedMotion();
  const { customer, setCustomer } = useSession();
  const requested = search.get("returnTo");
  const returnTo = requested?.startsWith("/") ? requested : "/account";

  const [method, setMethod] = useState<Method>("phone");
  const [step, setStep] = useState<Step>("form");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const googleReady = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
  const metaReady = Boolean(process.env.NEXT_PUBLIC_META_APP_ID);

  useEffect(() => {
    if (customer) router.replace(returnTo);
  }, [customer, returnTo, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  function translateError(err: unknown): string {
    const codeKey = err instanceof ApiError ? err.code : "UNKNOWN";
    const table = t.login.errors as Record<string, string>;
    if (table[codeKey]) return table[codeKey];
    if (err instanceof ApiError && err.status === 0) return t.common.networkError;
    return t.common.unknownError;
  }

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      if (method === "phone") {
        await api("auth/customer/otp/request", { method: "POST", body: { phone: phone.trim() } });
      } else {
        await api("auth/customer/email/otp/request", { method: "POST", body: { email: email.trim() } });
      }
      setStep("code");
      setCooldown(45);
    } catch (err) {
      setError(translateError(err));
    } finally {
      setBusy(false);
    }
  }

  function settle(result: CustomerLoginResult) {
    if ("challengeRequired" in result) {
      setChallengeId(result.challengeId);
      setCode("");
      setStep("challenge");
      return;
    }
    setCustomer(result.customer as CustomerDto);
    router.replace(returnTo);
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const body = method === "phone" ? { phone: phone.trim(), code, displayName: name.trim() || undefined } : { email: email.trim(), code, displayName: name.trim() || undefined };
      const path = method === "phone" ? "auth/customer/otp/verify" : "auth/customer/email/otp/verify";
      settle(await api<CustomerLoginResult>(path, { method: "POST", body }));
    } catch (err) {
      setError(translateError(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmChallenge() {
    if (!challengeId) return;
    setBusy(true);
    setError(null);
    try {
      const path = method === "email" ? "auth/customer/email/otp/adopt" : "auth/customer/link/confirm";
      settle(await api<CustomerLoginResult>(path, { method: "POST", body: { challengeId, code } }));
    } catch (err) {
      setError(translateError(err));
    } finally {
      setBusy(false);
    }
  }

  const destination = method === "phone" ? phone : email;
  const canSend = method === "phone" ? phone.replace(/\D/g, "").length >= 10 : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const errorBlock = (
    <AnimatePresence>
      {error ? (
        <motion.p key="err" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-[12px] bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );

  return (
    <div className="w-full">
      <h1 className="display-md">{t.login.title}</h1>
      <p className="mt-2 text-ink-muted">{t.login.lede}</p>

      <AnimatePresence mode="wait" initial={false}>
        {step === "form" ? (
          <motion.form
            key="form"
            className="mt-8 space-y-5"
            initial={reduce ? false : "hidden"}
            animate="show"
            exit={reduce ? undefined : { opacity: 0, x: -16, transition: { duration: 0.2 } }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            onSubmit={(e) => {
              e.preventDefault();
              if (canSend && !busy) void sendCode();
            }}
          >
            <motion.div variants={field} className="segmented w-full" role="tablist">
              {(["phone", "email"] as Method[]).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={method === m} onClick={() => { setMethod(m); setError(null); }} className="flex-1 text-center">
                  {m === "phone" ? t.login.phone : t.login.email}
                </button>
              ))}
            </motion.div>

            <motion.label variants={field} className="block">
              <span className="field-label">{method === "phone" ? t.login.phone : t.login.email}</span>
              {method === "phone" ? (
                <input className="field" type="tel" inputMode="tel" autoComplete="tel" placeholder={t.login.phonePlaceholder} value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
              ) : (
                <input className="field" type="email" inputMode="email" autoComplete="email" placeholder={t.login.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
              )}
            </motion.label>

            <motion.label variants={field} className="block">
              <span className="field-label">{t.login.nameOptional}</span>
              <input className="field" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </motion.label>

            {errorBlock}

            <motion.div variants={field}>
              <button type="submit" className="btn btn-primary btn-lg w-full" disabled={!canSend || busy}>
                {busy ? t.common.loading : t.login.sendCode}
              </button>
            </motion.div>

            <motion.div variants={field} className="flex items-center gap-3 pt-1 text-xs text-ink-faint">
              <span className="h-px flex-1 bg-line" />
              {t.login.or}
              <span className="h-px flex-1 bg-line" />
            </motion.div>
            <motion.div variants={field} className="grid grid-cols-2 gap-3">
              <button type="button" className="btn btn-glass" disabled={!googleReady} title={googleReady ? undefined : t.login.soon}>
                <GoogleLogo size={18} weight="bold" /> {t.login.google}{googleReady ? "" : ` · ${t.login.soon}`}
              </button>
              <button type="button" className="btn btn-glass" disabled={!metaReady} title={metaReady ? undefined : t.login.soon}>
                <FacebookLogo size={18} weight="bold" /> {t.login.meta}{metaReady ? "" : ` · ${t.login.soon}`}
              </button>
            </motion.div>
            <motion.p variants={field} className="text-xs leading-relaxed text-ink-faint">{t.login.consent} {t.login.poweredBy}</motion.p>
          </motion.form>
        ) : (
          <motion.form
            key="code"
            className="mt-8 space-y-5"
            initial={reduce ? false : "hidden"}
            animate="show"
            exit={reduce ? undefined : { opacity: 0, x: 16, transition: { duration: 0.2 } }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length === 6 && !busy) void (step === "challenge" ? confirmChallenge() : verify());
            }}
          >
            <motion.div variants={field}>
              <button type="button" onClick={() => { setStep("form"); setCode(""); setError(null); }} className="inline-flex items-center gap-2 text-sm text-ink-muted transition-colors hover:text-ink">
                <ArrowLeft size={16} weight="bold" /> {t.login.change}
              </button>
            </motion.div>
            <motion.p variants={field} className="text-ink-muted">
              {t.login.codeSentTo} <span className="font-medium text-ink">{destination}</span>
            </motion.p>
            <motion.label variants={field} className="block">
              <span className="field-label">{t.login.code}</span>
              <input
                className={clsx("field text-center text-[2rem] font-semibold tracking-[0.35em] tnum")}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                autoFocus
              />
            </motion.label>
            {errorBlock}
            <motion.div variants={field}>
              <button type="submit" className="btn btn-primary btn-lg w-full" disabled={code.length !== 6 || busy}>
                {busy ? t.common.loading : t.login.verify}
              </button>
            </motion.div>
            {step === "code" ? (
              <motion.div variants={field}>
                <button type="button" className="btn btn-quiet w-full" disabled={cooldown > 0 || busy} onClick={() => void sendCode()}>
                  {cooldown > 0 ? `${t.login.resendIn} ${cooldown}s` : t.login.resend}
                </button>
              </motion.div>
            ) : null}
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
