import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="ambient grid min-h-[100dvh] place-items-center px-6">
      <div className="glass w-full max-w-[420px] rounded-panel p-8 rise">
        <p className="inline-flex items-center gap-2.5 text-[1.3rem] font-semibold tracking-[-0.03em]">
          <span className="inline-block h-3 w-3 rounded-pill bg-accent" style={{ boxShadow: "0 0 0 3px var(--accent-soft), 0 0 16px -2px var(--accent)" }} aria-hidden />
          Başka İstanbul Yok
        </p>
        <p className="eyebrow mt-2">Operations panel</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
