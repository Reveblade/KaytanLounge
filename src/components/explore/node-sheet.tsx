"use client";

import { useEffect } from "react";
import { clsx } from "clsx";
import { motion, useDragControls, useReducedMotion, type PanInfo } from "motion/react";
import { X } from "@phosphor-icons/react";
import type { AttractionDto, BusinessDto, RouteNodeKind } from "@/lib/contract/api";
import { useI18n } from "@/lib/i18n/context";
import { PlaceDetail } from "@/components/places/place-detail";

/**
 * The place behind a stop, in a glass sheet that slides over the map. Mount it inside
 * an AnimatePresence so the exit plays. Escape and the scrim close it.
 */
export function NodeSheet({ kind, place, wide, onClose }: { kind: RouteNodeKind; place: AttractionDto | BusinessDto; wide: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const handle = useDragControls();

  /** A flick down on the grip throws the sheet back to the map. */
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 140 || info.velocity.y > 800) onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <motion.button
        type="button"
        aria-label={t.common.close}
        onClick={onClose}
        className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
      />
      <motion.aside
        className={clsx("glass-strong absolute overflow-y-auto overscroll-contain", wide ? "inset-y-3 right-3 w-[580px] rounded-panel" : "inset-x-0 bottom-0 top-[6dvh] rounded-t-[28px]")}
        initial={reduce ? { opacity: 0 } : wide ? { opacity: 0, x: 48 } : { opacity: 0, y: 80 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={reduce ? { opacity: 0 } : wide ? { opacity: 0, x: 40, transition: { duration: 0.22 } } : { opacity: 0, y: 60, transition: { duration: 0.22 } }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        drag={wide ? false : "y"}
        dragControls={handle}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={onDragEnd}
      >
        <button type="button" onClick={onClose} className="btn btn-glass btn-icon absolute right-4 top-4 z-20" aria-label={t.common.close}>
          <X size={18} weight="bold" />
        </button>
        {!wide ? (
          /* The grip rides over the gallery, on a scrim so it reads against any photograph. */
          <div
            onPointerDown={(e) => handle.start(e)}
            className="sticky top-0 z-10 -mb-[37px] flex touch-none justify-center bg-gradient-to-b from-bg/55 to-transparent pb-5 pt-3"
            aria-hidden
          >
            <span className="grab-handle" />
          </div>
        ) : null}
        <PlaceDetail kind={kind} place={place} inSheet />
      </motion.aside>
    </div>
  );
}
