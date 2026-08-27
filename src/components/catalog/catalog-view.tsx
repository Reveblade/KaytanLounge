"use client";

import { useMemo, useState, type ReactNode } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { clsx } from "clsx";
import { Plus, Star } from "@phosphor-icons/react";
import { api, ApiError, qs } from "@/lib/api";
import type { MediaItem, Paginated, PublishStatus } from "@/lib/contract/api";
import { text } from "@/lib/format";
import { useAdmin } from "@/lib/session/context";
import { EmptyState, Pager, PageHeader, SearchBox, Sheet, Skeleton, StatusBadge } from "@/components/ui/primitives";

const PAGE_SIZE = 24;

const STATUSES: (PublishStatus | "")[] = ["", "PUBLISHED", "DRAFT", "ARCHIVED"];

/** The shape both attractions and businesses share on this screen. */
export interface CatalogItem {
  id: string;
  slug: string;
  name: { tr?: string; en?: string };
  district: string;
  media: MediaItem[];
  featured: boolean;
  status: PublishStatus;
}

/**
 * Attractions and partner venues are the same screen with different fields: a filtered
 * grid, and a full-height editor in a sheet. Only the editor differs, so it is passed in.
 */
export function CatalogView<T extends CatalogItem>({
  title,
  subtitle,
  endpoint,
  queryKey,
  facet,
  editor,
  blank,
  cardMeta,
}: {
  title: string;
  subtitle: string;
  endpoint: "admin/attractions" | "admin/businesses";
  queryKey: string;
  /** The type/category filter, rendered as a select. */
  facet: { param: string; label: string; options: readonly string[] };
  editor: (props: { value: T | null; onClose: () => void }) => ReactNode;
  blank: () => T;
  cardMeta: (item: T) => string;
}) {
  const { can } = useAdmin();
  const client = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<PublishStatus | "">("");
  const [facetValue, setFacetValue] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<T | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: [queryKey, q, status, facetValue, page],
    queryFn: () => api<Paginated<T>>(`${endpoint}${qs({ q: q || undefined, status: status || undefined, [facet.param]: facetValue || undefined, page, pageSize: PAGE_SIZE })}`),
    placeholderData: keepPreviousData,
  });

  const toggleFeatured = useMutation({
    mutationFn: (item: T) => api<T>(`${endpoint}/${item.id}`, { method: "PATCH", body: { featured: !item.featured } }),
    onSuccess: () => void client.invalidateQueries({ queryKey: [queryKey] }),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Could not update"),
  });

  const editable = can("CATALOG_WRITE");
  const items = useMemo(() => data?.items ?? [], [data]);

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search by name" />
            {editable ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(blank())}>
                <Plus size={15} weight="bold" /> New
              </button>
            ) : null}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <button key={s || "all"} type="button" className={clsx("btn btn-sm", status === s ? "btn-primary" : "btn-secondary")} onClick={() => { setStatus(s); setPage(1); }}>
              {s ? s.toLowerCase() : "All"}
            </button>
          ))}
        </div>
        <select className="field max-w-[200px]" value={facetValue} onChange={(e) => { setFacetValue(e.target.value); setPage(1); }}>
          <option value="">{facet.label}</option>
          {facet.options.map((option) => (
            <option key={option} value={option}>
              {option.replace(/_/g, " ").toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      {isLoading && !data ? (
        <Skeleton rows={8} />
      ) : error || !data ? (
        <EmptyState title={`${title} unavailable`} body="The API did not answer." />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing here" body={q ? `Nothing matches “${q}”.` : "Add the first entry."} action={editable ? <button type="button" className="btn btn-primary" onClick={() => setEditing(blank())}>Add one</button> : undefined} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <article key={item.id} className="panel panel-lift overflow-hidden">
              <button type="button" className="block w-full text-left" onClick={() => editable && setEditing(item)}>
                <span className="relative block aspect-[4/3] w-full overflow-hidden bg-surface-2">
                  {item.media[0]?.url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.media[0].thumbnailUrl ?? item.media[0].url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : null}
                  <span className="badge-on-media absolute left-2.5 top-2.5">
                    <StatusBadge value={item.status} />
                  </span>
                </span>
                <span className="block p-4">
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold tracking-[-0.014em]">{text(item.name)}</span>
                      <span className="block truncate text-xs text-ink-faint">{item.district}</span>
                    </span>
                  </span>
                  <span className="mt-2 block truncate text-xs text-ink-muted">{cardMeta(item)}</span>
                </span>
              </button>
              {editable ? (
                <div className="flex items-center justify-between border-t border-line px-3 py-2">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(item)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className={clsx("btn btn-ghost btn-icon btn-sm", item.featured && "text-accent")}
                    aria-label={item.featured ? "Remove from featured" : "Feature"}
                    title={item.featured ? "Featured" : "Not featured"}
                    onClick={() => toggleFeatured.mutate(item)}
                  >
                    <Star size={15} weight={item.featured ? "fill" : "regular"} />
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {data ? <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} /> : null}

      <Sheet open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? text(editing.name) || "Edit" : "New entry"} wide>
        {editing ? editor({ value: editing, onClose: () => setEditing(null) }) : null}
      </Sheet>
    </>
  );
}
