"use client";

import { useI18n } from "@/lib/i18n/context";
import { Reveal } from "@/components/motion/reveal";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <main className="page-in ambient grid min-h-[100dvh] place-items-center px-6">
      <Reveal above>
        <div className="glass max-w-md rounded-panel p-10 text-center">
          <p className="display-md">{t.common.error}</p>
          <button type="button" onClick={reset} className="btn btn-primary mt-8">
            {t.common.retry}
          </button>
        </div>
      </Reveal>
    </main>
  );
}
