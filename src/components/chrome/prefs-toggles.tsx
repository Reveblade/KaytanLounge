"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CaretDown, Check, Moon, SunDim, Translate } from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n/context";
import { SUPPORTED_LOCALES, type UiLocale } from "@/lib/i18n/dictionaries";

type Theme = "dark" | "light";

const ThemeContext = createContext<{ theme: Theme; setTheme: (next: Theme) => void } | null>(null);

export function useTheme(): Theme {
  return useContext(ThemeContext)?.theme ?? "dark";
}

/** Same value the server wrote on <html data-theme>. Shared so every toggle hydrates alike. */
export function ThemeProvider({ initial, children }: { initial: Theme; children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initial);
  const setTheme = useCallback((next: Theme) => {
    document.documentElement.dataset.theme = next;
    setThemeState(next);
    void fetch("/api/prefs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ theme: next }) });
    window.dispatchEvent(new CustomEvent("biy-theme", { detail: next }));
  }, []);
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

/**
 * Language and theme, side by side. The language is a dropdown rather than a toggle so
 * the list can grow. Both persist as cookies so the server renders the right thing next time.
 */
export function PrefsToggles() {
  const { locale, setLocale, t } = useI18n();
  const prefs = useContext(ThemeContext);
  if (!prefs) throw new Error("PrefsToggles must be used inside ThemeProvider");
  const { theme, setTheme } = prefs;

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <div className="flex items-center gap-1">
      <LanguageMenu locale={locale} onSelect={setLocale} label={t.footer.language} names={t.locale} />
      <button type="button" onClick={toggleTheme} className="btn btn-quiet btn-icon" aria-label={theme === "dark" ? t.theme.light : t.theme.dark}>
        {theme === "dark" ? <SunDim size={20} weight="regular" /> : <Moon size={20} weight="regular" />}
      </button>
    </div>
  );
}

function LanguageMenu({ locale, onSelect, label, names }: { locale: UiLocale; onSelect: (code: UiLocale) => void; label: string; names: Record<UiLocale, string> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className={clsx("btn btn-quiet btn-sm gap-1.5 !px-2.5", open && "bg-ink/8 text-ink")}
      >
        <Translate size={17} weight="regular" />
        <span className="text-[0.78rem] font-semibold uppercase tracking-[0.08em]">{locale}</span>
        <CaretDown size={12} weight="bold" className={clsx("transition-transform duration-300", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.ul
            role="listbox"
            aria-label={label}
            initial={reduce ? false : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.14 } }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong menu absolute right-0 top-[calc(100%+10px)] z-50 !min-w-[190px] origin-top-right"
          >
            {SUPPORTED_LOCALES.map((code) => {
              const active = code === locale;
              return (
                <li key={code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setOpen(false);
                      if (!active) onSelect(code);
                    }}
                    className="menu-item"
                    data-active={active ? "true" : undefined}
                  >
                    <span className="menu-icon w-7 text-[0.72rem] font-semibold uppercase tracking-[0.08em]">{code}</span>
                    <span className="flex-1">{names[code]}</span>
                    {active ? <Check size={16} weight="bold" className="text-accent" /> : null}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
