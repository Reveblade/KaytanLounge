"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { clsx } from "clsx";
import { ArrowLeft, ArrowRight, Trash, UploadSimple, LinkSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { MediaItem } from "@/lib/contract/api";

interface Props {
  label?: string;
  value: MediaItem[];
  onChange: (next: MediaItem[]) => void;
  /** Cloudinary folder / local subfolder. */
  folder?: string;
  /** Single-image mode (logo, portrait, cover). */
  single?: boolean;
}

/** Upload, paste a URL, reorder, remove. The first item is the cover everywhere. */
export function MediaManager({ label = "Media", value, onChange, folder = "uploads", single }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const added: MediaItem[] = [];
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      try {
        const item = await api<Omit<MediaItem, "id">>(`admin/media/upload?folder=${encodeURIComponent(folder)}`, { method: "POST", form });
        added.push({ ...item, id: crypto.randomUUID() });
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : `Upload failed: ${file.name}`);
      }
    }
    setBusy(false);
    if (added.length) onChange(single ? [added[0]] : [...value, ...added]);
    if (input.current) input.current.value = "";
  }

  function addUrl() {
    const trimmed = url.trim();
    if (!/^https?:\/\//.test(trimmed)) return;
    const kind = /\.(mp4|webm|mov)(\?|$)/i.test(trimmed) ? "VIDEO" : "IMAGE";
    const item: MediaItem = { id: crypto.randomUUID(), kind, url: trimmed, provider: "EXTERNAL" };
    onChange(single ? [item] : [...value, item]);
    setUrl("");
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex flex-wrap gap-2">
        {value.map((m, i) => (
          <div key={m.id} className={clsx("group relative overflow-hidden rounded-control border border-line bg-surface-2", single ? "h-40 w-56" : "h-28 w-40")}>
            {m.kind === "VIDEO" ? (
              <video src={m.url} className="h-full w-full object-cover" muted />
            ) : (
              <Image src={m.thumbnailUrl ?? m.url} alt="" fill sizes="160px" className="object-cover" unoptimized />
            )}
            {i === 0 && !single ? <span className="badge badge-accent absolute left-1.5 top-1.5">cover</span> : null}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex gap-0.5">
                {!single ? (
                  <>
                    <button type="button" className="rounded-control bg-black/40 p-1 text-white" onClick={() => move(i, -1)} aria-label="Move left"><ArrowLeft size={14} /></button>
                    <button type="button" className="rounded-control bg-black/40 p-1 text-white" onClick={() => move(i, 1)} aria-label="Move right"><ArrowRight size={14} /></button>
                  </>
                ) : null}
              </div>
              <button type="button" className="rounded-control bg-black/40 p-1 text-white" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove"><Trash size={14} /></button>
            </div>
          </div>
        ))}
        {!single || value.length === 0 ? (
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className={clsx("grid place-items-center rounded-control border border-dashed border-line-strong text-ink-muted hover:border-ink hover:text-ink", single ? "h-40 w-56" : "h-28 w-40")}>
            <span className="flex flex-col items-center gap-1 text-xs">
              <UploadSimple size={20} />
              {busy ? "Uploading" : "Upload"}
            </span>
          </button>
        ) : null}
      </div>
      <input ref={input} type="file" accept="image/*,video/mp4,video/webm" multiple={!single} className="hidden" onChange={(e) => void upload(e.target.files)} />
      <div className="mt-2 flex max-w-md gap-2">
        <input className="field" placeholder="https://… (paste an image or video URL)" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUrl())} />
        <button type="button" className="btn btn-secondary" onClick={addUrl}><LinkSimple size={16} /> Add</button>
      </div>
    </div>
  );
}
